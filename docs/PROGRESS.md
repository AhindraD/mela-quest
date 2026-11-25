# Mela.io — Checkpoint Progress Ledger

## Summary

| Checkpoint | Title | Status |
| --- | --- | --- |
| CP-00 | Discovery and project contract | VERIFIED |
| CP-01 | Reproducible Next.js skeleton | VERIFIED |
| CP-02 | Docker runtime | VERIFIED |
| CP-03 | Socket transport and protocol | VERIFIED |
| CP-04 | Authoritative room manager | VERIFIED |
| CP-05 | Lobby and invitation flow | VERIFIED |
| CP-06 | 3D scene foundation | VERIFIED |
| CP-07 | Local avatar and controls | VERIFIED |
| CP-08 | Networked movement | VERIFIED |
| CP-09 | Carnival art pass | VERIFIED |
| CP-10 | Interaction framework and HUD | VERIFIED |
| CP-11 | Economy and inventory | VERIFIED |
| CP-12 | Balloon game engine | VERIFIED |
| CP-13 | Balloon game UI | VERIFIED |
| CP-14 | Ferris wheel | IN_PROGRESS |
| CP-15 | Shopkeeper without AI | IN_PROGRESS |
| CP-16 | Sarvam adapter and text dialogue | IN_PROGRESS |
| CP-17 | Multilingual voice | IN_PROGRESS |
| CP-18 | Flagsmith integration | IN_PROGRESS |
| CP-19 | Shared fireworks and celebration | IN_PROGRESS |
| CP-20 | Audio, accessibility and polish | IN_PROGRESS |
| CP-21 | Resilience and security | NOT_STARTED |
| CP-22 | Observability foundation | IN_PROGRESS |
| CP-23 | NudgeBee integration verification | IN_PROGRESS |
| CP-24 | Full five-player acceptance and performance | NOT_STARTED |
| CP-25 | Documentation and release candidate | NOT_STARTED |
| CP-26..30 | AWS deployment (gated, not authorized) | NOT_STARTED |

---

## CP-00 — Discovery and project contract
- **Status:** VERIFIED
- **Goal / requirement IDs:** Inspect existing repository, OS, Docker/Compose, Node/npm, Git, browser, and disk; create living docs (`docs/SPECS.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/TESTING.md`, `docs/ASSETS.md`, `docs/DEPLOYMENT.md`, `README.md`); establish requirement IDs and open questions; verify clean baseline.
- **Starting commit / baseline:** No git repository initialized yet; directory contained only `AGENTS.md`.
- **Changes and files:**
  - Created `docs/SPECS.md`
  - Created `docs/DECISIONS.md`
  - Created `docs/TESTING.md`
  - Created `docs/ASSETS.md`
  - Created `docs/DEPLOYMENT.md`
  - Created `docs/PROGRESS.md`
  - Created `README.md`
- **Commands actually executed:**
  1. `Get-ChildItem -Force; git status; node -v; npm -v; git --version; docker --version; docker compose version; Get-PSDrive C | Select-Object Name, Used, Free`
  2. `where.exe docker; docker info 2>&1; docker-compose --version 2>&1; Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe','HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\msedge.exe' -ErrorAction SilentlyContinue | Select-Object PSChildName, '(default)'`
- **Results (exit codes, counts, observed behavior):**
  - Command 1: Exit `0`. Directory had only `AGENTS.md`; `git status` -> `fatal: not a git repository`; Node `v26.13.1`; npm `11.4.2`; Git `2.56.1.windows.1`; Docker `29.9.3`; `docker compose` failed inside sandbox (`open C:\Users\offic\.docker\config.json: Access is denied`, `unknown command: docker compose`); Disk C: `141,463,687,168` bytes (~141.46 GB) free.
  - Command 2: Exit `0`. `docker-compose --version` -> `Docker Compose version v5.7.0`. `docker info` -> Client `29.9.3` with plugins (`compose v5.7.0`, `buildx v0.38.1`), Server -> `permission denied while trying to connect to the docker API at npipe:////./pipe/docker_engine`. Browsers found: `chrome.exe` and `msedge.exe`.
- **Evidence paths or CI run IDs:** Recorded in `docs/TESTING.md`.
- **Manual checks:** NOT RUN (no application UI exists in CP-00).
- **Known issues and blockers:**
  - **Docker daemon access from sandbox:** `docker info` cannot reach `npipe:////./pipe/docker_engine` from the sandboxed terminal (`permission denied`). Must verify Docker Desktop is running and determine unsandboxed/user execution for CP-02+.
  - **Git repository not initialized:** No `.git` directory exists yet.
  - **Open scope/sponsor questions:** Recorded in `docs/SPECS.md` §6.
