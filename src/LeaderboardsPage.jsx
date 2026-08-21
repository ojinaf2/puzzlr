import { useState, useEffect } from 'react';
import { C, SHADOW, GLOSS, GLOSS_SOFT, PILL, GLOW, grad, paleGrad, tint, shade, EASE } from './shared/theme.js';
import { Btn } from './shared/ui.jsx';
import { buildPath, BOARD_SEGMENT } from './shared/router.js';
import { myScoreId } from './shared/identity.js';
import { fetchBoard, leaderboardsEnabled } from './shared/leaderboard.js';
import { LEADERBOARDS, formatScore } from './data/leaderboards.js';
import { GAMES } from './games/index.jsx';
import { CONTENT } from './content.js';

/* ============================= THE LEADERBOARDS PAGE =============================

   Every ranked game on one screen, so "who is winning" is a place you can go
   rather than something you find by opening six games and looking in six tabs.

   It lives here rather than in shared/ because it needs the game registry for
   names, icons and accents — and the registry imports every game, each of
   which imports shared/leaderboardUi.jsx. Putting this in shared/ would close
   that loop into a circular import.

   Deliberately a summary, not a replacement. Each card shows the top three of
   the game's first board and links through to the game's own tab, which is
   where the full table and the other variants live. Two places showing the
   same hundred rows would be one place too many.                           */

const TOP = 3;

const labelStyle = {
  fontSize: "0.6875rem", color: C.dim, textTransform: "uppercase",
  letterSpacing: .4, fontWeight: 700,
};

/* Only the games that have a board, in the order the landing page shows them,
   so the two pages read as the same site rather than two lists. */
const RANKED = GAMES.filter((g) => LEADERBOARDS[g.id]);

/* One request per game, all in flight together. `fetchBoard` caches, so
   arriving here from a game you were just looking at costs nothing. */
function useTopBoards() {
  const [boards, setBoards] = useState({});

  useEffect(() => {
    if (!leaderboardsEnabled()) return undefined;
    const controller = new AbortController();
    let live = true;

    for (const game of RANKED) {
      const variant = LEADERBOARDS[game.id].variants[0].key;
      fetchBoard(game.id, variant, { signal: controller.signal })
        .then((entries) => { if (live) setBoards((b) => ({ ...b, [game.id]: { entries } })); })
        .catch((err) => {
          if (live && err.name !== "AbortError") setBoards((b) => ({ ...b, [game.id]: { error: true } }));
        });
    }

    return () => { live = false; controller.abort(); };
  }, []);

  return boards;
}

function Row({ rank, entry, mine, format }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 9, padding: "5px 8px", borderRadius: 8,
      background: mine ? "var(--wash-strong)" : "transparent",
    }}>
      <span style={{
        width: 22, height: 22, flexShrink: 0, borderRadius: 7, display: "grid", placeItems: "center",
        fontSize: "0.6875rem", fontWeight: 800, fontVariantNumeric: "tabular-nums",
        background: rank === 1 ? grad(C.gold) : PILL,
        color: rank === 1 ? "#fff" : rank <= 3 ? C.gold : C.dim,
        boxShadow: rank === 1 ? `${GLOSS}, ${SHADOW.sm}` : "none",
      }}>{rank}</span>
      <span style={{
        flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        fontSize: "0.84375rem", fontWeight: mine ? 800 : 600,
      }}>
        {entry.name}{mine && <span style={{ color: C.accent, fontWeight: 700 }}> · you</span>}
      </span>
      <span style={{ fontSize: "0.875rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
        {formatScore(format, entry.value)}
      </span>
    </div>
  );
}

