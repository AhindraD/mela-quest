# AGENTS.md — Mela.io

## 1. Mission and authority
Build a cozy, browser-based, Indian festive carnival for private groups of up to five players total (host included). Players invite friends, explore a small 3D world, ride attractions, compete in games, interact with a multilingual shopkeeper and celebrate together. Deliver a real playable product, not a mockup or a collection of disconnected demos.

This file governs all coding agents and human collaborators. Read it and the living project documents before changing code. User instructions override this file. Do not silently reinterpret requirements. When a material choice is unclear, propose options and ask; routine reversible implementation choices may be made and recorded. Do not implement the entire roadmap in one pass.

### Non-negotiable priorities
1. Correctness and verifiable progress before breadth.
2. Local Docker execution before any public deployment.
3. A working game at every completed checkpoint.
4. Small, reviewable changes; no unrelated refactors.
5. Honest reporting: generated code, passing builds, manual observation and automated end-to-end evidence are different things.
6. Protect secrets, user data and the owner's AWS credits.

## 2. Product specification baseline

### Player journey
A guest enters a nickname, creates a private room or opens an invitation URL, selects a simple avatar color, and enters a carnival. Friends join the same room, see one another move, and explore freely. Players approach attractions and receive an interaction prompt. A balloon game awards virtual coins; a Ferris wheel offers a shared ride; a shopkeeper sells virtual items and speaks supported Indian languages; players collectively unlock fireworks. The session ends when players leave; durable accounts and inventories are not required.

### World and presentation
- One compact, bounded, low-poly carnival; no procedural infinite world.
- Central plaza and fountain, spawn area, paths, balloon stall, mithai shop, Ferris wheel, decorative stalls and music/dance area.
- Warm lanterns, festive colors, nighttime sky, readable signs and clear navigation. Use original procedural geometry first; optional licensed assets later. Track asset source, license and attribution.
- Desktop-first third-person camera, WASD/arrow movement, E to interact, Escape to close overlays. Document controls. Prevent movement while typing or using modal controls. Provide mute and reduced-motion settings; avoid intense flashing.
- Keep decorative geometry inexpensive. No mandatory physics engine, character rigs, photorealism, voice chat, public matchmaking, payments or accounts.

### Gameplay rules (initial proposals; confirm in specs)
- Five players maximum including host; no host privileges beyond explicitly implemented controls. Rooms are isolated and use unguessable invitation identifiers.
- Guest identity uses a random session token, not nickname or socket ID. Nicknames are bounded and rendered as text. Reconnect within a configurable grace period restores session state while the server lives. Expired sessions release capacity. Empty rooms expire.
- Server owns positions, interaction eligibility, balances, inventory, game timers, scores, ride seats and fireworks. Client owns camera and presentation; prediction is optional. Never trust client-reported rewards or hits without validation.
- Balloon game: 30-second round, server-generated target IDs and spawn schedule, one score per valid target per player, bounded hit rate, deterministic reward rule. Define whether targets are shared or per-player before implementation; default to per-player targets with a shared scoreboard. Server validates timing and target IDs; this is not a claim of cheat-proof aim validation.
- Coins are non-monetary and session-only. No negative balances, duplicate rewards or double spending. Shop purchases use a server-owned catalog. AI dialogue cannot authorize purchases or set arbitrary prices.
- Ferris wheel: synchronized phase and server-controlled seat assignment, safe boarding/exiting, cleanup on disconnect. Fireworks: server-owned shared contribution threshold, cooldown and synchronized start time. Provide reduced-motion alternative.

### Sponsor requirements
Planned integrations: Sarvam AI for multilingual NPC interaction; Flagsmith for attraction availability and live event controls; NudgeBee for operational monitoring and incident investigation. Verify actual hackathon rules, current SDK/API contracts, credentials, supported languages and NudgeBee prerequisites from official sources before implementing. Do not invent endpoints or claim sponsor compliance from placeholders. Record unresolved requirements in docs/SPECS.md. A local mock is useful for tests but is never a verified live integration.

## 3. Architecture and boundaries