- **Decisions (ADR IDs):** `ADR-001`, `ADR-002`, `ADR-003` (proposed), `ADR-004`.
- **Next action:** Proceed to CP-01 — Reproducible Next.js skeleton.
- **Approval to advance:** approved (2026-11-25)

---

## CP-01 — Reproducible Next.js skeleton
- **Status:** VERIFIED
- **Goal / requirement IDs:** Scaffold minimal Next.js App Router TypeScript app, pinned dependencies, lockfile, lint/typecheck/unit test scripts, ignore rules, `.env.example`, minimal landing page, and `/api/health` endpoint with a unit smoke test.
- **Starting commit / baseline:** Initialized git repository in `mela-quest/` at CP-01; CP-00 living docs verified.
- **Changes and files:**
  - `package.json`, `package-lock.json` (pinned: `next@16.4.6`, `react@19.3.1`, `react-dom@19.3.1`, `typescript@6.0.3`, `tailwindcss@4.3.5`, `@tailwindcss/postcss@4.3.5`, `eslint@9.39.5`, `eslint-config-next@16.4.6`, `vitest@5.1.1`)
  - `.gitignore`, `.env.example`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.mts`
  - `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/api/health/route.ts`
  - `src/shared/health.ts`, `tests/unit/health.test.ts`
- **Commands actually executed:**
  1. `git -C C:\zmy_data\we-make-devs\mela-quest init`
  2. `npm install --save-exact next react react-dom; npm install --save-dev --save-exact typescript @types/node @types/react @types/react-dom eslint eslint-config-next tailwindcss @tailwindcss/postcss vitest` (unsandboxed)
  3. `npm run lint && npm run typecheck && npm run test:unit && npm run build`
  4. Production HTTP probe via `node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000` (unsandboxed)
- **Results (exit codes, counts, observed behavior):**
  - `git init`: Exit `0`.
  - `npm install`: Exit `0`, 486 packages audited, 0 vulnerabilities.
  - `npm run lint`: Exit `0` (`eslint .`).
  - `npm run typecheck`: Exit `0` (`tsc --noEmit`).
  - `npm run test:unit`: Exit `0` (1 test file, 2 tests passed).
  - `npm run build`: Exit `0` (`next build --webpack`; routes `/`, `/_not-found`, `/api/health`).
  - Production HTTP probe: Exit `0`; `GET /api/health` -> `200` (`status: "ok"`, `service: "mela-io"`); `GET /` -> `200` (`Welcome to the Festive Carnival`).
- **Evidence paths or CI run IDs:** Recorded in `docs/TESTING.md`.
- **Manual checks:** NOT RUN (verified via HTTP response probe; visual browser inspection begins in CP-02).
- **Known issues and blockers:**
  - Default Turbopack `next build` panicked on Windows PostCSS worker spawn (`ADR-005` switched build script to `next build --webpack`).
  - Docker commands in CP-02 will require unsandboxed execution (`BypassSandbox: true`) or user execution because the sandbox blocks `npipe:////./pipe/docker_engine`.
- **Decisions (ADR IDs):** `ADR-001`, `ADR-003` (accepted), `ADR-005`.
- **Verification follow-up (2026-11-25):** The original install generated the lockfile. `npm.cmd ci` initially failed with sandbox EPERM and passed on retry outside the sandbox (479 packages installed, 486 audited, 0 vulnerabilities). Lint, typecheck and both unit tests passed. The host build passed on retry outside the sandbox after a separate webpack EPERM.
- **Next action:** Proceed to CP-02 — Docker runtime.
- **Approval to advance:** approved (2026-11-25)

## CP-02 — Docker runtime

- **Status:** VERIFIED
- **Goal / requirement IDs:** `REQ-OPS-01`. Build a clean production image, verify the non-root runtime, health, browser landing page, shutdown, restart, and image contents.
- **Starting commit / baseline:** `46217b9`.
- **Changes and files:** Added `Dockerfile`, `.dockerignore`, and `compose.yaml`. Updated the local setup, specifications, deployment contract and test records.
- **Commands actually executed:** Host `npm ci`, lint, typecheck, unit tests and production build. Clean Docker build, Compose config and startup, health and log checks, runtime file/UID inspection, a competing port bind, and a stop/start cycle. See [TESTING.md](TESTING.md) for invocations.
- **Results:** Clean Linux build and all host gates passed. Compose reported healthy at `127.0.0.1:3000` before and after restart. Node ran as UID 1000. The port conflict failed as expected. SIGTERM cleanup completed in 0.48 seconds.
- **Evidence:** [TESTING.md](TESTING.md), CP-02 results and image digest. Landing page screenshot inspected in the checkpoint chat.
- **Manual checks:** PASS. The in-app Chromium browser rendered the landing page and reported zero captured warnings or errors.
- **Known issues and blockers:** Docker Engine commands require access outside the sandbox. Integration and browser E2E suites are introduced in CP-03 and CP-05. The local service remains running for review.
- **Decisions:** `ADR-004`, `ADR-006`.
- **Next action:** CP-03 — Socket transport and protocol.
- **Approval to advance:** approved (2026-11-25)

