import { useState, useEffect, useRef } from 'react';
import { C, SHADOW, GLOSS_SOFT, PILL, paleGrad, EASE } from './theme.js';
import { Btn, Centered, hStyle, pStyle } from './ui.jsx';
import { saveName, savedName, roomServerUrl } from './useRoom.js';
import { listRooms, joinRoom, setIntent, cleanCode, CODE_RE } from './rooms.js';
import { makeRoomCode } from './router.js';

/* Pieces every online game needs: an invite link to share, a connection
   banner, and the waiting-room screens shown before play begins. */

const labelStyle = { fontSize: "0.75rem", letterSpacing: ".18em", textTransform: "uppercase", color: C.dim, fontWeight: 700 };

/* How you want to play, at the top of the game rather than as an afterthought
   at the bottom of it. Playing online is a way to play, so it belongs beside
   the other ways — the same reasoning that put Wordle's "Play with Friend"
   next to Daily and Unlimited instead of under the keyboard.

   The online tab navigates rather than setting state, because online play is
   a route of its own: `/tetris/online` survives a refresh and can be linked.

   Renders nothing at all when no room server is configured. A lone tab
   reading "Solo" explains nothing, and an online tab that leads nowhere is
   worse than no tab. */
export function PlayTabs({ localLabel = "Solo", onlineLabel = "Play online", onOnline }) {
  if (!roomServerUrl()) return null;
  const tab = (label, active, onClick) => (
    <button onClick={onClick} disabled={active}
      style={{
        background: active ? C.accent : "transparent", color: active ? "#fff" : C.dim,
        border: "none", borderRadius: 7, padding: "7px 18px", fontSize: "0.84375rem",
        fontWeight: 700, fontFamily: "inherit", cursor: active ? "default" : "pointer",
        transition: `background .15s ${EASE}, color .15s ${EASE}`,
      }}>
      {label}
    </button>
  );
  return (
    <div style={{
      display: "flex", gap: 4, background: C.panel, border: `1px solid ${C.line}`,
      borderRadius: 9, padding: 4, marginBottom: 14,
    }}>
      {tab(localLabel, true)}
      {tab(onlineLabel, false, onOnline)}
    </div>
  );
}

export const GlobeIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
  </svg>
);

export const LockIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
    <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
  </svg>
);

/* `visibility` and `onVisibility` are optional: passed only for the host, who
   is the one allowed to change it. Everyone else just sees the code. */
export function InviteLink({ gameId, roomCode, visibility, onVisibility }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/${gameId}/${roomCode}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);   // clipboard blocked; the code below is still readable
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
      <div style={{ ...labelStyle, marginBottom: 8 }}>Room code</div>
      <div style={{ fontFamily: "var(--font-head)", fontSize: "2.625rem", fontWeight: 700, letterSpacing: ".12em", marginBottom: 16 }}>
        {roomCode}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "8px 8px 8px 14px" }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: "0.8125rem", color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{url}</span>
        <Btn onClick={copy} style={{ padding: "8px 16px", fontSize: "0.8125rem", flex: "0 0 auto" }}>{copied ? "Copied" : "Copy"}</Btn>
      </div>

      {onVisibility && (
        <div style={{ marginTop: 14 }}>
          <div style={{ ...labelStyle, marginBottom: 8 }}>Who can find it</div>
          <div style={{ display: "flex", gap: 6, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 11, padding: 4 }}>
            {[
              ["public", <GlobeIcon key="g" />, "Public", "Listed for anyone to join"],
              ["private", <LockIcon key="l" />, "Private", "Only people with the code"],
            ].map(([value, icon, label, hint]) => {
              const on = (visibility ?? "public") === value;
              return (
                <button key={value} onClick={() => onVisibility(value)} title={hint}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    padding: "9px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontFamily: "inherit", fontSize: "0.8125rem", fontWeight: 700,
                    background: on ? C.accent : "transparent", color: on ? "#fff" : C.dim,
                    transition: `background .15s ${EASE}, color .15s ${EASE}`,
                  }}>
                  {icon}{label}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: "0.75rem", color: C.dim, margin: "8px 0 0", lineHeight: 1.5 }}>
            {(visibility ?? "public") === "public"
              ? "Anyone browsing this game will see your room and can join it."
              : "Your room is marked private. Only someone with the code can get in."}
          </p>
        </div>
      )}
    </div>
  );
}