Default stack: Next.js App Router, TypeScript strict mode, React Three Fiber, Three.js, Drei, Socket.IO client/server, Zustand for client UI/game presentation, CSS/Tailwind, Node.js LTS compatible with pinned dependencies, npm lockfile, Docker and Compose. Choose exact versions during checkpoint 01 and record them. Use a custom persistent Node HTTP server hosting Next.js and Socket.IO on the same origin. Do not use Next.js standalone output with the custom server. Do not deploy Socket.IO to ordinary serverless request handlers.

Use one process and one replica with in-memory room state. No Redis, database or Kubernetes requirement for core local gameplay. A restart destroys rooms; explicitly communicate this. Keep state access behind clear modules so future persistence is possible. Do not implement future distributed infrastructure prematurely.

Suggested layout (adapt only with a recorded decision):

```text
AGENTS.md
README.md
docs/
  SPECS.md
  PROGRESS.md
  DECISIONS.md
  TESTING.md
  ASSETS.md
  DEPLOYMENT.md
app/                    # landing, room route, health/metrics endpoints
components/
  world/                # scene, terrain, stalls, lighting, avatars
  game/                 # input, camera, interpolation, HUD
  attractions/          # balloon, ride, shop, fireworks
  ui/                   # accessible menus and overlays
src/
  shared/               # protocol, schemas, constants, types
  server/               # room manager, simulation, economy, attractions
  client/               # socket lifecycle, stores, input
  integrations/         # server-only sponsor adapters
server.ts               # HTTP + Next + Socket.IO bootstrap
public/assets/
tests/unit/
tests/integration/
tests/e2e/
Dockerfile
compose.yaml
.dockerignore
.env.example
package.json
package-lock.json
```

Keep browser and server modules separate. No secrets in NEXT_PUBLIC_* variables, browser bundles, logs or fixtures. Load 3D canvas client-side with SSR-safe boundaries. Use a single socket lifecycle per session, clean up listeners and animation loops on unmount, and avoid React state updates on every render frame. Use interpolation for remote avatars; begin with approximately 15–20 Hz network snapshots and a measured simulation tick. Document units, coordinate system, speed, bounds and clock assumptions. Use shared runtime validation (e.g. Zod) for untrusted payloads, not TypeScript alone.

### Protocol baseline
Define versioned typed events and runtime schemas before implementation. Suggested client events: room:create, room:join, room:resume, room:leave, player:input, attraction:interact, game:join, game:hit, shop:purchase, ride:board, ride:exit, fireworks:contribute. Suggested server events: room:snapshot, player:joined, player:left, world:snapshot, game:state, economy:updated, ride:state, fireworks:started, flags:updated, session:error. Names are proposals, not existing APIs. Specify acknowledgments, error codes, payload limits, rate limits, sequencing, clock handling and authorization in SPECS.md. Use stable player IDs and server timestamps; never accept a client-selected room identity after joining without authorization. Use idempotency keys for economic mutations. Validate finite numeric values and reject impossible movement.

## 4. Living documentation — mandatory

Create these files in checkpoint 00, and maintain them in the same change as implementation. Do not combine them into a single status document.

| File | Purpose |
| --- | --- |
| docs/SPECS.md | Current intended behavior, acceptance criteria, protocol, gameplay rules, non-goals, open questions and requirement IDs |
| docs/PROGRESS.md | Checkpoint ledger, actual status, evidence, blockers, next checkpoint and handoff |
| docs/DECISIONS.md | Append-only architecture/product decision records; alternatives, rationale, consequences and reversal conditions |
| docs/TESTING.md | Reproducible commands, test matrix, environment, observed results, failures and manual verification instructions |
| docs/ASSETS.md | Asset paths, authors, sources, licenses and attribution |
| docs/DEPLOYMENT.md | Local runtime contract, deployment prerequisites, future AWS plan, rollback and teardown; distinguish proposed from executed |
| README.md | Crisp public-facing description, setup, controls, architecture summary, real integrations, limitations and links to detailed docs |

