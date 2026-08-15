import { useState, useEffect, useRef, useCallback } from 'react';
import { C, SHADOW, GLOSS, GLOSS_SOFT, PILL, paleGrad, EASE, SPRING } from '../shared/theme.js';
import { Btn, Centered, hStyle, pStyle } from '../shared/ui.jsx';
import { CONTENT } from '../content.js';
import {
  COLS, ROWS, COLOURS, PREVIEW, newGame, moveLeft, moveRight, moveBy, rotate,
  holdPiece, canFall, softDrop, hardDrop, ghostY, lock, resolveClear,
  cellsOf, pieceCells, gravityMs,
} from './tetrisRules.js';

/* ============================= TETRIS =============================
   The engine is in ./tetrisRules.js — pure, seedable and node-tested. This
   file is the board, the input and the timing, and it holds no rules of its
   own beyond how long a thing takes.

   THE LOOP IS A REF, NOT STATE
   requestAnimationFrame runs sixty times a second and almost every frame
   changes nothing, so the loop reads and writes `gameRef` and only calls
   setState when the state object actually changes. Doing the timing inside a
   setState updater instead would be wrong twice over: React may call an
   updater more than once for the same frame, which would double-count
   gravity, and it would re-render on every frame regardless.               */

const LOCK_MS = 500;          // grace to slide or spin a landed piece
const LOCK_RESETS = 15;       // ...but not forever
const CLEAR_MS = 240;         // how long the completed rows flash before going
const DAS_MS = 150;           // hold a direction this long before it repeats
const ARR_MS = 45;            // then a step this often
const SOFT_MS = 35;           // soft drop speed, or gravity if already faster
const TAP_MS = 220;           // longer than this on the board is a hold, not a tap
const SWIPE_PX = 22;

const BEST_KEY = "puzzlr:tetris:best";
const readBest = () => {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  } catch { return 0; }
};
const writeBest = (v) => {
  try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* private mode */ }
};

const styleBlock = `
  .tt-wrap {
    display: flex; gap: 14px; align-items: flex-start; justify-content: center;
    width: 100%;
  }
  .tt-side { display: flex; flex-direction: column; gap: 10px; width: 116px; flex-shrink: 0; }

  /* Below this the three columns become three stacked rows: the panels go
     horizontal and sit above the board, so the playfield keeps the full width
     and the thumb buttons stay reachable underneath. */
  @media (max-width: 700px) {
    .tt-wrap { flex-direction: column; align-items: center; }
    .tt-side { flex-direction: row; width: 100%; max-width: 320px; gap: 8px; }
    .tt-side > * { flex: 1 1 0; min-width: 0; }
    .tt-left { order: 1 } .tt-right { order: 2 } .tt-board { order: 3 }
    .tt-stat-big { font-size: 1.25rem !important }
    /* Stacked, the queue is taller than the stats row and shoves the board
       down the page. Lying it on its side costs nothing and keeps the
       playfield in reach. */
    .tt-next { flex-direction: row !important; justify-content: center; align-items: center; gap: 14px !important }
  }

  @keyframes tt-flash {
    0%   { filter: brightness(1); transform: scaleY(1) }
    35%  { filter: brightness(2.8) saturate(.4) }
    100% { filter: brightness(1.6); transform: scaleY(.15); opacity: 0 }
  }
  /* Delayed per column in the markup, so the flash sweeps across the row
     rather than the whole line blinking at once. */
  .tt-clearing { animation: tt-flash ${CLEAR_MS}ms ease-out both }

  @keyframes tt-settle {
    0%   { filter: brightness(1.9) }
    100% { filter: brightness(1) }
  }
  .tt-settle { animation: tt-settle 160ms ease-out }

  @keyframes tt-buzz {
    10%,90% { transform: translate(-2px, 1px) }
    20%,80% { transform: translate(3px, -2px) }
    30%,50%,70% { transform: translate(-4px, 2px) }
    40%,60% { transform: translate(4px, -1px) }
  }
  .tt-buzz { animation: tt-buzz 420ms }

  @keyframes tt-pop {
    0%   { transform: scale(.4) rotate(-9deg); opacity: 0 }
    40%  { transform: scale(1.18) rotate(3deg); opacity: 1 }
    62%  { transform: scale(.96) rotate(-1deg) }
    78%  { transform: scale(1.02); opacity: 1 }
    100% { transform: scale(1) rotate(0); opacity: 0 }
  }
  .tt-tetris { animation: tt-pop 950ms ${SPRING} both }

  @keyframes tt-levelup { 0%,100% { opacity: 0 } 30% { opacity: 1 } }
  .tt-levelup { animation: tt-levelup 700ms ease-out }

  @media (prefers-reduced-motion: reduce) {
    .tt-clearing { animation: none !important; opacity: .25 }
    .tt-settle, .tt-buzz, .tt-levelup { animation: none !important }
    /* The badge still appears — it is information, not decoration — it just
       does not fly around to do it. */
    .tt-tetris { animation: none !important; opacity: 1 }
  }
`;

