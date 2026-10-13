import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, Vite forwards /api requests to the Express backend, so the
// browser only ever talks to one origin (no CORS issues). In Docker, nginx
// does the same job (see nginx.conf).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  // Vitest settings. Tests run in jsdom, a simulated browser, so components
  // can be rendered and clicked without opening a real one.
  // Coverage thresholds make `npm run test:coverage` FAIL if coverage drops.
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.{js,jsx}'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/main.jsx'],
      reporter: ['text', 'lcov', 'json-summary'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
