# Mela.io — Product & Technical Specifications

Status: **Baseline Draft (CP-00)** — Subject to user confirmation before CP-01/CP-03 implementation.

## 1. Overview
Mela.io is a cozy, browser-based, 3D Indian festive carnival ("mela") for private groups of up to **5 players total (host included)**. Players create or join a private room via an unguessable invitation URL, explore a compact low-poly night carnival together, play a balloon-popping mini-game for virtual coins, ride a synchronized Ferris wheel, buy virtual items from a multilingual shopkeeper, and collectively trigger a shared fireworks celebration.

## 2. Scope & Non-Goals

### In Scope (Desktop-First)
- Private rooms capped at **5 players inclusive of host**.
- Unguessable room invitation URLs and random session tokens.
- Desktop-first third-person 3D exploration (`WASD` / Arrow keys, `E` to interact, `Escape` to close overlays).
- Authoritative single-process Node.js server (Next.js App Router + Socket.IO on same origin, in-memory state).
- Attractions: Balloon Stall mini-game, Ferris Wheel ride, Mithai/Souvenir Shopkeeper (deterministic first, then Sarvam AI text & voice), Shared Fireworks.
- Sponsor integrations: Sarvam AI (multilingual NPC), Flagsmith (live feature flags), NudgeBee (observability/monitoring).
- Accessibility: keyboard-navigable menus, mute/volume controls, reduced-motion mode, no intense flashing.

### Explicit Non-Goals
- No public matchmaking, accounts, persistent databases, or durable cross-restart inventories.
- No real-money payments, NFTs, or monetary value for virtual coins.
- No procedural infinite world, physics engine, skeletal character rigs, or photorealism.
- No player-to-player voice chat.
- No mobile touch controls (deferred unless explicitly approved).
- No multi-replica Redis/Kubernetes architecture for core local gameplay.

## 3. Requirement IDs

| ID | Category | Requirement |
| --- | --- | --- |
| `REQ-ROOM-01` | Rooms | Maximum 5 players per room, including the room creator (host). 6th joiner is rejected with a clear message. |
| `REQ-ROOM-02` | Rooms | Rooms are isolated and addressed by unguessable invitation tokens. |
| `REQ-ROOM-03` | Rooms | Guest identity uses a server-issued random session token (never nickname or socket ID); tokens are never broadcast to other players. |
| `REQ-ROOM-04` | Rooms | Reconnect within a configurable grace period restores session state while the server process lives; expired sessions release capacity and empty rooms expire. |
| `REQ-ROOM-05` | Rooms | Nicknames are length-bounded, sanitized, and rendered as plain text (XSS-safe). |
| `REQ-LOBBY-01` | Lobby | A guest can choose a nickname and avatar color, create or join a room, share its invite link, view the roster, and reload within the reconnect grace period. The browser reports connection, invalid invite and full room states and supports keyboard use. |
| `REQ-NET-01` | Transport | One HTTP listener serves Next.js and accepts same-origin Socket.IO connections. Independently connected clients receive versioned acknowledgments and can reconnect. |
| `REQ-WORLD-01` | World | Compact, bounded, low-poly night carnival with central plaza & fountain, spawn area, paths, balloon stall, mithai shop, Ferris wheel, decorative stalls, and music/dance area. |
| `REQ-WORLD-02` | World | Warm lanterns, festive colors, readable signs, and unobstructed spawn. |
| `REQ-AVATAR-01` | Avatars | Select from a man, a woman, and a cat, with the same four accent colors available for every avatar. Avatars share gameplay rules and use geometry that reads clearly from the third-person camera. |
| `REQ-MOVE-01` | Movement | Desktop-first third-person camera, `WASD`/Arrow movement (diagonal normalized), `E` to interact, `Escape` to close overlays. |
| `REQ-MOVE-02` | Movement | Movement input is suppressed when typing in inputs, when modals are open, or on window blur (no stuck keys). |
| `REQ-MOVE-03` | Movement | Server owns authoritative positions, validates finite numeric inputs, clamps speed/bounds, and broadcasts snapshots at ~15–20 Hz. |
| `REQ-ECON-01` | Economy | Session-only integer coin balances; no negative balances, duplicate rewards, or double spending. |
| `REQ-ECON-02` | Economy | Economic mutations require idempotency keys and use a server-owned catalog. AI dialogue cannot authorize purchases or set prices. |
| `REQ-BALLOON-01` | Balloon Game | 30-second round with server-generated target IDs and spawn schedule; deterministic seed/clock support for tests. |
| `REQ-BALLOON-02` | Balloon Game | Default: per-player targets with a shared room scoreboard (pending user confirmation). |
| `REQ-BALLOON-03` | Balloon Game | Server validates timing, target ID, bounded hit rate, and awards coins once per valid target / once per round. |
| `REQ-RIDE-01` | Ferris Wheel | Wheel phase is derived from a synchronized server epoch; server controls seat assignment, boarding, and safe exit. |
| `REQ-RIDE-02` | Ferris Wheel | Occupied seats cannot be double-booked; disconnect cleans up seat reservation. |
| `REQ-SHOP-01` | Shop | Fixed catalog purchase flow works deterministically without AI. |
| `REQ-SPONSOR-01` | Sarvam AI | Server-only adapter for multilingual text and voice NPC responses with bounded input/output, timeouts, rate limits, and fallback. |
| `REQ-SPONSOR-02` | Flagsmith | Server-side feature flags (`balloon_game`, `ferris_wheel`, `ai_shopkeeper`, `fireworks`, optional `double_rewards`) with safe defaults and live client updates. |
| `REQ-SPONSOR-03` | NudgeBee | Verified onboarding per official hackathon/product docs; real workload telemetry and isolated failure investigation. |
| `REQ-FIREWORKS-01` | Fireworks | Shared room contribution threshold, atomic debit, cooldown, synchronized start timestamp, and reduced-motion alternative. |
| `REQ-A11Y-01` | Accessibility | Keyboard-accessible UI, audio mute/volume (only starts after user gesture), reduced-motion setting, WebGL fallback. |
| `REQ-OPS-01` | Operations | Local Docker Compose is the canonical runtime (`127.0.0.1:3000`, non-root container, `/api/health`, graceful SIGTERM). |
| `REQ-OPS-02` | Operations | Structured logging without secrets/tokens/raw voice; Prometheus-compatible metrics endpoint (not publicly exposed in deployment). |

