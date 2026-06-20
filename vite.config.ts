import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname (required for Vite config with "type": "module")
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  base: '/',
  plugins: [tailwindcss()],

  resolve: {
    alias: {
      // @/src alias for clean imports: import { Profile } from '@/lib/types'
      '@': path.resolve(__dirname, 'src'),
    },
  },

  build: {
    // Modern target matching our TS config and supported browsers
    target: 'es2022',
    // Production minification — use default (Rolldown/Oxc in Vite 8) for compatibility; 'esbuild' would require explicit esbuild dep
    minify: true,
    // Generate .map files only in dev; disable in prod for smaller deploys
    sourcemap: process.env.NODE_ENV === 'development',
    // Warn on large chunks early
    chunkSizeWarningLimit: 600,
    // CSS code splitting + advanced optimizations
    cssCodeSplit: true,
    cssMinify: true,
    rollupOptions: {
      output: {
        // Manual chunking via function (required in Vite 8 / Rollup 4+ for strict mode)
        manualChunks(id) {
          if (id.includes('chart.js')) return 'chart';
          if (id.includes('canvas-confetti')) return 'confetti';
          if (id.includes('/src/timer/')) return 'timer';
          return undefined;
        },
        // Consistent file naming for long-term caching
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },

  // Dev server tuned for premium DX
  server: {
    port: 5173,
    open: true,
    // Allow access from local network for testing on mobile
    host: true,
  },

  // Preview server matches production behavior
  preview: {
    port: 4173,
    host: true,
  },

  // Optimize deps for faster cold starts
  optimizeDeps: {
    include: ['chart.js', 'canvas-confetti', '@supabase/supabase-js'],
  },
});
