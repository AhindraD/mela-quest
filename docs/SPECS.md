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
| `REQ-WORLD-01` | World | Compact, bounded, low-poly night carnival with central plaza & fountain, spawn area, paths, balloon stall, mithai shop, Ferris wheel, decorative stalls, and music/dance area. |
| `REQ-WORLD-02` | World | Warm lanterns, festive colors, readable signs, and unobstructed spawn. |
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
- **Lobby & Join:** Guest enters a bounded nickname and selects an avatar color, then creates a room or opens an invite URL (`/room/[inviteCode]` or query parameter — to be finalized in CP-05).
- **Interactions:** Proximity prompts appear when near an attraction; pressing `E` sends an interaction request validated by server distance and Flagsmith availability checks.
- **Balloon Game:** 30-second round. Players enter from the Balloon Stall. Server spawns targets on a schedule and validates hits. On round end, coins are credited once and the shared scoreboard is displayed.
- **Ferris Wheel:** Players board an available gondola seat via server reservation, ride with synchronized rotation, and exit safely to a valid ground coordinate.
- **Mithai Shop:** Players view a fixed server-owned catalog, purchase items with earned coins, and (in CP-16/17) converse with the shopkeeper via text or microphone in English and supported Indian languages.
- **Fireworks:** Players contribute coins toward a shared room threshold. Reaching the threshold triggers a synchronized fireworks show with a cooldown before the next contribution cycle.

## 5. Architecture & Protocol Baseline
- **Stack:** Next.js App Router, TypeScript (`strict: true`), React Three Fiber, Three.js, Drei, Socket.IO (client & server), Zustand, Tailwind CSS, Zod, Node.js LTS.
- **Transport:** Single custom Node HTTP server hosting Next.js and Socket.IO on the same origin (`/socket.io`). No Next.js `standalone` output.
- **Protocol Events (Proposed, to be specified with Zod schemas in CP-03/CP-04):**
  - Client -> Server: `room:create`, `room:join`, `room:resume`, `room:leave`, `player:input`, `attraction:interact`, `game:join`, `game:hit`, `shop:purchase`, `ride:board`, `ride:exit`, `fireworks:contribute`.
  - Server -> Client: `room:snapshot`, `player:joined`, `player:left`, `world:snapshot`, `game:state`, `economy:updated`, `ride:state`, `fireworks:started`, `flags:updated`, `session:error`.
- **Validation & Security:** All untrusted Socket.IO and HTTP payloads validated with Zod. Finite numeric checks on all coordinates/inputs. Server timestamps and sequence numbers on movement/events. Idempotency keys on all economy mutations.

## 6. Open Questions & Unresolved Requirements
1. **Room Cap & Scope Confirmation:** Confirm the 5-player host-inclusive room cap and desktop-first scope (mobile controls deferred).
2. **Balloon Game Targets:** Confirm default of **per-player targets with a shared scoreboard** (alternative: shared targets where players race to pop the same balloons).
3. **Git Initialization:** Confirm whether to initialize a local Git repository (`git init`) at the start of CP-01.
4. **Sponsor Verification (Deferred to CP-16/17/18/23):**
   - Exact Sarvam AI API endpoints, supported language codes, model names, and credentials.
   - Flagsmith environment keys and SDK version.
   - NudgeBee onboarding prerequisites (specifically whether Docker-only monitoring is supported or if local kind/k3d Kubernetes is required).
5. **Docker Daemon Access:** In the CP-00 environment check, `docker info` inside the agent sandbox returned `permission denied while trying to connect to the docker API at npipe:////./pipe/docker_engine`. Confirm Docker Desktop is running and how container commands should be executed for CP-02+ (unsandboxed approval or user-executed).
