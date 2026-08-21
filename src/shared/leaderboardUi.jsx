import { useState, useEffect, useRef } from 'react';
import { C, SHADOW, GLOSS, GLOSS_SOFT, PILL, grad, paleGrad, EASE } from './theme.js';
import { Btn, Tabs } from './ui.jsx';
import { myScoreId, savedName, saveName, useSavedName } from './identity.js';
import { boardOf, formatScore } from '../data/leaderboards.js';
import { useBoard, submitScore, renameEverywhere, leaderboardsEnabled, rankOf } from './leaderboard.js';
import { CONTENT, fill } from '../content.js';

/* ============================= LEADERBOARD UI =============================
   The tab body, and the two places a name gets asked for. Furniture shared by
   every game with a board, in the same spirit as dailyUi.jsx.               */

const labelStyle = {
  fontSize: "0.6875rem", color: C.dim, textTransform: "uppercase",
  letterSpacing: .4, fontWeight: 700,
};

const VISIBLE = 20;      // rows drawn before the list is cut off

/* ============================= THE NAME =============================
   One dialog, two callers: the prompt after a result worth posting, and the
   header control for changing it later. Deliberately not a browser prompt() —
   that is unstyled, unthemed, and on iOS it dismisses the keyboard under it. */
function NameDialog({ title, body, cta, onClose }) {
  const [value, setValue] = useState(savedName);
  const inputRef = useRef(null);
  const clean = value.replace(/\s+/g, " ").trim().slice(0, 14);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e) => {
    e.preventDefault();
    if (!clean) return;
    const had = savedName();
    saveName(clean);
    // Only worth the round trips if there were entries under the old name.
    if (had && had !== clean) renameEverywhere(clean);
    onClose(true);
  };

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose(false); }}
      style={{
        position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center",
        padding: 20, background: "rgba(20,14,9,.55)", backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label={title}
        style={{
          width: "100%", maxWidth: 380, background: paleGrad(C.panel), color: C.text,
          borderRadius: 18, padding: "22px 22px 20px",
          boxShadow: `${GLOSS_SOFT}, ${SHADOW.lg}`,
        }}>
        <h3 style={{ fontFamily: "var(--font-head)", fontSize: "1.375rem", fontWeight: 700, margin: "0 0 6px" }}>
          {title}
        </h3>
        <p style={{ color: C.dim, fontSize: "0.875rem", lineHeight: 1.55, margin: "0 0 16px" }}>{body}</p>

        <input ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)}
          maxLength={14} placeholder={CONTENT.leaderboard.namePlaceholder} aria-label="Display name"
          style={{
            width: "100%", padding: "12px 14px", borderRadius: 12, fontFamily: "inherit",
            fontSize: "1rem", fontWeight: 700, color: C.text, background: C.bg,
            border: `1px solid ${C.line}`, marginBottom: 6, outline: "none",
          }} />
        <div style={{ ...labelStyle, marginBottom: 16, textTransform: "none", letterSpacing: 0, fontWeight: 400 }}>
          {CONTENT.leaderboard.nameHint}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn type="button" variant="subtle" onClick={() => onClose(false)}>
            {CONTENT.leaderboard.notNow}
          </Btn>
          <Btn type="submit" style={{ padding: "11px 22px", opacity: clean ? 1 : .5, pointerEvents: clean ? undefined : "none" }}>
            {cta}
          </Btn>
        </div>
      </form>
    </div>
  );
}

/* Shown when a game finishes with something worth posting and the player has
   never given a name. `useScoreSubmit` decides when; this only draws it. */
export function NamePrompt({ open, metric, onClose }) {
  if (!open) return null;
  return (
    <NameDialog
      title={CONTENT.leaderboard.promptTitle}
      body={fill(CONTENT.leaderboard.promptBody, { metric: String(metric).toLowerCase() })}
      cta={CONTENT.leaderboard.promptCta}
      onClose={onClose} />
  );
}

/* The header control. Sits with the theme and sound switches because a name
   is a property of the site rather than of any one game — the same argument
   that put the sound toggle there. */
