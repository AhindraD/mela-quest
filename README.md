# Mela.io

A cozy, browser-based 3D Indian festive carnival ("mela") for private groups of up to five players to explore, play mini-games, ride attractions, chat with a multilingual shopkeeper, and celebrate together.

> **Current Status:** `CP-01` (Reproducible Next.js Skeleton) is **VERIFIED**. Minimal Next.js App Router landing page, `/api/health` readiness endpoint, lint/typecheck/unit test scripts, and production build are working. Next is `CP-02` (Docker runtime) pending user approval.

## Planned Features (Roadmap)
- Private invite-only rooms (max 5 players including host) with server-authoritative state
- Compact low-poly 3D night carnival with central plaza, balloon stall, Ferris wheel, and mithai shop
- 30-second Balloon Pop mini-game awarding session coins
- Synchronized Ferris wheel ride with server-assigned seats
- Mithai & souvenir shopkeeper (deterministic catalog first, then Sarvam AI multilingual text & voice)
- Shared room fireworks celebration
- Live attraction feature flags via Flagsmith and operational monitoring via NudgeBee

## Planned Stack
- **Frontend:** Next.js (App Router), TypeScript (strict), React Three Fiber, Three.js, Drei, Zustand, Tailwind CSS
- **Backend & Transport:** Custom Node.js HTTP server + Socket.IO (same-origin `/socket.io`), Zod runtime validation
- **Runtime:** Docker & Docker Compose (single-process in-memory state)

## Prerequisites (Observed in CP-00)
- Node.js (`v26.13.1` observed) & npm (`11.4.2` observed)
- Docker (`29.9.3` observed) & Docker Compose (`v5.7.0` observed; daemon must be running for CP-02+)
- Desktop browser (Chrome or Edge observed)

## Setup & Controls (Planned for CP-01 / CP-02+)
Once `CP-01` and `CP-02` are implemented:
```sh
cp .env.example .env
docker compose up --build -d
```
- **URL:** `http://localhost:3000`
- **Controls (Desktop-first):** `WASD` / Arrow keys to move, `E` to interact, `Escape` to close overlays.
- **Shutdown:** `docker compose down`

## Test Commands
Implemented in `CP-01`:
- `npm run lint` (`eslint .`)
- `npm run typecheck` (`tsc --noEmit`)
- `npm run test:unit` (`vitest run tests/unit`)
- `npm run build` (`next build --webpack`)

Planned for later checkpoints:
- `npm run test:integration` (`CP-03`), `npm run test:e2e` (`CP-05`), Docker smoke checks (`CP-02`)

## Sponsor Integrations Status
| Integration | Purpose | Status |
| --- | --- | --- |
| Sarvam AI | Multilingual NPC text & voice | `NOT_STARTED` (planned CP-16/17) |
| Flagsmith | Live attraction feature flags | `NOT_STARTED` (planned CP-18) |
| NudgeBee | Operational monitoring & incident investigation | `NOT_STARTED` (planned CP-23) |

## Known Limitations
- Project is at `CP-00`; no playable build exists yet.
- Single-process in-memory room state means server restarts clear active rooms and session balances.
- Docker daemon was not reachable from the sandboxed terminal during CP-00 inspection (`permission denied` on `docker_engine` pipe); this must be resolved before CP-02.

## Documentation
- [Specifications](docs/SPECS.md)
- [Progress Ledger](docs/PROGRESS.md)
- [Architecture Decisions](docs/DECISIONS.md)
- [Testing & Verification](docs/TESTING.md)
- [Assets & Attribution](docs/ASSETS.md)
- [Deployment & Runtime](docs/DEPLOYMENT.md)