/* ----------------------------------------------------------------- pieces */
const cellFace = (type) => ({
  background: `linear-gradient(160deg, ${COLOURS[type]}, ${COLOURS[type]})`,
  boxShadow: `inset 0 2px 0 rgba(255,255,255,.32), inset 0 -2px 0 rgba(0,0,0,.22)`,
});

/* The hold slot and the queue, drawn tight to the piece's own bounding box so
   an I and an O both look centred rather than floating in a 4x4 box. */
function MiniPiece({ type, size = 13 }) {
  if (!type) return <div style={{ height: size * 2 }} />;
  const cells = cellsOf(type, 0, 0, 0);
  const xs = cells.map(([x]) => x), ys = cells.map(([, y]) => y);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const w = Math.max(...xs) - x0 + 1, h = Math.max(...ys) - y0 + 1;
  return (
    <div style={{
      display: "grid", gap: 2, justifyContent: "center",
      gridTemplateColumns: `repeat(${w}, ${size}px)`,
      gridTemplateRows: `repeat(${h}, ${size}px)`,
    }}>
      {Array.from({ length: w * h }).map((_, i) => {
        const x = i % w, y = Math.floor(i / w);
        const on = cells.some(([cx, cy]) => cx - x0 === x && cy - y0 === y);
        return <div key={i} style={{
          borderRadius: 3,
          ...(on ? cellFace(type) : { background: "transparent" }),
        }} />;
      })}
    </div>
  );
}

function Panel({ label, children, style = {} }) {
  return (
    <div style={{
      background: paleGrad(C.panel), borderRadius: 14, padding: "9px 10px",
      boxShadow: `${GLOSS_SOFT}, ${SHADOW.sm}`, textAlign: "center", ...style,
    }}>
      <div style={{
        fontSize: "0.625rem", letterSpacing: ".16em", textTransform: "uppercase",
        color: C.dim, fontWeight: 700, marginBottom: 4,
      }}>{label}</div>
      {children}
    </div>
  );
}

const statValue = (big) => ({
  fontSize: big ? "1.5rem" : "1.0625rem", fontWeight: 800, lineHeight: 1.1,
  fontVariantNumeric: "tabular-nums", color: C.text,
});

/* A chunky control that repeats while held, for the on-screen pad. */
function PadBtn({ label, icon, onPress, onRelease, wide }) {
  return (
    <button
      className="btn3d"
      onPointerDown={(e) => { e.preventDefault(); onPress(); }}
      onPointerUp={() => onRelease?.()}
      onPointerLeave={() => onRelease?.()}
      onPointerCancel={() => onRelease?.()}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={label}
      style={{
        flex: wide ? "1.4 1 0" : "1 1 0", height: 52, border: "none", borderRadius: 13,
        background: paleGrad(C.panel2), color: C.text, cursor: "pointer",
        fontFamily: "inherit", fontSize: "0.75rem", fontWeight: 700,
        display: "grid", placeItems: "center", gap: 2,
        boxShadow: `${GLOSS_SOFT}, ${SHADOW.sm}`,
        touchAction: "none", userSelect: "none", WebkitUserSelect: "none",
        WebkitTapHighlightColor: "transparent",
      }}>
      {icon}
      <span style={{ fontSize: "0.625rem", color: C.dim, letterSpacing: ".04em" }}>{label}</span>
    </button>
  );
}

const Arrow = ({ rotate: r = 0 }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden
    style={{ transform: `rotate(${r}deg)` }}>
    <path d="M12 5v14M5 12l7 7 7-7" />
  </svg>
);

