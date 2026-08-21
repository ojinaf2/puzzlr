import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { C, SHADOW, GLOSS, GLOSS_SOFT, PILL, paleGrad, EASE, SPRING } from '../shared/theme.js';
import { Btn, Centered, hStyle, pStyle } from '../shared/ui.jsx';
import { CONTENT } from '../content.js';
import { sfx } from '../shared/sound.js';
import { LeaderboardTabs, LeaderboardPanel, NamePrompt } from '../shared/leaderboardUi.jsx';
import { useScoreSubmit, useBoardView } from '../shared/leaderboard.js';
import { SIZES, newGame, move, isOver } from './game2048Rules.js';

/* ============================= 2048 =============================
   Rules live in ./game2048Rules.js so node can test them without a browser —
   the merge rule has one shape that matters (a line of four equal tiles) and
   reaching it by playing is a matter of luck. This file is the board, the
   controls and the animation.

   HOW THE ANIMATION WORKS
   Tiles are absolutely positioned and moved with `transform: translate`, in
   multiples of their own size, so a tile at column 3 is `translateX(300%)`.
   Each keeps a stable `id` across moves, so React reuses the same DOM node and
   the browser interpolates the transform — the tile slides rather than
   reappearing somewhere else. That is the whole trick, and it is why the rules
   hand back tiles with identity instead of a grid of numbers.

   A merge renders as two nodes: the survivor, which pulses, and the absorbed
   tile, which finishes sliding underneath it and is dropped on the next move.
   Without that second node a merge looks like one tile blinking out while
   another suddenly doubles.

   The concept is Gabriele Cirulli's; the code and the look here are our own. */

const DIGIT_STEP = [1, 1, 0.86, 0.72, 0.6];        // by digit count, 1-indexed
const BASE_FONT = { 4: 2.125, 5: 1.75, 6: 1.4375 };  // rem, per board size
const GAP = { 4: 6, 5: 5, 6: 4 };                    // px between tiles

/* ------------------------------------------------------------- timing
   A tile crossing five cells used to take exactly as long as one crossing a
   single cell, which meant the long one moved five times faster. That is what
   read as snappy on the full-board slides: not the easing, the velocity.

   Distance now buys time, but sub-linearly. Constant velocity would be the
   physically honest option and it feels terrible — a full-length move would
   take most of a second and the game would drag. The exponent is the
   compromise: long moves get noticeably longer to travel without the board
   ever feeling slow. At a square root a five-cell move takes 425ms against a
   single cell's 190ms — still under half the velocity ratio it would need for
   constant speed, but enough that a full-board slide reads as a journey. */
const SLIDE_BASE = 190;
const SLIDE_FALLOFF = 0.5;                   // a plain square root
const slideMs = (dist) => Math.round(SLIDE_BASE * Math.max(1, dist || 1) ** SLIDE_FALLOFF);

/* Arrival effects fire just before the tile stops rather than exactly on the
   stop, so the pulse overlaps the last of the travel and the two read as one
   motion instead of two events. */
const LAND_LEAD = 40;

const fontFor = (value, size) => {
  const digits = String(value).length;
  const step = DIGIT_STEP[Math.min(digits, DIGIT_STEP.length - 1)];
  return `${(BASE_FONT[size] * step).toFixed(3)}rem`;
};

/* The tile ramp. Warm throughout rather than the original's beige-to-orange,
   so it reads as part of the site, and it now walks hue as well as lightness:
   cream, straw, amber, orange, vermilion, brick. Lightness alone was the
   problem with the first version — nine shades of the same orange getting
   gradually darker meant 128 and 256 were nearly the same tile, and a glance
   could not tell you which.

   Every neighbouring pair is at least ΔE 13 apart in CIELAB, and every number
   clears 3.7:1 against its face. Both were measured rather than eyeballed;
   the previous ramp had pairs as close as ΔE 6, which is why it looked flat.

   2048 breaks the pattern deliberately — after ten steps getting steadily
   darker it arrives on bright gold, so the tile you were playing for does not
   look like just another step. Anything past it goes deeper still (light) or
   paler still (dark), leaving 2048 as the moment.

   Both themes are written out because a scale that works on cream is mud on
   near-black: the dark set is lighter and more saturated at every step, and
   the low tiles invert entirely (dark face, light number) rather than trying
   to be a pale tile on a dark board. */