## CP-03 — Socket transport and protocol

- **Status:** VERIFIED
- **Goal / requirement IDs:** `REQ-NET-01`, `REQ-OPS-01`. Serve Next.js and Socket.IO on one listener and verify typed acknowledgments, validation, reconnect and HTTP readiness with independent clients against Compose.
- **Starting commit / baseline:** `46217b9` plus verified, uncommitted CP-02 changes.
- **Changes and files:** Custom server in `server.mts`, typed Zod protocol and listener modules under `src/`, transport tests under `tests/integration/`, pinned dependencies, Docker runtime entry point and living docs.
- **Commands actually executed:** `npm ci`, lint, typecheck, unit/integration tests, host build, Compose config/build/start/status/logs, HTTP probe, UID check and stop/start. See [TESTING.md](TESTING.md) for commands and results.
- **Results:** Two unit and three integration tests passed. The first host typecheck and Docker build failed with TS2540, resolved on rerun. Final Compose service healthy before and after graceful shutdown, with HTTP readiness and no fatal startup errors.
- **Evidence:** [TESTING.md](TESTING.md). Local image manifest digest `sha256:3035b69e1c887d7db86b1a62aeefea54967a85a24cd56f07f5ee2b73b8a0298c`.
- **Manual checks:** NOT RUN. No UI changed, and the integration suite verified HTTP responses and real socket transport.
- **Known issues and blockers:** Docker Engine commands require access outside the sandbox. Room identity, authorization and resume state are CP-04 work. The local service remains running.
- **Decisions:** `ADR-001`, `ADR-007`.
- **Next action:** CP-04 — Authoritative room manager.
- **Approval to advance:** approved (2026-11-25)

## CP-04 — Authoritative room manager

- **Status:** VERIFIED
- **Goal / requirement IDs:** `REQ-ROOM-01` through `REQ-ROOM-05`. Implement typed room events, private session credentials, room-scoped snapshots, and deterministic expiry.
- **Starting commit / baseline:** Clean CP-03 commit `f8f2569`.
- **Changes and files:** Added `src/server/room-manager.mts`, typed and validated room events, clock-injected unit tests, real Socket.IO integration tests, and Compose lifetime settings.
- **Commands actually executed:** `npm ci`, lint, typecheck, unit/integration tests, production build, Compose config/start/status/logs, HTTP readiness, runtime UID, and stop/start.
- **Results:** Seven unit tests and five integration tests passed. The isolated Docker run verified five-player admission, sixth rejection, duplicate and invalid join handling, token privacy, cross-room isolation, explicit leave, identity restoration and capacity release after expiry.
- **Evidence:** [TESTING.md](TESTING.md). Docker image manifest digest `sha256:20d7b1269684358241e09fc34e0fc282da57ec6bff757ac1ae4783e32c12d92e`.
- **Manual checks:** NOT RUN. The checkpoint adds a socket API and makes no visual changes.
- **Known issues and blockers:** Browser lobby and invitation links are CP-05 work. Rooms are process-local. The local container remains running.
- **Decisions:** `ADR-008`.
- **Next action:** CP-05 — Lobby and invitation flow.
- **Approval to advance:** approved (2026-11-25)

## CP-05 — Lobby and invitation flow

- **Status:** VERIFIED
- **Goal / requirement IDs:** `REQ-LOBBY-01`, `REQ-ROOM-01` through `REQ-ROOM-05`. Add browser create/join, avatar color, a shareable invite, roster, reload and accessible error states.
- **Starting commit / baseline:** Clean CP-04 commit `8471737`.
- **Changes and files:** Added the lobby and its socket lifecycle, tab-scoped reload recovery, server-owned avatar colors, an original ImageGen illustration, and a pinned Playwright suite.
- **Commands actually executed:** Clean npm install, Playwright browser install, lint, typecheck, unit/integration tests, host and Docker production builds, Docker Compose readiness and logs, and Chromium E2E. Exact results are in [TESTING.md](TESTING.md).
- **Results:** Seven unit tests, five integration tests and two E2E tests passed. Independent browser contexts verified capacity, room isolation, invite navigation, reload, keyboard submission, explicit leave, invalid links and the clipboard fallback.
- **Evidence:** `test-results/cp05-verified/`. The final Docker image manifest digest was `sha256:953b13ffeabeb5b34215675861698b646fc8e1e01b366b2184c53d25471c4396`.
- **Manual checks:** PASS. Inspected desktop lobby, five-guest roster and 390 px narrow lobby screenshots from the Docker-served Chromium session. Browser tests observed no console errors or uncaught exceptions across the main journey.
- **Known issues and blockers:** Loopback links support testing on the same machine. Rooms are process-local. The healthy app remains running.
- **Decisions:** `ADR-009`.
- **Next action:** CP-06 — 3D scene foundation.
- **Approval to advance:** approved (2026-11-25)