Use statuses NOT_STARTED, IN_PROGRESS, BLOCKED, VERIFIED, and DEFERRED. VERIFIED requires all mandatory acceptance criteria to pass with evidence. DEFERRED requires explicit scope approval and is not a pass. Record each checkpoint ID and requirement IDs. Do not overwrite historical failures; append rerun results and mark resolved. Keep progress current even if work stops midway.

Progress entry template:

```markdown
## CP-XX — Title
- Status: IN_PROGRESS
- Goal / requirement IDs:
- Starting commit / baseline:
- Changes and files:
- Commands actually executed:
- Results (exit codes, counts, observed behavior):
- Evidence paths or CI run IDs:
- Manual checks: PASS / FAIL / NOT RUN
- Known issues and blockers:
- Decisions (ADR IDs):
- Next action:
- Approval to advance: pending
```

Decision template: ADR-NNN, date, status (proposed/accepted/superseded), context, options, decision, rationale, consequences, validation, supersedes. Never fabricate a date, commit, command output, screenshot or approval. Record a proposed decision as proposed until accepted where approval is required.

## 5. Agent execution loop and verification gates

For EVERY checkpoint, follow this exact sequence:

1. Read AGENTS.md, specs, progress, decisions and testing docs. Inspect git status and relevant files. Preserve user changes; never reset, clean or overwrite unrelated work. Determine the last genuinely verified checkpoint.
2. Select only the next approved checkpoint. State the goal, dependencies, proposed files, acceptance criteria and verification commands. If prior work is broken, repair it first.
3. Mark IN_PROGRESS in PROGRESS.md. Implement the smallest coherent slice. Add tests alongside behavior. Do not create empty future feature scaffolding merely to suggest progress.
4. Run targeted checks. Fix failures and rerun. Then run the cumulative regression gate and Docker smoke checks described below. For visual/gameplay changes, use a real browser and inspect screenshots plus runtime console errors. For multiplayer, use separate browser contexts or devices, not two references to the same store.
5. Record actual commands, exit codes, counts and evidence. If a tool, Docker daemon, browser, network, credential or human action is unavailable, mark the affected criterion NOT RUN and checkpoint BLOCKED; explain the exact action needed. Never substitute reasoning for execution. Never claim a test passed because code looks correct.
6. Update specs for agreed changes, append decisions, update testing and progress, and adjust README if user-facing behavior changed. Review the diff for accidental secrets, regressions and unrelated changes.
7. Mark VERIFIED only when all required checks pass. Present a concise checkpoint report: implemented, tested, evidence, limitations, next checkpoint. STOP. Wait for the human to approve the next checkpoint. A request to work on CP-N does not authorize CP-N+1. If blocked, stop and request the minimum needed input. Do not silently bypass a gate.

Commits: one logical checkpoint per commit where practical. Ask before committing if repository conventions or user authorization are unclear. Never push, deploy, purchase resources, destroy data or rotate credentials without explicit authorization. Do not use destructive git commands. Do not hide failing tests by deleting assertions, skipping tests or loosening validation.

### Cumulative verification contract
Establish these npm scripts in CP-01; commands below are required targets, not claims that they already exist:

```sh
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
docker compose config
docker compose up --build -d
docker compose ps
 curl -fsS http://localhost:3000/api/health
npm run test:e2e
docker compose logs --tail=100 app
```

Run all established applicable checks after each checkpoint. Before a suite exists, explicitly mark it not applicable with rationale; once introduced it is mandatory. Use explicit ESLint CLI rather than assuming next lint exists. Run integration tests on isolated ports/state; run browser tests against the actual Docker app. Keep test fixtures deterministic and use polling/assertions rather than arbitrary sleeps. Use Playwright with independent contexts and Chromium initially. Install browser dependencies in a documented local or dedicated test container. Save failure screenshots, traces and logs under ignored test-results/; retain meaningful evidence locally. Do not commit secrets or personal audio. Report GPU/WebGL limitations; software-rendered CI is acceptable for functional checks, not performance claims.

Docker is the canonical runtime. A host npm dev server is a convenience, not a substitute for container verification. Never claim the user's machine was tested if execution occurred only in an agent sandbox. If Docker is inaccessible to the agent, provide exact commands for the user and wait for observed output before verification.

