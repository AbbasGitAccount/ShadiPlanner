import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rawTarget = process.env.VITE_API_URL || 'https://server-git-main-abbas1-54fd.vercel.app';
const proxyTarget = rawTarget.trim().replace(/\/api\/?$/, '');

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
