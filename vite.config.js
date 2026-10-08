import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' keeps the build portable (can be opened from any sub-path).
export default defineConfig({
  plugins: [react()],
  base: './',
});
