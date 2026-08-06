import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// The app imports the portable core straight from source (../core). No build step
// for the core — Vite transpiles the TS. This is what "screens wrap the brain" looks
// like in practice: swap this import for a native shell later, keep the core.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  resolve: {
    alias: { '@core': path.resolve(__dirname, '../core/index.ts') },
  },
  server: {
    port: 5173,
    fs: { allow: [path.resolve(__dirname, '..')] },
  },
});
