PUZZLR — how to use these files
================================

You have two things here:
  1. src/Puzzlr.jsx      -> the game code (already points flags at /flags/)
  2. public/flags/*.svg  -> 100 flag images, bundled so they load from YOUR site

WHY: External flag CDNs are blocked inside Claude's artifact preview, so the
flags looked broken there. Bundling them means they work everywhere — preview,
local dev, and once deployed — with no outside dependency.

SETUP (Vite + React project):
  1. Put Puzzlr.jsx in your project's src/ folder.
  2. Put the whole "flags" folder inside your project's public/ folder,
     so the path is:  public/flags/us.svg , public/flags/et.svg , etc.
  3. In src/App.jsx (or main.jsx) import and render it:
         import App from './Puzzlr.jsx'
  4. npm run dev  to test locally, or push to Vercel/Netlify to deploy.

Vite automatically serves anything in public/ at the site root, so
public/flags/us.svg becomes  yoursite.com/flags/us.svg  — which is exactly
what the code requests. Nothing else to configure.