### Design decision before CP-06

The user approved Painted Wood (option A) and requested a woman and a cat alongside the man avatar. The layout, rendering approach, and avatar lineup are recorded in `ADR-010` and the specifications.

## CP-06 — 3D scene foundation

- **Status:** VERIFIED
- **Goal / requirement IDs:** `REQ-WORLD-01`, `REQ-WORLD-02`, and the WebGL fallback portion of `REQ-A11Y-01`. Add a static client-only scene preview to admitted rooms, with shared world coordinates, responsive framing, and loading and error states.
- **Starting commit / baseline:** CP-05 at `fa50e0a` plus the approved Painted Wood documentation.
- **Changes and files:** Added the client-only room preview in `app/world/`, shared scene coordinates, static Painted Wood landmark placeholders, fallback and loading UI, and Chromium coverage. Pinned React Three Fiber 9.8.2 and Three.js 0.187.0.
- **Commands actually executed:** `npm ci`, lint, typecheck, unit and integration tests, host build, Compose config/build/start/status/logs, HTTP readiness, and Chromium E2E. See [TESTING.md](TESTING.md).
- **Results:** Seven unit, five integration, and four E2E tests passed. Browser tests verified rendering, resize, unavailable WebGL, context loss, and room use with the fallback.
- **Evidence:** `test-results/cp06/world-renders-the-carnival-in-WebGL-and-resizes-the-scene/`. Final Docker manifest digest `sha256:f7bed5e9e8379bf1c91effa2a883e89bfd64fd6eecf2171a4af364bfa34c623a`.
- **Manual checks:** PASS. Inspected desktop and narrow viewport screenshots from the Docker-served scene. All five landmarks and the entrance were visible. The Chromium render check reported no uncaught errors or console errors.
- **Known issues and blockers:** The preview is static. Chromium ran with SwiftShader for functional evidence. Hardware GPU performance remains unmeasured. The app remains healthy on localhost.
- **Decisions:** `ADR-010`, `ADR-011`.
- **Next action:** CP-07 — Local avatar and controls.
- **Approval to advance:** approved (2026-11-25)

## CP-07 — Local avatar and controls

- **Status:** VERIFIED
- **Goal / requirement IDs:** `REQ-AVATAR-01`, local movement and camera portions of `REQ-MOVE-01` and `REQ-MOVE-02`. Add three local avatars, keyboard movement, shared collisions and a follow camera.
- **Starting commit / baseline:** CP-05 commit `fa50e0a` with verified, uncommitted CP-06 and Painted Wood design changes in the working tree.
- **Changes and files:** Added procedural man, woman and cat models, the local avatar selector, focus-scoped controls, the third-person camera, and shared collision geometry and movement math. Added movement unit cases and extended the Docker-served Chromium tests.
- **Commands actually executed:** `npm ci`, lint, typecheck, unit/integration tests, host build, Compose config/build/start/status/logs, HTTP readiness and Chromium E2E. See [TESTING.md](TESTING.md).
- **Results:** Fifteen unit, five integration, and five E2E tests passed. Unit tests cover all four directions, normalized speed across four simulated frame rates, landmark collision and world boundaries. Chromium covers avatar selection, movement and follow framing, focus interruptions, and keyboard return to the room.
- **Evidence:** `test-results/cp07-verified/`. Final Docker image manifest digest `sha256:ba6380b2969524f24fd870eb68a9409d6a6d305c78aa2c728d7ffba7705b85c6`.
- **Manual checks:** PASS. Inspected man, woman and cat shots at the entrance and the follow-camera shot near the fountain. Chromium reported no uncaught browser errors on the tested path.
- **Known issues and blockers:** Avatar type and movement are local. The browser checks used software WebGL. The local Docker service remains healthy.
- **Decisions:** `ADR-010`, `ADR-012`.
- **Next action:** CP-08 — Networked movement.
- **Approval to advance:** approved (2026-11-25, CP-08 requested)