## 4. Gameplay Rules (Baseline)

### Approved art direction (ADR-010)

- **Painted Wood:** An original blocky Indian night fair built from boxes and low-sided primitives with flat, matte colors. Use indigo awnings, ochre paths, warm lanterns and rust-orange trim. Favor a few recognizable silhouettes over dense ornament.
- **Layout:** A broad entrance faces the central fountain. The balloon stall sits on the left, the mithai shop on the right, and the dance pavilion and Ferris wheel sit at the back. Keep a clear loop around the plaza.
- **Avatars:** The man and woman share the same block proportions and simple festive clothing, with distinct silhouettes through hair or clothing details. The cat uses a compact body, triangular ears, and a blocky tail. All three use marigold, rose, mint or indigo accents, with movement and interactions shared across choices.
- **Rendering:** Reuse geometry and materials for repeated objects. Use emissive lantern surfaces and a small shared lighting setup. Start with flat colors and simple contact shadows. Verify actual performance in the browser once there is a scene to measure.

#### CP-06 scene foundation

- **Entry point:** Admitted room guests select **View carnival** to open the static scene alongside the roster. Three.js loads client-side on demand. The preview has loading and WebGL-unavailable states and leaves room controls usable if rendering fails.
- **Coordinates:** One unit is approximately one metre. +Y is up, +X is right from the entry, and +Z points toward the entrance. The ground spans X from −17 to 17 and Z from −14 to 14. The shared center spawn is `[0, 0, 11]`. The same [world constants](../src/shared/world.ts) provide landmark anchors.
- **Presentation:** Orthographic preview frames the layout at different window sizes. It renders on demand, caps drawing resolution at 1.5× DPR, and uses no dynamic shadows or postprocessing. All landmark geometry is static and procedural.

### Session flow
- **Lobby & Join:** Guests choose a nickname and one of four avatar colors. Creating or joining a room opens its roster and exposes a link of the form `/?invite=<inviteCode>`. The link field can be selected manually if automatic copying fails. Guests may explicitly leave to release their slots.
- **Interactions:** Proximity prompts appear when near an attraction; pressing `E` sends an interaction request validated by server distance and Flagsmith availability checks.
- **Balloon Game:** 30-second round. Players enter from the Balloon Stall. Server spawns targets on a schedule and validates hits. On round end, coins are credited once and the shared scoreboard is displayed.
- **Ferris Wheel:** Players board an available gondola seat via server reservation, ride with synchronized rotation, and exit safely to a valid ground coordinate.
- **Mithai Shop:** Players view a fixed server-owned catalog, purchase items with earned coins, and (in CP-16/17) converse with the shopkeeper via text or microphone in English and supported Indian languages.
- **Fireworks:** Players contribute coins toward a shared room threshold. Reaching the threshold triggers a synchronized fireworks show with a cooldown before the next contribution cycle.

