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

## ADR-009 — Invitation URL and browser session

- **Date:** 2026-11-25
- **Status:** Accepted
- **Context:** The browser needs a shareable invitation, a single socket lifecycle, and a way to resume during reload.
- **Options:** Use one lobby with an invite query or a separate route for each room. Store the guest token in tab storage or keep it in memory only.
- **Decision:** Use `/?invite=<inviteCode>`, replace the URL on successful admission, and store the latest room's token in tab-scoped session storage. The URL exposes only the invitation code.
- **Rationale:** The same page handles admission and the roster without remounting the socket during admission. Tab storage enables reload recovery.
- **Consequences:** Each tab has one saved room session. Clearing or blocking tab storage removes reload recovery. When a guest explicitly leaves, the page clears their saved session and returns to the create screen.
- **Validation:** Independent Chromium contexts, invite navigation, and same-tab reload against Docker.
- **Supersedes:** The open invitation URL choice in CP-00.

## ADR-010 — Painted Wood carnival and avatar lineup

- **Date:** 2026-11-25
- **Status:** Accepted by the user before CP-06.
- **Context:** The carnival needs a cozy, readable style that is inexpensive to render in a browser.
- **Options:** Painted Wood with simple block geometry, Rounded Toy Blocks with selectively beveled geometry, or Folded Paper with more custom faceted shapes.
- **Decision:** Use Painted Wood (option A). Include a man, a woman, and a cat as selectable avatars, keeping all four accent colors available for every choice.
- **Rationale:** Simple, reusable primitives and flat materials give the renderer a low-cost starting point. Distinct silhouettes provide character variety while preserving shared movement and interactions.
- **Consequences:** CP-06 establishes the static world layout. Avatar implementation starts in CP-07, and the detailed carnival art pass remains CP-09.
- **Validation:** Inspect the Docker-served scene and measure rendering on available hardware during the world checkpoints. No performance benchmark was run during concept selection.
- **Supersedes:** None.

## ADR-011 — Lazy room preview and shared world coordinates

- **Date:** 2026-11-25
- **Status:** Accepted
- **Context:** CP-06 needs a reachable static 3D scene while retaining the existing lobby and invitation flow.
- **Options:** Mount a canvas in every room immediately, navigate to a separate world route, or open a preview alongside the roster.
- **Decision:** Put the static preview behind **View carnival** in admitted rooms. Use R3F 9 with Three.js WebGL 2, demand rendering, one orthographic camera, and shared meter-scale world coordinates.
- **Rationale:** Guests can keep using the room while the preview loads. The lobby does not have to initialize WebGL for every guest, and resizing can preserve the full ground layout.
- **Consequences:** The preview camera is separate from the future follow camera. Browsers without WebGL 2 see a message and retain room controls.
- **Validation:** Render, resize, and simulate unavailable WebGL in Chromium against the Docker app.
- **Supersedes:** None.

## ADR-012 — Local movement and fixed-heading follow camera

- **Date:** 2026-11-25
- **Status:** Accepted
- **Context:** CP-07 needs responsive movement and readable controls in the compact carnival before networking.
- **Options:** Add orbit-relative movement and a physics engine, or keep a fixed heading and shared ground-plane movement.
- **Decision:** Use a fixed-heading perspective follow camera, focus-scoped keyboard controls, elapsed-time ground movement and shared landmark collision footprints. Keep the new avatar choices local.
- **Rationale:** The cardinal controls stay predictable. Simple circle and box checks are sufficient for the current static obstacles and can be reused by the authoritative simulation.
- **Consequences:** The camera follows from a consistent side. Character selection and positions remain local until later checkpoints. Long stalls cap movement for the affected frame.
- **Validation:** Test normal and diagonal speed at several frame rates, collision and boundary behavior, then verify input and follow framing in the Docker-served browser.
- **Supersedes:** The fixed overview camera in ADR-011.

## ADR-013 — Painted Wood entrance composition

- **Date and status:** 2026-11-25, accepted implementation decision under ADR-010.
- **Context and options:** The close follow camera cropped the concept's two foreground stalls. An elevated follow view can preserve the player's movement cues and reveal the whole fair at spawn.
- **Decision:** Fit the camera distance to the scene aspect ratio, follow a fraction of the avatar's displacement and widen the desktop scene. Use the original sheet in the lobby and render the picker portraits from the actual meshes.
- **Rationale and consequences:** The avatar occupies less of the entrance view. The picker provides a close-up with the selected accent. Three batched meshes cover the static fair, bulbs and halos. A small procedural ground texture handles soft grounding. Lighting requires no per-lantern lights or shadow maps.
- **Validation and reversal:** Compare the approved sheet with the desktop and narrow Chromium captures and exercise movement and focus. Revisit the framing if player navigation suffers.
- **Supersedes:** The close framing of ADR-012.

## ADR-014 — Server-owned movement at 20 Hz

- **Date:** 2026-11-25
- **Status:** Accepted
- **Context:** CP-08 needs guests to see one another move without letting a client choose its own coordinates.
- **Options:** Relay client positions, or simulate shared walk input on the server and interpolate the results.
- **Decision:** Clients send sequenced axis input when it changes and every 100 ms while held. The server ticks the shared walk function every 50 ms, caps a late tick at 100 ms, and broadcasts a room snapshot each tick. Local avatars predict; remote avatars interpolate over one tick. A disconnect freezes the pose until the room reconnect grace expires.
- **Rationale:** The same collision rules run in both places. Rejecting positions, non-finite values, and stale sequences prevents a snapshot from teleporting someone. The input timeout stops a guest whose stop message is lost.
- **Consequences:** Remote motion is about one tick behind the server. A stalled server tick does not catch up the full gap. Prediction can be up to 3 units ahead before the local avatar corrects.
- **Validation:** Unit simulation, real socket clients, and Chromium sessions against the Docker app.
- **Supersedes:** The local-only position statement in ADR-012.