### CP-07 visual revision — Prototype A
- **Status:** VERIFIED for implementation and regression checks. Owner visual sign-off pending.
- **Baseline:** CP-07 local-play working tree at HEAD `4860424`. The original A sheet was recovered and saved with the project.
- **Gaps addressed:** The previous close camera cut off the booths and wheel. The revised view frames both foreground stalls, tiered fountain, rear pavilion and wheel. The polygon fence curves toward the lantern gate. The character picker uses portraits of all playable models. Updated the world mesh, movement bounds, avatar geometry, lobby, source inventory and visual specs.
- **Evidence:** [Prototype A alongside the Docker-served game](design/painted-wood-comparison.webp). Original captures and three avatar views in `test-results/painted-wood-reviewed/`. Desktop and narrow visual review PASS.
- **Commands:** npm ci, lint, typecheck, test:unit, build, Compose config/up/ps/logs, HTTP health probe, test:integration and test:e2e. All final checks exited 0. Passed 17 unit, 5 socket integration and 5 browser tests. See TESTING.md for the initial failures and reruns.
- **Decision and limitations:** ADR-013. The playable rendition retains wider routes and simpler lighting than the reference. Software WebGL verified rendering and controls. Device GPU performance is unmeasured.
- **Next action:** Owner review of the visual match remains open. CP-08 proceeded on request.

## CP-08 — Networked movement

- **Status:** VERIFIED
- **Goal / requirement IDs:** `REQ-MOVE-03`, with `REQ-ROOM-02`, `REQ-ROOM-04`, and `REQ-AVATAR-01`. Server-owned poses, sequenced input, 20 Hz snapshots, remote interpolation, room isolation, disconnect grace, resume, and rejection of teleporting input.
- **Starting commit / baseline:** `b9c49a6` plus the uncommitted CP-08 working tree.
- **Changes and files:** Added `src/server/world.mts`, remote avatar rendering, movement socket events, client prediction and interpolation, unit and socket tests, and a five-browser Playwright check. Updated the room manager, transport, lobby, scene, specs, and decisions (`ADR-014`).
- **Commands actually executed:** `npm ci`, lint, typecheck, unit tests, and host production build. Compose config and two image builds. The first container exited 1. After removing a parameter property, the second build became healthy. Isolated integration runs, Playwright, a stop/start cycle, health probes, UID check, and logs. See [TESTING.md](TESTING.md).
- **Results:** Final host lint, typecheck, and 22 unit tests passed. Isolated sockets: 7 tests passed in 8.97 seconds. Chromium: 6 tests passed in 1.4 minutes, including two browsers and then five browsers seeing movement. Observed snapshot median interval `49.76710000000003` ms across 14 gaps; input to a visible pose change `68.899` ms.
- **Evidence:** `test-results/cp08/`. Image ID `sha256:fc7228e526200ed5b2cdffba985164179e3fd64dd10f53a46e7a9f8edbdbbc60`.
- **Manual checks:** PASS for the Docker-served Chromium captures. The guest view shows the host avatar beside the local avatar. The fifth browser shows the moved avatar separated from the cluster at the entrance. Software WebGL only.
- **Known issues and blockers:** Guests overlap at the shared spawn. Remote motion trails the server by about one 50 ms tick. A stalled tick does not catch up more than 100 ms. Hardware GPU frame time was not measured. Rooms and poses still disappear on process restart. The healthy app remains on localhost.
- **Decisions:** `ADR-014`.
- **Next action:** CP-09 — Carnival art pass, after approval. The Prototype A visual review is still open.
- **Approval to advance:** pending

## CP-09 — Carnival art pass

- **Status:** VERIFIED
- **Goal / requirement IDs:** `REQ-WORLD-01`, `REQ-WORLD-02`, and shared collision/interaction geometry. Add connecting low-poly paths, readable landmark signs, Dance Pavilion stage centerpiece, shared `INTERACTION_ZONES`, layout reachability tests, desktop screenshot inspection, and WebGL render measurements.
- **Starting commit / baseline:** Clean `HEAD` with CP-08 verified.
- **Changes and files:**
  - `src/shared/world.ts`: Added `INTERACTION_ZONES` (`anchor`, `approach`, `radius`, `label`) for `fountain`, `balloonStall`, `mithaiShop`, `ferrisWheel`, and `dancePavilion`.
  - `src/shared/movement.ts`: Exported `isBlocked` for layout and collision verification.
  - `app/world/painted-fair.ts` & `app/world/carnival-scene.tsx`: Added connecting ochre paths, Dance Pavilion brass diya centerpiece, Ferris Wheel boarding signpost, and a single batched `signs` mesh + `CanvasTexture` atlas (`MELA PLAZA`, `BALLOONS`, `MITHAI SHOP`, `DANCE PAVILION`, `FERRIS WHEEL`).
  - `tests/unit/carnival-layout.test.ts`: Added unit tests for unobstructed spawn, landmark collision alignment, and BFS reachability of every landmark from spawn via `walk()`.
  - `tests/e2e/world.spec.ts` & `tests/e2e/movement.spec.ts`: Added CP-09 desktop screenshot and render-metrics test (`1280x720`, `1440x900`); raised 5-browser WebGL2 readiness timeout in `movement.spec.ts` from 5000 ms to 15000 ms.
  - Updated `docs/ASSETS.md`, `docs/SPECS.md`, `docs/TESTING.md`, and `docs/PROGRESS.md`.
