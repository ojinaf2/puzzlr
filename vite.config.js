import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Nothing custom needed: everything in public/ (including flags/) is served at
// the site root, so public/flags/us.svg is available at /flags/us.svg.
export default defineConfig({
  plugins: [react()],
});
