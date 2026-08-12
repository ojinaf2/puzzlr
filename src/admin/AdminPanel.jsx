import { useState, useMemo } from 'react';
import { C, SHADOW, GLOSS_SOFT, paleGrad, grad, THEMES, TYPE, EASE, useTheme, toggleTheme } from '../shared/theme.js';
import { CONTENT } from '../content.js';

/* ============================= THE EDITOR =============================

   Dev only. Reached at /admin while `npm run dev` is running; the route is
   behind `import.meta.env.DEV` and the write-back endpoint is a serve-time
   Vite plugin, so neither exists in a production build.

   Saving rewrites the real source files. That is the point: an edit becomes a
   normal diff you can read, review and revert, and it deploys with everything
   else. There is no database, no login and nothing for the live site to fetch.

   Colour and type preview live, because both are CSS variables and can simply
   be set on the root. Text lands when you save — Vite reloads the module
   immediately, so it is near enough instant anyway.                        */

const FONT_PRESETS = {
  head: [
    ["Times New Roman", "'Times New Roman', Times, serif"],
    ["Georgia", "Georgia, 'Times New Roman', serif"],
    ["Playfair-ish", "'Iowan Old Style', 'Palatino Linotype', Palatino, serif"],
    ["Same as body", "var(--font-body)"],
  ],
  body: [
    ["Libre Franklin", "'Libre Franklin', 'Helvetica Neue', Helvetica, Arial, sans-serif"],
    ["System", "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"],
    ["Helvetica", "'Helvetica Neue', Helvetica, Arial, sans-serif"],
    ["Rounded", "'SF Pro Rounded', 'Nunito', 'Segoe UI', sans-serif"],
  ],
};

/* Contrast, so a colour choice that makes text unreadable is caught here
   rather than after it has shipped. */
const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
const contrast = (a, b) => {
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) return null;
  const [x, y] = [luminance(a), luminance(b)];
  return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 10) / 10;
};

const clone = (o) => JSON.parse(JSON.stringify(o));