- **Commands actually executed:**
  - Host: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` (build retried once after transient sandbox `EPERM`).
  - Docker: `docker compose config -q && docker compose up --build -d --wait --wait-timeout 90 && docker compose ps && curl.exe -fsS http://localhost:3000/api/health && docker compose logs --tail=80 app`.
  - Isolated Docker suites: `npm.cmd run test:integration` and `npx.cmd playwright test --output test-results/cp09`.
- **Results (exit codes, counts, observed behavior):**
  - All final host, Docker, integration, and E2E commands exited `0`.
  - Unit: 5 files, 25 tests passed. Integration: 3 files, 7 tests passed (8.28 s). E2E: 7 tests passed (1.7 m) with 0 console errors, 0 page errors, and 0 failed asset requests.
  - Observed rendering metrics (Chromium SwiftShader): `29` draw calls, `14428` triangles, `40.6` ms median frame interval across `59` samples on `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`.
- **Evidence paths or CI run IDs:** `test-results/cp09/` (`cp09-desktop-1280.png`, `cp09-desktop-1440.png`); Docker manifest digest `sha256:91be4d6f1a6943168753cd7115ac878c7110a0373d60c198c870eb225a02db92`.
- **Manual checks:** PASS — inspected `1280x720` and `1440x900` desktop screenshots from the Docker-served Chromium session; all five signs, paths, and landmarks are visible and legible.
- **Known issues and blockers:** Rendering was measured on ANGLE SwiftShader software WebGL; hardware GPU frame time remains unmeasured. The healthy Docker app remains running on `http://127.0.0.1:3000`.
- **Decisions (ADR IDs):** None new (follows `ADR-010`, `ADR-013`).
- **Next action:** CP-10 — Interaction framework and HUD, after approval.
- **Approval to advance:** pending

## CP-10 — Interaction framework and HUD

- **Status:** VERIFIED
- **Goal / requirement IDs:** `REQ-MOVE-01`, `REQ-MOVE-02`, and `REQ-A11Y-01` interaction/HUD portions. Proximity prompts, `E` interaction, accessible modal overlays, `Escape` focus return, roster and coins HUD, and server-side distance/availability validation.
- **Starting commit / baseline:** Clean `HEAD` with CP-09 verified.
- **Changes and files:**
  - `src/shared/world.ts` & `src/shared/protocol.ts`: Added `ATTRACTION_IDS`, `ATTRACTION_DETAILS`, `nearestAttraction()`, `attractionInteractSchema`, and `AttractionInteractResult`.
  - `src/server/world.mts` & `src/server/transport.mts`: Added `WorldSimulation.interact()` (distance, availability, presence checks) and wired `"attraction:interact"` with disconnect cleanup.
  - `src/client/use-lobby.ts`, `app/lobby.tsx`, `app/world/local-player.tsx`, `app/world/carnival-scene.tsx`, `app/world/carnival-preview.tsx`, `app/globals.css`: Added position-change proximity tracking, `Press E to open <Attraction>` prompt, `Coins: 0` and roster HUD, accessible `role="dialog"` overlay with focus management, and `Escape` closing only the overlay.
  - `tests/unit/world.test.ts`, `tests/integration/movement.test.ts`, `tests/e2e/movement.spec.ts`: Added unit, socket integration, and two-browser Playwright E2E tests.
  - Updated `docs/SPECS.md`, `docs/TESTING.md`, and `docs/PROGRESS.md`.
- **Commands actually executed:**
  - Host: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` (plus final `npm run lint && npm run typecheck`).
  - Docker: `docker compose config -q && docker compose up --build -d --wait --wait-timeout 90 && docker compose ps && curl.exe -fsS http://localhost:3000/api/health && docker compose logs --tail=60 app`.
  - Isolated Docker suites: `npm.cmd run test:integration` and `npx.cmd playwright test --output test-results/cp10`.
- **Results (exit codes, counts, observed behavior):**
  - All final commands exited `0`.
  - Unit: 5 files, 26 tests passed. Integration: 3 files, 8 tests passed (10.67 s). E2E: 8 tests passed (1.2 m) with 0 console/page errors.
- **Evidence paths or CI run IDs:** `test-results/cp10/` (`cp10-hud-and-modal.png`); Docker manifest digest `sha256:046614560662eeb995389079e4fcca7d09d358383330d62c0c3c7a1109a15c77`.
- **Manual checks:** PASS — inspected `cp10-hud-and-modal.png` from the Docker-served Chromium session.
- **Known issues and blockers:** Coins HUD displays `0` until CP-11 (Economy and inventory) implements balances and `economy:updated`. The healthy Docker app remains running on `http://127.0.0.1:3000`.
- **Decisions (ADR IDs):** None new.
- **Next action:** CP-11 — Economy and inventory, after approval.
- **Approval to advance:** pending