## 6. Local container contract

- Compose service `app` exposes port 3000 (bind to 127.0.0.1 by default; explicitly opt into LAN testing). Server listens on 0.0.0.0 inside container. Same-origin Socket.IO path /socket.io.
- Multi-stage Dockerfile uses pinned compatible Node base, npm ci, production Next build, custom server runtime and non-root user. Compile custom server or include its runtime dependencies; do not copy only Next standalone output. Copy public assets and required Next artifacts. Include a real health check and graceful SIGTERM handling. Use init where appropriate.
- `.env.example` documents every variable and safe defaults; `.env` is ignored. Real keys are supplied at runtime, not build args. Use test/mock mode by default for sponsor calls. Validate required variables at startup for explicitly enabled live mode. Keep app usable when optional providers are down.
- Health endpoint returns minimal process readiness; metrics endpoint is not publicly exposed in deployment. Avoid leaking environment values. Log structured events with room/session correlation IDs, not tokens, invite links, raw voice or secrets.
- Provide a clean startup command, shutdown command, and instructions for inspecting logs. Do not run `docker compose down -v` or global prune without approval. Optional monitoring services belong in a Compose profile so core startup remains simple.
- Test clean image build, startup, HTTP health, socket handshake, graceful shutdown and restart behavior. Verify port conflicts and clear error messages. Test from another device on LAN only with user consent and firewall guidance.

## 7. Sequential checkpoint roadmap

Each checkpoint below has its own mandatory acceptance gate in addition to the cumulative gate. Split any checkpoint further if it becomes too large; record the split. Do not skip ahead because a later feature is more exciting.

### CP-00 — Discovery and project contract
Inspect existing repository, OS, Docker/Compose availability, Node/npm, Git, browser and available disk. Do not assume a greenfield repo. Confirm host-inclusive room cap, desktop-first scope and sponsor requirements; record unanswered questions. Create all living docs, requirement IDs and checkpoint ledger. Write initial README with honest status. Verify documentation paths, commands available and clean baseline. Gate: user approves scope and next checkpoint; missing Docker is a blocker for subsequent container gates.

### CP-01 — Reproducible Next.js skeleton
Scaffold minimal Next.js TypeScript app, pinned dependencies, lockfile, lint/typecheck/test scripts, ignore rules and environment example. Add minimal landing page and health endpoint. Establish unit test runner and one meaningful smoke test. Gate: clean install, lint, typecheck, test and production build pass; landing renders and health returns expected JSON. No gameplay yet.

### CP-02 — Docker runtime
Create Dockerfile, Compose, health check and startup/shutdown docs. Verify production build inside container, non-root runtime, HTTP response and restart. Gate: clean Docker build and healthy app on localhost; browser opens landing; logs show no fatal errors. Verify no secret files copied into image. From now on Docker is required at every gate.

### CP-03 — Socket transport and protocol
Introduce custom Node server and same-origin Socket.IO; define event schemas and error acknowledgments. Implement connection lifecycle, ping/echo and listener cleanup. Gate: two independent clients connect to Docker app, exchange test acknowledgments, disconnect/reconnect, invalid payload rejected; HTTP still works. Integration tests must exercise real socket transport, not mocks only.

### CP-04 — Authoritative room manager
Implement room creation, invite token, join, leave, capacity, stable guest IDs, session token, grace period and expiry. Use injectable clock for tests. Gate: five clients admitted, sixth rejected, invalid invite rejected, duplicate join handled, room isolation proven, disconnect/resume restores identity, expiry releases capacity. Verify tokens not broadcast. No UI required beyond debug controls.

### CP-05 — Lobby and invitation flow
Build polished landing, nickname/avatar choice, create/join flow, shareable invite URL, room loading/error states and roster. Handle full room, invalid link, clipboard failure and reload. Gate: Playwright opens host and guest in independent contexts via real invite URL; roster updates, sixth player gets useful message, separate room cannot see roster. Test keyboard navigation.

