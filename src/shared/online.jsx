import { useState } from 'react';
import { C } from './theme.js';
import { Btn, Centered, hStyle, pStyle } from './ui.jsx';
import { saveName } from './useRoom.js';

/* Pieces every online game needs: an invite link to share, a connection
   banner, and the waiting-room screens shown before play begins. */

const labelStyle = { fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase", color: C.dim, fontWeight: 700 };

export function InviteLink({ gameId, roomCode }) {
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
      <div style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: 42, fontWeight: 700, letterSpacing: ".12em", marginBottom: 16 }}>
        {roomCode}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: "8px 8px 8px 14px" }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.dim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "left" }}>{url}</span>
        <Btn onClick={copy} style={{ padding: "8px 16px", fontSize: 13, flex: "0 0 auto" }}>{copied ? "Copied" : "Copy"}</Btn>
      </div>
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
          style={{ width: "100%", padding: "14px 16px", fontSize: 18, fontFamily: "inherit", color: C.text,
            background: "#fff", border: `2px solid ${C.line}`, borderRadius: 12, outlineColor: C.accent, textAlign: "center" }} />
        <Btn type="submit" disabled={!clean} style={{ opacity: clean ? 1 : .5 }}>Continue</Btn>
      </form>
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
    <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: error ? C.danger : C.accent2 }}>
      {error || note}
    </div>
  );
}

/* Screens shown before the game itself can be drawn. Returns null once the
   room is ready to play, so a game can early-return this and then assume
   `room`, `me` and `room.game` all exist. */
export function lobbyView({ status, room, me, roomCode, gameId, navigate, waitingFor, name, onName }) {
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
      <div style={{ fontFamily: "'Times New Roman', Times, serif", fontSize: 34, fontWeight: 700, letterSpacing: ".12em" }}>{roomCode}</div>
    </Centered>
  );

  if (!me) return (
    <Centered>
      <h2 style={hStyle}>Can't join</h2>
      <p style={pStyle}>That room is full or the game has already started.</p>
      <Btn onClick={() => navigate(gameId)}>Back to the game</Btn>
    </Centered>
  );

  if (room.status === 'lobby') {
    const others = room.players.filter((p) => p.id !== me.id);
    return (
      <Centered>
        <h2 style={hStyle}>{waitingFor ?? 'Waiting for someone to join'}</h2>
        <p style={pStyle}>Send this link to whoever you want to play with. They just open it — no sign-up.</p>
        <InviteLink gameId={gameId} roomCode={roomCode} />
        <div style={{ marginTop: 22, fontSize: 14, color: C.dim }}>
          {others.length === 0 ? 'Nobody else here yet.' : `Here: ${others.map((p) => p.name).join(', ')}`}
        </div>
        <Btn variant="subtle" style={{ marginTop: 18 }} onClick={() => navigate(gameId)}>Leave room</Btn>
      </Centered>
    );
  }

  return null;   // room is playing or over: the game draws itself
}
