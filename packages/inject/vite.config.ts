/**
 * Vite configuration for @ai-clash/inject package
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  const isStandalone = mode === 'standalone';

  return {
    build: {
      emptyOutDir: !isStandalone,
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