### CP-06 — 3D scene foundation
Add client-only R3F canvas, camera, lighting, ground, world bounds, placeholder landmarks and loading/error fallback. Establish world coordinates and spawn positions in shared constants. Gate: Docker-served scene renders in real browser, no uncaught console errors, screenshot inspected, resize works, unsupported WebGL gives useful fallback. Keep scene static.

### CP-07 — Local avatar and controls
Implement simple avatar, camera follow, keyboard input, frame-rate-independent movement, bounds and basic obstacles. Pause input in text/modal focus and on blur. Gate: movement in four directions, diagonal normalization, camera tracking, no wall escape, no stuck keys, consistent behavior at different frame rates. Test pure movement math and inspect browser behavior.

### CP-08 — Networked movement
Implement server simulation, input sequencing, snapshot broadcast and remote interpolation. Reject nonfinite or impossible inputs; clamp speed and bounds. Keep server state authoritative; avoid sending every render frame. Gate: two and then five independent clients see each other move, room isolation holds, disconnect removes avatar after policy interval, reconnect works, invalid movement cannot teleport. Record observed snapshot rate and test latency; no invented performance numbers.

### CP-09 — Carnival art pass
Build low-poly paths, plaza, fountain, lanterns, shop, balloon stall, Ferris wheel and decorative area. Use shared collision/interaction geometry. Add signs, distinct silhouettes and coherent palette. Gate: all landmarks reachable, spawn unobstructed, collisions align with visible geometry, no missing assets, screenshots inspected at desktop sizes. Record asset licenses. Measure actual rendering behavior on available hardware.

### CP-10 — Interaction framework and HUD
Implement proximity prompts, E interaction, accessible overlays, Escape, roster and coins HUD. Server checks distance and availability for interactions. Gate: prompts appear/disappear correctly, distant or spoofed interaction rejected, movement suppressed in modal, close returns focus, other players remain visible. Test two clients interacting independently.

### CP-11 — Economy and inventory
Implement integer balances, catalog, inventory, idempotent transaction IDs and server-only mutation APIs. Use test-only reward fixtures, never expose a public mint endpoint. Gate: valid transaction succeeds once, duplicate rejected or returns original result, insufficient funds rejected, no negative balances, cross-room mutation rejected. Reconnect restores balance while process lives.

### CP-12 — Balloon game engine
Implement server round lifecycle, target schedule, hit validation, score and one-time reward. Use deterministic test seed and clock. Gate: round starts/ends on server time, duplicate/late/unknown hits rejected, rate limits work, reward exactly once, disconnect cleanup, concurrent rooms independent. Test scoring and lifecycle without graphics first.

### CP-13 — Balloon game UI
Implement playable balloon targets, countdown, feedback, results and shared scoreboard. Integrate entry/exit from carnival. Gate: two players complete real round in browser, scores synchronize, coins update, replay works, exiting mid-round cleans up, no input leakage into world. Record actual screenshots and automated assertions.

### CP-14 — Ferris wheel
Animate wheel from server epoch; implement seat reservations, boarding, camera experience, safe exit and disconnect cleanup. Gate: two clients see consistent phase within documented tolerance, occupied seat cannot be double-booked, players exit safely, reconnect behavior documented. Test phase math and seat ownership. Keep motion accessible.

### CP-15 — Shopkeeper without AI
Implement NPC interaction, fixed catalog, purchase confirmation and inventory display; allow basic deterministic dialogue. Gate: earned coins buy item, insufficient balance and duplicate purchase handled, inventory synchronized, AI not required for purchases. Label deterministic dialogue as such.

### CP-16 — Sarvam adapter and text dialogue
Verify official API/model availability and credentials. Build server-only adapter with timeout, bounded input/output, rate limits, structured errors and mock tests. Keep NPC persona constrained; no arbitrary tool access, secrets or authority over economy. Gate: mock tests pass and real credentialed request produces actual response in at least one supported language; verify failure fallback and record live evidence without secrets. Missing credentials block live integration, not core shop functionality.

