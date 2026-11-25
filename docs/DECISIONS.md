# Mela.io — Architecture & Product Decisions

Append-only record of material architecture and product decisions.

---

## ADR-001 — Single-Process Custom Node Server with In-Memory State
- **Date:** 2026-11-25
- **Status:** Accepted (mandated by `AGENTS.md` §3)
- **Context:** Mela.io needs same-origin Next.js App Router pages and Socket.IO real-time multiplayer for private rooms of up to 5 players.
- **Options:**
  1. Custom Node.js HTTP server (`server.ts`) hosting Next.js + Socket.IO on the same origin with in-memory room state.
  2. Separate Next.js server + standalone WebSocket microservice + Redis adapter.
- **Decision:** Use a single-process custom Node HTTP server hosting Next.js and Socket.IO on `/socket.io` with in-memory room state behind clear module boundaries. Do not use Next.js `standalone` output.
- **Rationale:** Eliminates CORS/origin complexity, avoids premature Redis/DB infrastructure, and keeps local Docker execution simple and reliable.
- **Consequences:** Server restarts destroy active rooms and session balances (must be communicated clearly in UI/docs). Horizontal scaling beyond one replica is out of scope.
- **Validation:** Verified in CP-02 (Docker runtime) and CP-03 (same-origin Socket.IO handshake).
- **Supersedes:** None.

---

## ADR-002 — Server-Authoritative Simulation & Zod Runtime Validation
- **Date:** 2026-11-25
- **Status:** Accepted (mandated by `AGENTS.md` §2–3)
- **Context:** Multiplayer movement, mini-game scoring, coin balances, shop purchases, ride seats, and fireworks contributions must not be spoofable by modified clients.
- **Options:**
  1. Client-authoritative state broadcast via server relay.
  2. Server-authoritative simulation, economy, and attraction state with shared Zod runtime schemas.
- **Decision:** Server owns all authoritative state (positions, interaction eligibility, balances, inventory, game timers, scores, ride seats, fireworks). Client owns camera, rendering, and optional prediction/interpolation. All untrusted payloads are validated at runtime with Zod.
- **Rationale:** Prevents negative balances, duplicate rewards, teleportation, and unauthorized purchases.
- **Consequences:** Slightly more server logic and snapshot/interpolation code, testable cleanly via unit and integration suites.
- **Validation:** Verified progressively in CP-03, CP-04, CP-08, CP-11, CP-12, CP-14, CP-19, and CP-21.
- **Supersedes:** None.

---

## ADR-003 — Balloon Game Target Ownership
- **Date:** 2026-11-25
- **Status:** Accepted (confirmed by user on 2026-11-25)
- **Context:** Up to 5 players in a room can play the 30-second balloon game concurrently.
- **Options:**
  1. Per-player server-generated targets with a shared room scoreboard.
  2. Shared targets where all players race to pop the same balloons.
- **Decision:** Default to per-player targets with a shared scoreboard (`AGENTS.md` §2).
- **Rationale:** Avoids frustrating latency-induced target stealing in casual festive play while preserving competitive scores.
- **Consequences:** Server tracks target schedules per participant per round; UI renders the local player's targets and a shared leaderboard.
- **Validation:** Verified in CP-12 (engine) and CP-13 (UI).
- **Supersedes:** None.

---

## ADR-004 — Local Docker Compose as Canonical Runtime
- **Date:** 2026-11-25
- **Status:** Accepted (mandated by `AGENTS.md` §1, §5, §6)
- **Context:** Local development on Windows/host can diverge from Linux container production behavior.
- **Options:**
  1. Test primarily with `npm run dev` on host.
  2. Use Docker Compose (`app` service on `127.0.0.1:3000`) as the canonical verification target from CP-02 onward.
- **Decision:** Require clean Docker build, health check, and Playwright/integration verification against the Docker-served app at every checkpoint starting at CP-02.
- **Rationale:** Catches build, asset, env, and networking issues early before any AWS deployment.
- **Consequences:** Docker Desktop must be running and accessible for CP-02+ gates.
- **Validation:** Verified at CP-02 and every subsequent checkpoint.
- **Supersedes:** None.

