"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  PROTOCOL_VERSION as version,
  SOCKET_PATH,
  createRoomSchema,
  inviteCodeSchema,
  resumeRoomSchema,
  type AvatarColor,
  type ClientToServerEvents,
  type RoomAdmission,
  type RoomAdmissionResult,
  type RoomLeaveResult,
  type RoomSnapshot,
  type ServerToClientEvents,
  type WorldEnterResult,
  type WorldLeaveResult,
  type WorldSnapshot,
} from "../shared/protocol.ts";
import type { AvatarKind } from "../shared/world.ts";

type LobbySocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type Credentials = Pick<RoomAdmission, "inviteCode" | "sessionToken">;
type Room = Pick<RoomAdmission, "inviteCode" | "playerId" | "snapshot">;
const storageKey = "mela-room-session-v1";

const messages = {
  INVALID_INVITE: "This invitation is invalid or has expired.",
  ROOM_FULL: "This room is full. Ask your friend for another invitation or try again when a spot opens.",
  INVALID_SESSION: "Your room session expired. You can join again with an invitation.",
  SESSION_ACTIVE: "Your previous connection is still closing. Try reconnecting in a moment.",
  ALREADY_IN_ROOM: "You already have a room open on this connection.",
  INVALID_PAYLOAD: "Check your nickname and invitation, then try again.",
  RATE_LIMITED: "Too many attempts. Wait a moment and try again.",
  NOT_IN_ROOM: "You’ve already left this room.",
  NOT_IN_WORLD: "Enter the carnival before moving.",
  STALE_INPUT: "That movement is out of date.",
};

function readCredentials(invite: string | null): Credentials | null {
  try {
    const { inviteCode, sessionToken } = JSON.parse(sessionStorage.getItem(storageKey) ?? "{}");
    if (inviteCodeSchema.safeParse(inviteCode).success &&
        resumeRoomSchema.safeParse({ version, sessionToken }).success &&
        (invite === null || invite === inviteCode)) {
      return { inviteCode, sessionToken };
    }
  } catch {
    // The lobby still works if tab storage is unavailable.
  }
  return null;
}

function saveCredentials(credentials: Credentials | null) {
  try {
    if (credentials) sessionStorage.setItem(storageKey, JSON.stringify(credentials));
    else sessionStorage.removeItem(storageKey);
  } catch {
    // This tab can continue using the in-memory credentials until it reloads.
  }
}

export function invitationPath(inviteCode: string) {
  return `/?invite=${encodeURIComponent(inviteCode)}`;
}