### CP-17 — Multilingual voice
Add explicit microphone permission, recording duration/size caps, transcription, NPC response and speech synthesis using verified Sarvam capabilities. Support text fallback, mute and playback controls. Document audio handling and avoid retaining raw recordings by default. Gate: actual microphone input and live response tested in English and at least one supported Indian language; permission denied, unsupported format, timeout and no-mic paths work. Automated tests may use fixtures but cannot replace live verification. Localhost is a secure context; remote microphone use requires HTTPS.

### CP-18 — Flagsmith integration
Verify SDK and environment setup. Add server-side flag adapter, safe defaults, cached refresh and broadcast updates. Flags: balloon_game, ferris_wheel, ai_shopkeeper, fireworks, optionally double_rewards. Define behavior for active rounds/rides when disabled (default: allow safe completion, deny new entry). Gate: change a real remote flag, observe two connected clients update without redeploy, server rejects disabled attraction, provider outage uses documented fallback. Mock tests plus live evidence required. No public admin endpoint that bypasses authorization.

### CP-19 — Shared fireworks and celebration
Implement contribution threshold, atomic debit, cooldown and synchronized event timestamp; render inexpensive particles and reduced-motion alternative. Gate: multiple clients contribute, exactly one event starts at threshold, no double debit, all room clients see celebration, other rooms unaffected, flag disable enforced. Test concurrent contributions.

### CP-20 — Audio, accessibility and polish
Add optional licensed ambient audio, mute/volume, reduced motion, keyboard-accessible UI, readable HUD, loading states and graceful error screens. Audio starts only after user gesture. Gate: keyboard-only menus usable, mute works, no autoplay errors, reduced motion works, desktop viewport checks and screenshot review. Mobile controls remain deferred unless explicitly approved.

### CP-21 — Resilience and security
Audit payload schemas, authorization, rate limits, session handling, room expiry, memory bounds, origin checks, XSS-safe rendering, provider timeouts and secrets. Implement graceful disconnect/reconnect UI and restart notification. Gate: malformed/oversized payloads, spoofed identity, cross-room access, spam and duplicate transactions rejected; restart loses rooms as documented and client recovers to lobby. No claim of production-grade security or formal penetration testing.

### CP-22 — Observability foundation
Add structured logs, health/readiness, Prometheus-compatible metrics (connections, rooms, events, rejected requests, round counts, provider errors/latency, process metrics). Avoid high-cardinality room/player labels. Optional local Prometheus Compose profile. Gate: real gameplay changes counters, scrape succeeds, health remains healthy, logs correlate controlled failures without secrets. Document metric definitions and access restrictions.

### CP-23 — NudgeBee integration verification
Read current official onboarding docs and hackathon-specific guidance. Determine whether Docker-only monitoring is supported; do not assume it. If Kubernetes is required, propose a separate local kind/k3d cluster using the same built image, only after Docker app is verified and user approves the extra local dependencies. Keep core Compose path unchanged. Connect actual supported agent/data sources using official instructions and user-provided credentials. Gate: NudgeBee shows real workload/telemetry and investigates a controlled isolated test failure; record evidence, recovery and limitations. Never simulate a screenshot or label local logs as NudgeBee output. If local onboarding is unsupported or credentials unavailable, mark BLOCKED and seek explicit approval to defer live verification to deployment; do not mark sponsor integration verified.

### CP-24 — Full five-player acceptance and performance
Run a clean Docker build and five independent browser sessions. Execute create/invite/join, movement, balloon game, purchase, ride, multilingual NPC, flag change and fireworks. Test sixth rejection, disconnect/rejoin, room isolation and provider outage. Run a bounded socket load test with configurable rooms; begin with 5 and 25 clients and record actual CPU, memory, latency and errors. Do not extrapolate unsupported capacity. Gate: complete journey passes, no uncaught browser errors, no known critical bugs, resource use recorded. If a sponsor was explicitly deferred, report conditional local acceptance and keep its gate open.

### CP-25 — Documentation and release candidate
Finalize crisp README, architecture diagram (Mermaid acceptable), environment table, controls, setup, tests, sponsor status, known limitations and asset attribution. Provide demo script and clean-start instructions. Review repo for secrets, unused code and licenses. Gate: clean checkout builds and runs following README alone; cumulative suite passes; user performs or witnesses five-player demo. Tag local release only with approval. Stop here until user explicitly authorizes live deployment.