export default function AdminPanel({ onClose }) {
  const [tab, setTab] = useState("text");
  const [content, setContent] = useState(() => clone(CONTENT));
  const [light, setLight] = useState(() => clone(THEMES.light));
  const [dark, setDark] = useState(() => clone(THEMES.dark));
  const [type, setType] = useState(() => clone(TYPE));
  const [status, setStatus] = useState(null);
  const [filter, setFilter] = useState("");
  const theme = useTheme();

  const dirty = useMemo(() =>
    JSON.stringify(content) !== JSON.stringify(CONTENT) ||
    JSON.stringify(light) !== JSON.stringify(THEMES.light) ||
    JSON.stringify(dark) !== JSON.stringify(THEMES.dark) ||
    JSON.stringify(type) !== JSON.stringify(TYPE),
  [content, light, dark, type]);

  /* Preview by writing straight onto the root. The stylesheet sets the same
     variables, but an inline style on documentElement outranks it, so this
     wins without having to regenerate any CSS. */
  const preview = (next, which) => {
    const root = document.documentElement;
    if (which === "type") {
      root.style.setProperty("--font-head", next.head);
      root.style.setProperty("--font-body", next.body);
      root.style.setProperty("--type-scale", String(next.scale));
      return;
    }
    if (which !== theme) return;                    // only the visible theme
    for (const [k, v] of Object.entries(next)) root.style.setProperty(`--c-${k}`, v);
  };

  const save = async () => {
    setStatus("saving");
    try {
      const res = await fetch("/__admin/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, light, dark, type }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "write failed");
      /* Clear the inline preview so what you see afterwards is the saved file
         being served back, not the preview still sitting on top of it. */
      document.documentElement.removeAttribute("style");
      setStatus("saved");
      setTimeout(() => setStatus(null), 2500);
    } catch (err) {
      setStatus(`failed: ${err.message}`);
    }
  };

  const revert = () => {
    document.documentElement.removeAttribute("style");
    setContent(clone(CONTENT));
    setLight(clone(THEMES.light));
    setDark(clone(THEMES.dark));
    setType(clone(TYPE));
    setStatus(null);
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "26px 20px 80px" }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "var(--font-head)", fontSize: "1.75rem", margin: 0 }}>Site editor</h1>
        <span style={{ fontSize: "0.75rem", color: C.dim, background: "var(--pill)", padding: "3px 10px", borderRadius: 20 }}>
          dev only
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={onClose} style={btnStyle("subtle")}>Back to site</button>
      </header>
      <p style={{ color: C.dim, fontSize: "0.85rem", maxWidth: 620, lineHeight: 1.6, marginTop: 0 }}>
        Saving rewrites <code>src/content.js</code> and <code>src/shared/theme.js</code>.
        Review the diff and commit it like any other change — nothing here reaches
        the live site until you deploy.
      </p>

      <div style={{ display: "flex", gap: 6, margin: "18px 0 16px", flexWrap: "wrap" }}>
        {[["text", "Text"], ["colour", "Colour"], ["type", "Type"]].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={btnStyle(tab === k ? "primary" : "ghost")}>{label}</button>
        ))}
        <div style={{ flex: 1 }} />
        {dirty && <button onClick={revert} style={btnStyle("subtle")}>Discard changes</button>}
        <button onClick={save} disabled={!dirty} style={{ ...btnStyle(dirty ? "primary" : "ghost"), opacity: dirty ? 1 : .5 }}>
          {status === "saving" ? "Saving…" : "Save to files"}
        </button>
      </div>

      {status && status !== "saving" && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", borderRadius: 10, fontSize: "0.85rem", fontWeight: 700,
          background: status === "saved" ? "#e8f6ec" : "#fdecea",
          color: status === "saved" ? "#1d6b34" : "#a3281a",
        }}>
          {status === "saved" ? "Written. Vite has reloaded the page with your changes." : status}
        </div>
      )}

      {tab === "text" && (
        <TextTab content={content} setContent={setContent} filter={filter} setFilter={setFilter} />
      )}
      {tab === "colour" && (
        <ColourTab {...{ light, dark, setLight, setDark, preview, theme }} />
      )}
      {tab === "type" && (
        <TypeTab type={type} setType={(t) => { setType(t); preview(t, "type"); }} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ text */
function TextTab({ content, setContent, filter, setFilter }) {
  const set = (path, value) => {
    const next = clone(content);
    let node = next;
    for (const key of path.slice(0, -1)) node = node[key];
    node[path[path.length - 1]] = value;
    setContent(next);
  };

  const rows = [];
  const walk = (obj, path = []) => {
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object") walk(v, [...path, k]);
      else rows.push({ path: [...path, k], value: v });
    }
  };
  walk(content);

  const q = filter.trim().toLowerCase();
  const shown = q
    ? rows.filter((r) => r.path.join(".").toLowerCase().includes(q) || String(r.value).toLowerCase().includes(q))
    : rows;

  const groups = {};
  for (const r of shown) (groups[r.path.slice(0, -1).join(" › ") || "top level"] ??= []).push(r);

  return (
    <div>
      <input value={filter} onChange={(e) => setFilter(e.target.value)}
        placeholder={`Search ${rows.length} pieces of text…`}
        style={{ ...fieldStyle, marginBottom: 18 }} />
      {Object.entries(groups).map(([group, items]) => (
        <section key={group} style={cardStyle}>
          <h2 style={groupTitle}>{group}</h2>
          {items.map((r) => (
            <label key={r.path.join(".")} style={{ display: "block", marginBottom: 12 }}>
              <span style={labelStyle}>{r.path[r.path.length - 1]}</span>
              {String(r.value).length > 70 ? (
                <textarea value={r.value} rows={3} onChange={(e) => set(r.path, e.target.value)} style={fieldStyle} />
              ) : (
                <input value={r.value} onChange={(e) => set(r.path, e.target.value)} style={fieldStyle} />
              )}
            </label>
          ))}
        </section>
      ))}
      {!shown.length && <p style={{ color: C.dim }}>Nothing matches “{filter}”.</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- colour */
function ColourTab({ light, dark, setLight, setDark, preview, theme }) {
  const editing = theme === "dark" ? dark : light;
  const setEditing = theme === "dark" ? setDark : setLight;

  const set = (key, value) => {
    const next = { ...editing, [key]: value };
    setEditing(next);
    preview(next, theme);
  };

  return (
    <div>
      <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <strong style={{ fontSize: "0.9rem" }}>Editing the {theme} palette</strong>
        <span style={{ color: C.dim, fontSize: "0.8rem", flex: 1, minWidth: 200 }}>
          Both palettes are saved. Switch theme to edit the other one.
        </span>
        <button onClick={toggleTheme} style={btnStyle("ghost")}>
          Switch to {theme === "dark" ? "light" : "dark"}
        </button>
      </div>

      <section style={cardStyle}>
        {Object.entries(editing).map(([key, value]) => {
          const against = key === "text" || key === "dim" ? editing.bg : editing.text;
          const ratio = contrast(value, against);
          const weak = ratio !== null && ratio < 3 && ["text", "dim", "correct", "present", "accent", "danger"].includes(key);
          return (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <input type="color" value={value} onChange={(e) => set(key, e.target.value)}
                style={{ width: 44, height: 34, border: "none", borderRadius: 8, background: "none", cursor: "pointer", flexShrink: 0 }} />
              <span style={{ width: 92, fontSize: "0.82rem", fontWeight: 700 }}>{key}</span>
              <input value={value} onChange={(e) => set(key, e.target.value)}
                style={{ ...fieldStyle, width: 110, flex: "0 0 auto", fontFamily: "ui-monospace, monospace" }} />
              {ratio !== null && (
                <span style={{ fontSize: "0.75rem", color: weak ? "#c0492f" : C.dim, fontWeight: weak ? 800 : 400 }}>
                  {ratio}:1 vs {key === "text" || key === "dim" ? "background" : "text"}
                  {weak && " — hard to read"}
                </span>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ type */
function TypeTab({ type, setType }) {
  return (
    <div>
      {["head", "body"].map((which) => (
        <section key={which} style={cardStyle}>
          <h2 style={groupTitle}>{which === "head" ? "Headings" : "Body text"}</h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {FONT_PRESETS[which].map(([label, stack]) => (
              <button key={label} onClick={() => setType({ ...type, [which]: stack })}
                style={{ ...btnStyle(type[which] === stack ? "primary" : "ghost"), fontFamily: stack }}>
                {label}
              </button>
            ))}
          </div>
          <input value={type[which]} onChange={(e) => setType({ ...type, [which]: e.target.value })}
            style={{ ...fieldStyle, fontFamily: "ui-monospace, monospace", fontSize: "0.78rem" }} />
          <p style={{ fontFamily: type[which], fontSize: which === "head" ? "1.6rem" : "1rem", margin: "14px 0 0" }}>
            Play, guess, and outsmart a friend.
          </p>
        </section>
      ))}

      <section style={cardStyle}>
        <h2 style={groupTitle}>Overall text size</h2>
        <p style={{ color: C.dim, fontSize: "0.82rem", marginTop: 0 }}>
          Scales every piece of text on the site together. 1 is the current size.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <input type="range" min="0.8" max="1.3" step="0.01" value={type.scale}
            onChange={(e) => setType({ ...type, scale: Number(e.target.value) })}
            style={{ flex: 1 }} />
          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 800, width: 52 }}>
            {Number(type.scale).toFixed(2)}×
          </span>
          <button onClick={() => setType({ ...type, scale: 1 })} style={btnStyle("subtle")}>Reset</button>
        </div>
      </section>
    </div>
  );
}

/* ----------------------------------------------------------------- bits */
const cardStyle = {
  background: paleGrad(C.panel), borderRadius: 14, padding: "16px 18px", marginBottom: 14,
  boxShadow: `${GLOSS_SOFT}, ${SHADOW.sm}`,
};
const groupTitle = { fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: ".08em", color: C.dim, margin: "0 0 12px", fontWeight: 800 };
const labelStyle = { display: "block", fontSize: "0.72rem", color: C.dim, fontWeight: 700, marginBottom: 4 };
const fieldStyle = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 9,
  border: `1px solid ${C.line}`, background: C.bg, color: C.text,
  fontFamily: "inherit", fontSize: "0.85rem", lineHeight: 1.5,
};
function btnStyle(variant) {
  const base = { border: "none", borderRadius: 10, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.82rem", padding: "9px 16px", transition: `filter .15s ${EASE}` };
  if (variant === "primary") return { ...base, background: grad(C.accent), color: "#fff" };
  if (variant === "ghost") return { ...base, background: paleGrad(C.panel2), color: C.text };
  return { ...base, background: "transparent", color: C.dim, border: `1px solid ${C.line}` };
}
