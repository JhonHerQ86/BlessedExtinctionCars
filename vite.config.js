import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps the build portable (can be opened from any sub-path).
export default defineConfig({
  plugins: [react()],
  base: './',
  // Unique per build: appended to asset URLs so browsers/CDN never reuse stale files.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
});
