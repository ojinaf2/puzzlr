import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import adminWriter from './scripts/admin-writer.js';

// Nothing custom needed for assets: everything in public/ (including flags/) is
// served at the site root, so public/flags/us.svg is available at /flags/us.svg.
//
// adminWriter is the editor's write-back endpoint. It declares `apply: 'serve'`,
// so it exists only while the dev server is running and is absent from every
// production build.
export default defineConfig({
  plugins: [react(), adminWriter()],
});
