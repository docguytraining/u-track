import { defineConfig } from 'vitest/config';
import path from 'node:path';

// App-layer unit tests. Kept separate from vite.config so the PWA plugin doesn't
// run under test; the @core alias is mirrored for tests that touch the core.
export default defineConfig({
  resolve: { alias: { '@core': path.resolve(__dirname, '../core/index.ts') } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
