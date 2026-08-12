import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { C, SHADOW, GLOSS, GLOSS_SOFT, PILL, grad, paleGrad, EASE, SPRING } from '../shared/theme.js';
import { Btn, TileBtn, Centered, hStyle, pStyle } from '../shared/ui.jsx';
import { SIZE, MAX_SCORE, SPEEDS, DIRS, freshGame, step } from './snakeRules.js';

/* ============================= SNAKE =============================
   A 15x15 board where the difficulty is purely how fast the snake moves.

   HOW THE GLIDE WORKS
   The board is a grid but the snake does not jump between cells: each segment
   is absolutely positioned and animated with a CSS transform transition that
   lasts exactly one tick, so it slides.

   Getting that right depends entirely on the React key. Segments are keyed by
   their distance from the *tail*, not from the head. Walk through a move and
   the reason becomes clear: a new head is added and the tail is dropped, so
   the segment that was second-from-tail is now third-from-tail, and every key
   ends up one cell further along the body — which is exactly the motion a
   snake makes. Key from the head instead and every segment would keep its own
   key while the whole body shifted underneath, so nothing would appear to move
   at all except the tail vanishing.

   It also handles growth correctly for free. When an apple is eaten nothing is
   dropped, so every existing key stays exactly where it is (right — the tail
   does not advance on the tick you eat) and one new key appears at the head.

   The rules themselves live in ./snakeRules.js so they can be tested without a
   browser — see test/snake.test.mjs.                                         */

const KEY_MAP = {
  arrowup: "up", w: "up", arrowdown: "down", s: "down",
  arrowleft: "left", a: "left", arrowright: "right", d: "right",
};

const bestKey = (difficulty) => `puzzlr:snake:best:${difficulty}`;

const readBest = (difficulty) => {
  try { return Number(localStorage.getItem(bestKey(difficulty))) || 0; } catch { return 0; }
};
const writeBest = (difficulty, score) => {
  try { localStorage.setItem(bestKey(difficulty), String(score)); } catch { /* private mode */ }
};