## 5. Architecture & Protocol Baseline
- **Stack:** Next.js App Router, TypeScript (`strict: true`), React Three Fiber, Three.js, Drei, Socket.IO (client & server), Zustand, Tailwind CSS, Zod, Node.js LTS.
- **Local runtime:** Docker Compose runs the custom server as a non-root user on Node.js 24.11.1 LTS. Compose publishes `127.0.0.1:3000` and the image checks `/api/health`.
- **Transport:** One HTTP listener hosts Next.js and Socket.IO 4.8.4 on `/socket.io`. Both polling and WebSocket are supported. A browser handshake with an explicit Origin must match the incoming HTTP Host. Clients without an Origin, such as CLI probes, are accepted. Public HTTPS and proxy handling are future deployment work.
- **Implemented protocol v1:** Client event `transport:ping` takes one object with `version: 1` and `echo` (a string of up to 128 UTF-16 code units). The caller must supply an acknowledgment callback. Replies are `{ ok: true, version: 1, echo, serverTime }` or `{ ok: false, code }`. `serverTime` is the server's Unix time in milliseconds. Malformed payloads and unsupported versions return `INVALID_PAYLOAD`; the eleventh acknowledged request in a one-second per-connection window returns `RATE_LIMITED`. Requests without callbacks are ignored. Transport messages larger than 4096 bytes are rejected by Engine.IO. The diagnostic has no room authorization, sequence counters or session state. Each reconnect creates a new transport identity and rate window.
- **Room protocol v1 (CP-04):** Each request carries `version: 1` and requires an acknowledgment. Extra keys are rejected. Room commands share an independent per-socket budget of 10 acknowledged requests per second and the same 4096-byte message limit as ping. Commands without an acknowledgment have no effect. They are processed in arrival order on each connection, with no automatic retries or client sequence numbers.

| Request | Additional fields | Outcome |
| --- | --- | --- |
| `room:create` | `nickname`, optional `color` | Creates a new room and admits its creator into one of five slots. |
| `room:join` | `inviteCode`, `nickname`, optional `color` | Admits a guest if the invite is valid and space is available. Returns `INVALID_INVITE` or `ROOM_FULL` otherwise. |
| `room:resume` | `sessionToken` | Restores the existing room and player identity before the reservation deadline. Returns `INVALID_SESSION` for unknown or expired tokens and `SESSION_ACTIVE` while the original connection is still active. |
| `room:leave` | None | Removes the current connection's session immediately and returns `{ ok: true }`. A detached connection receives `NOT_IN_ROOM`. |

Create, join and resume all reject a connection already in a room with `ALREADY_IN_ROOM`. Each successful admission privately acknowledges `{ ok: true, playerId, inviteCode, sessionToken, snapshot }`. The invite uses 128 random bits and a session token uses 256 random bits, encoded in unpadded Base64URL. Player IDs and room IDs are UUIDs. Nicknames are trimmed and normalized to NFC, then checked for a length of 1–24 UTF-16 code units and for disallowed control and markup characters. Duplicate nicknames are allowed.

`room:snapshot` is sent only to currently connected members after a membership or connection change and can precede that operation's acknowledgment. It carries `version`, `roomId` and roster entries with `playerId`, `nickname`, `color` and `connected`. Allowed colors are `marigold` (default), `rose`, `mint` and `indigo`. Invitation and session tokens are absent from these events. Socket.IO preserves snapshot order per connection. The creator has the same room permissions as each guest.

The browser stores the most recent room's credentials in session storage to recover after a reload in that tab. Sharing its URL shares the invitation code only. When tab storage is unavailable, reconnect can use in-memory credentials while the page remains open.

A disconnected session reserves its slot for `MELA_RECONNECT_GRACE_MS` (default 30 seconds). The session expires at the deadline. Once its last session is removed, the empty room still accepts joins for `MELA_EMPTY_ROOM_TTL_MS` (default 60 seconds), then its invite expires. The server uses a monotonic clock, a one-second background sweep, and deadline checks on admission. A process restart clears all rooms and reservations.

- **Proposed gameplay events (runtime schemas and authorization arrive with each feature):**
  - Client -> Server: `player:input`, `attraction:interact`, `game:join`, `game:hit`, `shop:purchase`, `ride:board`, `ride:exit`, `fireworks:contribute`.
  - Server -> Client: `world:snapshot`, `game:state`, `economy:updated`, `ride:state`, `fireworks:started`, `flags:updated`, `session:error`.
- **Validation & Security:** All untrusted Socket.IO and HTTP payloads validated with Zod. Finite numeric checks on all coordinates/inputs. Server timestamps and sequence numbers on movement/events. Idempotency keys on all economy mutations.

## 6. Open Questions & Unresolved Requirements
1. **Room Cap & Scope Confirmation:** Confirm the 5-player host-inclusive room cap and desktop-first scope (mobile controls deferred).
2. **Balloon Game Targets:** Confirm default of **per-player targets with a shared scoreboard** (alternative: shared targets where players race to pop the same balloons).
3. **Git Initialization:** Confirm whether to initialize a local Git repository (`git init`) at the start of CP-01.
4. **Sponsor Verification (Deferred to CP-16/17/18/23):**
   - Exact Sarvam AI API endpoints, supported language codes, model names, and credentials.
   - Flagsmith environment keys and SDK version.
   - NudgeBee onboarding prerequisites (specifically whether Docker-only monitoring is supported or if local kind/k3d Kubernetes is required).
5. **Docker Daemon Access (resolved in CP-02):** The sandbox cannot access the Docker API pipe. Docker Desktop Linux Engine access was verified outside the sandbox with command approval.
