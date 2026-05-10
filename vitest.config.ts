import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,pbt}.?(c|m)[jt]s?(x)'],
    exclude: ['tests/e2e/**', 'node_modules/**', '.next/**'],
    coverage: {
      enabled: false,
      provider: 'v8',
    },
  },
});
