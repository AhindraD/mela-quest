# Mela.io

A cozy, browser-based 3D Indian festive carnival ("mela") for private groups of up to five players to explore, play mini-games, ride attractions, chat with a multilingual shopkeeper, and celebrate together.

Create a private room for up to five players, choose an avatar color, and invite friends from the browser lobby. Pick a man, woman, or cat and walk through the Painted Wood fairground. The roster updates as guests join, reconnect, or leave. [Progress ledger](docs/PROGRESS.md)

Prototype A and the playable entrance appear side by side in the [visual comparison](docs/design/painted-wood-comparison.webp).

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

## Local Setup
```sh
cp .env.example .env
docker compose up --build -d
```
- Open `http://127.0.0.1:3000` after `docker compose ps` reports the app healthy.
- Enter a nickname, choose an avatar color, and select **Create room**. Share the link from the roster. Guests open the link and select **Join room**.
- Choose **Man**, **Woman**, or **Cat**, then select **Enter carnival**. Use WASD or the arrow keys to move and Escape to return to the room. Friends in the same room see your avatar move. The scene requires WebGL 2.
- With the default localhost binding, try guest links in separate browser profiles on the same machine.
- The environment file is optional for the current build.
- **Shutdown:** `docker compose down`

## Test Commands
Implemented in `CP-01`:
- `npm ci`
- `npm run lint` (`eslint .`)
- `npm run typecheck` (`tsc --noEmit`)
- `npm run test:unit` (`vitest run tests/unit`)
- `npm run build` (`next build --webpack`)
- `npm run test:integration` (run against the Docker app; see [test instructions](docs/TESTING.md))
- `npm run test:e2e` (install Playwright Chromium first and run against the Docker app)

## Sponsor Integrations Status
| Integration | Purpose | Status |
| --- | --- | --- |
| Sarvam AI | Multilingual NPC text & voice | `NOT_STARTED` (planned CP-16/17) |
| Flagsmith | Live attraction feature flags | `NOT_STARTED` (planned CP-18) |
| NudgeBee | Operational monitoring & incident investigation | `NOT_STARTED` (planned CP-23) |

## Known Limitations
- Attractions, coins, and the shop are not available yet. Other rooms cannot see your avatar. A server restart clears rooms and poses.
- Room state is held in memory. Server restarts invalidate existing invites and guest sessions.

## Documentation
- [Specifications](docs/SPECS.md)
- [Progress Ledger](docs/PROGRESS.md)
- [Architecture Decisions](docs/DECISIONS.md)
- [Testing & Verification](docs/TESTING.md)
- [Assets & Attribution](docs/ASSETS.md)
- [Deployment & Runtime](docs/DEPLOYMENT.md)
