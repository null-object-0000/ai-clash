/**
 * Vite configuration for @ai-clash/inject package
 * Supports:
 * - serve mode: Development server with HMR for testing
 * - build mode: Production builds (ESM, UMD, Standalone)
 */

import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Serve mode: Development server with test pages
  if (mode === 'serve') {
    return {
      root: resolve(__dirname, 'test'),
      publicDir: resolve(__dirname, 'dist'),
      server: {
        port: 5173,
        open: true,
        cors: true,
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify('development'),
      },
    };
  }

  // Build mode: Production builds
  const isStandalone = mode === 'standalone';

  return {
    build: {
      emptyOutDir: !isStandalone, // Only clean on first build
      lib: isStandalone ? {
        entry: resolve(__dirname, 'src/standalone/entry.ts'),
        name: 'AIClashInject',
        fileName: () => 'standalone.js',
        formats: ['iife'],
      } : {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'AIClashInject',
        fileName: (format) => `index.${format === 'es' ? 'esm' : 'umd'}.js`,
        formats: ['es', 'umd'],
      },
      outDir: resolve(__dirname, 'dist'),
      sourcemap: true,
      minify: false,
      rollupOptions: {
        external: isStandalone ? [] : ['@types/chrome'],
        output: isStandalone ? {} : {
          globals: {
            '@types/chrome': 'chrome',
          },
        },
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  };
});
