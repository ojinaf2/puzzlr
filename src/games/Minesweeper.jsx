import { useState, useEffect, useRef, useCallback } from 'react';
import { C, SHADOW, GLOSS, GLOSS_SOFT, PILL, paleGrad, EASE } from '../shared/theme.js';
import { Btn, TileBtn, Centered, hStyle, pStyle } from '../shared/ui.jsx';
import {
  LEVELS, COVERED, REVEALED, FLAGGED, newGame, revealAt, toggleFlag, chord,
  minesLeft, bestKey, formatTime, levelOf, transpose,
} from './minesweeperRules.js';
import { sfx } from '../shared/sound.js';
import { LeaderboardTabs, LeaderboardPanel, NamePrompt } from '../shared/leaderboardUi.jsx';
import { useScoreSubmit, useBoardView } from '../shared/leaderboard.js';

/* ============================= MINESWEEPER =============================
   Rules live in ./minesweeperRules.js so they can be tested without a browser.
   This file is the board, the clock and the input handling.

   INPUT IS THE FIDDLY PART
   One pointer handler covers both a mouse and a finger. A press that lasts
   400ms places a flag and then suppresses the click that would otherwise
   follow it, because a long press on touch still fires a click on release —
   without that suppression every flag would immediately uncover the cell it
   had just protected.                                                      */

const LONG_PRESS_MS = 400;

/* Classic Minesweeper's number colours, pulled toward the site's palette and
   given a second set for the dark theme, where the originals are unreadable
   against a dark tile. */
const NUM_LIGHT = ["", "#2f6fd0", "#2e8b57", "#c0392b", "#6b3fa0", "#8d3220", "#1f8a8a", "#4a3524", "#7a6a5a"];
const NUM_DARK  = ["", "#77acff", "#6ac585", "#ff8a75", "#c39aeb", "#e0876a", "#5fd0d0", "#e8d9c2", "#b3a58f"];

/* `null` means no record, which is not the same as a record of zero. A first
   click can clear an Easy board outright, and treating that 0 as "unset" would
   throw away the best time anybody can have. */
const readBest = (key) => {
  try {
    const raw = localStorage.getItem(bestKey(key));
    if (raw === null) return null;
    const v = Number(raw);
    return Number.isFinite(v) && v >= 0 ? v : null;
  } catch { return null; }
};
const writeBest = (key, seconds) => {
  try { localStorage.setItem(bestKey(key), String(seconds)); } catch { /* private mode */ }
};

/* A board wider than it is tall does not fit across a phone. Below this the
   wide levels are laid out on their side instead. Read once per board rather
   than watched, so rotating the device mid-game cannot rebuild the board and
   throw away a run in progress. */
const NARROW = 560;
const isNarrow = () => typeof window !== "undefined" && window.innerWidth < NARROW;

const shapeFor = (key) => {
  const level = levelOf(key);
  return isNarrow() && level.cols > level.rows ? transpose(level) : level;
};

