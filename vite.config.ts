import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5180,
    proxy: {
      '/api': 'http://localhost:5179',
      '/mcp': 'http://localhost:5179',
    },
  },
  build: {
    outDir: 'dist',
  },
});
