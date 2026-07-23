import { socketRequest } from "../sockets";
import commands from "../commands";
import { emit } from '../context/toast/events';

// The backend RPC server is single-threaded and every request opens its own
// short-lived WebSocket. When the UI fires many calls at once (e.g. resolving a
// cover for every card or every folder row), opening dozens of simultaneous
// WebSocket connections overwhelms the browser and the server, and requests
// stall until they hit the socket timeout. Cap how many run concurrently and
// queue the rest, so a burst just runs a little slower instead of timing out.
const MAX_CONCURRENT = 5;
let active = 0;
const pending = [];

const pump = () => {
  if (active >= MAX_CONCURRENT) return;
  const next = pending.shift();
  if (!next) return;
  active += 1;
  // The socket timeout only starts once the call actually runs (here), not while
  // it waits in the queue.
  next.fn().then(next.resolve, next.reject).finally(() => {
    active -= 1;
    pump();
  });
};

const schedule = (fn) =>
  new Promise((resolve, reject) => {
    pending.push({ fn, resolve, reject });
    pump();
  });

const request = async (command, kwargs = {}) => {
  try {
    if (!(command in commands)) {
      throw new Error(`'${command}' does not exist in command object`);
    }

    const { _package, plugin, method = null } = commands[command];

    // Send request (throttled through the concurrency limiter)
    const result = await schedule(() => socketRequest(_package, plugin, method, kwargs));
    return { result };
  }
  catch (error) {
    console.error(`${command}: `, error);
    const message = error?.message || String(error);
    emit('error', `${command}: ${message}`);
    return { error };
  };
};

export default request;