## 8. AWS deployment — future gated phase, NOT authorized now

Owner reports an AWS account with approximately USD 200 in credits distributed across services. Actual credit eligibility, expiration, account limits and region pricing are unknown. Credits are not a hard spending cap. Do not provision anything during local development. Do not request root credentials or long-lived access keys in chat. Use least-privilege IAM and existing authenticated AWS CLI/profile when approved.

### CP-26 — Deployment design and cost approval
Verify credit coverage, region, quotas, current pricing, domain/TLS options and NudgeBee requirements. Compare EC2 + Docker Compose (simplest), EC2 + single-node K3s (if required), and managed EKS (only with compelling reason and approved cost). Consider a modest 2–4 vCPU / 4–8 GiB instance for K3s plus monitoring as a starting estimate, not a benchmark. Include EBS, public IPv4, data transfer, registry, monitoring and DNS costs. Avoid NAT gateways, load balancers, managed databases and multi-node clusters unless justified. Configure budget alerts with user approval; explain alerts do not stop charges. Gate: written cost estimate, eligible services, security plan, teardown plan and explicit provisioning approval.

### CP-27 — Infrastructure and image delivery
Provision only approved resources. Prefer reproducible scripts or minimal IaC. Use single replica, private management access (SSM where supported), restricted security groups, no public metrics or Kubernetes API, and least-privilege instance role. Push versioned image to approved registry (ECR or GHCR), pin image digest. Configure secrets securely and document rollback. Gate: instance and service healthy, image digest matches local release, no unintended public ports, actual resources/cost tracked.

### CP-28 — Public HTTPS and multiplayer
Configure approved domain or supported HTTPS endpoint, TLS, reverse proxy and WebSocket upgrade/timeouts. Verify WSS, invite links, microphone permissions and reconnect from independent networks. No insecure public microphone workaround. Gate: five real clients complete public journey, health and logs checked, no mixed content, secrets not exposed.

### CP-29 — Live sponsors and operational drill
Verify live Sarvam, Flagsmith and NudgeBee in final environment. If NudgeBee requires K3s, follow verified onboarding and close any deferred CP-23 criteria. Demonstrate an isolated reversible failure, actual investigation and recovery without destroying active game state. Gate: evidence for each sponsor, approved recovery procedure and no residual failing workloads.

### CP-30 — Release, demo and teardown plan
Record deployment URL, image version, test results, known limitations, actual resource inventory and estimated ongoing cost. Prepare submission video and README links. Test rollback and explain that single-process room state is ephemeral across releases. Schedule or perform teardown only with explicit approval; include instances, volumes, snapshots, public IPs, registry images, DNS and monitoring resources. Verify deletion rather than assuming it. Gate: user accepts release and ongoing cost or teardown plan.

## 9. README contract

Keep README concise and useful, ideally readable in a few minutes. Include: project name and one-sentence pitch; actual features and screenshot if available; stack; prerequisites; `cp .env.example .env` and `docker compose up --build -d`; URL and controls; test commands; sponsor integrations with honest live/mock/deferred status; known limitations; links to specs, decisions, progress, testing and deployment docs. Include shutdown instructions. Do not dump this entire AGENTS.md into README. Never advertise features not implemented. Update after each relevant checkpoint.

## 10. Definition of done and handoff

The local release is complete only when CP-00 through CP-25 are verified, or explicitly approved deferrals are listed as such; deferred mandatory sponsor requirements prevent a claim of full hackathon compliance. The deployed release requires CP-26 through CP-30 as well. A passing build alone is not done. A polished screenshot alone is not done. A mock integration alone is not done.

At the end of every agent turn, leave the repository in a known state, update progress, state exactly what was run and what was not run, and identify the next checkpoint. If context is lost, reconstruct status from repository evidence, not conversation guesses. The next agent should be able to continue without relying on hidden memory.

Start with CP-00 only. Inspect, document, verify prerequisites, report findings and wait for approval.