## CP-11 — Economy and inventory

- **Status:** VERIFIED
- **Goal / requirement IDs:** `REQ-ECON-01`, `REQ-ECON-02`. Integer balances, server-owned catalog, inventory, idempotent transaction IDs, server-only mutation APIs, no public mint endpoint, and reconnect balance restoration.
- **Starting commit / baseline:** Clean `HEAD` with CP-10 verified.
- **Changes and files:**
  - `src/shared/catalog.ts`: Added server-owned catalog (`jalebi`, `ladoo`, `lassi`, `lantern`, `marigold`).
  - `src/shared/protocol.ts`: Added `EconomySnapshot` and `"economy:updated"` server event.
  - `src/server/economy.mts` & `src/server/transport.mts`: Added `EconomyManager` (`credit`, `debit`, `purchase`, `snapshot`, `sync`) with idempotent `transactionId` tracking, integer validation, cross-room rejection, and `RoomManager` lifecycle sync.
  - `src/client/use-lobby.ts` & `app/lobby.tsx`: Subscribed to `"economy:updated"` and passed authoritative `coins` to `CarnivalPreview`.
  - `app/world/carnival-preview.tsx`: Derived `nearby` from the server's authoritative pose so `E` prompts never outpace server distance checks.
  - `tests/unit/economy.test.ts` & `tests/integration/economy.test.ts`: Added unit and socket integration tests.
  - Updated `docs/SPECS.md`, `docs/TESTING.md`, and `docs/PROGRESS.md`.
- **Commands actually executed:**
  - Host: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` (final build succeeded on host after transient sandbox `EPERM` retries earlier).
  - Docker: `docker compose config -q && docker compose up --build -d --wait --wait-timeout 90 && docker compose ps && curl.exe -fsS http://localhost:3000/api/health`.
  - Isolated Docker suites: `npm.cmd run test:integration` and `npx.cmd playwright test --output test-results/cp11`.
- **Results (exit codes, counts, observed behavior):**
  - All final commands exited `0`.
  - Unit: 6 files, 28 tests passed. Integration: 4 files, 9 tests passed (9.52 s). E2E: 8 tests passed (1.3 m).
- **Evidence paths or CI run IDs:** `test-results/cp11/`; Docker manifest digest `sha256:28146edc2c4bf7db148468fba72af1fdab38791a4da1e53c1efa9d47c38ada95`.
- **Manual checks:** PASS (verified via Chromium E2E suite and Docker readiness probe).
- **Known issues and blockers:** None. The healthy Docker app remains running on `http://127.0.0.1:3000`.
- **Decisions (ADR IDs):** None new.
- **Next action:** CP-12 — Balloon game engine, after approval.
- **Approval to advance:** pending

## CP-12 — Balloon game engine

- **Status:** VERIFIED
- **Goal / requirement IDs:** `REQ-BALLOON-01`, `REQ-BALLOON-02`, `REQ-BALLOON-03`. Server round lifecycle, deterministic target schedule, hit validation, rate limits, one-time coin reward, disconnect cleanup, and concurrent room isolation.
- **Starting commit / baseline:** Clean `HEAD` with CP-11 verified.
- **Changes and files:**
  - `src/shared/balloon.ts` & `src/shared/protocol.ts`: Added `BALLOON_ROUND_MS`, `generateBalloonTargets()`, `balloonRewardCoins()`, `gameJoinSchema`, `gameHitSchema`, `gameLeaveSchema`, `BalloonGameState`, and `"game:state"`.
  - `src/server/balloon-game.mts`, `src/server/world.mts`, `src/server/transport.mts`: Added `BalloonGameManager` (`join`, `hit`, `leave`, `sync`, `tick`), `WorldSimulation.pose()`, 250 ms round settlement tick, and `"game:join"` / `"game:hit"` / `"game:leave"` socket handlers wired to `EconomyManager.credit()`.
  - `tests/unit/balloon-game.test.ts` & `tests/integration/balloon-game.test.ts`: Added unit and socket integration tests.
  - Updated `docs/SPECS.md`, `docs/TESTING.md`, and `docs/PROGRESS.md`.
- **Commands actually executed:**
  - Host: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`.
  - Docker: `docker compose config -q && docker compose up --build -d --wait --wait-timeout 90 && docker compose ps && curl.exe -fsS http://localhost:3000/api/health`.
  - Isolated Docker suites: `npm.cmd run test:integration` and `npx.cmd playwright test --output test-results/cp12`.