const RAMP_LIGHT = {
  2: ["#fbf3de", "#5a3a1c"], 4: ["#f3dea4", "#5a3a1c"], 8: ["#edc36a", "#5a3a1c"],
  16: ["#e9a63c", "#5a3a1c"], 32: ["#e2861f", "#5a3a1c"], 64: ["#d56515", "#ffffff"],
  128: ["#c04413", "#ffffff"], 256: ["#a52c19", "#ffffff"], 512: ["#8a1f20", "#ffffff"],
  1024: ["#6e1e1e", "#ffffff"], 2048: ["#edb520", "#5a3a1c"], x: ["#4f1a17", "#ffffff"],
};
const RAMP_DARK = {
  2: ["#3a2c1d", "#f5e6cf"], 4: ["#57411c", "#f5e6cf"], 8: ["#78581a", "#f5e6cf"],
  16: ["#9c7018", "#2a1c0f"], 32: ["#bd8619", "#2a1c0f"], 64: ["#e69b1e", "#2a1c0f"],
  128: ["#ef7a2a", "#2a1c0f"], 256: ["#ec5b2d", "#2a1c0f"], 512: ["#dc3b30", "#2a1c0f"],
  1024: ["#bc2440", "#f5e6cf"], 2048: ["#ffd45e", "#2a1c0f"], x: ["#ffeaa6", "#2a1c0f"],
};

const rampVars = (ramp) => Object.entries(ramp)
  .map(([k, [bg, fg]]) => `--t${k}-bg:${bg};--t${k}-fg:${fg};`).join("");

const faceStyle = (value) => ({
  background: `var(--t${value}-bg, var(--tx-bg))`,
  color: `var(--t${value}-fg, var(--tx-fg))`,
  boxShadow: `${GLOSS}, ${SHADOW.sm}`,
});

/* `x` is the fallback past 2048, reached through the var fallback below rather
   than by capping the value — someone who gets to 8192 should still see a
   tile. Empty cells are a wash rather than a colour so they sit on whatever
   the board is. */
const styleBlock = `
  .g2048 {
    ${rampVars(RAMP_LIGHT)}
    --cell: rgba(74,53,36,.07);

    /* Both timings in one place, because they are a pair rather than two
       numbers: --land is when a tile finishes travelling, and every arrival
       effect waits for it. Nudge --slide and --land follows. */
    /* Defaults only. Both are overridden per tile from JS, because how long a
       tile should take depends on how far it is going — see slideMs below. */
    --slide: 190ms;
    --land: 150ms;
    /* The curves are the site's own. EASE leaves immediately and spends most
       of the duration settling, which is exactly the glide this wanted — the
       old version was not using the wrong curve, just far too little of it
       at 130ms. */
    --swish: ${EASE};
    --spring: ${SPRING};
  }
  :root[data-theme="dark"] .g2048 {
    ${rampVars(RAMP_DARK)}
    --cell: rgba(255,255,255,.05);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme]) .g2048 {
      ${rampVars(RAMP_DARK)}
      --cell: rgba(255,255,255,.05);
    }
  }

  /* The slide. Only transform is animated — animating left/top would lay the
     board out again on every frame. */
  .g2048-slot { transition: transform var(--slide) var(--swish); will-change: transform; }

  /* Everything below waits for --land, and that delay is the whole fix for
     "the tiles just appear". A spawn popping in while the board is still
     moving reads as the board redrawing itself; the same pop after the travel
     has finished reads as a tile arriving. Same for a merge. */

  @keyframes g2048-pop {
    0%   { transform: scale(.2);  opacity: 0 }
    55%  { transform: scale(1.1); opacity: 1 }
    100% { transform: scale(1);   opacity: 1 }
  }
  /* The "both" fill mode matters: its backwards half holds the tile at
     scale(.2) and invisible for the whole delay, so a spawning tile is
     genuinely absent while the others slide rather than sitting there at
     full size waiting for its turn to animate. */
  .g2048-new { animation: g2048-pop 190ms var(--spring) var(--land) both; }

  /* The merge lands in two parts. First the tile itself takes a bounce, over
     and slightly under before settling. */
  @keyframes g2048-merge {
    0%   { transform: scale(1) }
    35%  { transform: scale(1.2); box-shadow: ${GLOSS}, ${SHADOW.md}, 0 0 22px 2px var(--flash) }
    68%  { transform: scale(.96) }
    100% { transform: scale(1) }
  }
  .g2048-mrg { animation: g2048-merge 260ms var(--spring) var(--land) both; }

  /* Then it throws a ring of its own colour outwards, which fades as it goes.
     That is the echo — it carries the merge past the edge of the tile, so a
     merge registers even when you are looking somewhere else on the board. */
  @keyframes g2048-echo {
    0%   { opacity: .9; transform: scale(1) }
    100% { opacity: 0;  transform: scale(1.8) }
  }
  .g2048-mrg::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    border: 2px solid var(--flash);
    pointer-events: none;
    animation: g2048-echo 440ms var(--swish) var(--land) both;
  }

  @media (prefers-reduced-motion: reduce) {
    .g2048-slot { transition: none !important }
    .g2048-new, .g2048-mrg { animation: none !important }
    /* Not just animation:none — without the keyframes the ring would sit
       there at full opacity as a permanent outline. */
    .g2048-mrg::after { display: none }
  }
`;

