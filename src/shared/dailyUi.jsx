import { useState } from 'react';
import { C } from './theme.js';
import { Btn } from './ui.jsx';
import { copyText, useCountdown } from './daily.js';

/* ============================= DAILY UI =============================
   The two pieces of furniture a daily puzzle needs, shared by every game that
   has one: the switch between today's puzzle and endless practice, and the
   panel of stats that replaces the board once the puzzle is over. */

export function ModeTabs({ mode, setMode, dailyDone }) {
  const tab = (key, label) => {
    const on = mode === key;
    return (
      <button key={key} onClick={() => setMode(key)}
        style={{
          background: on ? C.accent : "transparent", color: on ? "#fff" : C.dim,
          border: "none", borderRadius: 7, padding: "7px 18px", fontSize: "0.84375rem",
          fontWeight: 700, fontFamily: "inherit", cursor: "pointer", transition: "background .15s, color .15s",
        }}>
        {label}{key === "daily" && dailyDone && !on ? " ✓" : ""}
      </button>
    );
  };
  return (
    <div style={{ display: "flex", gap: 4, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, padding: 4, marginBottom: 14 }}>
      {tab("daily", "Daily")}
      {/* The mode is still called "practice" in code; only the label changed. */}
      {tab("practice", "Unlimited")}
    </div>
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
