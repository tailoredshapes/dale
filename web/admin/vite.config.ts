import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  server: {
    port: 5175,
  },
  preview: {
    port: 5175,
  },
});
