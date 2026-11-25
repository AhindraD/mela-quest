"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { invitationPath, useLobby } from "../src/client/use-lobby";
import {
  AVATAR_COLORS,
  DEFAULT_AVATAR_COLOR,
  ROOM_CAPACITY,
  inviteCodeSchema,
  type AvatarColor,
} from "../src/shared/protocol.ts";
import { CarnivalPreview } from "./world/carnival-preview";

const colorLabels: Record<AvatarColor, string> = {
  marigold: "Marigold", rose: "Rose", mint: "Mint", indigo: "Indigo",
};

export function Lobby({ initialInvite }: { initialInvite: string | null }) {
  const { invite, room, connection, busy, error, enter, leave, retry } = useLobby(initialInvite);
  const [nickname, setNickname] = useState("");
  const [color, setColor] = useState<AvatarColor>(DEFAULT_AVATAR_COLOR);
  const [previewRoomId, setPreviewRoomId] = useState<string | null>(null);
  const roomId = room?.snapshot.roomId;
  const previewOpen = roomId !== undefined && previewRoomId === roomId;
  const heading = useRef<HTMLHeadingElement>(null);
  const previousRoom = useRef<string | undefined>(undefined);
  const isInvitation = invite !== null;
  const invalidInvite = isInvitation && !inviteCodeSchema.safeParse(invite).success;

  useEffect(() => {
    if (previousRoom.current !== roomId) heading.current?.focus();
    previousRoom.current = roomId;
  }, [roomId]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void enter(nickname, color);
  }

  return (
    <main className="lobby-shell">
      {previewOpen ? <CarnivalPreview /> : (
        <section className="lobby-poster" aria-labelledby="carnival-title">
          <p className="lobby-wordmark"><span aria-hidden="true">✷</span> Mela.io</p>
          <div className="lobby-poster-copy">
            <h1 id="carnival-title">Welcome to the Festive Carnival</h1>
            <p>An Indian night fair for you and your friends.</p>
          </div>
        </section>
      )}

      <section className="lobby-panel" aria-labelledby="lobby-heading">
        {room ? (
          <>
            <div className="lobby-heading-row">
              <h2 id="lobby-heading" tabIndex={-1} ref={heading}>Your room</h2>
              <button className="lobby-text-button" disabled={busy !== null || connection !== "ready"} onClick={() => void leave()}>
                {busy === "leave" ? "Leaving…" : "Leave room"}
              </button>
            </div>
            <InviteLink inviteCode={room.inviteCode} />
            <div className="lobby-roster-title">
              <h3>Guests</h3>
              <p role="status">{room.snapshot.players.length} of {ROOM_CAPACITY} spots taken</p>
            </div>
            <ul className="lobby-roster" aria-label="Guests">
              {room.snapshot.players.map((player) => (
                <li key={player.playerId}>
                  <span className={`avatar-dot avatar-${player.color}`} aria-label={colorLabels[player.color]} role="img" />
                  <span className="lobby-guest-name">{player.nickname}</span>
                  {player.playerId === room.playerId && <span className="lobby-muted">You</span>}
                  {!player.connected && <span className="lobby-muted lobby-reservation">Reconnecting</span>}
                </li>
              ))}
            </ul>
            <button className="lobby-secondary world-toggle" type="button" aria-expanded={previewOpen}
              onClick={() => setPreviewRoomId(previewOpen ? null : room.snapshot.roomId)}>
              {previewOpen ? "Close carnival preview" : "View carnival"}
            </button>
          </>
        ) : (
          <>
            <h2 id="lobby-heading" tabIndex={-1} ref={heading}>{isInvitation ? "Join a room" : "Create a room"}</h2>
            {invalidInvite ? (
              <>
                <p className="lobby-alert" role="alert">This invitation is invalid or has expired.</p>
                <Link className="lobby-link" href="/">Create your own room</Link>
              </>
            ) : (
              <>
                <p className="lobby-intro">{isInvitation
                  ? "Pick a nickname and color to join your friends."
                  : "Start a private room for up to five guests."}</p>
                <form className="lobby-form" onSubmit={submit}>
                  <label htmlFor="nickname">Nickname</label>
                  <input id="nickname" name="nickname" placeholder="e.g. Mira" autoComplete="off"
                    required maxLength={24} value={nickname} onChange={(event) => setNickname(event.target.value)} />
                  <fieldset>
                    <legend>Avatar color</legend>
                    <div className="lobby-colors">
                      {AVATAR_COLORS.map((option) => (
                        <label key={option} className="lobby-choice">
                          <input type="radio" name="color" value={option} checked={color === option}
                            onChange={() => setColor(option)} />
                          <span className={`avatar-dot avatar-${option}`} aria-hidden="true" />
                          <span>{colorLabels[option]}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <button className="lobby-primary" type="submit" disabled={connection !== "ready" || busy !== null}>
                    {busy === "create" ? "Creating room…" : busy === "join" ? "Joining room…" : isInvitation ? "Join room" : "Create room"}
                  </button>
                </form>
                {isInvitation && <Link className="lobby-link" href="/">Create your own room</Link>}
              </>
            )}
          </>
        )}
        {error && <p className="lobby-alert" role="alert">{error}</p>}
        {!invalidInvite && connection === "connecting" && <p className="lobby-muted" role="status">
          {room ? "Reconnecting to your room…" : "Connecting to the carnival…"}
        </p>}
        {!invalidInvite && connection === "offline" && <p className="lobby-muted" role="status">
          Can’t reach the carnival. Retrying…
        </p>}
        {connection === "retry" && <button className="lobby-text-button" onClick={retry}>Try reconnecting</button>}
      </section>
    </main>
  );
}

function InviteLink({ inviteCode }: { inviteCode: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState("");
  const url = new URL(invitationPath(inviteCode), window.location.origin).href;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setFeedback("Invite link copied.");
    } catch {
      input.current?.focus();
      input.current?.select();
      setFeedback("Couldn’t copy automatically. Copy the selected link.");
    }
  }

  return (
    <div className="lobby-invite">
      <label htmlFor="invite-link">Invitation link</label>
      <div>
        <input id="invite-link" ref={input} value={url} readOnly onFocus={(event) => event.target.select()} />
        <button className="lobby-secondary" onClick={() => void copyLink()}>Copy link</button>
      </div>
      {feedback && <p role="status" className="lobby-muted">{feedback}</p>}
    </div>
  );
}
