import { Analytics } from '@vercel/analytics/react';
import Puzzlr from './Puzzlr.jsx';

/* `/react`, not `/next` — Vercel's dashboard defaults its snippet to Next.js
   and this is a Vite app. The wrong import fails to build. Analytics is
   cookieless and sends nothing in development. */
export default function App() {
  return (
    <>
      <Puzzlr />
      <Analytics />
    </>
  );
}