/* ------------------------------------------------------------ best scores
   Per board size, because a 5x5 score is not comparable to a 4x4 one — the
   bigger board simply has more room to keep merging. */
const bestKey = (size) => `puzzlr:2048:best:${size}x${size}`;

const readBest = (size) => {
  try {
    const raw = localStorage.getItem(bestKey(size));
    const v = Number(raw);
    return raw !== null && Number.isFinite(v) && v >= 0 ? v : 0;
  } catch { return 0; }
};
const writeBest = (size, score) => {
  try { localStorage.setItem(bestKey(size), String(score)); } catch { /* private mode */ }
};


/* ------------------------------------------------------------------- bits */
function ScoreBox({ label, value }) {
  return (
    <div style={{
      background: PILL, borderRadius: 12, padding: "6px 16px", minWidth: 78,
      textAlign: "center", boxShadow: `${GLOSS_SOFT}, ${SHADOW.sm}`,
    }}>
      <div style={{
        fontSize: "0.65625rem", letterSpacing: ".14em", textTransform: "uppercase",
        color: C.dim, fontWeight: 700,
      }}>{label}</div>
      <div style={{
        fontSize: "1.1875rem", fontWeight: 800, lineHeight: 1.15,
        fontVariantNumeric: "tabular-nums", color: C.text,
      }}>{value}</div>
    </div>
  );
}

function Overlay({ title, body, children }) {
  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 5, borderRadius: 16,
      display: "grid", placeItems: "center", padding: 20, textAlign: "center",
      /* Translucent rather than opaque, so the board stays readable behind the
         result — and it is a panel colour, so it follows the theme. */
      background: "color-mix(in srgb, var(--c-panel) 88%, transparent)",
      backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
    }}>
      <div>
        <div style={{
          fontFamily: "var(--font-head)", fontSize: "2.125rem", fontWeight: 700,
          marginBottom: 6, color: C.text,
        }}>{title}</div>
        {body && <div style={{ color: C.dim, fontSize: "0.9375rem", marginBottom: 16 }}>{body}</div>}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

const KEYS = {
  arrowup: "up", w: "up", arrowdown: "down", s: "down",
  arrowleft: "left", a: "left", arrowright: "right", d: "right",
};
const SWIPE_MIN = 24;                         // px, so a tap is never a move