export default function Snake() {
  const [difficulty, setDifficulty] = useState("easy");
  const [screen, setScreen] = useState("menu");
  const [g, setG] = useState(freshGame);
  const [best, setBest] = useState(() => readBest("easy"));
  const boardRef = useRef(null);
  const touch = useRef(null);

  const speed = SPEEDS.find((s) => s.key === difficulty) ?? SPEEDS[0];
  const over = g.status === "dead" || g.status === "won";

  /* The clock. Keyed on status and speed so it is torn down the instant the
     game ends — an interval left running behind a results screen is the
     classic way these end up eating battery in a background tab. */
  useEffect(() => {
    if (g.status !== "running") return;
    const id = setInterval(() => setG(step), speed.ms);
    return () => clearInterval(id);
  }, [g.status, speed.ms]);

  useEffect(() => { setBest(readBest(difficulty)); }, [difficulty]);

  // Record the best only once the run is genuinely over.
  useEffect(() => {
    if (!over) return;
    setBest((prev) => {
      if (g.score <= prev) return prev;
      writeBest(difficulty, g.score);
      return g.score;
    });
  }, [over, g.score, difficulty]);

  const turn = useCallback((name) => {
    const dir = DIRS[name];
    if (!dir) return;
    setG((prev) => {
      /* The opening move sets the direction outright rather than queueing it.
         Queueing sent it through the no-reversing rule, which is measured
         against the default heading of right — so pressing left to start was
         discarded as a 180 and the snake set off rightwards on its own. A
         one-segment snake has no neck to reverse into, so every direction is
         legal here. */
      if (prev.status === "ready") return { ...prev, status: "running", dir, queue: [] };
      if (prev.status !== "running") return prev;
      // Two buffered turns is plenty; more just makes the snake feel remote.
      if (prev.queue.length >= 2) return prev;
      return { ...prev, queue: [...prev.queue, dir] };
    });
  }, []);

  const start = (key) => {
    setDifficulty(key);
    setBest(readBest(key));
    setG(freshGame());
    setScreen("play");
  };

  const again = () => setG(freshGame());

  useEffect(() => {
    if (screen !== "play") return;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const name = KEY_MAP[e.key.toLowerCase()];
      if (name) {
        e.preventDefault();               // stop the arrow keys scrolling the page
        turn(name);
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        setG((p) => p.status === "running" ? { ...p, status: "paused" }
          : p.status === "paused" ? { ...p, status: "running" } : p);
      }
    };
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, turn]);

  /* Swipe, as well as the pad below. The pad is the reliable control; this is
     for people who reach for a swipe first and would otherwise think the game
     is broken. */
  const onTouchStart = (e) => {
    const t = e.changedTouches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;      // a tap, not a swipe
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  };

  const headDir = useMemo(() => {
    const d = g.dir;
    return d.x === 1 ? 0 : d.y === 1 ? 90 : d.x === -1 ? 180 : 270;
  }, [g.dir]);

  /* ------------------------------- menu ------------------------------- */
  if (screen === "menu") return (
    <Centered>
      <Anim />
      <h2 style={hStyle}>Snake</h2>
      <p style={pStyle}>
        Eat apples, grow longer, and do not hit the wall or yourself.
        The board is {SIZE} by {SIZE}, so a perfect run is {MAX_SCORE} apples.
      </p>
      <div style={{ width: "100%", maxWidth: 460, textAlign: "left" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
          Difficulty is how fast it moves
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
          {SPEEDS.map((s) => {
            const record = readBest(s.key);
            return (
              <TileBtn key={s.key} onClick={() => start(s.key)}
                style={{ padding: "14px 16px", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ flex: 1 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, display: "block" }}>{s.name}</span>
                  <span style={{ fontSize: 13, color: C.dim }}>{s.blurb}</span>
                </span>
                {record > 0 && (
                  <span style={{ fontSize: 12, color: C.dim, background: PILL, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
                    Best {record}
                  </span>
                )}
              </TileBtn>
            );
          })}
        </div>
      </div>
    </Centered>
  );

  /* ------------------------------- playing ------------------------------- */
  return (
    <Centered>
      <Anim />

      {/* The score rail, kept above the board so it never moves as the snake
          grows. `position: sticky` keeps it in view on a short phone screen
          where the pad pushes the board up. */}
      <div style={{
        position: "sticky", top: 62, zIndex: 5, width: "100%", maxWidth: 430,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        background: paleGrad(C.panel), borderRadius: 14, padding: "10px 16px",
        boxShadow: `${GLOSS_SOFT}, ${SHADOW.sm}`, marginBottom: 14,
      }}>
        <Stat label="Score" value={g.score} big />
        <Stat label="Best" value={Math.max(best, g.score)} accent />
        <Stat label="Speed" value={speed.name} />
      </div>

      <div ref={boardRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        className={g.status === "dead" ? "snake-shake" : ""}
        style={{
          position: "relative", width: "min(92vw, 430px)", aspectRatio: "1 / 1",
          background: paleGrad(C.panel2), borderRadius: 18, overflow: "hidden",
          boxShadow: `${GLOSS_SOFT}, ${SHADOW.md}`, touchAction: "none",
          /* A faint checker so the grid reads without drawing 225 borders. */
          backgroundImage: `repeating-conic-gradient(rgba(127,127,127,.055) 0 25%, transparent 0 50%)`,
          backgroundSize: `${(100 / SIZE) * 2}% ${(100 / SIZE) * 2}%`,
        }}>

        {g.apple && (
          <div className="snake-apple" style={{
            position: "absolute", width: `${100 / SIZE}%`, height: `${100 / SIZE}%`,
            transform: `translate(${g.apple.x * 100}%, ${g.apple.y * 100}%)`,
            display: "grid", placeItems: "center", pointerEvents: "none",
          }}>
            <div style={{
              width: "70%", height: "70%", borderRadius: "50%",
              background: "var(--snake-apple)",
              boxShadow: "0 0 10px rgba(255,90,60,.45)",
            }} />
          </div>
        )}

        {g.snake.map((seg, i) => {
          const head = i === 0;
          /* Distance from the tail. See the note at the top of the file — this
             is what turns a redraw into a glide. */
          const key = g.snake.length - 1 - i;
          const shade = i / Math.max(12, g.snake.length);
          return (
            /* No percentage padding here. On an absolutely positioned element a
               percentage padding resolves against the *containing block's*
               width — the whole board — not the element's own. At 6% that came
               to 26px of padding on a 28px cell, which collapsed the inner box
               to nothing: the background had no area left to paint and only the
               eyes showed, because their SVG overflows a zero-sized box.
               Centring with grid and sizing the inner box as a percentage of
               the cell avoids the trap entirely. */
            <div key={key} className={g.status === "dead" ? "snake-die" : ""}
              style={{
                position: "absolute", width: `${100 / SIZE}%`, height: `${100 / SIZE}%`,
                transform: `translate(${seg.x * 100}%, ${seg.y * 100}%)`,
                transition: g.status === "running" ? `transform ${speed.ms}ms linear` : "none",
                display: "grid", placeItems: "center", pointerEvents: "none",
                animationDelay: g.status === "dead" ? `${Math.min(i, 14) * 28}ms` : "0s",
                zIndex: head ? 3 : 2,
              }}>
              <div style={{
                width: head ? "94%" : "86%", height: head ? "94%" : "86%",
                borderRadius: head ? "34%" : `${30 - shade * 10}%`,
                background: head ? "var(--snake-head)" : "var(--snake-body)",
                opacity: head ? 1 : 1 - Math.min(shade, .35),
                boxShadow: head
                  ? `${GLOSS}, 0 0 0 1.5px var(--snake-edge), 0 2px 6px rgba(0,0,0,.32)`
                  : `${GLOSS}, 0 0 0 1px var(--snake-edge)`,
                display: "grid", placeItems: "center",
                transform: head ? `rotate(${headDir}deg)` : "none",
                transition: `transform ${speed.ms}ms ${EASE}`,
              }}>
                {head && (
                  /* Eyes sit on the leading edge and rotate with the head, so
                     the snake always looks where it is going. */
                  <svg viewBox="0 0 10 10" style={{ width: "100%", height: "100%" }} aria-hidden>
                    <circle cx="6.9" cy="3.2" r="1.5" fill="#fff" />
                    <circle cx="6.9" cy="6.8" r="1.5" fill="#fff" />
                    <circle cx="7.6" cy="3.2" r=".72" fill="#12301c" />
                    <circle cx="7.6" cy="6.8" r=".72" fill="#12301c" />
                  </svg>
                )}
              </div>
            </div>
          );
        })}

        {/* The wall the snake hit, flashed briefly rather than left on screen. */}
        {g.status === "dead" && g.death?.wall && (
          <div className="snake-flash" style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            boxShadow: `inset 0 0 0 4px ${C.danger}`, borderRadius: 18,
          }} />
        )}

        {(g.status === "ready" || g.status === "paused" || over) && (
          <Overlay status={g.status} score={g.score} best={best} onAgain={again}
            onMenu={() => setScreen("menu")} onResume={() => setG((p) => ({ ...p, status: "running" }))} />
        )}
      </div>

      <Dpad onTurn={turn} />

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn variant="ghost" onClick={again}>Restart</Btn>
        <Btn variant="subtle" onClick={() => setScreen("menu")}>Change speed</Btn>
      </div>
      <p style={{ ...pStyle, fontSize: 12.5, marginTop: 14 }}>
        Arrow keys or WASD, swipe on the board, or use the pad. Space pauses.
      </p>
    </Centered>
  );
}

function Stat({ label, value, big, accent }) {
  return (
    <div style={{ textAlign: "center", minWidth: 62 }}>
      <div style={{ fontSize: big ? 26 : 19, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: "tabular-nums", color: accent ? C.accent : C.text }}>{value}</div>
      <div style={{ fontSize: 10.5, color: C.dim, textTransform: "uppercase", letterSpacing: ".5px" }}>{label}</div>
    </div>
  );
}

function Overlay({ status, score, best, onAgain, onMenu, onResume }) {
  const title = status === "won" ? "Perfect board!"
    : status === "dead" ? "You crashed"
    : status === "paused" ? "Paused" : "Ready";
  const beat = status === "dead" && score > 0 && score >= best;
  return (
    /* Above the segments. They carry a z-index of their own so the head draws
       over the body, and without one here the snake sat on top of the message
       — which at the start is exactly where it begins, dead centre. */
    <div className="snake-overlay" style={{
      position: "absolute", inset: 0, zIndex: 6, display: "grid", placeItems: "center",
      background: "color-mix(in srgb, var(--c-panel) 88%, transparent)",
      backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", padding: 18, textAlign: "center",
    }}>
      <div>
        <div style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: 27, fontWeight: 700, marginBottom: 4 }}>{title}</div>
        {status === "ready" ? (
          <div style={{ color: C.dim, fontSize: 14, maxWidth: 250 }}>
            Press an arrow key, swipe, or tap the pad to set off.
          </div>
        ) : status === "paused" ? (
          <Btn onClick={onResume} style={{ marginTop: 10 }}>Resume</Btn>
        ) : (
          <>
            <div style={{ color: C.dim, fontSize: 14.5, marginBottom: 2 }}>
              {score} {score === 1 ? "apple" : "apples"}
              {status === "won" && ` — every one of them`}
            </div>
            {beat && <div style={{ color: C.accent, fontWeight: 800, fontSize: 13.5, marginBottom: 4 }}>New best!</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 10 }}>
              <Btn onClick={onAgain}>Play again</Btn>
              <Btn variant="subtle" onClick={onMenu}>Speed</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* The pad. Big targets, and `touchAction: none` plus a preventDefault on
   touchstart so a fast repeated tap cannot get interpreted as a double-tap
   zoom, which on iOS would otherwise jerk the whole page mid-game. */
function Dpad({ onTurn }) {
  const press = (name) => (e) => { e.preventDefault(); onTurn(name); };
  const cell = (name, label, path, style) => (
    <button onTouchStart={press(name)} onMouseDown={press(name)} className="btn3d"
      aria-label={label} style={{
        ...style, border: "none", cursor: "pointer", borderRadius: 14, padding: 0,
        background: paleGrad(C.panel2), color: C.text, touchAction: "none",
        boxShadow: `${GLOSS_SOFT}, ${SHADOW.sm}`, display: "grid", placeItems: "center",
        WebkitTapHighlightColor: "transparent",
      }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{path}</svg>
    </button>
  );
  const up = <path d="M6 15l6-6 6 6" />;
  const down = <path d="M6 9l6 6 6-6" />;
  const left = <path d="M15 6l-6 6 6 6" />;
  const right = <path d="M9 6l6 6-6 6" />;
  return (
    <div style={{
      marginTop: 16, display: "grid", gap: 8,
      gridTemplateColumns: "repeat(3, 62px)", gridTemplateRows: "repeat(2, 54px)",
    }}>
      {cell("up", "Up", up, { gridColumn: 2, gridRow: 1 })}
      {cell("left", "Left", left, { gridColumn: 1, gridRow: 2 })}
      {cell("down", "Down", down, { gridColumn: 2, gridRow: 2 })}
      {cell("right", "Right", right, { gridColumn: 3, gridRow: 2 })}
    </div>
  );
}

/* Animations live with the game that uses them, and every one is switched off
   under prefers-reduced-motion. */
function Anim() {
  return (
    <style>{`
      /* The snake carries its own colours rather than borrowing C.correct.
         On the dark board the palette's green sits too close to the
         background to read as a distinct object, and the snake is the one
         thing on screen the player must never lose track of, so the dark
         theme gets a deliberately brighter set. The 1px edge keeps the body
         legible where it crosses its own tail. */
      :root {
        --snake-head: linear-gradient(150deg, #4fb572, #22834a 55%, #145c33);
        --snake-body: linear-gradient(150deg, #43a463, #277a44);
        --snake-edge: rgba(16,52,30,.45);
        --snake-apple: radial-gradient(circle at 32% 28%, #ff8a72, #d4432c 62%, #7d2415);
      }
      :root[data-theme="dark"] {
        --snake-head: linear-gradient(150deg, #c7ffd8, #5fe08c 55%, #2fae63);
        --snake-body: linear-gradient(150deg, #9cf0b6, #4ecb7c);
        --snake-edge: rgba(0,0,0,.5);
        --snake-apple: radial-gradient(circle at 32% 28%, #ffb5a2, #ff5f43 60%, #b0301a);
      }
      @media (prefers-color-scheme: dark) {
        :root:not([data-theme]) {
          --snake-head: linear-gradient(150deg, #c7ffd8, #5fe08c 55%, #2fae63);
          --snake-body: linear-gradient(150deg, #9cf0b6, #4ecb7c);
          --snake-edge: rgba(0,0,0,.5);
          --snake-apple: radial-gradient(circle at 32% 28%, #ffb5a2, #ff5f43 60%, #b0301a);
        }
      }

      @keyframes snakeShake {
        0%,100% { transform: translate(0,0) }
        15% { transform: translate(-6px, 3px) }
        30% { transform: translate(5px, -4px) }
        45% { transform: translate(-4px, -2px) }
        60% { transform: translate(4px, 3px) }
        80% { transform: translate(-2px, 1px) }
      }
      @keyframes snakeDie {
        0% { transform: scale(1); filter: none }
        35% { transform: scale(1.22); filter: hue-rotate(-95deg) saturate(2.4) brightness(1.15) }
        100% { transform: scale(0); filter: hue-rotate(-95deg) saturate(2.4); opacity: 0 }
      }
      @keyframes snakeApple {
        0%,100% { transform: scale(1) } 50% { transform: scale(.86) }
      }
      @keyframes snakeFlash { 0% { opacity: 1 } 100% { opacity: 0 } }
      @keyframes snakeFade { from { opacity: 0 } to { opacity: 1 } }

      .snake-shake { animation: snakeShake .42s ease both }
      /* The die animation runs on the inner box, so the outer element keeps
         holding the segment's grid position while it collapses. */
      .snake-die > div { animation: snakeDie .55s ${EASE} both; animation-delay: inherit }
      .snake-die { animation: none }
      .snake-apple > div { animation: snakeApple 1.1s ease-in-out infinite }
      .snake-flash { animation: snakeFlash .8s ease-out both }
      .snake-overlay { animation: snakeFade .25s ease both }

      @media (prefers-reduced-motion: reduce) {
        .snake-shake, .snake-die > div, .snake-apple > div, .snake-flash, .snake-overlay {
          animation: none !important;
        }
        .snake-die > div { opacity: .35 }
      }
    `}</style>
  );
}
