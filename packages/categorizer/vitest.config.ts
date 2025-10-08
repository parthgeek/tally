import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      // Load env vars from root .env file
      envDir: resolve(__dirname, '../..'),
    },
  },
});