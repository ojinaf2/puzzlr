import { useState, useEffect, lazy, Suspense } from 'react';
import { C, SHADOW, GLOSS, GLOSS_SOFT, GLASS, GLOW, LOGO, PILL, grad, paleGrad, tint, shade, EASE, themeCss, typeCss, useTheme, toggleTheme, THEMES } from './shared/theme.js';
import { Btn, SoundToggle } from './shared/ui.jsx';
import { useRoute, buildPath } from './shared/router.js';
import { GAMES } from './games/index.jsx';
import { CONTENT, fill } from './content.js';

/* ============================= HUB SHELL =============================
   Header, landing page, routing and footer. Contains no game logic — every
   game lives in src/games/ and is registered in src/games/index.jsx. */
const HUB_NAME = "Puzzlr";

/* Loaded lazily and only in development. In a production build the condition
   folds to a literal false, so the dynamic import is unreachable and Rollup
   drops the editor and everything it imports out of the bundle entirely. */
const AdminPanel = import.meta.env.DEV
  ? lazy(() => import('./admin/AdminPanel.jsx'))
  : null;


/* Sun and moon share one button. The icons cross-fade and counter-rotate so
   the switch reads as a single object turning over rather than two separate
   glyphs swapping, which is the detail that makes it feel considered. */
function ThemeToggle() {
  const dark = useTheme() === "dark";
  const face = { position: "absolute", inset: 0, display: "grid", placeItems: "center", transition: `opacity .3s ${EASE}, transform .45s ${EASE}` };
  return (
    <button onClick={toggleTheme} className="btn3d"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      style={{
        width: 38, height: 38, borderRadius: 12, border: "none", padding: 0, flexShrink: 0,
        cursor: "pointer", color: C.text, background: paleGrad(C.panel2),
        boxShadow: `${GLOSS_SOFT}, ${SHADOW.sm}`, position: "relative", overflow: "hidden",
      }}>
      <span style={{ ...face, opacity: dark ? 0 : 1, transform: dark ? "rotate(-90deg) scale(.4)" : "none" }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4.2" />
          <g opacity=".9"><path d="M12 2.4v2.2M12 19.4v2.2M4.2 12H2M22 12h-2.2M6.1 6.1 4.6 4.6M19.4 19.4l-1.5-1.5M17.9 6.1l1.5-1.5M4.6 19.4l1.5-1.5" /></g>
        </svg>
      </span>
      <span style={{ ...face, opacity: dark ? 1 : 0, transform: dark ? "none" : "rotate(90deg) scale(.4)" }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a6.9 6.9 0 0 0 11.1 11.1Z" />
        </svg>
      </span>
    </button>
  );
}

/* A real link, so cards can be opened in a new tab, copied or shared. Plain
   left-clicks are intercepted and handled by the router instead. */
function GameCard({ game, onClick }) {
  const [hover, setHover] = useState(false);
  const handle = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onClick();
  };
  return (
    /* No outline. The card is separated from the page by light and shadow
       instead, and on hover it lifts and picks up a wash of its own accent —
       which does the job a border was doing, without the hard edge. */
    <a href={buildPath(game.id)} onClick={handle} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="btn3d-lift"
      style={{
        background: paleGrad(C.panel), border: "none", borderRadius: 20,
        padding: "22px 20px", cursor: "pointer", textAlign: "left",
        display: "flex", flexDirection: "column", gap: 14,
        transition: `transform .28s ${EASE}, box-shadow .28s ${EASE}`,
        transform: hover ? "translateY(-6px)" : "none",
        boxShadow: hover
          ? `${GLOSS_SOFT}, ${SHADOW.lg}, 0 20px 44px ${shade(game.accent, -.1)}2e`
          : `${GLOSS_SOFT}, ${SHADOW.md}`,
        color: C.text, fontFamily: "inherit", textDecoration: "none",
      }}>
      <div style={{
        width: 58, height: 58, borderRadius: 16, background: tint(game.accent),
        display: "grid", placeItems: "center",
        boxShadow: `${GLOSS}, ${SHADOW.sm}, 0 6px 14px ${shade(game.accent, -.05)}22`,
        transition: `transform .28s ${EASE}`, transform: hover ? "scale(1.06)" : "none",
      }}>
        <svg viewBox="0 0 52 52" width="42" height="42">{game.icon}</svg>
      </div>
      <div>
        {/* Name only. The one-line taglines under each name were saying
            nothing the icon and the name had not already said. */}
        <div style={{ fontSize: "1.1875rem", fontWeight: 800, letterSpacing: "-.01em" }}>{game.name}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2, gap: 8 }}>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.75rem", color: C.dim, background: PILL, padding: "3px 10px", borderRadius: 20, boxShadow: GLOSS_SOFT }}>{game.players}</span>
          {game.daily && (
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#fff", background: grad(game.accent), padding: "3px 10px", borderRadius: 20, boxShadow: `${GLOSS}, ${SHADOW.sm}` }}>Daily</span>
          )}
        </span>
        <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: game.accent, whiteSpace: "nowrap", transition: `transform .28s ${EASE}`, transform: hover ? "translateX(3px)" : "none" }}>{CONTENT.hub.cardCta}</span>
      </div>
    </a>
  );
}

