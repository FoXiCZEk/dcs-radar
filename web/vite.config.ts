import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';

const cesiumPlugin = typeof (cesium as any) === 'function' ? (cesium as any) : (cesium as any).default;

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cesiumPlugin()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8080',
        ws: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 4000,
  },
});
