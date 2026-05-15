import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// Build stamp injected as a global so the Navbar can render the deployed
// version at a glance — handy for telling whether a fresh build actually
// reached the browser through CDN / Coolify / Render caches.
const BUILD_STAMP = new Date().toISOString().replace(/\.\d+Z$/, "Z");

export default defineConfig({
  define: {
    __TASKFLOW_BUILD__: JSON.stringify(BUILD_STAMP),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Used by the imported marketing pages (`@/src/lib/utils`, etc.) so they
      // resolve into `<frontend>/src/...` without needing to be rewritten.
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    historyApiFallback: true,
  },
  preview: {
    historyApiFallback: true,
  },
  base: '/',
});
