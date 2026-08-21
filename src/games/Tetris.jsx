import { useState, useEffect, useRef, useCallback } from 'react';
import { C, SHADOW, GLOSS, GLOSS_SOFT, paleGrad, SPRING } from '../shared/theme.js';
import { Btn, Centered, hStyle, pStyle } from '../shared/ui.jsx';
import { CONTENT } from '../content.js';
import { RoomStatus, lobbyView, OnlineEntry, PlayTabs } from '../shared/online.jsx';
import { LeaderboardPanel, NamePrompt } from '../shared/leaderboardUi.jsx';
import { useScoreSubmit } from '../shared/leaderboard.js';
import { useRoom } from '../shared/useRoom.js';
import { savedName } from '../shared/identity.js';
import { sfx, startMusic, stopMusic, pauseMusic, resumeMusic } from '../shared/sound.js';
import {
  COLS, ROWS, COLOURS, PREVIEW, newGame, moveLeft, moveRight, moveBy, rotate,
  holdPiece, canFall, softDrop, hardDrop, ghostY, lock, resolveClear,
  cellsOf, pieceCells, fallMs, speedMultiplier, packRows,
} from './tetrisRules.js';

/* ============================= TETRIS =============================
   The engine is in ./tetrisRules.js — pure, seedable and node-tested. This
   file is the board, the input and the timing.

   THE ENGINE IS A HOOK, NOT A COMPONENT
   `useTetrisEngine` owns the state, the loop and the controls and knows
   nothing about who is watching. Local play and an online match are the same
   engine with different chrome around it, differing only in where the seed
   comes from and who is told about it. That split is what made the online
   mode a wrapper rather than a second copy of the game.

   THE LOOP IS A REF, NOT STATE
   requestAnimationFrame runs sixty times a second and almost every frame
   changes nothing, so the loop reads and writes `gameRef` and only calls
   setState when the state object actually changes. Doing the timing inside a
   setState updater would be wrong twice over: React may call an updater more
   than once for the same frame, which double-counts gravity, and it would
   re-render on every frame regardless.                                     */

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

const randomSeed = () => (Math.random() * 2 ** 31) >>> 0;

/* Served from our own domain rather than hotlinked, like the flags, and only
   fetched once a game actually starts — see the note in shared/sound.js. */
const MUSIC_SRC = "/audio/tetris-theme.mp3";

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

  @keyframes tt-settle { 0% { filter: brightness(1.9) } 100% { filter: brightness(1) } }
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

  @keyframes tt-count { 0% { transform: scale(.5); opacity: 0 } 30% { transform: scale(1); opacity: 1 } 100% { transform: scale(1.4); opacity: 0 } }
  .tt-count { animation: tt-count 900ms ease-out both }

  @media (prefers-reduced-motion: reduce) {
    .tt-clearing { animation: none !important; opacity: .25 }
    .tt-settle, .tt-buzz, .tt-levelup, .tt-count { animation: none !important }
    /* The badge still appears — it is information, not decoration — it just
       does not fly around to do it. */
    .tt-tetris { animation: none !important; opacity: 1 }
  }
