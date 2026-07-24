import { v4 as uuidv4 } from 'uuid';
import * as zmq from 'jszmq';

import {
  PUBSUB_ENDPOINT,
  REQRES_ENDPOINT,
  SUBSCRIPTIONS,
} from '../config';
import {
  decodeMessage,
  decodePubSubMessage,
  encodeMessage,
  preparePayload
} from './utils';

const socket_sub = new zmq.Sub();

SUBSCRIPTIONS.forEach(
  (topic) => socket_sub.subscribe(topic)
);

socket_sub.connect(PUBSUB_ENDPOINT);

const socketEvents = ({ setState, events = [] }) => {
  socket_sub.on('message', (_topic, _payload) => {
    const { topic, data, error } = decodePubSubMessage(_topic, _payload);

    if (events.includes(topic) && data) {
      setState(state => ({ ...state, [topic]: data }));
      if (topic !== 'playerstatus') {
        console.log(topic, data, events);
      }
    }

    if (error) {
      // TODO: Better error handling
      console.error(`[PubSub][${topic}]: ${error}`);
    }
  });
};

const initSockets = ({ setState, events }) => {
  socketEvents({ setState, events });
};

// Single persistent REQ socket with a priority FIFO queue: one outstanding request at a time, socket recreated on timeout.
const REQUEST_TIMEOUT_MS = 15000;

let reqSocket = null;
let current = null;
const highQueue = [];
const lowQueue = [];

const attachSocket = () => {
  const socket = new zmq.Req();

  socket.on('message', (msg) => {
    if (socket !== reqSocket || !current) return;

    let decoded;
    try {
      decoded = decodeMessage(msg);
    } catch (e) {
      return;
    }
    const { id, error, result } = decoded;
    const cur = current;

    if (error && error.message) {
      return settle(() => cur.reject(new Error(error.message)));
    }
    if (id && id === cur.id) {
      return settle(() => cur.resolve(result));
    }
    return settle(() => cur.reject(new Error('Received socket message ID does not match sender ID.')), true);
  });

  socket.onerror = (err) => {
    if (socket !== reqSocket) return;
    if (current) {
      const cur = current;
      settle(() => cur.reject(err), true);
    } else {
      recreateSocket();
    }
  };

  try {
    socket.connect(REQRES_ENDPOINT);
  } catch (e) {
    console.error(`WebSocket connection to '${REQRES_ENDPOINT}' failed: `, e);
  }
  return socket;
};

const ensureSocket = () => {
  if (!reqSocket) reqSocket = attachSocket();
  return reqSocket;
};

const recreateSocket = () => {
  const old = reqSocket;
  reqSocket = null;
  if (old) {
    try { old.close(); } catch (e) { /* already torn down */ }
  }
  reqSocket = attachSocket();
};

const settle = (fn, recreate = false) => {
  if (!current) return;
  const cur = current;
  current = null;
  if (cur.timer) clearTimeout(cur.timer);
  if (recreate) recreateSocket();
  try { fn(); } catch (e) { /* consumer callback error */ }
  pump();
};

const pump = () => {
  if (current) return;
  const next = highQueue.shift() || lowQueue.shift();
  if (!next) return;

  const id = uuidv4();
  current = {
    id,
    resolve: next.resolve,
    reject: next.reject,
    target: next.target,
    timer: null,
  };
  current.timer = setTimeout(() => {
    if (!current || current.id !== id) return;
    const cur = current;
    // Socket is stuck awaiting recv after a lost reply; recreate so the queue proceeds.
    settle(() => cur.reject(new Error(`Request '${cur.target}' timed out`)), true);
  }, REQUEST_TIMEOUT_MS);

  const socket = ensureSocket();
  const payload = preparePayload(id, next._package, next.plugin, next.method, next.kwargs);
  try {
    socket.send(encodeMessage(payload));
  } catch (e) {
    settle(() => next.reject(e), true);
  }
};

const socketRequest = (_package, plugin, method, kwargs, lowPriority = false) => (
  new Promise((resolve, reject) => {
    const target = `${_package}.${plugin}${method ? `.${method}` : ''}`;
    const item = { _package, plugin, method, kwargs, resolve, reject, target };
    (lowPriority ? lowQueue : highQueue).push(item);
    pump();
  })
);

export {
  initSockets,
  socketRequest,
};
