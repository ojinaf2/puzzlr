import { useState, useEffect } from 'react';
import { C, SHADOW, GLOSS, GLOSS_SOFT, grad, paleGrad, tint, shade, EASE } from './shared/theme.js';
import { Btn } from './shared/ui.jsx';
import { useRoute, buildPath } from './shared/router.js';
import { GAMES } from './games/index.jsx';

/* ============================= HUB SHELL =============================
   Header, landing page, routing and footer. Contains no game logic — every
   game lives in src/games/ and is registered in src/games/index.jsx. */
const HUB_NAME = "Puzzlr";

// Landing copy counts the games itself, so adding one to the registry keeps it honest.
const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const countWord = (n) => NUMBER_WORDS[n] ?? String(n);

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
          ? `${GLOSS_SOFT}, 0 4px 10px rgba(74,53,36,.10), 0 20px 44px ${shade(game.accent, -.1)}2e`
          : `${GLOSS_SOFT}, ${SHADOW.md}`,
        color: C.text, fontFamily: "inherit", textDecoration: "none",
      }}>
      <div style={{
        width: 58, height: 58, borderRadius: 16, background: tint(game.accent),
        display: "grid", placeItems: "center",
        boxShadow: `${GLOSS}, 0 1px 2px rgba(74,53,36,.12), 0 6px 14px ${shade(game.accent, -.05)}22`,
        transition: `transform .28s ${EASE}`, transform: hover ? "scale(1.06)" : "none",
      }}>
        <svg viewBox="0 0 52 52" width="42" height="42">{game.icon}</svg>
      </div>
      <div>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 3, letterSpacing: "-.01em" }}>{game.name}</div>
        <div style={{ fontSize: 13.5, color: C.dim }}>{game.tag}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2, gap: 8 }}>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: C.dim, background: "rgba(255,255,255,.75)", padding: "3px 10px", borderRadius: 20, boxShadow: GLOSS_SOFT }}>{game.players}</span>
          {game.daily && (
            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: grad(game.accent), padding: "3px 10px", borderRadius: 20, boxShadow: `${GLOSS}, ${SHADOW.sm}` }}>Daily</span>
          )}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: game.accent, whiteSpace: "nowrap", transition: `transform .28s ${EASE}`, transform: hover ? "translateX(3px)" : "none" }}>Play →</span>
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
      <div aria-hidden style={{ position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)", width: "min(620px, 96%)", height: 340, pointerEvents: "none", background: `radial-gradient(closest-side, ${shade(C.accent, .82)}, transparent)`, opacity: .75, zIndex: 0 }} />
      <section style={{ textAlign: "center", padding: "48px 0 40px", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 13, letterSpacing: "0.22em", textTransform: "uppercase", color: C.accent2, fontWeight: 700, marginBottom: 14 }}>A little arcade of quick games</div>
        <h1 className="grad-text" style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "clamp(38px, 7vw, 62px)", fontWeight: 700, lineHeight: 1.05, margin: "0 0 16px", letterSpacing: "-.01em", background: `linear-gradient(170deg, ${C.text} 30%, ${C.accent2})`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
          Play, guess,<br />and outsmart a friend.
        </h1>
        <p style={{ color: C.dim, fontSize: 16, maxWidth: 460, margin: "0 auto", lineHeight: 1.6 }}>
          {countWord(GAMES.length)} hand-built games in one place. No sign-up, no timer pressure. Just open one and go.
        </p>
      </section>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, paddingBottom: 60 }}>
        {GAMES.map((g) => <GameCard key={g.id} game={g} onClick={() => onPick(g.id)} />)}
      </section>
    </div>
  );
}

/* ============================= ROOT APP ============================= */
export default function App() {
  const [{ gameId, roomCode }, navigate] = useRoute();
  const game = GAMES.find((g) => g.id === gameId);

  // An unknown game in the URL falls back to the landing page rather than a blank screen.
  useEffect(() => {
    if (gameId && !game) navigate(null, null, { replace: true });
  }, [gameId, game, navigate]);

  useEffect(() => { window.scrollTo(0, 0); }, [gameId, roomCode]);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Libre Franklin', 'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;500;700;800&display=swap');
        * { box-sizing: border-box; }
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
        .btn-flat { -webkit-tap-highlight-color: transparent; transition: background .18s ${EASE}, color .18s ${EASE}; }
        .btn-flat:hover { background: rgba(74,53,36,.05); color: ${C.text}; }
        .btn-flat:active { background: rgba(74,53,36,.09); }

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
      <header style={{ position: "sticky", top: 0, background: "rgba(255,255,255,.72)", backdropFilter: "blur(18px) saturate(180%)", WebkitBackdropFilter: "blur(18px) saturate(180%)", boxShadow: "0 1px 0 rgba(74,53,36,.07), 0 6px 20px rgba(74,53,36,.05)", zIndex: 10 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <a href="/" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); navigate(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 9, color: C.text, fontFamily: "inherit", padding: 0, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(150deg, ${shade(C.accent, .28)}, ${C.accent} 55%, ${C.accent2})`, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 17, color: "#fff", boxShadow: `${GLOSS}, 0 1px 2px rgba(74,53,36,.2), 0 4px 10px ${shade(C.accent, -.1)}3a`, textShadow: "0 1px 1px rgba(74,53,36,.3)" }}>P</div>
            <span style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: 23, fontWeight: 700 }}>{HUB_NAME}</span>
          </a>
          {game && <><span style={{ color: C.line }}>/</span><span style={{ fontSize: 15, fontWeight: 700, color: game.accent }}>{game.name}</span></>}
          {roomCode && <span style={{ fontSize: 12, fontWeight: 700, color: C.dim, background: C.panel, padding: "3px 9px", borderRadius: 20, letterSpacing: ".08em" }}>{roomCode}</span>}
          <div style={{ flex: 1 }} />
          {game && <Btn variant="subtle" onClick={() => navigate(null)}>← All games</Btn>}
        </div>
      </header>

      <main style={{ padding: game ? "28px 20px 60px" : 0 }}>
        {!game ? <Landing onPick={(id) => navigate(id)} /> : (
          <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* roomCode and navigate are passed down for the online modes; the
                local-only games simply ignore them. */}
            <game.Comp key={game.id} roomCode={roomCode} navigate={navigate} />
          </div>
        )}
      </main>

      <footer style={{ borderTop: `1px solid rgba(226,203,166,.5)`, padding: "26px 20px", textAlign: "center", color: C.dim, fontSize: 13, background: `linear-gradient(180deg, transparent, ${shade(C.panel, .55)})` }}>
        {HUB_NAME} — a small collection of games. Built for fun.
      </footer>
    </div>
  );
}
