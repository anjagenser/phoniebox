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
// Cover-art lookups are best-effort background work fired in bursts (one per card
// / per folder row). Cap how many run at once so at least (MAX-LOW) slots stay
// free for interactive/critical calls (app settings, saving a card, listings),
// which must never be starved behind a cover flood.
const LOW_MAX_CONCURRENT = 3;
const LOW_PRIORITY = new Set([
  'getFolderCoverArt',
  'getFolderCovers',
  'getSingleCoverArt',
  'getAlbumCoverArt',
  'getUriDetails',
  'getUriName',
]);

let active = 0;
let activeLow = 0;
const highQueue = [];
const lowQueue = [];

const run = (item, isLow) => {
  active += 1;
  if (isLow) activeLow += 1;
  // The socket timeout only starts once the call actually runs (here), not while
  // it waits in the queue.
  item.fn().then(item.resolve, item.reject).finally(() => {
    active -= 1;
    if (isLow) activeLow -= 1;
    pump();
  });
};

const pump = () => {
  while (active < MAX_CONCURRENT && highQueue.length) {
    run(highQueue.shift(), false);
  }
  while (active < MAX_CONCURRENT && activeLow < LOW_MAX_CONCURRENT && lowQueue.length) {
    run(lowQueue.shift(), true);
  }
};

const schedule = (fn, isLow) =>
  new Promise((resolve, reject) => {
    (isLow ? lowQueue : highQueue).push({ fn, resolve, reject });
    pump();
  });

const request = async (command, kwargs = {}) => {
  try {
    if (!(command in commands)) {
      throw new Error(`'${command}' does not exist in command object`);
    }

    const { _package, plugin, method = null } = commands[command];

    // Send request (throttled through the concurrency limiter, cover art last)
    const result = await schedule(
      () => socketRequest(_package, plugin, method, kwargs),
      LOW_PRIORITY.has(command),
    );
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