export function NameButton() {
  const name = useSavedName();
  const [open, setOpen] = useState(false);
  if (!leaderboardsEnabled()) return null;

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn3d"
        aria-label={name ? `Change your name (currently ${name})` : "Set your name"}
        title={name ? `Playing as ${name}` : "Set your name"}
        style={{
          height: 38, minWidth: 38, borderRadius: 12, border: "none", flexShrink: 0,
          padding: name ? "0 12px" : 0, cursor: "pointer", color: name ? C.text : C.dim,
          background: paleGrad(C.panel2), boxShadow: `${GLOSS_SOFT}, ${SHADOW.sm}`,
          display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit",
          fontSize: "0.8125rem", fontWeight: 700, maxWidth: 150,
        }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden
          style={{ flexShrink: 0 }}>
          <circle cx="12" cy="8.2" r="3.8" />
          <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
        </svg>
        {/* The name is hidden on a narrow phone for the same reason the
            wordmark is: the header has to stay on one line. */}
        {name && <span className="hdr-word" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>}
      </button>

      {open && (
        <NameDialog
          title={name ? CONTENT.leaderboard.changeTitle : CONTENT.leaderboard.setTitle}
          body={name ? CONTENT.leaderboard.changeBody : CONTENT.leaderboard.setBody}
          cta={CONTENT.leaderboard.save}
          onClose={() => setOpen(false)} />
      )}
    </>
  );
}

/* Play / Leaderboard, for the games whose modes are chosen on their own menu
   rather than in a tab strip — Minesweeper picks a difficulty, 2048 a board
   size, Hangman an opponent. Those menus already read well, so the strip sits
   above them and adds the one tab that was missing rather than rebuilding
   three games' front doors around it.

   Renders nothing when there is no leaderboard to reach, which keeps a lone
   "Play" tab explaining nothing off the screen. */
export function LeaderboardTabs({ gameId, view, setView, playLabel = "Play" }) {
  if (!leaderboardsEnabled() || !boardOf(gameId)) return null;
  return (
    <Tabs items={[
      { key: "play", label: playLabel, active: view === "play", onClick: () => setView("play") },
      { key: "board", label: CONTENT.leaderboard.tab, active: view === "board", onClick: () => setView("board") },
    ]} />
  );
}

/* ============================= THE TABLE ============================= */

const Rank = ({ n }) => {
  const top = n <= 3;
  return (
    <span style={{
      width: 26, height: 26, flexShrink: 0, borderRadius: 8, display: "grid", placeItems: "center",
      fontSize: "0.75rem", fontWeight: 800, fontVariantNumeric: "tabular-nums",
      background: n === 1 ? grad(C.gold) : top ? PILL : "transparent",
      color: n === 1 ? "#fff" : top ? C.gold : C.dim,
      boxShadow: n === 1 ? `${GLOSS}, ${SHADOW.sm}` : "none",
    }}>{n}</span>
  );
};

function Row({ rank, entry, mine, format }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10,
      background: mine ? "var(--wash-strong)" : "transparent",
      boxShadow: mine ? `inset 0 0 0 1px ${C.accent}55` : "none",
    }}>
      <Rank n={rank} />
      <span style={{
        flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        fontSize: "0.90625rem", fontWeight: mine ? 800 : 600,
      }}>
        {entry.name}
        {mine && <span style={{ color: C.accent, fontWeight: 700 }}> · you</span>}
      </span>
      <span style={{ fontSize: "0.9375rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
        {formatScore(format, entry.value)}
      </span>
    </div>
  );
}

/* `localBest(variantKey)` is optional and returns this browser's stored best
   for that variant, or null. It is what puts a player who has been playing
   since before any of this existed onto the board the first time they open
   the tab, rather than making them earn their record all over again. */
