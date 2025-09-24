import _fs from 'node:fs';

declare global {
  namespace globalThis {
      let fs: typeof _fs;
  }
}
