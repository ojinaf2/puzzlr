import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import Puzzlr from './Puzzlr.jsx';

/* Vercel's two measurement scripts, mounted once for the whole site.

   Both come from their `/react` entry point, not `/next`. The dashboard hands
   out a Next.js snippet by default and this is a Vite app, so the suggested
   import does not build at all. The Speed Insights page also offers a bare
   `injectSpeedInsights()` call under "Other"; the component does the same job
   and keeps the two mounted the same way.

   Neither sets a cookie, and neither sends anything in development. */
export default function App() {
  return (
    <>
      <Puzzlr />
      <Analytics />
      <SpeedInsights />
    </>
  );
}