export default function Minesweeper({ mode, navigate }) {
  const [screen, setScreen] = useState("menu");
  const [levelKey, setLevelKey] = useState("easy");
  const [g, setG] = useState(() => newGame("easy"));
  const [seconds, setSeconds] = useState(0);
  const [best, setBest] = useState(null);
  const [view, setView] = useBoardView('minesweeper', mode, navigate);
  const board = useScoreSubmit("minesweeper");
  const press = useRef(null);
  const startedAt = useRef(0);

  const over = g.status === "won" || g.status === "lost";

  /* The clock starts on the first click, not on mount, and is torn down the
     moment the game ends so nothing keeps ticking behind the result.

     Elapsed time is measured from a timestamp rather than by counting ticks:
     a counting interval drifts, and browsers throttle timers in a background
     tab, so a player who switched away mid-game would come back to a clock
     that had quietly lost a chunk of their real time. */
  useEffect(() => {
    if (g.status !== "playing") return;
    if (!startedAt.current) startedAt.current = Date.now();
    const tick = () => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [g.status]);

  // Freeze the exact elapsed time the instant it ends, not the last tick's.
  useEffect(() => {
    if (!over || !startedAt.current) return;
    setSeconds(Math.floor((Date.now() - startedAt.current) / 1000));
  }, [over]);

  // A best time is only meaningful on a win, and only if it beats the stored one.
  useEffect(() => {
    if (g.status !== "won") return;
    const final = startedAt.current ? Math.floor((Date.now() - startedAt.current) / 1000) : seconds;
    /* Read before the updater below runs — `setBest`'s function form is not
       called until the next render, so this is still the previously stored
       time, which is exactly what `final` needs comparing against. */
    const stored = readBest(levelKey);
    setBest((prev) => {
      if (prev !== null && final >= prev) return prev;
      writeBest(levelKey, final);
      return final;
    });
    // The board ranks the fastest clear on this level, so what goes up is the
    // better of the two — resent on every win, which repairs a submission an
    // earlier bad connection dropped.
    board.submit(levelKey, stored === null ? final : Math.min(stored, final));
  }, [g.status]);      // deliberately once, on the transition into "won"

  const start = (key) => {
    setLevelKey(key);
    setBest(readBest(key));
    setG(newGame(shapeFor(key)));
    setSeconds(0);
    startedAt.current = 0;
    setScreen("play");
  };

  const restart = useCallback(() => {
    setG(newGame(shapeFor(levelKey)));
    setSeconds(0);
    startedAt.current = 0;
  }, [levelKey]);

  const tap = useCallback((i) => {
    sfx.tap();
    setG((prev) => (prev.state[i] === REVEALED ? chord(prev, i) : revealAt(prev, i)));
  }, []);

  const flag = useCallback((i) => { sfx.flag(); setG((prev) => toggleFlag(prev, i)); }, []);

  useEffect(() => {
    if (g.status === "lost") sfx.boom();
    if (g.status === "won") sfx.win();
  }, [g.status]);

  /* --------------------------------- input --------------------------------- */
  const onPointerDown = (e, i) => {
    if (e.button === 2) return;                       // the context menu handles this
    const timer = setTimeout(() => {
      if (press.current) press.current.fired = true;
      flag(i);
    }, LONG_PRESS_MS);
    press.current = { i, timer, fired: false };
  };

  const onPointerUp = (e, i) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    clearTimeout(p.timer);
    // The long press already flagged; swallow the click that follows it.
    if (p.fired || p.i !== i) return;
    tap(i);
  };

  const cancelPress = () => {
    if (!press.current) return;
    clearTimeout(press.current.timer);
    press.current = null;
  };

  useEffect(() => () => cancelPress(), []);

  /* --------------------------------- menu --------------------------------- */
  if (screen === "menu") return (
    <Centered>
      <LeaderboardTabs gameId="minesweeper" view={view} setView={setView} />
      {view === "board" ? (
        <LeaderboardPanel gameId="minesweeper" localBest={(key) => readBest(key)} />
      ) : <>
      <Anim />
      <h2 style={hStyle}>Minesweeper</h2>
      <p style={pStyle}>
        Uncover every square that is not a mine. A number tells you how many of
        the eight squares around it are mined. Your first click is always safe.
      </p>
      <div style={{ width: "100%", maxWidth: 460, textAlign: "left" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 22 }}>
          {LEVELS.map((l) => {
            const record = readBest(l.key);
            return (
              <TileBtn key={l.key} onClick={() => start(l.key)}
                style={{ padding: "14px 16px", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ flex: 1 }}>
                  <span style={{ fontSize: "1rem", fontWeight: 800, display: "block" }}>{l.name}</span>
                  <span style={{ fontSize: "0.8125rem", color: C.dim }}>{l.blurb}</span>
                </span>
                {record !== null && (
                  <span style={{ fontSize: "0.75rem", color: C.dim, background: PILL, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
                    Best {formatTime(record)}
                  </span>
                )}
              </TileBtn>
            );
          })}
        </div>
        <p style={{ ...pStyle, fontSize: "0.78125rem" }}>
          Right-click, or press and hold on a phone, to plant a flag. Tapping a
          number that already has all its flags opens the squares around it.
        </p>
      </div>
      </>}
    </Centered>
  );

  /* -------------------------------- playing -------------------------------- */
  const { level } = g;
  /* The columns are fractions of the board rather than a width computed from
     the viewport, so the board cannot overflow by construction. An earlier
     version measured against 100vw and was always a scrollbar's width too
     generous — 100vw counts the scrollbar, the space available to lay out in
     does not. The cap keeps cells from ballooning on a wide screen. */
  const maxBoard = level.cols * 34 + (level.cols - 1) * 2 + 16;

  return (
    <Centered>
      <Anim />

      <div style={{
        width: "100%", maxWidth: 430, display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 10, marginBottom: 14,
        background: paleGrad(C.panel), borderRadius: 14, padding: "9px 14px",
        boxShadow: `${GLOSS_SOFT}, ${SHADOW.sm}`,
      }}>
        <Counter icon={<MineIcon />} value={minesLeft(g)} label="Mines left" />
        <Face status={g.status} onClick={restart} />
        <Counter icon={<ClockIcon />} value={formatTime(seconds)} label="Time"
          sub={best !== null ? `Best ${formatTime(best)}` : null} />
      </div>

      {/* Hard is 30 columns wide, so on a phone the board scrolls inside this
          container rather than stretching the page. */}
      {/* `width: 100%` is load-bearing. This sits in a centred column flex
          container, so without it the box is shrink-to-fit — and the grid's
          own `min(100%, …)` would then be resolving a percentage against a
          parent that is sizing itself from that same grid. The circle
          collapses every column to zero. */}
      <div style={{ width: "100%", maxWidth: "100%", overflowX: "auto", padding: "2px 2px 6px", WebkitOverflowScrolling: "touch" }}>
        <div
          onContextMenu={(e) => e.preventDefault()}
          onPointerLeave={cancelPress}
          style={{
            display: "grid", gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))`,
            gap: 2, padding: 8, borderRadius: 14,
            width: `min(100%, ${maxBoard}px)`, margin: "0 auto",
            background: paleGrad(C.panel2), boxShadow: `${GLOSS_SOFT}, ${SHADOW.md}`,
            touchAction: "manipulation", userSelect: "none", WebkitUserSelect: "none",
            WebkitTouchCallout: "none",
          }}>
          {g.state.map((st, i) => {
            const open = st === REVEALED;
            const isMine = g.mine[i] === 1;
            const boom = over && i === g.hitIndex;
            /* On a loss every mine comes up; a flag on a cell that held no
               mine is marked wrong, which is how you learn what went astray.
               The cell that was actually hit is excluded — it draws its own
               emphasised mine below, and without this it matched both and
               rendered two mines stacked on top of each other. */
            const showMine = g.status === "lost" && isMine && st !== FLAGGED && !boom;
            const wrongFlag = g.status === "lost" && st === FLAGGED && !isMine;
            const n = g.adj[i];

            return (
              <button key={i}
                className={[
                  "ms-cell", open ? "ms-open" : "ms-covered",
                  open && !isMine && n > 0 ? `ms-n${n}` : "",
                  boom ? "ms-boom" : "", open && !boom ? "ms-reveal" : "",
                ].filter(Boolean).join(" ")}
                style={{ animationDelay: open ? `${Math.min(g.wave[i], 14) * 22}ms` : "0s" }}
                onPointerDown={(e) => onPointerDown(e, i)}
                onPointerUp={(e) => onPointerUp(e, i)}
                onPointerCancel={cancelPress}
                onContextMenu={(e) => { e.preventDefault(); flag(i); }}
                /* Describes what is actually on screen. On a loss every mine is
                   drawn even though only the one that was hit is `REVEALED`,
                   so keying this off `open` alone would announce nine mines as
                   "covered". */
                aria-label={
                  boom ? "exploded mine"
                    : showMine ? "mine"
                    : wrongFlag ? "wrong flag"
                    : st === FLAGGED ? "flagged"
                    : open ? (n ? `${n}` : "empty")
                    : "covered"
                }>
                {st === FLAGGED && !wrongFlag && <span className="ms-pop"><FlagIcon /></span>}
                {wrongFlag && <span className="ms-wrong"><FlagIcon /></span>}
                {showMine && <span className="ms-pop"><MineIcon /></span>}
                {boom && <MineIcon />}
                {open && !isMine && n > 0 && n}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ minHeight: 26, marginTop: 12, fontSize: "0.96875rem", fontWeight: 800 }}>
        {g.status === "won" && (
          <span style={{ color: C.correct }}>
            Cleared in {formatTime(seconds)}{best === seconds ? " — a new best!" : ""}
          </span>
        )}
        {g.status === "lost" && <span style={{ color: C.danger }}>That one was a mine.</span>}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn onClick={restart}>New board</Btn>
        <Btn variant="subtle" onClick={() => setScreen("menu")}>Change difficulty</Btn>
      </div>

      <NamePrompt open={board.needsName} metric="time" onClose={board.dismiss} />
    </Centered>
  );
}

/* ------------------------------------------------------------------ HUD */
function Counter({ icon, value, label, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 92 }} title={label}>
      <span style={{ color: C.dim, display: "grid", placeItems: "center" }}>{icon}</span>
      <span>
        <span style={{ fontSize: "1.1875rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", display: "block", lineHeight: 1.1 }}>{value}</span>
        {sub && <span style={{ fontSize: "0.65625rem", color: C.dim }}>{sub}</span>}
      </span>
    </div>
  );
}

/* The classic reset face. It is the restart button as well as the status. */
function Face({ status, onClick }) {
  const won = status === "won", lost = status === "lost";
  return (
    <button onClick={onClick} className="btn3d" aria-label="New board" title="New board"
      style={{
        width: 42, height: 42, borderRadius: 13, border: "none", cursor: "pointer", padding: 0,
        background: paleGrad(C.gold), boxShadow: `${GLOSS}, ${SHADOW.sm}`, display: "grid", placeItems: "center",
      }}>
      <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="#f6d97a" stroke="#a97e20" strokeWidth="1.2" />
        {lost ? (
          <>
            <path d="M7 8.5l3.4 3.4M10.4 8.5L7 11.9M13.6 8.5l3.4 3.4M17 8.5l-3.4 3.4"
              stroke="#6b4a12" strokeWidth="1.5" strokeLinecap="round" />
            <ellipse cx="12" cy="17" rx="2.6" ry="2" fill="#6b4a12" />
          </>
        ) : won ? (
          <>
            <path d="M5.4 9.6h5.1v2.2a1.6 1.6 0 0 1-3.2.2Zm8.1 0h5.1l-1.9 2.4a1.6 1.6 0 0 1-3.2-.2Z" fill="#4a3524" />
            <path d="M10.5 10h3" stroke="#4a3524" strokeWidth="1.2" />
            <path d="M8.4 16.4a5 5 0 0 0 7.2 0" stroke="#6b4a12" strokeWidth="1.7" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            <circle cx="9" cy="10" r="1.5" fill="#6b4a12" />
            <circle cx="15" cy="10" r="1.5" fill="#6b4a12" />
            <path d="M8.4 15.4a5 5 0 0 0 7.2 0" stroke="#6b4a12" strokeWidth="1.7" strokeLinecap="round" fill="none" />
          </>
        )}
      </svg>
    </button>
  );
}

const MineIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
    <g stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M12 2.6v3.2M12 18.2v3.2M2.6 12h3.2M18.2 12h3.2M5.3 5.3l2.3 2.3M16.4 16.4l2.3 2.3M18.7 5.3l-2.3 2.3M7.6 16.4l-2.3 2.3" />
    </g>
    <circle cx="12" cy="12" r="5.6" fill="currentColor" />
    <circle cx="10" cy="10" r="1.5" fill="#fff" opacity=".55" />
  </svg>
);

const ClockIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="13.4" r="8" />
    <path d="M12 9.4v4l2.4 1.6M9.4 2.6h5.2M12 2.6v2.8" />
  </svg>
);

const FlagIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
    <path d="M6 21h12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M8.5 21V3.6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    <path d="M8.5 4.2 19 8.2 8.5 12.4Z" fill="#c0492f" />
  </svg>
);

function Anim() {
  const nums = (list, sel) =>
    list.map((c, i) => (i ? `${sel} .ms-n${i}{color:${c}}` : "")).join("");
  return (
    <style>{`
      .ms-cell {
        aspect-ratio: 1 / 1; width: 100%; border: none; padding: 0; margin: 0;
        border-radius: 4px; cursor: pointer; font-family: inherit;
        font-size: clamp(10px, 2.4vw, 15px); font-weight: 800;
        display: grid; place-items: center; line-height: 1;
        -webkit-tap-highlight-color: transparent;
        transition: background .12s ${EASE}, filter .12s ${EASE};
      }
      .ms-covered {
        background: linear-gradient(180deg, var(--c-key), color-mix(in srgb, var(--c-key) 82%, #000));
        box-shadow: var(--gloss), 0 1px 1.5px rgba(0,0,0,.18);
        color: var(--c-text);
      }
      .ms-covered:hover { filter: brightness(1.07) }
      .ms-covered:active { filter: brightness(.93) }
      /* Revealed cells sit *into* the board: no top highlight, a soft inner
         shadow instead. That inversion is what reads as "opened". */
      .ms-open {
        background: color-mix(in srgb, var(--c-panel) 78%, var(--c-bg));
        box-shadow: inset 0 1px 2px rgba(0,0,0,.13);
        color: var(--c-dim); cursor: default;
      }
      .ms-boom { background: ${C.danger} !important; color: #fff !important }
      .ms-wrong { color: var(--c-dim); opacity: .55; position: relative }
      .ms-wrong::after {
        content: ""; position: absolute; inset: 12% 6%;
        border-top: 2px solid ${C.danger}; transform: rotate(-45deg);
      }
      ${nums(NUM_LIGHT, ":root")}
      ${nums(NUM_DARK, ':root[data-theme="dark"]')}
      @media (prefers-color-scheme: dark) { ${nums(NUM_DARK, ":root:not([data-theme])")} }

      @keyframes msReveal { from { opacity: .25; transform: scale(.84) } to { opacity: 1; transform: scale(1) } }
      @keyframes msPop { 0% { transform: scale(0) rotate(-25deg) } 60% { transform: scale(1.18) rotate(6deg) } 100% { transform: scale(1) rotate(0) } }
      @keyframes msBoom { 0% { transform: scale(.5) } 45% { transform: scale(1.35) } 100% { transform: scale(1) } }

      .ms-reveal { animation: msReveal .2s ${EASE} both }
      .ms-pop { animation: msPop .26s cubic-bezier(.34,1.56,.64,1) both; display: grid; place-items: center }
      .ms-boom { animation: msBoom .34s ease both }

      @media (prefers-reduced-motion: reduce) {
        .ms-reveal, .ms-pop, .ms-boom { animation: none !important }
      }
    `}</style>
  );
}
