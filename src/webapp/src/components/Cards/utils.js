import {
  isEmpty,
  has,
} from 'ramda';

import commands from '../../commands';
import { JUKEBOX_ACTIONS_MAP } from '../../config';

const mapValuesToKeys = (command, args) => {
  const argKeys = getCommandArgKeys(command);
  const values = argKeys.reduce((prev, arg, pos) => (
    {
      ...prev,
      [arg]: args[pos],
    }
    ), {});

  return values;
};

const getActionAndCommand = (actionData) => {
  const { action, command: { name } = {} } = actionData;

  return { action, command: name };
}

const findActionByCommand = (command) => {
  const action = Object.keys(JUKEBOX_ACTIONS_MAP).find((action) => {
    return has(command)(JUKEBOX_ACTIONS_MAP[action].commands)
  });

  return action;
};

const getCommandArgKeys = (command) => {
  const { [command] : { argKeys = [] } = {} } = commands;

  return argKeys;
};

const buildActionData = (action, command = {}, args = {}) => {
  const data = {
    action,
    command,
  };

  if (!isEmpty(command)) {
    const _args = Array.isArray(args)
      ? mapValuesToKeys(command, args)
      : args;

    data.command = {
      name: command,
      args: _args,
    }
  }

  return data;
};

const getArgsValues = (actionData) => {
  const { command } = getActionAndCommand(actionData);
  const argKeys = getCommandArgKeys(command);

  return argKeys.map(
    key => actionData.command.args[key]
  );
};

// Build a kwargs object for an RPC command from an ordered args array,
// using the command's declared argKeys (e.g. play_album -> {albumartist, album}).
const buildCommandKwargs = (command, args = []) => {
  const argKeys = getCommandArgKeys(command);
  return argKeys.reduce(
    (acc, key, index) => ({ ...acc, [key]: args[index] }),
    {}
  );
};

const normalizeArgs = (args) =>
  (args || []).map((arg) => (arg === null || arg === undefined ? '' : String(arg)));

const argsAreEqual = (a, b) => {
  const na = normalizeArgs(a);
  const nb = normalizeArgs(b);
  return na.length === nb.length && na.every((value, index) => value === nb[index]);
};

// Commands whose first argument is a shareable "value" (a Spotify/stream URI or
// a music folder) that usually should not be assigned to more than one card.
const VALUE_BEARING_COMMANDS = ['play_uri', 'play_folder', 'play_album', 'play_single'];

// Collect warnings that should be confirmed before a card is (re)assigned:
//  - 'reassign': this very card already carries a different action (Feature 4)
//  - 'duplicate': the exact same value is already assigned to other card(s) (Feature 5)
const getAssignmentWarnings = ({ cardId, cardsList = {}, command, args }) => {
  const warnings = [];
  const id = cardId ? cardId.toString() : cardId;
  const existing = cardsList[id];

  if (existing && existing.from_alias) {
    const changed =
      existing.from_alias !== command ||
      !argsAreEqual(existing.action && existing.action.args, args);
    if (changed) {
      warnings.push({ type: 'reassign', current: existing });
    }
  }

  if (command && VALUE_BEARING_COMMANDS.includes(command)) {
    const duplicates = Object.keys(cardsList).filter((otherId) =>
      otherId !== id &&
      cardsList[otherId].from_alias === command &&
      argsAreEqual(cardsList[otherId].action && cardsList[otherId].action.args, args)
    );
    if (duplicates.length) {
      warnings.push({ type: 'duplicate', cardIds: duplicates });
    }
  }

  return warnings;
};

export {
  argsAreEqual,
  buildActionData,
  buildCommandKwargs,
  findActionByCommand,
  getActionAndCommand,
  getArgsValues,
  getAssignmentWarnings,
};
