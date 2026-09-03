import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    host: true,

    allowedHosts: ['growl-pumice-phoney.ngrok-free.dev', 'bondless-impart-lustiness.ngrok-free.dev'],

    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      }
    }
  }
});