`;

/* ------------------------------------------------------------- the engine */
/* `active` is whether there is a game to play at all; `paused` is whether the
   player has stepped away from one. They are separate because the music holds
   its place for a pause and rewinds for a stop. */
function useTetrisEngine({ seed, active = true, paused = false, onProgress, onOver }) {
  const live = active && !paused;
  const [game, setGame] = useState(() => newGame(seed));
  const gameRef = useRef(game);
  const [buzz, setBuzz] = useState(0);
  const [levelUp, setLevelUp] = useState(0);
  const [rushUp, setRushUp] = useState(0);
  const [settle, setSettle] = useState(null);

  const acc = useRef({ drop: 0, lock: 0, clear: 0, das: 0, arr: 0, dir: 0, soft: false, resets: 0 });
  const touch = useRef(null);
  const prevLevel = useRef(1);
  const prevRush = useRef(1);
  const prevPiece = useRef(null);
  /* A hold swaps the piece, which looks exactly like a spawn from the outside.
     Without this the two cues fire together and it reads as a stutter. */
  const heldJustNow = useRef(false);
  const cb = useRef({ onProgress, onOver });
  cb.current = { onProgress, onOver };

  /* The seed is the whole identity of a game. Local play bumps it to restart;
     online play is handed a new one by the server on a rematch. Either way,
     a new seed means a new board. */
  useEffect(() => {
    const fresh = newGame(seed);
    acc.current = { drop: 0, lock: 0, clear: 0, das: 0, arr: 0, dir: 0, soft: false, resets: 0 };
    prevLevel.current = 1;
    prevRush.current = 1;
    setSettle(null);
    gameRef.current = fresh;
    setGame(fresh);
  }, [seed]);

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
    if (!live) return;
    apply((g) => { const n = moveBy(g, dx, 0); if (n !== g) bumpLock(); return n; });
  }, [apply, bumpLock, live]);

  const doRotate = useCallback((dir) => {
    if (!live) return;
    apply((g) => { const n = rotate(g, dir); if (n !== g) { bumpLock(); sfx.rotate(); } return n; });
  }, [apply, bumpLock, live]);

  const doHold = useCallback(() => {
    if (!live) return;
    apply((g) => {
      const next = holdPiece(g);
      if (next !== g) { heldJustNow.current = true; sfx.hold(); }
      return next;
    });
  }, [apply, live]);

  const doHardDrop = useCallback(() => {
    if (!live) return;
    apply((g) => {
      if (g.status !== "playing" || !g.piece) return g;
      setSettle({ cells: pieceCells({ ...g.piece, y: ghostY(g) }).map(([x, y]) => `${x},${y}`), id: Date.now() });
      const a = acc.current;
      a.lock = 0; a.resets = 0; a.drop = 0;
      sfx.land();
      return hardDrop(g);
    });
  }, [apply, live]);

  const setDir = useCallback((dir) => {
    const a = acc.current;
    if (dir === 0) { a.dir = 0; return; }
    if (a.dir !== dir) { a.dir = dir; a.das = 0; a.arr = 0; doMove(dir); }
  }, [doMove]);

  const setSoft = useCallback((on) => { acc.current.soft = on; }, []);

  /* --------------------------------------------------------------- loop */
  useEffect(() => {
    if (!live || game.status === "over") return;
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

        /* Level curve plus the score tier. Soft drop never makes a piece
           slower than it was already falling. */
        const natural = fallMs(g.level, g.score);
        const speed = a.soft ? Math.min(natural, SOFT_MS) : natural;
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
            sfx.land();
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
  }, [live, game.status]);

  /* The settle highlight is a flash, not a state — drop it once it has run. */
  useEffect(() => {
    if (!settle) return;
    const t = setTimeout(() => setSettle(null), 200);
    return () => clearTimeout(t);
  }, [settle]);

  useEffect(() => {
    if (game.status !== "clearing" || !game.pending) return;
    if (game.pending.length === 4) { setBuzz((b) => b + 1); sfx.tetris(); } else sfx.clear();
  }, [game.status, game.pending]);

  /* A new piece in play. Skipped when it arrived by a hold, which has already
     made its own noise. */
  useEffect(() => {
    const id = game.piece?.id ?? null;
    if (id !== null && id !== prevPiece.current) {
      if (!heldJustNow.current) sfx.spawn();
      heldJustNow.current = false;
    }
    prevPiece.current = id;
  }, [game.piece?.id]);

  useEffect(() => { if (game.status === "over") sfx.over(); }, [game.status]);

  /* Music runs while there is a game to play — not through the Ready screen,
     not over the countdown, and not on top of the game-over sting. */
  const scored = active && game.status !== "over";
  useEffect(() => {
    if (!scored) { stopMusic(); return undefined; }
    startMusic(MUSIC_SRC);
    return () => stopMusic();
  }, [scored]);

  /* Pausing holds the track where it is rather than stopping it, so resuming
     picks up the same bar instead of starting the piece again. */
  useEffect(() => {
    if (!scored) return;
    if (paused) pauseMusic(); else resumeMusic();
  }, [paused, scored]);

  useEffect(() => {
    if (game.level > prevLevel.current) { prevLevel.current = game.level; setLevelUp((n) => n + 1); sfx.levelUp(); }
  }, [game.level]);

  /* Crossing a score tier makes everything suddenly faster. Say so, or it
     reads as the game glitching. */
  useEffect(() => {
    const rush = speedMultiplier(game.score);
    if (rush > prevRush.current) { prevRush.current = rush; setRushUp((n) => n + 1); }
  }, [game.score]);

  /* The board is a new array on every lock and every clear, which makes it
     the natural heartbeat to report on — a few times a second at most, rather
     than per frame. */
  useEffect(() => { cb.current.onProgress?.(gameRef.current); }, [game.board]);
  useEffect(() => { if (game.status === "over") cb.current.onOver?.(gameRef.current); }, [game.status]);

  /* ------------------------------------------------------------ keyboard */
  useEffect(() => {
    if (!live) return;
    const press = (k) => {
      switch (k) {
        case "arrowleft": case "a": setDir(-1); break;
        case "arrowright": case "d": setDir(1); break;
        case "arrowup": case "w": doRotate(1); break;
        case "z": doRotate(-1); break;            // the other way, for anyone who wants it
        case "arrowdown": case "s": setSoft(true); break;
        case "control": doHardDrop(); break;
        case " ": case "spacebar": doHold(); break;
        default: break;
      }
    };
    const release = (k) => {
      const a = acc.current;
      if (k === "arrowleft" || k === "a") { if (a.dir === -1) setDir(0); }
      else if (k === "arrowright" || k === "d") { if (a.dir === 1) setDir(0); }
      else if (k === "arrowdown" || k === "s") setSoft(false);
    };

    const onDown = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      /* Ctrl is a game control here, so it has to be read before the modifier
         guard below would swallow it. Only the bare key counts: a real
         shortcut like Ctrl+R arrives as a second keydown for "r", and that one
         still hits the guard. The cost is that reaching for Ctrl+anything
         mid-game drops the piece first. */
      if (k === "control") {
        e.preventDefault();
        if (!e.repeat) press("control");
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!KEY_SET.has(k)) return;
      e.preventDefault();          // arrows and space would scroll the page
      if (e.repeat) return;        // the loop does its own auto-repeat
      press(k);
    };
    const onUp = (e) => { const k = e.key.toLowerCase(); if (KEY_SET.has(k)) release(k); };
    /* Losing focus mid-hold would otherwise leave a direction stuck down. */
    const onBlur = () => { setDir(0); setSoft(false); };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [live, setDir, setSoft, doRotate, doHold, doHardDrop]);

  /* --------------------------------------------------------------- touch */
  const boardTouch = {
    onTouchStart: (e) => {
      const t = e.touches[0];
      touch.current = { x: t.clientX, y: t.clientY, at: performance.now(), moved: false };
    },
    onTouchMove: (e) => {
      const s = touch.current;
      if (!s) return;
      const t = e.touches[0];
      const dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
        doMove(dx > 0 ? 1 : -1);
        s.x = t.clientX;            // let a continued drag keep stepping
        s.moved = true;
      } else if (dy > SWIPE_PX * 1.6 && Math.abs(dy) > Math.abs(dx)) {
        setSoft(true);              // dragged downwards: fall faster
        s.moved = true;
      }
      if (!s.moved && performance.now() - s.at > TAP_MS) setSoft(true);
    },
    onTouchEnd: () => {
      const s = touch.current;
      touch.current = null;
      setSoft(false);
      if (!s) return;
      if (!s.moved && performance.now() - s.at < TAP_MS) doRotate(1);
    },
  };

  return {
    game, buzz, levelUp, rushUp, settle, boardTouch,
    rush: speedMultiplier(game.score),
    actions: { setDir, setSoft, doRotate, doHold, doHardDrop },
  };
}

const KEY_SET = new Set([
  "arrowleft", "arrowright", "arrowup", "arrowdown",
  "a", "d", "s", "w", "z", "control", " ", "spacebar",
]);

/* ---------------------------------------------------------------- pieces */
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
        return <div key={i} style={{ borderRadius: 3, ...(on ? cellFace(type) : { background: "transparent" }) }} />;
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

/* The score tier, worn next to the score that earned it. */
function RushChip({ rush }) {
  if (rush <= 1) return null;
  return (
    <span style={{
      fontSize: "0.625rem", fontWeight: 800, color: "#fff", background: COLOURS.Z,
      borderRadius: 20, padding: "1px 6px", marginLeft: 5, verticalAlign: "middle",
      letterSpacing: ".02em", whiteSpace: "nowrap",
    }}>×{rush}</span>
  );
}

const WELL_BG = "#221a14";
const WELL_EMPTY = "#2f251d";

/* The playfield. Everything floating above the board is flattened into one
   grid first, so the renderer never has to think about layers. */
function Well({ game, buzz, settle, boardTouch, frozen }) {
  const view = game.board.map((row) => row.map((t) => (t ? { type: t } : null)));
  const clearing = new Set(game.pending || []);

  if (game.piece && game.status === "playing" && !frozen) {
    const gy = ghostY(game);
    for (const [x, y] of pieceCells({ ...game.piece, y: gy })) {
      if (y >= 0 && y < ROWS && !view[y][x]) view[y][x] = { type: game.piece.type, ghost: true };
    }
    for (const [x, y] of pieceCells(game.piece)) {
      if (y >= 0 && y < ROWS) view[y][x] = { type: game.piece.type };
    }
  }

  return (
    <div key={buzz} className={buzz ? "tt-buzz" : undefined} {...boardTouch}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, 1fr)`,
        gridTemplateRows: `repeat(${ROWS}, 1fr)`,
        gap: 1,
        /* The well is dark in both themes — see the note in the rules about it
           being the only background all seven pieces read against. */
        background: WELL_BG,
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
                : { background: WELL_EMPTY }),
            }} />
        );
      }))}
    </div>
  );
}