/* Asked once, then remembered. Other players see this name, so it is worth
   collecting before joining rather than labelling everyone "Player 2". */
export function NameEntry({ initial, onDone }) {
  const [value, setValue] = useState(initial || '');
  const clean = value.trim().slice(0, 14);

  const submit = (e) => {
    e.preventDefault();
    if (!clean) return;
    saveName(clean);
    onDone(clean);
  };

  return (
    <Centered>
      <h2 style={hStyle}>What should we call you?</h2>
      <p style={pStyle}>The other players will see this. You can change it later.</p>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus
          placeholder="Your name" maxLength={14} autoComplete="nickname"
          style={{ width: "100%", padding: "14px 16px", fontSize: "1.125rem", fontFamily: "inherit", color: C.text,
            background: C.bg, border: `2px solid ${C.line}`, borderRadius: 12, outlineColor: C.accent, textAlign: "center" }} />
        <Btn type="submit" disabled={!clean} style={{ opacity: clean ? 1 : .5 }}>Continue</Btn>
      </form>
    </Centered>
  );
}

/* ============================= HOST OR JOIN =============================
   The screen before a room exists. Hosting creates one and hands over the
   code; joining offers a code box and a list of what is already open.

   The list is a convenience, not the authority: a room can fill or start
   between being listed and being tapped, so a tap still goes through the real
   join and can still come back refused. */
export function OnlineEntry({ gameId, gameName, navigate, onCancel }) {
  const [mode, setMode] = useState(null);            // null | 'host' | 'join'
  const [name, setName] = useState(savedName());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const enter = async (code, { create, visibility } = {}) => {
    setBusy(true);
    setError(null);
    const result = await joinRoom({ gameId, code, name, create, visibility });
    setBusy(false);
    if (!result.ok) {
      setError(result.code === 'not-found' ? 'No room found with that code.' : result.message);
      return;
    }
    // Remember how to reconnect, then hand over to the real room connection.
    setIntent(code, { create: !!create, visibility: visibility ?? 'public' });
    navigate(gameId, code);
  };

  if (!name) {
    return <NameEntry initial="" onDone={(n) => setName(n)} />;
  }

  if (mode === null) return (
    <Centered>
      <h2 style={hStyle}>Play {gameName} online</h2>
      <p style={pStyle}>Start a room and invite someone, or join one that is already open.</p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 18 }}>
        <Btn onClick={() => setMode('host')}>Host a game</Btn>
        <Btn variant="ghost" onClick={() => setMode('join')}>Join a game</Btn>
      </div>
      <p style={{ fontSize: "0.8125rem", color: C.dim }}>
        Playing as <strong style={{ color: C.text }}>{name}</strong>
        {" · "}
        <button onClick={() => { saveName(""); setName(""); }}
          style={{ background: "none", border: "none", padding: 0, color: C.accent2, cursor: "pointer", font: "inherit", textDecoration: "underline" }}>
          change
        </button>
      </p>
      <Btn variant="subtle" onClick={onCancel} style={{ marginTop: 16 }}>Back</Btn>
    </Centered>
  );

  if (mode === 'host') return (
    <Centered>
      <h2 style={hStyle}>Host a game</h2>
      <p style={pStyle}>
        We will make you a room and give you a code and a link to share.
        You can make it public or private once it exists.
      </p>
      {error && <p style={{ color: C.danger, fontWeight: 700, fontSize: "0.85rem" }}>{error}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        <Btn onClick={() => enter(makeRoomCode(), { create: true, visibility: 'public' })} disabled={busy}>
          {busy ? "Creating…" : "Create room"}
        </Btn>
        <Btn variant="subtle" onClick={() => setMode(null)}>Back</Btn>
      </div>
    </Centered>
  );

  return <JoinPanel {...{ gameId, gameName, name, busy, error, enter, onBack: () => setMode(null) }} />;
}

