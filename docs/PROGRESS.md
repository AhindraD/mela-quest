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
| CP-08 | Networked movement | NOT_STARTED |
| CP-09 | Carnival art pass | NOT_STARTED |
| CP-10 | Interaction framework and HUD | NOT_STARTED |
| CP-11 | Economy and inventory | NOT_STARTED |
| CP-12 | Balloon game engine | NOT_STARTED |
| CP-13 | Balloon game UI | NOT_STARTED |
| CP-14 | Ferris wheel | NOT_STARTED |
| CP-15 | Shopkeeper without AI | NOT_STARTED |
| CP-16 | Sarvam adapter and text dialogue | NOT_STARTED |
| CP-17 | Multilingual voice | NOT_STARTED |
| CP-18 | Flagsmith integration | NOT_STARTED |
| CP-19 | Shared fireworks and celebration | NOT_STARTED |
| CP-20 | Audio, accessibility and polish | NOT_STARTED |
| CP-21 | Resilience and security | NOT_STARTED |
| CP-22 | Observability foundation | NOT_STARTED |
| CP-23 | NudgeBee integration verification | NOT_STARTED |
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
- **Approval to advance:** pending

### CP-07 visual revision — Prototype A
- **Status:** VERIFIED for implementation and regression checks. Owner visual sign-off pending.
- **Baseline:** CP-07 local-play working tree at HEAD `4860424`. The original A sheet was recovered and saved with the project.
- **Gaps addressed:** The previous close camera cut off the booths and wheel. The revised view frames both foreground stalls, tiered fountain, rear pavilion and wheel. The polygon fence curves toward the lantern gate. The character picker uses portraits of all playable models. Updated the world mesh, movement bounds, avatar geometry, lobby, source inventory and visual specs.
- **Evidence:** [Prototype A alongside the Docker-served game](design/painted-wood-comparison.webp). Original captures and three avatar views in `test-results/painted-wood-reviewed/`. Desktop and narrow visual review PASS.
- **Commands:** npm ci, lint, typecheck, test:unit, build, Compose config/up/ps/logs, HTTP health probe, test:integration and test:e2e. All final checks exited 0. Passed 17 unit, 5 socket integration and 5 browser tests. See TESTING.md for the initial failures and reruns.
- **Decision and limitations:** ADR-013. The playable rendition retains wider routes and simpler lighting than the reference. Software WebGL verified rendering and controls. Device GPU performance is unmeasured.
- **Next action:** Owner review of the visual match. CP-08 approval pending.
