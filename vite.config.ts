import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        player: resolve(import.meta.dirname, 'index.html'),
        screen: resolve(import.meta.dirname, 'screen/index.html'),
        admin: resolve(import.meta.dirname, 'admin/index.html'),
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