function BoardCard({ game, board, myId, onOpen }) {
  const [hover, setHover] = useState(false);
  const def = LEADERBOARDS[game.id];
  const entries = board?.entries;
  const href = buildPath(game.id, BOARD_SEGMENT);

  const open = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    onOpen();
  };

  return (
    /* A real link, so a board can be opened in a new tab or shared — the same
       reasoning as the game cards on the landing page. */
    <a href={href} onClick={open} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="btn3d-lift"
      style={{
        background: paleGrad(C.panel), border: "none", borderRadius: 18, padding: "18px 18px 14px",
        display: "flex", flexDirection: "column", gap: 12, cursor: "pointer",
        color: C.text, textDecoration: "none", fontFamily: "inherit",
        transition: `transform .28s ${EASE}, box-shadow .28s ${EASE}`,
        transform: hover ? "translateY(-4px)" : "none",
        boxShadow: hover
          ? `${GLOSS_SOFT}, ${SHADOW.lg}, 0 18px 38px ${shade(game.accent, -.1)}26`
          : `${GLOSS_SOFT}, ${SHADOW.md}`,
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 42, height: 42, flexShrink: 0, borderRadius: 12, background: tint(game.accent),
          display: "grid", placeItems: "center", boxShadow: `${GLOSS}, ${SHADOW.sm}`,
        }}>
          <svg viewBox="0 0 52 52" width="30" height="30">{game.icon}</svg>
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "1rem", fontWeight: 800, letterSpacing: "-.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {game.name}
          </div>
          <div style={{ ...labelStyle, marginTop: 2 }}>
            {def.metric}
            {/* Named only when there is more than one, so a single-board game
                does not carry a label that explains nothing. */}
            {def.variants.length > 1 && ` · ${def.variants[0].label}`}
          </div>
        </div>
      </div>

      {board?.error ? (
        <p style={{ color: C.dim, fontSize: "0.8125rem", margin: "6px 0 2px" }}>{CONTENT.leaderboard.offline}</p>
      ) : !entries ? (
        <p style={{ color: C.dim, fontSize: "0.8125rem", margin: "6px 0 2px" }}>{CONTENT.leaderboard.loading}</p>
      ) : entries.length === 0 ? (
        <p style={{ color: C.dim, fontSize: "0.8125rem", margin: "6px 0 2px", lineHeight: 1.5 }}>
          {CONTENT.leaderboard.empty}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {entries.slice(0, TOP).map((entry, i) => (
            <Row key={entry.id} rank={i + 1} entry={entry} mine={entry.id === myId} format={def.format} />
          ))}
        </div>
      )}

      <span style={{
        marginTop: "auto", paddingTop: 4, fontSize: "0.8125rem", fontWeight: 700, color: game.accent,
        transition: `transform .28s ${EASE}`, transform: hover ? "translateX(3px)" : "none",
      }}>
        {CONTENT.leaderboard.seeAll}
      </span>
    </a>
  );
}

export default function LeaderboardsPage({ navigate }) {
  const boards = useTopBoards();
  const myId = leaderboardsEnabled() ? myScoreId() : null;

  return (
    <div style={{ width: "100%", maxWidth: 860, margin: "0 auto", padding: "0 20px", position: "relative" }}>
      <div aria-hidden style={{
        position: "absolute", top: -60, left: "50%", transform: "translateX(-50%)",
        width: "min(620px, 96%)", height: 300, pointerEvents: "none", background: GLOW, opacity: .7, zIndex: 0,
      }} />

      <section style={{ textAlign: "center", padding: "40px 0 30px", position: "relative", zIndex: 1 }}>
        <h1 style={{
          fontFamily: "var(--font-head)", fontSize: "clamp(2rem, 6vw, 3rem)", fontWeight: 700,
          lineHeight: 1.05, margin: "0 0 12px", letterSpacing: "-.01em",
        }}>
          {CONTENT.leaderboard.pageTitle}
        </h1>
        <p style={{ color: C.dim, fontSize: "0.9375rem", lineHeight: 1.6, maxWidth: 480, margin: "0 auto" }}>
          {CONTENT.leaderboard.pageBlurb}
        </p>
      </section>

      {!leaderboardsEnabled() ? (
        <p style={{ color: C.dim, textAlign: "center", padding: "20px 0 60px" }}>
          {CONTENT.leaderboard.offline}
        </p>
      ) : (
        <section style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 16, paddingBottom: 40, position: "relative", zIndex: 1,
        }}>
          {RANKED.map((game) => (
            <BoardCard key={game.id} game={game} board={boards[game.id]} myId={myId}
              onOpen={() => navigate(game.id, BOARD_SEGMENT)} />
          ))}
        </section>
      )}

      <div style={{ textAlign: "center", paddingBottom: 60 }}>
        <Btn variant="subtle" onClick={() => navigate(null)}>
          <span aria-hidden>←</span> {CONTENT.hub.backToGames}
        </Btn>
      </div>
    </div>
  );
}