export function LeaderboardPanel({ gameId, localBest }) {
  const def = boardOf(gameId);
  const name = useSavedName();
  const [variant, setVariant] = useState(def.variants[0].key);
  const [asking, setAsking] = useState(false);
  const { entries, error, reload, accept } = useBoard(gameId, variant);
  const bestRef = useRef(localBest);
  bestRef.current = localBest;

  const mine = bestRef.current?.(variant);
  const hasLocal = typeof mine === "number" && Number.isFinite(mine);

  /* Opening the tab posts whatever this browser already had. Submitting is
     idempotent — the server keeps the better of the two — so doing it on
     every open costs one request and repairs anything an earlier submission
     dropped on a bad connection. */
  useEffect(() => {
    if (!name || !hasLocal) return undefined;
    let live = true;
    submitScore(gameId, variant, mine).then((fresh) => { if (live && fresh) accept(fresh); });
    return () => { live = false; };
  }, [gameId, variant, name, mine, hasLocal, accept]);

  const id = leaderboardsEnabled() ? myScoreId() : null;
  const myRank = entries ? rankOf(def.dir, entries, id) : null;
  const shown = entries ? entries.slice(0, VISIBLE) : [];
  const offBottom = myRank && myRank > VISIBLE ? entries[myRank - 1] : null;

  return (
    <div style={{
      width: "100%", maxWidth: 420, background: C.panel, border: `1px solid ${C.line}`,
      borderRadius: 14, padding: "16px 16px 14px", marginBottom: 14,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: def.variants.length > 1 ? 12 : 10 }}>
        <span style={labelStyle}>{def.metric}</span>
        {def.unit && <span style={{ fontSize: "0.6875rem", color: C.dim }}>{def.unit}</span>}
      </div>

      {def.variants.length > 1 && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
          {def.variants.map((v) => {
            const on = v.key === variant;
            return (
              <button key={v.key} onClick={() => setVariant(v.key)} aria-pressed={on}
                className={on ? "btn3d" : "btn-flat"}
                style={{
                  border: "none", borderRadius: 20, cursor: "pointer", fontFamily: "inherit",
                  padding: "6px 13px", fontSize: "0.78125rem", fontWeight: 700,
                  background: on ? C.accent : C.panel2, color: on ? "#fff" : C.dim,
                  boxShadow: on ? `${GLOSS}, ${SHADOW.sm}` : "none",
                  transition: `background .15s ${EASE}, color .15s ${EASE}`,
                }}>
                {v.label}
              </button>
            );
          })}
        </div>
      )}

      {error ? (
        <div style={{ textAlign: "center", padding: "18px 0 14px" }}>
          <p style={{ color: C.dim, fontSize: "0.875rem", margin: "0 0 12px" }}>{error}</p>
          <Btn variant="ghost" onClick={reload}>{CONTENT.leaderboard.retry}</Btn>
        </div>
      ) : !entries ? (
        <p style={{ color: C.dim, fontSize: "0.875rem", textAlign: "center", padding: "22px 0" }}>
          {CONTENT.leaderboard.loading}
        </p>
      ) : entries.length === 0 ? (
        <p style={{ color: C.dim, fontSize: "0.875rem", textAlign: "center", padding: "22px 0", lineHeight: 1.55 }}>
          {CONTENT.leaderboard.empty}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {shown.map((entry, i) => (
            <Row key={entry.id} rank={i + 1} entry={entry} mine={entry.id === id} format={def.format} />
          ))}
          {offBottom && (
            <>
              <div aria-hidden style={{ textAlign: "center", color: C.dim, fontSize: "0.8125rem", padding: "2px 0" }}>···</div>
              <Row rank={myRank} entry={offBottom} mine format={def.format} />
            </>
          )}
        </div>
      )}

      {/* The other place a name is asked for: someone who has a record sitting
          in this browser but has never been asked what to call them. */}
      {hasLocal && !name && (
        <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 12, paddingTop: 12, textAlign: "center" }}>
          <p style={{ color: C.dim, fontSize: "0.8125rem", margin: "0 0 10px", lineHeight: 1.5 }}>
            {fill(CONTENT.leaderboard.claim, { value: formatScore(def.format, mine) })}
          </p>
          <Btn onClick={() => setAsking(true)} style={{ padding: "10px 20px", fontSize: "0.875rem" }}>
            {CONTENT.leaderboard.claimCta}
          </Btn>
        </div>
      )}

      {!hasLocal && !name && entries && (
        <p style={{ borderTop: `1px solid ${C.line}`, marginTop: 12, paddingTop: 12, color: C.dim, fontSize: "0.78125rem", textAlign: "center", margin: "12px 0 0", lineHeight: 1.5 }}>
          {CONTENT.leaderboard.footnote}
        </p>
      )}

      {asking && (
        <NameDialog
          title={CONTENT.leaderboard.setTitle}
          body={CONTENT.leaderboard.setBody}
          cta={CONTENT.leaderboard.save}
          onClose={() => setAsking(false)} />
      )}
    </div>
  );
}