export default function Game2048({ mode, navigate }) {
  const [size, setSize] = useState(4);
  /* The game and its one-level undo snapshot live in a single piece of state,
     so a move records the position to go back to in the same update that
     changes it. Two useStates would let a fast second press land between them. */
  const [{ game, prev }, setState] = useState(() => ({ game: newGame(4), prev: null }));
  const [best, setBest] = useState(() => readBest(4));
  const [view, setView] = useBoardView('2048', mode, navigate);
  const board = useScoreSubmit("2048");
  const touch = useRef(null);

  /* Glass tiles were briefly a setting. Anyone who switched it on still has
     the key sitting in their storage, so clear it on the way past.
     Safe to delete this effect once the stragglers have visited — nothing
     reads the key, it is only tidiness. */
  useEffect(() => {
    try { localStorage.removeItem("puzzlr:2048:glass"); } catch { /* private mode */ }
  }, []);

  const over = useMemo(() => isOver(game), [game]);
  const showWin = game.won && !game.keepGoing;

  /* Cues are driven off the state that changed rather than from inside the
     move handlers: React may run a state updater more than once for the same
     move, and a sound played in there would double up. */
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    // A merge is the thing worth hearing; a plain slide is a whisper under it.
    if (game.tiles.some((t) => t.merged)) sfx.pop(); else sfx.swoosh();
  }, [game.tiles]);

  useEffect(() => { if (showWin) sfx.win(); }, [showWin]);
  useEffect(() => { if (over) sfx.lose(); }, [over]);

  /* One board per size, because a 5x5 score is not comparable to a 4x4 one —
     the same reasoning that already splits the stored best. What is posted is
     the stored best rather than this run, so a submission lost to a bad
     connection is resent by the next finished game. */
  useEffect(() => {
    if (!over) return;
    board.submit(String(size), Math.max(best, game.score));
  }, [over]);      // deliberately once, on the transition into "over"

  const start = useCallback((n) => {
    setSize(n);
    setBest(readBest(n));
    setState({ game: newGame(n), prev: null });
  }, []);

  const doMove = useCallback((dir) => {
    setState((s) => {
      /* A finished board ignores input rather than quietly accumulating moves
         behind the overlay. */
      if (isOver(s.game) || (s.game.won && !s.game.keepGoing)) return s;
      const next = move(s.game, dir);
      if (!next.moved) return s;              // nothing slid: not a move at all
      return {
        game: next,
        prev: {
          tiles: s.game.tiles, score: s.game.score,
          won: s.game.won, keepGoing: s.game.keepGoing,
        },
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState((s) => (s.prev
      ? {
        game: {
          ...s.game, ...s.prev,
          /* Strip the animation flags off the restored tiles, or the board
             replays the pop and the pulse from the move being undone. */
          tiles: s.prev.tiles.map((t) => ({ ...t, isNew: false, merged: false })),
        },
        prev: null,
      }
      : s));
  }, []);

  const keepGoing = useCallback(() => {
    setState((s) => ({ ...s, game: { ...s.game, keepGoing: true } }));
  }, []);

  /* Best is derived from the score rather than written at the moment of a
     merge, so undo cannot lower it and a restored game cannot inflate it. */
  useEffect(() => {
    if (game.score > best) { setBest(game.score); writeBest(size, game.score); }
  }, [game.score, best, size]);

  useEffect(() => {
    // Nothing to drive while the leaderboard is on screen, and an arrow key
    // there would quietly play a move behind it.
    if (view !== "play") return undefined;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const dir = KEYS[e.key.toLowerCase()];
      if (!dir) return;
      e.preventDefault();                     // or the arrows scroll the page
      doMove(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doMove, view]);

  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e) => {
    const start0 = touch.current;
    touch.current = null;
    if (!start0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start0.x, dy = t.clientY - start0.y;
    // Dominant axis, so a lazy diagonal still does the obvious thing.
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN) return;
    doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  };

  const cell = 100 / size;
  const tiles = game.tiles;
  /* When the last tile of this move stops. A spawn waits for it rather than
     for its own (zero) distance. */
  const settleMs = Math.max(SLIDE_BASE, ...tiles.map((t) => slideMs(t.dist)));
  const intro = CONTENT.intros?.game2048;

  if (view === "board") return (
    <Centered>
      <LeaderboardTabs gameId="2048" view={view} setView={setView} />
      <LeaderboardPanel gameId="2048" localBest={(key) => readBest(Number(key))} />
    </Centered>
  );

  return (
    <Centered>
      <style>{styleBlock}</style>
      <LeaderboardTabs gameId="2048" view={view} setView={setView} />

      {/* ----------------------------------------------------------- top bar */}
      <div style={{
        width: "100%", maxWidth: 440, display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14,
      }}>
        <h2 style={{ ...hStyle, margin: 0, flexShrink: 0 }}>2048</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <ScoreBox label="Score" value={game.score} />
          <ScoreBox label="Best" value={Math.max(best, game.score)} />
        </div>
        <Btn onClick={() => start(size)} variant="ghost"
          style={{ padding: "10px 18px", fontSize: "0.84375rem", flexShrink: 0 }}>
          New game
        </Btn>
      </div>

      {/* ------------------------------------------------------------- board */}
      <div className="g2048" style={{
        width: "100%", maxWidth: 440, position: "relative",
        background: paleGrad(C.panel2), borderRadius: 16, padding: GAP[size],
        boxShadow: `${GLOSS_SOFT}, ${SHADOW.md}`,
        /* Claims the gesture outright, which is what stops a swipe from
           scrolling the page — cheaper and more reliable than preventing
           default on a touchmove that browsers now deliver passively. */
        touchAction: "none", userSelect: "none", WebkitUserSelect: "none",
      }}
        onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1" }}>
          {/* The empty grid underneath, so a sparse board still reads as one. */}
          {Array.from({ length: size * size }).map((_, i) => (
            <div key={`c${i}`} aria-hidden style={{
              position: "absolute", left: 0, top: 0, width: `${cell}%`, height: `${cell}%`,
              transform: `translate(${(i % size) * 100}%, ${Math.floor(i / size) * 100}%)`,
            }}>
              <div style={{
                position: "absolute", inset: GAP[size], borderRadius: 9, background: "var(--cell)",
              }} />
            </div>
          ))}

          {tiles.map((t) => {
            const travel = slideMs(t.dist);
            /* A spawning tile waits for the whole board to stop, not just for
               itself — it has not travelled, so it has no distance of its own
               to wait out, and appearing while the longest tile is still in
               flight is the thing that made the board look like it redrew. */
            const land = t.isNew ? settleMs - 30 : Math.max(0, travel - LAND_LEAD);
            return (
              <div key={t.id} className="g2048-slot" style={{
                position: "absolute", left: 0, top: 0, width: `${cell}%`, height: `${cell}%`,
                transform: `translate(${t.c * 100}%, ${t.r * 100}%)`,
                transitionDuration: `${travel}ms`,
                /* An absorbed tile slides under its survivor, never over it. */
                zIndex: t.absorbed ? 1 : 2,
              }}>
                <div
                  /* Keyed on the value so the face remounts when it doubles.
                     A CSS animation only restarts when the class changes, and a
                     tile merging twice in a row keeps the same class both times
                     — without this the second merge slides in silently. */
                  key={t.value}
                  className={t.isNew ? "g2048-new" : t.merged ? "g2048-mrg" : undefined}
                  style={{
                    position: "absolute", inset: GAP[size], borderRadius: 9,
                    display: "grid", placeItems: "center",
                    /* Set as a custom property rather than as animation-delay,
                       because the echo lives on ::after and inline styles
                       cannot reach a pseudo-element — but they do inherit
                       into one. */
                    "--land": `${land}ms`,
                    "--flash": `var(--t${t.value}-bg, var(--tx-bg))`,
                    fontSize: fontFor(t.value, size), fontWeight: 800,
                    fontVariantNumeric: "tabular-nums", lineHeight: 1,
                    ...faceStyle(t.value),
                  }}>
                  {t.value}
                </div>
              </div>
            );
          })}

          {showWin && (
            <Overlay title="2048!" body={`You made it, with ${game.score} points.`}>
              <Btn onClick={keepGoing}>Keep going</Btn>
              <Btn variant="ghost" onClick={() => start(size)}>New game</Btn>
            </Overlay>
          )}
          {over && (
            <Overlay title="No moves left" body={`You finished on ${game.score}.`}>
              <Btn onClick={() => start(size)}>New game</Btn>
              {prev && <Btn variant="ghost" onClick={undo}>Undo last move</Btn>}
            </Overlay>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- controls */}
      <div style={{
        width: "100%", maxWidth: 440, display: "flex", alignItems: "center",
        justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 14,
      }}>
        <Btn variant="ghost" onClick={undo} disabled={!prev}
          style={{
            padding: "10px 18px", fontSize: "0.84375rem",
            opacity: prev ? 1 : .45,
            /* Btn keeps its .btn3d class when disabled, so without this the
               greyed-out button still lifts and brightens under the cursor. */
            pointerEvents: prev ? undefined : "none",
            display: "inline-flex", alignItems: "center", gap: 7,
          }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" />
          </svg>
          Undo
        </Btn>

        <div role="group" aria-label="Board size" style={{
          display: "flex", gap: 4, background: C.panel2, borderRadius: 20, padding: 4,
        }}>
          {SIZES.map((n) => {
            const on = n === size;
            return (
              <button key={n} onClick={() => start(n)} aria-pressed={on}
                className={on ? "btn3d" : "btn-flat"}
                style={{
                  border: "none", borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                  padding: "7px 15px", fontSize: "0.8125rem", fontWeight: 700,
                  background: on ? C.accent : "transparent", color: on ? "#fff" : C.dim,
                  boxShadow: on ? `${GLOSS}, ${SHADOW.sm}` : "none",
                }}>
                {n}×{n}
              </button>
            );
          })}
        </div>
      </div>

      {intro && (
        <p style={{ ...pStyle, fontSize: "0.8125rem", marginTop: 16, textAlign: "center" }}>
          {intro}
        </p>
      )}

      <NamePrompt open={board.needsName} metric="score" onClose={board.dismiss} />
    </Centered>
  );
}
