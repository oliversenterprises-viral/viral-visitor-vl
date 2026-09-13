import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
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
    tailwindcss(),
    {
      name: 'preload-extracted-css',
      transformIndexHtml(html) {
        return html.replace(
          /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
          '<link rel="preload" as="style" href="$1">\n    <link rel="stylesheet" crossorigin href="$1">',
        );
      },
    },
    {
      name: 'admin-pretty-url',
      closeBundle() {
        mkdirSync(resolve(__dirname, 'dist/admin'), { recursive: true });
        copyFileSync(resolve(__dirname, 'dist/admin.html'), resolve(__dirname, 'dist/admin/index.html'));
      },
    },
  ],
});