/* The opponent, drawn from the packed bitmask the server relays. No colours:
   at this size they would be confetti. */
function OpponentWell({ rows, alive }) {
  const filled = Array.isArray(rows) && rows.length === ROWS ? rows : Array(ROWS).fill(0);
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(${COLS}, 1fr)`,
      gridTemplateRows: `repeat(${ROWS}, 1fr)`,
      gap: 1, background: WELL_BG, padding: 3, borderRadius: 8,
      width: "min(30vw, 108px)", aspectRatio: `${COLS} / ${ROWS}`,
      boxShadow: `inset 0 1px 6px rgba(0,0,0,.5), ${SHADOW.sm}`,
      opacity: alive ? 1 : .45, transition: "opacity .3s",
    }}>
      {filled.flatMap((bits, y) => Array.from({ length: COLS }, (_, x) => (
        <div key={`${x},${y}`} style={{
          borderRadius: 1,
          background: (bits >> x) & 1 ? C.dim : WELL_EMPTY,
        }} />
      )))}
    </div>
  );
}

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

function Pad({ actions }) {
  const { setDir, setSoft, doRotate, doHold, doHardDrop } = actions;
  return (
    <div style={{ width: "min(100%, 340px)", marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <PadBtn label="Left" icon={<Arrow rotate={90} />} onPress={() => setDir(-1)} onRelease={() => setDir(0)} />
        <PadBtn label="Rotate" wide icon={
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" />
          </svg>
        } onPress={() => doRotate(1)} />
        <PadBtn label="Right" icon={<Arrow rotate={-90} />} onPress={() => setDir(1)} onRelease={() => setDir(0)} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <PadBtn label="Hold" icon={
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 9h6v6H9z" />
          </svg>
        } onPress={doHold} />
        <PadBtn label="Soft drop" wide icon={<Arrow />}
          onPress={() => setSoft(true)} onRelease={() => setSoft(false)} />
        <PadBtn label="Drop" icon={
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 4v11M6 11l6 6 6-6M5 21h14" />
          </svg>
        } onPress={doHardDrop} />
      </div>
    </div>
  );
}

/* The attribution the track's licence asks for. Deliberately not in
   content.js: everything in that file is copy somebody can reword or empty
   from /admin, and this is a condition of using the music rather than a
   sentence about the game. */
function MusicCredit() {
  return (
    <p style={{ fontSize: "0.6875rem", color: C.dim, marginTop: 18, textAlign: "center", lineHeight: 1.6, maxWidth: 420 }}>
      Music —{" "}
      <a href="https://www.youtube.com/watch?v=NEPsBlNggno" target="_blank" rel="noopener noreferrer"
        style={{ color: C.accent, fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 2 }}>
        Tetris (Dark Version) by Myuu
      </a>{" "}
      is licensed under a Creative Commons License (No Copyright Music)
    </p>
  );
}


/* Just the bindings, keyboard and touch, rather than a paragraph explaining
   the game to somebody who has already opened it. */
function Controls() {
  const row = (label, keys) => keys ? (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline", justifyContent: "center", flexWrap: "wrap" }}>
      <span style={{
        fontSize: "0.625rem", letterSpacing: ".16em", textTransform: "uppercase",
        color: C.dim, fontWeight: 700, flexShrink: 0,
      }}>{label}</span>
      <span style={{ fontSize: "0.8125rem", color: C.dim }}>{keys}</span>
    </div>
  ) : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 16, textAlign: "center" }}>
      {row("Keyboard", CONTENT.intros?.tetrisKeys)}
      {row("Touch", CONTENT.intros?.tetrisTouch)}
    </div>
  );
}

function TetrisBadge({ buzz }) {
  if (!buzz) return null;
  return (
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
  );
}

function BoardOverlay({ title, body, children }) {
  return (
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
        }}>{title}</div>
        {body && <div style={{ color: C.dim, fontSize: "0.875rem", marginBottom: 14 }}>{body}</div>}
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ local play */
function LocalTetris({ onOnline }) {
  const [seed, setSeed] = useState(randomSeed);
  const [best, setBest] = useState(readBest);
  /* Nothing falls until the player says so. Landing on the page with a piece
     already dropping means the first few seconds are spent catching up rather
     than playing, and the same is true of every new board — so the gate comes
     back on a restart too, rather than only on first load. */
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState("local");
  const board = useScoreSubmit("tetris");
  /* Reading the leaderboard pauses the game. The tab is reachable mid-drop,
     and a piece that keeps falling behind a table of other people's scores
     would cost you the run you were about to post. */
  const { game, buzz, levelUp, rushUp, rush, settle, boardTouch, actions } =
    useTetrisEngine({ seed, active: started, paused: paused || view !== "local" });

  const newGame = useCallback(() => { setSeed(randomSeed()); setStarted(false); setPaused(false); }, []);

  useEffect(() => {
    if (game.score > best) { setBest(game.score); writeBest(game.score); }
  }, [game.score, best]);

  const over = game.status === "over";

  /* Posted on the top-out rather than as the score climbs, so the board is not
     being written to several times a second. What goes up is the stored best,
     not this run — the resend is what repairs a submission a bad connection
     lost, and the server keeps the higher of the two either way. */
  useEffect(() => {
    if (!over) return;
    board.submit("solo", Math.max(best, game.score));
  }, [over]);      // deliberately once, on the transition into "over"
  const canPause = started && !over;

  /* Escape is the pause key everywhere else, so it is the pause key here.
     Deliberately only in solo play: an online board that stops while the
     opponent's keeps falling is not a pause, it is a way of never topping
     out. */
  useEffect(() => {
    if (!canPause) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setPaused((p) => !p);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canPause]);

  // Any key that would have played the game starts it instead.
  useEffect(() => {
    if (started || over || view !== "local") return;
    const go = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k !== "control" && (e.metaKey || e.ctrlKey || e.altKey)) return;
      if (!KEY_SET.has(k) && k !== "enter") return;
      e.preventDefault();
      setStarted(true);
    };
    window.addEventListener("keydown", go);
    return () => window.removeEventListener("keydown", go);
  }, [started, over, view]);


  return (
    <Centered>
      <style>{styleBlock}</style>
      {/* Sound has its own switch in the site header now, next to the theme
          toggle — it applies to every game, so it belongs there rather than
          being repeated inside each one. */}
      <PlayTabs localLabel="Solo" onOnline={onOnline} gameId="tetris" view={view} setView={setView} />

      {view === "board" ? <LeaderboardPanel gameId="tetris" localBest={() => best || null} /> : <>

      <div className="tt-wrap">
        <div className="tt-side tt-left">
          <Panel label="Score" style={{ position: "relative", overflow: "hidden" }}>
            <div className="tt-stat-big" style={statValue(true)}>
              {game.score}<RushChip rush={rush} />
            </div>
            <div key={rushUp} className={rushUp ? "tt-levelup" : undefined} style={{
              position: "absolute", inset: 0, background: COLOURS.Z, opacity: 0, pointerEvents: "none",
            }} />
          </Panel>
          <Panel label="Best"><div style={statValue(false)}>{Math.max(best, game.score)}</div></Panel>
          <Panel label="Level" style={{ position: "relative", overflow: "hidden" }}>
            <div style={statValue(false)}>{game.level}</div>
            <div key={levelUp} className={levelUp ? "tt-levelup" : undefined} style={{
              position: "absolute", inset: 0, background: C.accent, opacity: 0, pointerEvents: "none",
            }} />
          </Panel>
          <Panel label="Lines"><div style={statValue(false)}>{game.lines}</div></Panel>
          <Panel label="Hold"><MiniPiece type={game.hold} /></Panel>
        </div>

        <div className="tt-board" style={{ position: "relative" }}>
          <Well game={game} buzz={buzz} settle={settle} boardTouch={boardTouch} frozen={!started} />
          <TetrisBadge buzz={buzz} />
          {!started && !over && (
            <BoardOverlay title="Ready?" body={CONTENT.intros?.tetrisKeys}>
              <Btn onClick={() => setStarted(true)}>Start</Btn>
            </BoardOverlay>
          )}
          {paused && !over && (
            <BoardOverlay title="Paused" body="Esc to carry on.">
              <Btn onClick={() => setPaused(false)}>Resume</Btn>
            </BoardOverlay>
          )}
          {over && (
            <BoardOverlay title="Topped out"
              body={`${game.score} points, ${game.lines} lines, level ${game.level}.`}>
              <Btn onClick={newGame}>New game</Btn>
            </BoardOverlay>
          )}
        </div>

        <div className="tt-side tt-right">
          <Panel label="Next">
            <div className="tt-next" style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
              {game.queue.slice(0, PREVIEW).map((t, i) => (
                <MiniPiece key={i} type={t} size={i === 0 ? 13 : 10} />
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Pad actions={actions} />

      <Controls />

      <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
        {canPause && (
          <Btn variant="ghost" onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume" : "Pause"}
          </Btn>
        )}
        <Btn variant="subtle" onClick={newGame}>Restart</Btn>
      </div>

      <MusicCredit />
      </>}

      <NamePrompt open={board.needsName} metric="score" onClose={board.dismiss} />
    </Centered>
  );
}

/* ----------------------------------------------------------- online play
   Both players run this same engine on the same seed, so they get the same
   pieces in the same order. The server owns the seed and the verdict; what
   travels is a score and a packed board, a few times a second. */
function OnlineTetris({ roomCode, navigate }) {
  const [name, setName] = useState(() => savedName());
  const { status, room, me, playerId, error, send } = useRoom({ gameId: 'tetris', roomCode, name });
  const [countdown, setCountdown] = useState(0);
  const sentTopOut = useRef(null);

  const g = room?.game;
  const startsAt = g?.startsAt ?? 0;
  const playing = room?.status === 'playing';

  /* Both players see the same "get ready" because both are counting to the
     same server timestamp, not to a timer each started on arrival. */
  useEffect(() => {
    if (!playing || !startsAt) { setCountdown(0); return; }
    const tick = () => setCountdown(Math.max(0, Math.ceil((startsAt - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [playing, startsAt]);

  const live = playing && countdown === 0;

  const onProgress = useCallback((state) => {
    if (state.status === 'over') return;      // the topout report carries the final figures
    send({ type: 'move', kind: 'progress', score: state.score, lines: state.lines, level: state.level, rows: packRows(state.board) });
  }, [send]);

  const onOver = useCallback((state) => {
    /* Keyed on the round, so a rematch can report again but a re-render
       cannot double-report the same death. */
    if (sentTopOut.current === g?.roundNo) return;
    sentTopOut.current = g?.roundNo;
    send({ type: 'move', kind: 'topout', score: state.score, lines: state.lines, level: state.level, rows: packRows(state.board) });
  }, [send, g?.roundNo]);

  const engine = useTetrisEngine({
    seed: g?.seed ?? 1,
    active: live,
    onProgress: playing ? onProgress : undefined,
    onOver: playing ? onOver : undefined,
  });

  const lobby = lobbyView({ status, room, me, roomCode, gameId: 'tetris', navigate, name, onName: setName, send });
  if (lobby) return lobby;

  const opponent = room.players.find((p) => p.id !== playerId);
  const mine = g.boards?.[playerId];
  const theirs = opponent ? g.boards?.[opponent.id] : null;
  const over = room.status === 'over';
  const stale = opponent && !opponent.connected && Date.now() - opponent.lastSeen > 90000;

  const verdict = over
    ? (g.forfeitedBy ? `${opponent?.name ?? 'They'} left — you win`
      : g.draw ? 'You both went at once'
      : g.winner === playerId ? 'You outlasted them!'
      : `${opponent?.name ?? 'They'} outlasted you`)
    : null;

  return (
    <Centered>
      <style>{styleBlock}</style>
      <RoomStatus status={status} error={error} />

      <div style={{ display: "flex", gap: 18, fontSize: "0.875rem", marginBottom: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <span style={{ color: C.accent, fontWeight: 800 }}>{me.name} {g.wins?.[playerId] ?? 0}</span>
        <span style={{ color: C.dim }}>vs</span>
        <span style={{ color: C.accent2, fontWeight: 800 }}>{opponent?.name ?? '—'} {opponent ? (g.wins?.[opponent.id] ?? 0) : 0}</span>
        <span style={{ color: C.dim }}>Round {g.roundNo}</span>
      </div>

      {opponent && !opponent.connected && !over && (
        <div style={{ background: C.panel2, borderRadius: 12, padding: "10px 16px", marginBottom: 12, fontSize: "0.84375rem", textAlign: "center", maxWidth: 380 }}>
          {opponent.name} lost connection. Their seat is held while they reconnect.
          {stale && <div style={{ marginTop: 8 }}>
            <Btn variant="ghost" style={{ padding: "7px 16px", fontSize: "0.8125rem" }} onClick={() => send({ type: 'claim' })}>Claim the win</Btn>
          </div>}
        </div>
      )}

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Well game={engine.game} buzz={engine.buzz} settle={engine.settle}
              boardTouch={engine.boardTouch} frozen={!live} />
            <TetrisBadge buzz={engine.buzz} />

            {countdown > 0 && (
              <BoardOverlay title={String(countdown)} body="Same pieces, both boards. Last one standing wins.">
                <span key={countdown} className="tt-count" style={{ display: "block", height: 0 }} />
              </BoardOverlay>
            )}

            {over && (
              <BoardOverlay title={verdict}
                body={`You: ${mine?.score ?? 0} · ${opponent?.name ?? 'Them'}: ${theirs?.score ?? 0}`}>
                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <Btn onClick={() => send({ type: 'rematch' })}>Play again</Btn>
                  <Btn variant="ghost" onClick={() => navigate('tetris')}>Leave</Btn>
                </div>
              </BoardOverlay>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <Panel label="Score" style={{ minWidth: 84, position: "relative", overflow: "hidden" }}>
              <div style={statValue(false)}>{engine.game.score}<RushChip rush={engine.rush} /></div>
              <div key={engine.rushUp} className={engine.rushUp ? "tt-levelup" : undefined} style={{
                position: "absolute", inset: 0, background: COLOURS.Z, opacity: 0, pointerEvents: "none",
              }} />
            </Panel>
            <Panel label="Lines" style={{ minWidth: 62 }}>
              <div style={statValue(false)}>{engine.game.lines}</div>
            </Panel>
            <Panel label="Hold" style={{ minWidth: 62 }}><MiniPiece type={engine.game.hold} size={9} /></Panel>
            <Panel label="Next" style={{ minWidth: 62 }}><MiniPiece type={engine.game.queue[0]} size={9} /></Panel>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: "0.6875rem", letterSpacing: ".14em", textTransform: "uppercase", color: C.dim, fontWeight: 700 }}>
            {opponent?.name ?? 'Opponent'}{theirs && !theirs.alive ? ' — out' : ''}
          </div>
          <OpponentWell rows={theirs?.rows} alive={theirs?.alive !== false} />
          <Panel label="Their score" style={{ minWidth: 92 }}>
            <div style={statValue(false)}>{theirs?.score ?? 0}</div>
          </Panel>
        </div>
      </div>

      {!over && <Pad actions={engine.actions} />}

      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn variant="subtle" onClick={() => navigate('tetris')}>Leave room</Btn>
      </div>

      <MusicCredit />
    </Centered>
  );
}

export default function Tetris({ roomCode, mode, navigate }) {
  /* The host/join screen is a route, not component state, so a refresh while
     choosing keeps you on it instead of dropping back to the local game. */
  if (roomCode) return <OnlineTetris roomCode={roomCode} navigate={navigate} />;
  if (mode === 'online') {
    return <OnlineEntry gameId="tetris" gameName="Tetris" navigate={navigate}
      onCancel={() => navigate('tetris')} />;
  }
  return <LocalTetris onOnline={() => navigate('tetris', 'online')} />;
}
