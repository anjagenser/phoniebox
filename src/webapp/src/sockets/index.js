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

// Reject a request that never receives a reply, so callers don't hang forever.
const REQUEST_TIMEOUT_MS = 15000;

// Each request gets its own short-lived Req socket. The backend is a single ZMQ
// REP socket that fair-queues across peers, so concurrent requests each get their
// own socket and reply correctly. Using a local socket (instead of a shared
// property) avoids concurrent callers clobbering each other's connection, and the
// socket is always closed once the request settles (success, error or timeout).
const socketRequest = (_package, plugin, method, kwargs) => (
  new Promise((resolve, reject) => {
    const requestId = uuidv4();
    const server = new zmq.Req();

    let settled = false;
    let timer = null;

    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        server.close();
      } catch (e) {
        // ignore close errors on an already-torn-down socket
      }
      fn(value);
    };

    server.on('message', (msg) => {
      const { id, error, result } = decodeMessage(msg);

      if (error && error.message) {
        return settle(reject, error.message);
      }

      if (id && id === requestId) {
        return settle(resolve, result);
      }

      return settle(reject, 'Received socket message ID does not match sender ID.');
    });

    server.onerror = (err) => settle(reject, err);

    timer = setTimeout(() => {
      const target = `${_package}.${plugin}${method ? `.${method}` : ''}`;
      settle(reject, new Error(`Request '${target}' timed out`));
    }, REQUEST_TIMEOUT_MS);

    try {
      server.connect(REQRES_ENDPOINT);
    }
    catch (error) {
      console.error(`WebSocket connection to '${REQRES_ENDPOINT}' failed: `, error);
      return settle(reject, error);
    }

    const payload = preparePayload(
      requestId,
      _package,
      plugin,
      method,
      kwargs,
    );
    server.send(encodeMessage(payload));
  })
);

export {
  initSockets,
  socketRequest,
};