function JoinPanel({ gameId, gameName, busy, error, enter, onBack }) {
  const [code, setCode] = useState('');
  const [rooms, setRooms] = useState(null);          // null while first loading
  const [listError, setListError] = useState(null);
  const timer = useRef(null);

  /* Poll while the panel is open. A browse list that goes stale the moment you
     open it is worse than none, and rooms appear and fill constantly. */
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const found = await listRooms(gameId);
        if (alive) { setRooms(found); setListError(null); }
      } catch (err) {
        if (alive) { setRooms([]); setListError('Could not reach the room server.'); }
      }
    };
    load();
    timer.current = setInterval(load, 5000);
    return () => { alive = false; clearInterval(timer.current); };
  }, [gameId]);

  const ready = CODE_RE.test(code);

  /* The list is polled every few seconds, so a tap can always land on an
     entry that has just changed underneath it — the host flipping the room to
     private is the case that actually happens. Re-read the list at the moment
     of the tap and only go if the room is still there and still open, rather
     than acting on what was true five seconds ago. */
  const enterFromList = async (roomCode) => {
    try {
      const fresh = await listRooms(gameId);
      setRooms(fresh);
      if (!fresh.some((r) => r.code === roomCode)) {
        setListError("That room isn't open any more — ask whoever's hosting for the code.");
        return;
      }
      setListError(null);
    } catch {
      /* Can't reach the server to check. The join itself is about to fail in
         a more informative way, so let it try. */
    }
    enter(roomCode);
  };

  return (
    <Centered>
      <h2 style={hStyle}>Join a game</h2>

      <form onSubmit={(e) => { e.preventDefault(); if (ready) enter(code); }}
        style={{ width: "100%", maxWidth: 340, marginBottom: 8 }}>
        <div style={{ ...labelStyle, marginBottom: 8, textAlign: "left" }}>Have a code?</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={code} onChange={(e) => setCode(cleanCode(e.target.value))} autoFocus
            placeholder="ABC123" maxLength={6} autoCapitalize="characters" autoComplete="off"
            aria-label="Room code"
            style={{
              flex: 1, minWidth: 0, padding: "13px 16px", fontSize: "1.25rem", fontFamily: "inherit",
              fontWeight: 700, letterSpacing: ".18em", textAlign: "center", textTransform: "uppercase",
              color: C.text, background: C.bg, border: `2px solid ${error ? C.danger : C.line}`,
              borderRadius: 12, outlineColor: C.accent,
            }} />
          <Btn type="submit" disabled={!ready || busy} style={{ opacity: ready && !busy ? 1 : .5, flex: "0 0 auto" }}>
            {busy ? "…" : "Join"}
          </Btn>
        </div>
        <div style={{ minHeight: 22, marginTop: 8 }}>
          {error && <span style={{ color: C.danger, fontWeight: 700, fontSize: "0.85rem" }}>{error}</span>}
        </div>
      </form>

      <div style={{ width: "100%", maxWidth: 420, textAlign: "left", marginTop: 6 }}>
        <div style={{ ...labelStyle, marginBottom: 8 }}>
          Open rooms{rooms?.length ? ` (${rooms.length})` : ""}
        </div>

        {rooms === null && <p style={{ color: C.dim, fontSize: "0.85rem" }}>Looking for rooms…</p>}
        {listError && <p style={{ color: C.danger, fontSize: "0.85rem" }}>{listError}</p>}
        {rooms?.length === 0 && !listError && (
          <p style={{ color: C.dim, fontSize: "0.85rem", lineHeight: 1.6 }}>
            Nobody is hosting {gameName} right now. Host one yourself and share the code.
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rooms?.map((r, i) => {
            const isPrivate = r.visibility === 'private';
            /* Private entries arrive without a code — the server withholds it —
               so they have no natural key. */
            return (
              <div key={r.code ?? `private-${i}`} style={{
                display: "flex", alignItems: "center", gap: 12,
                background: paleGrad(C.panel), borderRadius: 12, padding: "11px 14px",
                boxShadow: `${GLOSS_SOFT}, ${SHADOW.sm}`,
              }}>
                <span title={isPrivate ? "Private — needs the code" : "Public — anyone can join"}
                  style={{ color: isPrivate ? C.dim : C.correct, display: "grid", placeItems: "center", flexShrink: 0 }}>
                  {isPrivate ? <LockIcon size={17} /> : <GlobeIcon size={17} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontWeight: 800, fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.host}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: C.dim }}>
                    {/* Pluralised on the capacity, not the current count —
                        otherwise a room with one player reads "1 of 2 player". */}
                    {r.players} of {r.max} {r.max === 1 ? "player" : "players"}
                    {isPrivate && " · private"}
                  </span>
                </span>
                {isPrivate ? (
                  /* Not a one-tap join, and not merely hidden either: the
                     server does not send the code for a private room, so there
                     is nothing here to join with even for an edited client. */
                  <span style={{ fontSize: "0.72rem", color: C.dim, background: PILL, padding: "5px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
                    Code needed
                  </span>
                ) : (
                  <Btn onClick={() => enterFromList(r.code)} disabled={busy}
                    style={{ padding: "8px 16px", fontSize: "0.8125rem", flex: "0 0 auto" }}>Join</Btn>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Btn variant="subtle" onClick={onBack} style={{ marginTop: 20 }}>Back</Btn>
    </Centered>
  );
}

export function RoomStatus({ status, error }) {
  const note =
    status === 'reconnecting' ? 'Reconnecting…' :
    status === 'offline' ? 'Still trying to reconnect…' :
    null;
  if (!note && !error) return <div style={{ height: 8 }} />;
  return (
    <div style={{ marginBottom: 12, fontSize: "0.8125rem", fontWeight: 700, color: error ? C.danger : C.accent2 }}>
      {error || note}
    </div>
  );
}

/* Screens shown before the game itself can be drawn. Returns null once the
   room is ready to play, so a game can early-return this and then assume
   `room`, `me` and `room.game` all exist. */
export function lobbyView({ status, room, me, roomCode, gameId, navigate, waitingFor, name, onName, skipLobby, send }) {
  if (status === 'needs-name') return <NameEntry initial={name} onDone={onName} />;

  if (status === 'unconfigured') return (
    <Centered>
      <h2 style={hStyle}>Online play isn't switched on yet</h2>
      <p style={pStyle}>
        The room server address hasn't been set for this site, so there's nowhere to host the game.
        Pass-and-play still works.
      </p>
      <Btn onClick={() => navigate(gameId)}>Back to the game</Btn>
    </Centered>
  );

  if (!room) return (
    <Centered>
      <h2 style={hStyle}>Joining room</h2>
      <p style={pStyle}>{status === 'reconnecting' || status === 'offline' ? 'Trying to reach the room…' : 'One moment…'}</p>
      <div style={{ ...labelStyle, marginBottom: 8 }}>Room code</div>
      <div style={{ fontFamily: "var(--font-head)", fontSize: "2.125rem", fontWeight: 700, letterSpacing: ".12em" }}>{roomCode}</div>
    </Centered>
  );

  if (!me) return (
    <Centered>
      <h2 style={hStyle}>Can't join</h2>
      <p style={pStyle}>That room is full or the game has already started.</p>
      <Btn onClick={() => navigate(gameId)}>Back to the game</Btn>
    </Centered>
  );

  // Games with settings to choose draw their own waiting room instead.
  if (room.status === 'lobby' && !skipLobby) {
    const others = room.players.filter((p) => p.id !== me.id);
    return (
      <Centered>
        <h2 style={hStyle}>{waitingFor ?? 'Waiting for someone to join'}</h2>
        <p style={pStyle}>Send this link to whoever you want to play with. They just open it — no sign-up.</p>
        {/* Only the host sees the public/private control; the server
            refuses it from anyone else anyway. */}
        <InviteLink gameId={gameId} roomCode={roomCode} visibility={room?.visibility}
          onVisibility={send && me && room?.hostId === me.id ? (v) => send({ type: 'visibility', visibility: v }) : undefined} />
        <div style={{ marginTop: 22, fontSize: "0.875rem", color: C.dim }}>
          {others.length === 0 ? 'Nobody else here yet.' : `Here: ${others.map((p) => p.name).join(', ')}`}
        </div>
        <Btn variant="subtle" style={{ marginTop: 18 }} onClick={() => navigate(gameId)}>Leave room</Btn>
      </Centered>
    );
  }

  return null;   // room is playing or over: the game draws itself
}
