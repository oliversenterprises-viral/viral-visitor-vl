import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5174,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
  plugins: [
    {
      name: 'admin-pretty-url',
      closeBundle() {
        mkdirSync(resolve(__dirname, 'dist/admin'), { recursive: true });
        copyFileSync(resolve(__dirname, 'dist/admin.html'), resolve(__dirname, 'dist/admin/index.html'));
      },
    },
  ],
});
