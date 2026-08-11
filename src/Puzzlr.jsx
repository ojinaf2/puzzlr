import { useState, useEffect } from 'react';
import { C } from './shared/theme.js';
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
    <a href={buildPath(game.id)} onClick={handle} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: C.panel, border: `1px solid ${hover ? game.accent : C.line}`, borderRadius: 16, padding: "22px 20px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 14, transition: "transform .15s, border-color .15s", transform: hover ? "translateY(-4px)" : "none", color: C.text, fontFamily: "inherit", textDecoration: "none" }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, background: "#eacfa5", display: "grid", placeItems: "center" }}>
        <svg viewBox="0 0 52 52" width="40" height="40">{game.icon}</svg>
      </div>
      <div>
        <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 3 }}>{game.name}</div>
        <div style={{ fontSize: 13.5, color: C.dim }}>{game.tag}</div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
        <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: C.dim, background: C.bg, padding: "3px 9px", borderRadius: 20 }}>{game.players}</span>
          {game.daily && (
            <span style={{ fontSize: 12, fontWeight: 700, color: game.accent, background: C.bg, padding: "3px 9px", borderRadius: 20 }}>Daily</span>
          )}
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: game.accent }}>Play →</span>
      </div>
    </a>
  );
}

function Landing({ onPick }) {
  return (
    <div style={{ width: "100%", maxWidth: 860, margin: "0 auto", padding: "0 20px" }}>
      <section style={{ textAlign: "center", padding: "48px 0 40px" }}>
        <div style={{ fontSize: 13, letterSpacing: "0.22em", textTransform: "uppercase", color: C.accent2, fontWeight: 700, marginBottom: 14 }}>A little arcade of quick games</div>
        <h1 style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: "clamp(38px, 7vw, 62px)", fontWeight: 700, lineHeight: 1.05, margin: "0 0 16px", letterSpacing: "-.01em" }}>
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
        button:focus-visible { outline: 2px solid ${C.accent}; outline-offset: 2px; }
        input[type=range]:focus-visible { outline: 2px solid ${C.accent}; }
        @media (prefers-reduced-motion: reduce) { .tile-fill,.tile-flip,.row-shake,.win-bounce { animation: none !important; } }
      `}</style>

      <header style={{ borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, background: "rgba(255,255,255,.9)", backdropFilter: "blur(8px)", zIndex: 10 }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <a href="/" onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); navigate(null); }}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 9, color: C.text, fontFamily: "inherit", padding: 0, textDecoration: "none" }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`, display: "grid", placeItems: "center", fontWeight: 900, fontSize: 17, color: "#fff" }}>P</div>
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

      <footer style={{ borderTop: `1px solid ${C.line}`, padding: "22px 20px", textAlign: "center", color: C.dim, fontSize: 13 }}>
        {HUB_NAME} — a small collection of games. Built for fun.
      </footer>
    </div>
  );
}
