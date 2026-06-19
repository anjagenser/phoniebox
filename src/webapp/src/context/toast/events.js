// Singleton event bus for toast notifications.
// Plain JS (no React) so request.js and other utilities can emit without hooks.

const listeners = [];

export const subscribe = (fn) => {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
};

export const emit = (severity, message) => {
  listeners.forEach((fn) => fn({ severity, message }));
};
