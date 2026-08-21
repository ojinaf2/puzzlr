import { useState } from 'react';
import { C } from './theme.js';
import { Btn, Tabs } from './ui.jsx';
import { copyText, useCountdown } from './daily.js';
import { boardOf } from '../data/leaderboards.js';
import { leaderboardsEnabled } from './leaderboard.js';
import { CONTENT } from '../content.js';

/* ============================= DAILY UI =============================
   The two pieces of furniture a daily puzzle needs, shared by every game that
   has one: the switch between today's puzzle and endless practice, and the
   panel of stats that replaces the board once the puzzle is over. */

/* `onFriends` is optional. When given, a third tab sits alongside the two
   modes rather than the online option living at the bottom of the page — it
   is a way to play, so it belongs with the other ways to play. It navigates
   instead of setting mode, because online play is a route of its own.

   `gameId` is optional too, and adds the leaderboard as a fourth tab. Four
   tabs do not fit across a phone, which is why the strip scrolls — see the
   note on `Tabs`. */
export function ModeTabs({ mode, setMode, dailyDone, onFriends, gameId }) {
  const board = gameId && leaderboardsEnabled() && boardOf(gameId);
  return (
    <Tabs items={[
      { key: "daily", label: "Daily", active: mode === "daily", onClick: () => setMode("daily"), suffix: dailyDone ? " ✓" : "" },
      /* The mode is still called "practice" in code; only the label changed. */
      { key: "practice", label: "Unlimited", active: mode === "practice", onClick: () => setMode("practice") },
      onFriends && { key: "friends", label: "Play with Friend", active: mode === "friends", onClick: onFriends },
      board && { key: "board", label: CONTENT.leaderboard.tab, active: mode === "board", onClick: () => setMode("board") },
    ]} />
  );
}

/* `buckets` is the ordered list of result labels for the distribution chart —
   guess counts for Wordle, wrong-letter counts for Hangman. */
export function DailyPanel({ record, day, title, buildShare, buckets, caption }) {
  const [copied, setCopied] = useState(false);
  const countdown = useCountdown();

  const share = async () => {
    const ok = await copyText(buildShare());
    setCopied(ok ? "copied" : "failed");
    setTimeout(() => setCopied(false), 2000);
  };

  const max = Math.max(1, ...buckets.map((b) => record.dist[b] || 0));
  const winPct = record.played ? Math.round((record.won / record.played) * 100) : 0;

  return (
    <div style={{ width: "100%", maxWidth: 380, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: "18px 20px", marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-around", marginBottom: 16 }}>
        {[["Played", record.played], ["Win %", winPct], ["Streak", record.streak], ["Best", record.best]].map(([label, value]) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 800 }}>{value}</div>
            <div style={{ fontSize: "0.6875rem", color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: "0.6875rem", color: C.dim, textTransform: "uppercase", letterSpacing: .4, marginBottom: 6 }}>{caption}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: 16 }}>
        {buckets.map((b) => {
          const n = record.dist[b] || 0;
          const isToday = record.done?.won && String(record.done.bucket) === String(b);
          return (
            <div key={b} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "0.78125rem" }}>
              <span style={{ width: 12, color: C.dim }}>{b}</span>
              <div style={{
                background: isToday ? C.correct : C.absent, color: "#fff", fontWeight: 700,
                borderRadius: 4, padding: "2px 7px", textAlign: "right",
                minWidth: 26, width: `${Math.max(8, (n / max) * 100)}%`,
              }}>{n}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <div>
          <div style={{ fontSize: "0.6875rem", color: C.dim, textTransform: "uppercase", letterSpacing: .4 }}>Next {title}</div>
          <div style={{ fontSize: "1.1875rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{countdown}</div>
        </div>
        <Btn onClick={share}>{copied === "copied" ? "Copied!" : copied === "failed" ? "Copy failed" : "Share"}</Btn>
      </div>
    </div>
  );
}
