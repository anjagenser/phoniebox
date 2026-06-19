import { socketRequest } from "../sockets";
import commands from "../commands";
import { emit } from "../context/toast/events";

const request = async (command, kwargs = {}) => {
  try {
    if (!(command in commands)) {
      throw new Error(`'${command}' does not exist in command object`);
    }

    const { _package, plugin, method = null } = commands[command];

    // Send request
    const result = await socketRequest(_package, plugin, method, kwargs);
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