export function useLobby(initialInvite: string | null) {
  const socketRef = useRef<LobbySocket | null>(null);
  const credentials = useRef<Credentials | null>(null);
  const [invite, setInvite] = useState(initialInvite);
  const [room, setRoom] = useState<Room | null>(null);
  const [world, setWorld] = useState<WorldSnapshot | null>(null);
  const roomId = useRef<string | null>(null);
  const [connection, setConnection] = useState<"connecting" | "offline" | "ready" | "retry">("connecting");
  const [busy, setBusy] = useState<"create" | "join" | "leave" | null>(null);
  const [error, setError] = useState("");

  const openRoom = useCallback(({ inviteCode, sessionToken, playerId, snapshot }: RoomAdmission) => {
    credentials.current = { inviteCode, sessionToken };
    saveCredentials(credentials.current);
    window.history.replaceState(null, "", invitationPath(inviteCode));
    roomId.current = snapshot.roomId;
    setInvite(inviteCode);
    setRoom({ playerId, inviteCode, snapshot });
    setWorld((current) => current?.roomId === snapshot.roomId ? current : null);
    setError("");
  }, []);

  useEffect(() => {
    credentials.current = readCredentials(initialInvite);
    const socket: LobbySocket = io({ path: SOCKET_PATH, autoConnect: false });
    socketRef.current = socket;
    let resumeTimer: ReturnType<typeof setTimeout> | undefined;

    async function onConnect(attempt = 0) {
      const session = credentials.current;
      if (!session) {
        setConnection("ready");
        return;
      }

      const socketId = socket.id;
      try {
        const result: RoomAdmissionResult = await socket.timeout(5000).emitWithAck("room:resume", {
          version, sessionToken: session.sessionToken,
        });
        if (!socket.connected || socket.id !== socketId) return;

        if (result.ok) {
          openRoom(result);
          setConnection("ready");
        } else if (result.code === "SESSION_ACTIVE" && attempt < 5) {
          resumeTimer = setTimeout(() => void onConnect(attempt + 1), 400);
        } else if (result.code === "INVALID_SESSION") {
          credentials.current = null;
          saveCredentials(null);
          roomId.current = null;
          setRoom(null);
          setWorld(null);
          setError(messages.INVALID_SESSION);
          setConnection("ready");
        } else {
          setError(messages[result.code]);
          setConnection("retry");
        }
      } catch {
        if (socket.connected && socket.id === socketId) {
          setError("The room didn’t respond. Try reconnecting.");
          setConnection("retry");
        }
      }
    }

    function onDisconnect() {
      clearTimeout(resumeTimer);
      setBusy(null);
      setConnection("connecting");
    }

    function onConnectError() {
      setConnection("offline");
    }

    function onSnapshot(snapshot: RoomSnapshot) {
      setRoom((current) => current?.snapshot.roomId === snapshot.roomId
        ? { ...current, snapshot }
        : current);
    }

    function onWorld(snapshot: WorldSnapshot) {
      if (roomId.current !== snapshot.roomId) return;
      setWorld(snapshot);
    }

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("disconnect", onDisconnect);
    socket.on("room:snapshot", onSnapshot);
    socket.on("world:snapshot", onWorld);
    socket.connect();

    return () => {
      clearTimeout(resumeTimer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("disconnect", onDisconnect);
      socket.off("room:snapshot", onSnapshot);
      socket.off("world:snapshot", onWorld);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [initialInvite, openRoom]);

  async function enter(nickname: string, color: AvatarColor) {
    const socket = socketRef.current;
    if (!socket?.connected || connection !== "ready" || busy) return;
    const profile = createRoomSchema.safeParse({ version, nickname, color });
    if (!profile.success) {
      setError("Enter a nickname between 1 and 24 characters without angle brackets or control characters.");
      return;
    }

    const socketId = socket.id;
    setError("");
    setBusy(invite === null ? "create" : "join");
    try {
      const result: RoomAdmissionResult = invite === null
        ? await socket.timeout(5000).emitWithAck("room:create", profile.data)
        : await socket.timeout(5000).emitWithAck("room:join", { ...profile.data, inviteCode: invite });
      if (socket.id !== socketId) return;
      if (result.ok) openRoom(result);
      else setError(messages[result.code]);
    } catch {
      if (socket.id !== socketId) return;
      // A lost admission acknowledgment may have left this connection bound on the server.
      socket.disconnect().connect();
      setError("The room didn’t respond. Please try again.");
    } finally {
      if (socket.id === socketId) setBusy(null);
    }
  }

  async function leave() {
    const socket = socketRef.current;
    if (!socket?.connected || connection !== "ready" || busy) return;
    const socketId = socket.id;
    setError("");
    setBusy("leave");
    try {
      const result: RoomLeaveResult = await socket.timeout(5000).emitWithAck("room:leave", { version });
      if (socket.id !== socketId) return;
      if (!result.ok && result.code !== "NOT_IN_ROOM") {
        setError(messages[result.code]);
        return;
      }
      credentials.current = null;
      saveCredentials(null);
      roomId.current = null;
      window.history.replaceState(null, "", "/");
      setRoom(null);
      setWorld(null);
      setInvite(null);
    } catch {
      if (socket.id === socketId) setError("Couldn’t leave the room yet. Please try again.");
    } finally {
      if (socket.id === socketId) setBusy(null);
    }
  }

  const enterWorld = useCallback(async (avatar: AvatarKind) => {
    const socket = socketRef.current;
    if (!socket?.connected) return null;
    const socketId = socket.id;
    try {
      const result: WorldEnterResult = await socket.timeout(5000).emitWithAck("world:enter", { version, avatar });
      if (socket.id !== socketId) return null;
      if (!result.ok) {
        setError(messages[result.code]);
        return null;
      }
      return result.pose;
    } catch {
      if (socket.id === socketId) setError("The carnival didn’t respond. Try again.");
      return null;
    }
  }, []);

  const leaveWorld = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    try {
      const result: WorldLeaveResult = await socket.timeout(5000).emitWithAck("world:leave", { version });
      if (!result.ok && result.code !== "NOT_IN_WORLD" && result.code !== "NOT_IN_ROOM") {
        setError(messages[result.code]);
      }
    } catch {
      // Closing the carnival still returns the guest to the room controls.
    }
  }, []);

  const sendInput = useCallback((sequence: number, x: number, z: number) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    void socket.timeout(2000).emitWithAck("player:input", { version, sequence, x, z }).catch(() => undefined);
  }, []);

  function retry() {
    setError("");
    setConnection("connecting");
    socketRef.current?.disconnect().connect();
  }

  return { invite, room, world, connection, busy, error, enter, leave, retry, enterWorld, leaveWorld, sendInput };
}