export default function Tetris() {
  const [game, setGame] = useState(() => newGame((Math.random() * 2 ** 31) >>> 0));
  const gameRef = useRef(game);
  const [best, setBest] = useState(readBest);
  const [buzz, setBuzz] = useState(0);
  const [levelUp, setLevelUp] = useState(0);
  const [settle, setSettle] = useState(null);

  const acc = useRef({ drop: 0, lock: 0, clear: 0, das: 0, arr: 0, dir: 0, soft: false, resets: 0 });
  const touch = useRef(null);
  const prevLevel = useRef(game.level);

  const apply = useCallback((fn) => {
    const next = fn(gameRef.current);
    if (next !== gameRef.current) { gameRef.current = next; setGame(next); }
  }, []);

  /* Any successful nudge of a landed piece buys it more time on the floor,
     up to a limit — otherwise a player can spin a piece in place forever and
     never top out. */
  const bumpLock = useCallback(() => {
    const a = acc.current;
    if (a.lock > 0 && a.resets < LOCK_RESETS) { a.lock = 0; a.resets += 1; }
  }, []);

  const doMove = useCallback((dx) => {
    apply((g) => {
      const next = moveBy(g, dx, 0);
      if (next !== g) bumpLock();
      return next;
    });
  }, [apply, bumpLock]);

  const doRotate = useCallback((dir) => {
    apply((g) => {
      const next = rotate(g, dir);
      if (next !== g) bumpLock();
      return next;
    });
  }, [apply, bumpLock]);

  const doHold = useCallback(() => apply((g) => holdPiece(g)), [apply]);

  const doHardDrop = useCallback(() => {
    apply((g) => {
      if (g.status !== "playing" || !g.piece) return g;
      setSettle({ cells: pieceCells({ ...g.piece, y: ghostY(g) }).map(([x, y]) => `${x},${y}`), id: Date.now() });
      const a = acc.current;
      a.lock = 0; a.resets = 0; a.drop = 0;
      return hardDrop(g);
    });
  }, [apply]);

  const restart = useCallback(() => {
    acc.current = { drop: 0, lock: 0, clear: 0, das: 0, arr: 0, dir: 0, soft: false, resets: 0 };
    prevLevel.current = 1;
    setSettle(null);
    const fresh = newGame((Math.random() * 2 ** 31) >>> 0);
    gameRef.current = fresh;
    setGame(fresh);
  }, []);

  /* ------------------------------------------------------------- the loop */
  useEffect(() => {
    if (game.status === "over") return;
    let raf = 0;
    let last = performance.now();

    const frame = (now) => {
      /* Capped, so a tab that was in the background for a minute does not
         come back and drop the piece forty rows in one frame. */
      const dt = Math.min(80, now - last);
      last = now;
      const a = acc.current;
      let g = gameRef.current;

      if (g.status === "over") { raf = requestAnimationFrame(frame); return; }

      if (g.status === "clearing") {
        a.clear += dt;
        if (a.clear >= CLEAR_MS) {
          a.clear = 0;
          g = resolveClear(g);
          a.drop = 0; a.lock = 0; a.resets = 0;
        }
      } else {
        // Horizontal auto-repeat, once the initial delay is served.
        if (a.dir) {
          a.das += dt;
          if (a.das >= DAS_MS) {
            a.arr += dt;
            while (a.arr >= ARR_MS) {
              a.arr -= ARR_MS;
              const moved = a.dir < 0 ? moveLeft(g) : moveRight(g);
              if (moved !== g) { g = moved; if (a.lock > 0 && a.resets < LOCK_RESETS) { a.lock = 0; a.resets += 1; } }
            }
          }
        }

        const speed = a.soft ? Math.min(gravityMs(g.level), SOFT_MS) : gravityMs(g.level);
        a.drop += dt;
        while (a.drop >= speed) {
          a.drop -= speed;
          if (!canFall(g)) break;
          g = a.soft ? softDrop(g) : moveBy(g, 0, 1);
        }

        if (g.piece && !canFall(g)) {
          a.lock += dt;
          if (a.lock >= LOCK_MS || a.resets >= LOCK_RESETS) {
            setSettle({ cells: pieceCells(g.piece).map(([x, y]) => `${x},${y}`), id: now });
            g = lock(g);
            a.lock = 0; a.resets = 0; a.drop = 0;
          }
        } else if (a.lock !== 0) {
          a.lock = 0;
        }
      }

      if (g !== gameRef.current) { gameRef.current = g; setGame(g); }
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [game.status]);

  /* The settle highlight is a flash, not a state — drop it once it has run. */
  useEffect(() => {
    if (!settle) return;
    const t = setTimeout(() => setSettle(null), 200);
    return () => clearTimeout(t);
  }, [settle]);

  useEffect(() => {
    if (game.status === "clearing" && game.pending?.length === 4) setBuzz((b) => b + 1);
  }, [game.status, game.pending]);

  useEffect(() => {
    if (game.level > prevLevel.current) { prevLevel.current = game.level; setLevelUp((n) => n + 1); }
  }, [game.level]);

  useEffect(() => {
    if (game.score > best) { setBest(game.score); writeBest(game.score); }
  }, [game.score, best]);

  /* ------------------------------------------------------------ keyboard */
  useEffect(() => {
    const press = (k) => {
      const a = acc.current;
      switch (k) {
        case "arrowleft": case "a":
          if (a.dir !== -1) { a.dir = -1; a.das = 0; a.arr = 0; doMove(-1); } break;
        case "arrowright": case "d":
          if (a.dir !== 1) { a.dir = 1; a.das = 0; a.arr = 0; doMove(1); } break;
        case " ": case "spacebar": doRotate(1); break;
        case "z": doRotate(-1); break;
        case "arrowdown": case "s": a.soft = true; break;
        case "arrowup": doHardDrop(); break;
        case "c": case "shift": doHold(); break;
        default: break;
      }
    };
    const release = (k) => {
      const a = acc.current;
      if (k === "arrowleft" || k === "a") { if (a.dir === -1) a.dir = 0; }
      else if (k === "arrowright" || k === "d") { if (a.dir === 1) a.dir = 0; }
      else if (k === "arrowdown" || k === "s") a.soft = false;
    };

    const onDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (!KEY_SET.has(k)) return;
      e.preventDefault();          // arrows and space would scroll the page
      if (e.repeat) return;        // the loop does its own auto-repeat
      press(k);
    };
    const onUp = (e) => {
      const k = e.key.toLowerCase();
      if (KEY_SET.has(k)) release(k);
    };
    /* Losing focus mid-hold would otherwise leave a direction stuck down. */
    const onBlur = () => { acc.current.dir = 0; acc.current.soft = false; };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [doMove, doRotate, doHold, doHardDrop]);

  /* --------------------------------------------------------------- touch */
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, at: performance.now(), moved: false };
  };
  const onTouchMove = (e) => {
    const s = touch.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
      doMove(dx > 0 ? 1 : -1);
      s.x = t.clientX;            // let a continued drag keep stepping
      s.moved = true;
    } else if (dy > SWIPE_PX * 1.6 && Math.abs(dy) > Math.abs(dx)) {
      acc.current.soft = true;    // dragged downwards: fall faster
      s.moved = true;
    }
    // A press held still on the board is a soft drop.
    if (!s.moved && performance.now() - s.at > TAP_MS) acc.current.soft = true;
  };
  const onTouchEnd = () => {
    const s = touch.current;
    touch.current = null;
    acc.current.soft = false;
    if (!s) return;
    if (!s.moved && performance.now() - s.at < TAP_MS) doRotate(1);
  };

  /* ---------------------------------------------------------------- view
     The board plus whatever is floating above it, flattened into one grid so
     the renderer does not have to think about layers. */
  const g = game;
  const view = g.board.map((row) => row.map((t) => (t ? { type: t } : null)));
  const clearing = new Set(g.pending || []);

  if (g.piece && g.status === "playing") {
    const gy = ghostY(g);
    for (const [x, y] of pieceCells({ ...g.piece, y: gy })) {
      if (y >= 0 && y < ROWS && !view[y][x]) view[y][x] = { type: g.piece.type, ghost: true };
    }
    for (const [x, y] of pieceCells(g.piece)) {
      if (y >= 0 && y < ROWS) view[y][x] = { type: g.piece.type };
    }
  }

  const over = g.status === "over";
  const intro = CONTENT.intros?.tetris;

  return (
    <Centered>
      <style>{styleBlock}</style>

      <div className="tt-wrap">
        {/* ------------------------------------------------------ left */}
        <div className="tt-side tt-left">
          <Panel label="Score">
            <div className="tt-stat-big" style={statValue(true)}>{g.score}</div>
          </Panel>
          <Panel label="Best">
            <div style={statValue(false)}>{Math.max(best, g.score)}</div>
          </Panel>
          <Panel label="Level" style={{ position: "relative", overflow: "hidden" }}>
            <div style={statValue(false)}>{g.level}</div>
            <div key={levelUp} className={levelUp ? "tt-levelup" : undefined} style={{
              position: "absolute", inset: 0, background: C.accent, opacity: 0, pointerEvents: "none",
            }} />
          </Panel>
          <Panel label="Lines"><div style={statValue(false)}>{g.lines}</div></Panel>
          <Panel label="Hold"><MiniPiece type={g.hold} /></Panel>
        </div>

        {/* ----------------------------------------------------- board */}
        <div className="tt-board" style={{ position: "relative" }}>
          <div key={buzz} className={buzz ? "tt-buzz" : undefined}
            onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gridTemplateRows: `repeat(${ROWS}, 1fr)`,
              gap: 1,
              /* The well is dark in both themes — see the note in the rules
                 about it being the only background all seven pieces read
                 against. */
              background: "#221a14",
              padding: 5, borderRadius: 12,
              width: "min(74vw, 300px)", aspectRatio: `${COLS} / ${ROWS}`,
              boxShadow: `inset 0 2px 10px rgba(0,0,0,.5), ${SHADOW.md}`,
              touchAction: "none", userSelect: "none", WebkitUserSelect: "none",
            }}>
            {view.map((row, y) => row.map((cell, x) => {
              const key = `${x},${y}`;
              const isClearing = clearing.has(y);
              const settling = settle?.cells.includes(key);
              return (
                <div key={key}
                  className={isClearing ? "tt-clearing" : settling ? "tt-settle" : undefined}
                  style={{
                    borderRadius: 3,
                    animationDelay: isClearing ? `${x * 14}ms` : undefined,
                    ...(cell
                      ? (cell.ghost
                        ? { background: "transparent", boxShadow: `inset 0 0 0 2px ${COLOURS[cell.type]}55` }
                        : cellFace(cell.type))
                      : { background: "#2f251d" }),
                  }} />
              );
            }))}
          </div>

          {/* The hype moment. Fires on a four-line clear and nothing else. */}
          {buzz > 0 && (
            <div key={`t${buzz}`} className="tt-tetris" aria-hidden style={{
              position: "absolute", inset: 0, display: "grid", placeItems: "center",
              pointerEvents: "none", opacity: 0,
            }}>
              <div style={{
                fontFamily: "var(--font-head)", fontSize: "2rem", fontWeight: 700,
                color: "#fff", background: `linear-gradient(150deg, ${COLOURS.Z}, ${COLOURS.L})`,
                padding: "8px 20px", borderRadius: 14, letterSpacing: ".02em",
                boxShadow: `${GLOSS}, 0 10px 30px rgba(0,0,0,.4)`,
                textShadow: "0 2px 4px rgba(0,0,0,.35)",
              }}>TETRIS!</div>
            </div>
          )}

          {over && (
            <div style={{
              position: "absolute", inset: 0, display: "grid", placeItems: "center",
              borderRadius: 12, padding: 16, textAlign: "center",
              background: "color-mix(in srgb, var(--c-panel) 90%, transparent)",
              backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
            }}>
              <div>
                <div style={{
                  fontFamily: "var(--font-head)", fontSize: "1.75rem", fontWeight: 700,
                  marginBottom: 4, color: C.text,
                }}>Topped out</div>
                <div style={{ color: C.dim, fontSize: "0.875rem", marginBottom: 14 }}>
                  {g.score} points, {g.lines} lines, level {g.level}.
                </div>
                <Btn onClick={restart}>New game</Btn>
              </div>
            </div>
          )}
        </div>

        {/* ----------------------------------------------------- right */}
        <div className="tt-side tt-right">
          <Panel label="Next">
            <div className="tt-next" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
              {g.queue.slice(0, PREVIEW).map((t, i) => (
                <MiniPiece key={i} type={t} size={i === 0 ? 13 : 10} />
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* ------------------------------------------------------- controls */}
      <div style={{ width: "min(100%, 340px)", marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <PadBtn label="Left" icon={<Arrow rotate={90} />} onPress={() => { acc.current.dir = -1; acc.current.das = 0; acc.current.arr = 0; doMove(-1); }} onRelease={() => { if (acc.current.dir === -1) acc.current.dir = 0; }} />
          <PadBtn label="Rotate" wide icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" />
            </svg>
          } onPress={() => doRotate(1)} />
          <PadBtn label="Right" icon={<Arrow rotate={-90} />} onPress={() => { acc.current.dir = 1; acc.current.das = 0; acc.current.arr = 0; doMove(1); }} onRelease={() => { if (acc.current.dir === 1) acc.current.dir = 0; }} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <PadBtn label="Hold" icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 9h6v6H9z" />
            </svg>
          } onPress={doHold} />
          <PadBtn label="Soft drop" wide icon={<Arrow />}
            onPress={() => { acc.current.soft = true; }}
            onRelease={() => { acc.current.soft = false; }} />
          <PadBtn label="Drop" icon={
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 4v11M6 11l6 6 6-6M5 21h14" />
            </svg>
          } onPress={doHardDrop} />
        </div>
      </div>

      {intro && (
        <p style={{ ...pStyle, fontSize: "0.8125rem", marginTop: 14, textAlign: "center" }}>
          {intro}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn variant="subtle" onClick={restart}>Restart</Btn>
      </div>
    </Centered>
  );
}

const KEY_SET = new Set([
  "arrowleft", "arrowright", "arrowup", "arrowdown",
  "a", "d", "s", "z", "c", "shift", " ", "spacebar",
]);
