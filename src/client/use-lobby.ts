"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { CatalogItemId } from "../shared/catalog.ts";
import {
  PROTOCOL_VERSION as version,
  SOCKET_PATH,
  createRoomSchema,
  inviteCodeSchema,
  resumeRoomSchema,
  type AttractionInteractResult,
  type AvatarColor,
  type BalloonGameState,
  type ClientToServerEvents,
  type EconomySnapshot,
  type FeatureFlags,
  type FireworksContributeResult,
  type FireworksState,
  type GameHitResult,
  type GameJoinResult,
  type RideBoardResult,
  type RideExitResult,
  type RideState,
  type RoomAdmission,
  type RoomAdmissionResult,
  type RoomLeaveResult,
  type RoomSnapshot,
  type ServerToClientEvents,
  type ShopChatResult,
  type ShopPurchaseResult,
  type ShopVoiceResult,
  type SupportedLanguage,
  type WorldEnterResult,
  type WorldLeaveResult,
  type WorldSnapshot,
} from "../shared/protocol.ts";
import type { AttractionId, AvatarKind } from "../shared/world.ts";

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
  TOO_FAR: "Move closer to the attraction to interact.",
  UNAVAILABLE: "This attraction is currently closed.",
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
  const [coins, setCoins] = useState(0);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [balloonGame, setBalloonGame] = useState<BalloonGameState | null>(null);
  const [balloonGameAt, setBalloonGameAt] = useState(0);
  const [rideState, setRideState] = useState<RideState | null>(null);
  const [flags, setFlags] = useState<FeatureFlags>({
    balloon_game: true,
    ferris_wheel: true,
    ai_shopkeeper: true,
    fireworks: true,
    double_rewards: false,
  });
  const [fireworksState, setFireworksState] = useState<FireworksState | null>(null);
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

    function onEconomy(snapshot: EconomySnapshot) {
      if (roomId.current !== snapshot.roomId) return;
      setCoins(snapshot.coins);
      setInventory(snapshot.inventory);
    }

    function onBalloonGame(state: BalloonGameState) {
      if (roomId.current !== state.roomId) return;
      setBalloonGame(state);
      setBalloonGameAt(performance.now());
    }

    function onRide(state: RideState) {
      if (roomId.current !== state.roomId) return;
      setRideState(state);
    }

    function onFlags(next: FeatureFlags) {
      setFlags(next);
    }

    function onFireworks(state: FireworksState) {
      if (roomId.current !== state.roomId) return;
      setFireworksState(state);
    }

    socket.on("connect", onConnect);
    socket.on("connect_error", onConnectError);
    socket.on("disconnect", onDisconnect);
    socket.on("room:snapshot", onSnapshot);
    socket.on("world:snapshot", onWorld);
    socket.on("economy:updated", onEconomy);
    socket.on("game:state", onBalloonGame);
    socket.on("ride:state", onRide);
    socket.on("flags:updated", onFlags);
    socket.on("fireworks:started", onFireworks);
    socket.connect();

    return () => {
      clearTimeout(resumeTimer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
      socket.off("disconnect", onDisconnect);
      socket.off("room:snapshot", onSnapshot);
      socket.off("world:snapshot", onWorld);
      socket.off("economy:updated", onEconomy);
      socket.off("game:state", onBalloonGame);
      socket.off("ride:state", onRide);
      socket.off("flags:updated", onFlags);
      socket.off("fireworks:started", onFireworks);
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

  const interactAttraction = useCallback(async (attraction: AttractionId): Promise<AttractionInteractResult> => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, code: "NOT_IN_ROOM" };
    try {
      return await socket.timeout(5000).emitWithAck("attraction:interact", { version, attraction });
    } catch {
      return { ok: false, code: "UNAVAILABLE" };
    }
  }, []);

  const joinBalloonGame = useCallback(async (): Promise<GameJoinResult> => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, code: "NOT_IN_ROOM" };
    try {
      const result = await socket.timeout(5000).emitWithAck("game:join", { version });
      if (result.ok) {
        setBalloonGame(result.state);
        setBalloonGameAt(performance.now());
      }
      return result;
    } catch {
      return { ok: false, code: "UNAVAILABLE" };
    }
  }, []);

  const hitBalloonTarget = useCallback(async (roundId: string, targetId: string): Promise<GameHitResult> => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, code: "NOT_IN_ROOM" };
    try {
      return await socket.timeout(3000).emitWithAck("game:hit", { version, roundId, targetId });
    } catch {
      return { ok: false, code: "RATE_LIMITED" };
    }
  }, []);

  const leaveBalloonGame = useCallback(async () => {
    setBalloonGame(null);
    const socket = socketRef.current;
    if (!socket?.connected) return;
    await socket.timeout(3000).emitWithAck("game:leave", { version }).catch(() => undefined);
  }, []);

  const boardRide = useCallback(async (seatIndex?: number): Promise<RideBoardResult> => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, code: "NOT_IN_ROOM" };
    try {
      const result = await socket.timeout(4000).emitWithAck("ride:board", seatIndex === undefined ? { version } : { version, seatIndex });
      if (result.ok) setRideState(result.state);
      return result;
    } catch {
      return { ok: false, code: "UNAVAILABLE" };
    }
  }, []);

  const exitRide = useCallback(async (): Promise<RideExitResult> => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, code: "NOT_IN_ROOM" };
    try {
      const result = await socket.timeout(4000).emitWithAck("ride:exit", { version });
      if (result.ok) setRideState(result.state);
      return result;
    } catch {
      return { ok: false, code: "NOT_RIDING" };
    }
  }, []);

  const purchaseShopItem = useCallback(async (itemId: CatalogItemId, quantity = 1): Promise<ShopPurchaseResult> => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, code: "NOT_IN_ROOM" };
    try {
      const transactionId = `shop:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
      return await socket.timeout(4000).emitWithAck("shop:purchase", { version, itemId, quantity, transactionId });
    } catch {
      return { ok: false, code: "UNAVAILABLE" };
    }
  }, []);

  const chatWithShopkeeper = useCallback(async (message: string, language: SupportedLanguage): Promise<ShopChatResult> => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, code: "NOT_IN_ROOM" };
    try {
      return await socket.timeout(20_000).emitWithAck("shop:chat", { version, message, language });
    } catch {
      return { ok: false, code: "UNAVAILABLE" };
    }
  }, []);

  const voiceWithShopkeeper = useCallback(async (
    audioBase64: string,
    mimeType: string,
    language: SupportedLanguage,
  ): Promise<ShopVoiceResult> => {
    const sessionToken = credentials.current?.sessionToken;
    if (!sessionToken) return { ok: false, code: "NOT_IN_ROOM" };
    try {
      const response = await fetch("/api/shop/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version, sessionToken, audioBase64, mimeType, language }),
      });
      return (await response.json()) as ShopVoiceResult;
    } catch {
      return { ok: false, code: "UNAVAILABLE" };
    }
  }, []);

  const contributeFireworks = useCallback(async (amount: number): Promise<FireworksContributeResult> => {
    const socket = socketRef.current;
    if (!socket?.connected) return { ok: false, code: "NOT_IN_ROOM" };
    try {
      const transactionId = `fw:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
      const result = await socket.timeout(4000).emitWithAck("fireworks:contribute", { version, amount, transactionId });
      if (result.ok) setFireworksState(result.state);
      return result;
    } catch {
      return { ok: false, code: "UNAVAILABLE" };
    }
  }, []);

  function retry() {
    setError("");
    setConnection("connecting");
    socketRef.current?.disconnect().connect();
  }

  return {
    invite, room, world, coins, inventory, balloonGame, balloonGameAt, rideState, flags, fireworksState,
    connection, busy, error, enter, leave, retry, enterWorld, leaveWorld, sendInput, interactAttraction,
    joinBalloonGame, hitBalloonTarget, leaveBalloonGame, boardRide, exitRide,
    purchaseShopItem, chatWithShopkeeper, voiceWithShopkeeper, contributeFireworks,
  };
}
