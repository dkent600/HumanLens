import { defineConfig } from 'vite';
import aurelia from '@aurelia/vite-plugin';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  server: {
    open: !process.env.CI,
    port: 9000,
    // Dev: forward API calls to the Fastify backend. In production one Fastify
    // process serves both the built UI and the API on the same origin (no proxy).
    proxy: {
      '/engagements': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  esbuild: {
    target: 'es2022'
  },
  plugins: [
    aurelia({
      useDev: true,
    }),
    tailwindcss(),
  ],
});