---

## ADR-005 — Next.js 16 Production Build with `--webpack`
- **Date:** 2026-11-25
- **Status:** Accepted
- **Context:** Default `next build` (Turbopack in Next.js `16.4.6`) panicked on Windows when spawning the PostCSS worker subprocess (`TurbopackInternalError: Failed to write app endpoint /page`, `node process exited before we could connect to it with exit code: 0`).
- **Options:**
  1. Keep default Turbopack `next build`.
  2. Pin `next build --webpack` in `package.json`.
- **Decision:** Use `next build --webpack` in `package.json` (`build` script).
- **Rationale:** Compiles cleanly on Windows (`6.6s` total) with zero worker IPC panics and produces standard `.next` artifacts compatible with a custom Node server.
- **Consequences:** Uses Webpack instead of Turbopack for production builds; reversible if Turbopack Windows PostCSS IPC is fixed or when building in Linux Docker containers.
- **Validation:** Verified via `npm run build` in CP-01.
- **Supersedes:** None.

## ADR-006 — Node.js 24 LTS and the Next.js CLI in CP-02

- **Date:** 2026-11-25
- **Status:** Accepted
- **Context:** The existing Next.js skeleton needs a production container before Socket.IO is introduced. The lockfile's Vitest and Vite releases support Node.js 24.
- **Options:** Pin a compatible LTS Node image and run the production Next.js CLI, or introduce the custom Node entry point during CP-02.
- **Decision:** Use `node:24.11.1-bookworm-slim` for both stages, retain normal `.next` output and run the production CLI directly under Compose init.
- **Rationale:** A direct Node process receives signals from Compose init. Keeping the Next.js CLI for this checkpoint keeps the custom server and transport in CP-03.
- **Consequences:** CP-03 replaces the CLI command with its custom entry point. Revisit the base pin when dependency compatibility or Node.js maintenance warrants it.
- **Validation:** Clean image build, healthy startup, browser render, SIGTERM stop, and healthy restart in CP-02.
- **Supersedes:** None.

## ADR-007 — Run the custom TypeScript server with Node type stripping

- **Date:** 2026-11-25
- **Status:** Accepted
- **Context:** The custom server must run beside the standard Next.js build in one Node process.
- **Options:** Run erasable TypeScript on the pinned Node line, or compile the custom entry point separately.
- **Decision:** Use `server.mts` with native Node type stripping and explicit source extensions. Retain the repository's TypeScript check as a separate gate.
- **Rationale:** The pinned image already supports erasable TypeScript. The server does not require TypeScript path aliases or syntax that emits extra JavaScript.
- **Consequences:** Custom server imports must resolve directly in Node. Next.js continues to build browser code separately. Revisit if the server needs compile-time transforms or path aliases.
- **Validation:** Host typecheck and production image runtime checks are part of CP-03.
- **Supersedes:** The CLI entry point portion of ADR-006.

## ADR-008 — Reserve room capacity for disconnected sessions

- **Date:** 2026-11-25
- **Status:** Accepted
- **Context:** A room must enforce five-player capacity while allowing a guest to survive a transient disconnect.
- **Options:** Release the slot immediately, allow a reconnect to displace the new occupant, or reserve the slot for a grace period.
- **Decision:** Reserve the slot for 30 seconds by default. Require its private session token to resume once the prior socket has disconnected. Explicit leave invalidates the token immediately. Keep empty invites joinable for 60 seconds by default.
- **Rationale:** A reconnecting guest keeps their identity and place without evicting anyone. Join and resume use monotonic deadlines, including when the scheduled sweep has yet to run.
- **Consequences:** Guests joining a full room may need to wait for a reserved slot. All state is process-local. Rosters expose connection status and stable IDs.
- **Validation:** Clock-injected boundary tests and independent Socket.IO clients in the CP-04 Docker gate.
- **Supersedes:** None.