- **Results (exit codes, counts, observed behavior):**
  - All final commands exited `0`.
  - Unit: 7 files, 30 tests passed. Integration: 5 files, 10 tests passed (9.85 s). E2E: 8 tests passed (1.6 m).
- **Evidence paths or CI run IDs:** `test-results/cp12/`; Docker manifest digest `sha256:e9f74a87033e7ccd07795df029ec9b4a970b0a3293aab108494cfb2fe3d367f9`.
- **Manual checks:** NOT RUN (CP-12 is server engine only; playable Balloon Game UI is CP-13).
- **Known issues and blockers:** None. The healthy Docker app remains running on `http://127.0.0.1:3000`.
- **Decisions (ADR IDs):** `ADR-003`.
- **Next action:** CP-13 — Balloon game UI, after approval.
- **Approval to advance:** pending

## CP-13 — Balloon game UI

- **Status:** VERIFIED
- **Goal / requirement IDs:** `REQ-BALLOON-01`, `REQ-BALLOON-02`, `REQ-BALLOON-03`, `REQ-MOVE-02`. Playable balloon targets, countdown, hit feedback, results, shared scoreboard, replay, mid-round exit cleanup, and two-player browser verification.
- **Starting commit / baseline:** Clean `HEAD` with CP-12 verified.
- **Changes and files:**
  - `src/server/transport.mts`: Added `MELA_BALLOON_ROUND_MS` configuration (default `30000` ms).
  - `src/client/use-lobby.ts`, `app/lobby.tsx`, `app/world/carnival-preview.tsx`, `app/attractions/balloon-game-modal.tsx`, `app/globals.css`: Wired `"game:state"`, `joinBalloonGame`, `hitBalloonTarget`, `leaveBalloonGame`, and built `BalloonGameModal`.
  - `tests/e2e/balloon.spec.ts` & `tests/e2e/movement.spec.ts`: Added two-player balloon round E2E test; raised 5-browser timeout to `120000` ms.
  - Updated `docs/SPECS.md`, `docs/TESTING.md`, and `docs/PROGRESS.md`.
- **Commands actually executed:**
  - Host: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` (plus final `npm run lint && npm run typecheck`).
  - Docker: `docker compose config -q && docker compose up --build -d --wait --wait-timeout 90 && docker compose ps && curl.exe -fsS http://localhost:3000/api/health`.
  - Isolated Docker suites: `npm.cmd run test:integration` and `npx.cmd playwright test --output test-results/cp13`.
- **Results (exit codes, counts, observed behavior):**
  - All final commands exited `0`.
  - Unit: 7 files, 30 tests passed. Integration: 5 files, 10 tests passed. E2E: 9 tests passed (2.3 m) with 0 console/page errors.
- **Evidence paths or CI run IDs:** `test-results/cp13/` (`cp13-balloon-active.png`, `cp13-balloon-results.png`); Docker manifest digest `sha256:32f04dc41a4c8ac5cdbf9bf46c713dd7ba9bb089ce25627c41965d3971853b5d`.
- **Manual checks:** PASS — inspected `cp13-balloon-active.png` and `cp13-balloon-results.png` from the Docker-served Chromium session.
- **Known issues and blockers:** None. The healthy Docker app remains running on `http://127.0.0.1:3000`.
- **Decisions (ADR IDs):** `ADR-003`.
- **Next action:** CP-14 — Ferris wheel, after approval.
- **Approval to advance:** pending

## Demo & Sponsor Branch Handoff (`sponsor-demo`)

- **Status:** IN_PROGRESS (demo-ready build & media recorded; formal per-checkpoint test gates for CP-14..23 deferred per user request)
- **Changes and files:**
  - `src/server/ferris-wheel.mts`, `src/server/fireworks.mts`, `src/integrations/sarvam.mts`, `src/integrations/flagsmith.mts`, `src/shared/metrics.ts`, `app/api/metrics/route.ts`, `app/attractions/*`, `server.mts`, `compose.yaml`.
  - Updated `sarvam.mts` to verified live endpoints/models (`sarvam-105b-conversations`, `bulbul:v3`, `saaras:v3`) and routed microphone voice uploads through `POST /api/shop/voice` so `Engine.IO` remains at `4096` bytes while supporting up to `750 KB` voice clips.
  - Recorded [`docs/media/mela-demo.mp4`](media/mela-demo.mp4) (`51.4s`) and six screenshots in `docs/media/`, and rewrote `README.md` for non-technical readers.
- **Observed checks:**
  - Live Sarvam AI Hindi chat (`[live]`) and `bulbul:v3` TTS verified against `https://api.sarvam.ai` from inside the Docker app container (`3.78s` end-to-end Socket.IO ack, `291080`-char base64 audio payload).
  - Full 3-player Playwright session recorded and muxed with Sarvam AI voiceover into `docs/media/mela-demo.mp4`.