function Landing({ onPick }) {
  return (
    <div style={{ width: "100%", maxWidth: 860, margin: "0 auto", padding: "0 20px", position: "relative" }}>
      {/* A warm bloom behind the headline, so the page does not start on flat
          white. Pointer-events off — it is decoration and must never swallow
          a click meant for a card. */}
      <div aria-hidden style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: "min(620px, 96%)", height: 340, pointerEvents: "none", background: GLOW, opacity: .75, zIndex: 0 }} />
      <section style={{ textAlign: "center", padding: "48px 0 40px", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: "0.8125rem", letterSpacing: "0.22em", textTransform: "uppercase", color: C.accent2, fontWeight: 700, marginBottom: 14 }}>{CONTENT.hub.eyebrow}</div>
        <h1 className="grad-text" style={{ fontFamily: "var(--font-head)", fontSize: "clamp(2.375rem, 7vw, 3.875rem)", fontWeight: 700, lineHeight: 1.05, margin: "0 0 16px", letterSpacing: "-.01em", background: `linear-gradient(170deg, ${C.text} 30%, ${C.accent2})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          {CONTENT.hub.headlineTop}<br />{CONTENT.hub.headlineBottom}
        </h1>
      </section>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, paddingBottom: 60 }}>
        {GAMES.map((g) => <GameCard key={g.id} game={g} onClick={() => onPick(g.id)} />)}
      </section>
    </div>
  );
}

/* ============================= METADATA =============================
   The app never reloads, so these tags have to be rewritten on navigation.
   Until this existed every route served the landing page's title, which meant
   search engines saw one page and every shared link previewed identically. */
const SITE = "https://playpuzzlr.com";

const HOME_TITLE = `Puzzlr — browser puzzle games with friends, no sign-up`;
/* Deliberately no count, and deliberately not every game either. A number
   baked into a search result goes stale the moment a game is added — and so
   does an exhaustive list, because a reader (or a search engine) can just
   count it. Naming a few and trailing off with "and more" keeps the keywords
   and needs no edit per game. Kept in step with index.html, which is what a
   crawler sees before this ever runs. */
const HOME_DESC = `Free browser puzzle games — Wordl Unlimited, Minesweeper, Snake, Connect 4 and more. Play solo or with friends over an invite link. No sign-up, no downloads.`;

const setMeta = (selector, attr, value) => {
  const el = document.head.querySelector(selector);
  if (el) el.setAttribute(attr, value);
};

function useDocumentMeta(game, theme) {
  useEffect(() => {
    const title = game ? `${game.name} | Puzzlr` : HOME_TITLE;
    const desc = game ? game.blurb : HOME_DESC;
    /* Deliberately without the room code: invite links are private and
       transient, and every room for a game is the same page to a crawler. */
    const url = SITE + buildPath(game ? game.id : null);
    document.title = title;
    setMeta('meta[name="description"]', "content", desc);
    setMeta('meta[property="og:title"]', "content", title);
    setMeta('meta[property="og:description"]', "content", desc);
    setMeta('meta[property="og:url"]', "content", url);
    setMeta('meta[name="twitter:title"]', "content", title);
    setMeta('meta[name="twitter:description"]', "content", desc);
    setMeta('link[rel="canonical"]', "href", url);
  }, [game]);

  // Tints the browser chrome on a phone, so it does not stay cream in dark mode.
  useEffect(() => {
    setMeta('meta[name="theme-color"]', "content",
      theme === "dark" ? THEMES.dark.bg : THEMES.light.accent);
  }, [theme]);
}

/* ============================= ROOT APP ============================= */
export default function App() {
  const [{ gameId, roomCode, mode }, navigate] = useRoute();
  const game = GAMES.find((g) => g.id === gameId);
  const theme = useTheme();
  useDocumentMeta(game, theme);

  /* `import.meta.env.DEV` is replaced with a literal at build time, so in a
     production bundle this is `false && …` — the branch is dead code and the
     editor is never pulled in. Verified by grepping the built bundle. */
  const adminRoute = import.meta.env.DEV && gameId === "admin";

  // An unknown game in the URL falls back to the landing page rather than a blank screen.
  useEffect(() => {
    if (gameId && !game && !adminRoute) navigate(null, null, { replace: true });
  }, [gameId, game, adminRoute, navigate]);

  useEffect(() => { window.scrollTo(0, 0); }, [gameId, roomCode, mode]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "var(--font-body)" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;700;800&display=swap');
        ${themeCss()}
        ${typeCss()}
        * { box-sizing: border-box; }
        /* Recolouring every surface at once looks broken if it happens
           instantly. Backgrounds and borders cross-fade; text does not, because
           fading text through a mid-tone makes it briefly unreadable. */
        body, header, footer, main a, main button { transition: background-color .3s ${EASE}, border-color .3s ${EASE}; }
        @keyframes pop { 0%{transform:scale(.8)} 50%{transform:scale(1.12)} 100%{transform:scale(1)} }
        @keyframes flip { 0%{transform:rotateX(0)} 50%{transform:rotateX(90deg)} 100%{transform:rotateX(0)} }
        @keyframes shk { 10%,90%{transform:translateX(-2px)} 20%,80%{transform:translateX(4px)} 30%,50%,70%{transform:translateX(-7px)} 40%,60%{transform:translateX(7px)} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 30%{transform:translateY(-14px)} 50%{transform:translateY(4px)} }
        .tile-fill { animation: pop .12s ease; } .tile-flip { animation: flip .5s ease forwards; }
        .row-shake { animation: shk .5s; } .win-bounce { animation: bounce .5s ease; }
        button:focus-visible, a:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 3px; border-radius: 12px; }
        input[type=range]:focus-visible { outline: 2px solid ${C.accent}; }

        /* The press. :active rather than JS handlers, because it is the only
           version that behaves the same for a finger as for a mouse — and it
           cannot get stuck "held" when a pointer leaves mid-click. */
        .btn3d { will-change: transform; -webkit-tap-highlight-color: transparent; }
        .btn3d:hover { transform: translateY(-1px); filter: brightness(1.04); }
        .btn3d:active { transform: translateY(1px) scale(.98); filter: brightness(.95); }
        /* Tiles and cards set their own hover transform inline, so only the
           pressed state is claimed here. */
        .tile3d:active, .btn3d-lift:active { transform: translateY(1px) scale(.99) !important; }
        /* On a narrow phone the wordmark and the button label are the first
           things to go, so the game name, the back arrow and the theme toggle
           all still fit on one line. */
        @media (max-width: 460px) { .hdr-word { display: none } }
        .btn-flat { -webkit-tap-highlight-color: transparent; transition: background .18s ${EASE}, color .18s ${EASE}; }
        .btn-flat:hover { background: var(--wash); color: ${C.text}; }
        .btn-flat:active { background: var(--wash-strong); }

        @media (prefers-reduced-motion: reduce) {
          .tile-fill,.tile-flip,.row-shake,.win-bounce { animation: none !important; }
          .btn3d, .tile3d, .btn3d-lift { transition: none !important; }
          .btn3d:hover, .btn3d:active, .tile3d:active, .btn3d-lift:active { transform: none !important; }
        }
        /* Gradient-filled text is painted through a transparent colour, which
           Windows High Contrast throws away — leaving an invisible headline.
           Hand the colour back when the OS is overriding our palette. */
        @media (forced-colors: active) {
          .grad-text { background: none !important; color: CanvasText !important;
            -webkit-text-fill-color: CanvasText !important; }
        }
      `}</style>

      {/* Frosted glass rather than a hard rule: the blur separates the header
          from whatever scrolls under it without drawing a line across the page. */}
      <header style={{ position: "sticky", top: 0, background: GLASS, backdropFilter: "blur(18px) saturate(180%)", WebkitBackdropFilter: "blur(18px) saturate(180%)", boxShadow: SHADOW.sm, zIndex: 10 }}>
        {/* `minWidth: 0` matters: without it the flex children refuse to shrink
            below their content, and on a narrow phone the row silently pushes
            the theme toggle off the right edge of the page. */}
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <a href="/" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); navigate(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 9, color: C.text, fontFamily: "inherit", padding: 0, textDecoration: "none", flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: LOGO, display: "grid", placeItems: "center", fontWeight: 900, fontSize: "1.0625rem", color: "#fff", boxShadow: `${GLOSS}, ${SHADOW.sm}`, textShadow: "0 1px 1px rgba(74,53,36,.3)" }}>P</div>
            <span className="hdr-word" style={{ fontFamily: "var(--font-head)", fontSize: "1.4375rem", fontWeight: 700 }}>{HUB_NAME}</span>
          </a>
          {game && <>
            <span className="hdr-word" style={{ color: C.line }}>/</span>
            {/* Truncates rather than pushing the controls off screen. */}
            <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: game.accent, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{game.name}</span>
          </>}
          {roomCode && <span style={{ fontSize: "0.75rem", fontWeight: 700, color: C.dim, background: C.panel, padding: "3px 9px", borderRadius: 20, letterSpacing: ".08em", flexShrink: 0 }}>{roomCode}</span>}
          <div style={{ flex: 1, minWidth: 8 }} />
          {game && <Btn variant="subtle" onClick={() => navigate(null)} style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
            <span aria-hidden>←</span><span className="hdr-word"> {CONTENT.hub.backToGames}</span>
          </Btn>}
          <SoundToggle />
          <ThemeToggle />
        </div>
      </header>

      <main style={{ padding: game ? "28px 20px 60px" : 0 }}>
        {adminRoute ? (
          <Suspense fallback={null}>
            <AdminPanel onClose={() => navigate(null)} />
          </Suspense>
        ) : !game ? <Landing onPick={(id) => navigate(id)} /> : (
          <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* roomCode and navigate are passed down for the online modes; the
                local-only games simply ignore them. */}
            <game.Comp key={game.id} roomCode={roomCode} mode={mode} navigate={navigate} />
          </div>
        )}
      </main>

      <footer style={{ borderTop: `1px solid ${C.line}`, padding: "26px 20px", textAlign: "center", color: C.dim, fontSize: "0.8125rem", background: `linear-gradient(180deg, transparent, ${C.panel})` }}>
        {fill(CONTENT.hub.footer, { name: HUB_NAME })}
      </footer>
    </div>
  );
}
