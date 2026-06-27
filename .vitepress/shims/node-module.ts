export function createRequire() {
  return () => {
    throw new Error('node:module createRequire is unavailable in the browser bundle.');
  };
}

export default { createRequire };
