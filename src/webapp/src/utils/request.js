import { socketRequest } from "../sockets";
import commands from "../commands";
import { emit } from '../context/toast/events';

// Cover-art lookups are best-effort background work fired in bursts (one per card
// / per folder row). Mark them low priority so they queue behind interactive and
// critical calls (app settings, saving a card, listings) in the transport, which
// serialises all requests over a single persistent socket.
const LOW_PRIORITY = new Set([
  'getFolderCoverArt',
  'getFolderCovers',
  'getSingleCoverArt',
  'getAlbumCoverArt',
  'getUriDetails',
  'getUriName',
  'getSongByUrl',
]);

const request = async (command, kwargs = {}) => {
  try {
    if (!(command in commands)) {
      throw new Error(`'${command}' does not exist in command object`);
    }

    const { _package, plugin, method = null } = commands[command];

    // Send request through the serial, priority-aware transport
    const result = await socketRequest(_package, plugin, method, kwargs, LOW_PRIORITY.has(command));
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
