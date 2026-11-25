# MelaQuest — Deployment & Runtime Contract

> [!IMPORTANT]
> Local runtime verification is tracked in [TESTING.md](TESTING.md). AWS deployment requires separate approval after the local release.

## 1. Local Container Contract

- **Service:** `app` in `compose.yaml`
- **Port Binding:** `127.0.0.1:3000:3000` by default (server listens on `0.0.0.0:3000` inside container). LAN testing requires explicit opt-in.
- **Server:** `node server.mts` starts the custom HTTP server and serves both Next.js and Socket.IO on `/socket.io`. Compose init forwards SIGTERM. The server closes its Socket.IO connections and HTTP listener, then releases Next.js resources.
- **Image:** Node.js 24.11.1 LTS on Debian Bookworm Slim. The build stage installs the lockfile and compiles Next.js. The runtime stage uses production dependencies, the Next.js build and public assets, and runs under the `node` user. Compose init forwards signals to the Node process. The image health check polls `/api/health`.
- **Environment:** The image sets `MELA_HOST=0.0.0.0` and `PORT=3000` for its internal listener. For host execution the server reads process environment variables and defaults to `127.0.0.1:3000`. The Docker build context excludes environment files. Sponsor credentials are reserved for later checkpoints.
- **Room lifetimes:** Compose forwards `MELA_RECONNECT_GRACE_MS` (default `30000`) and `MELA_EMPTY_ROOM_TTL_MS` (default `60000`). Both accept integer milliseconds from 1 through 86400000. Restarting the process clears all rooms and invalidates its invites and sessions.
- **Invitations:** The lobby generates an invite using the origin the browser opened. With the default loopback binding, use separate browser contexts on the same machine to test the link.
- **Commands:**
  - Start: `docker compose up --build -d`
  - Status: `docker compose ps`
  - Logs: `docker compose logs --tail=100 app`
  - Stop: `docker compose down` (do not run `docker compose down -v` or global prune without approval)

If Docker reports that port 3000 is already in use, identify the listener and free the port before retrying. On Windows, use `Get-NetTCPConnection -LocalPort 3000 -State Listen` to find its process ID. The local stack binds to loopback by default.

## 2. Deployment Prerequisites — *Proposed*
- Local release candidate (`CP-00` through `CP-25`) verified in Docker.
- Explicit user approval for AWS provisioning, cost estimate, region, and budget alerts (`CP-26`).

## 3. Future AWS Plan — *Proposed (Gated at CP-26..CP-30, Not Authorized Now)*
- **Account Context:** Owner reports ~USD 200 in AWS credits across services (exact eligibility, expiration, and limits unverified).
- **Candidate Topologies (to evaluate in CP-26):**
  1. Single EC2 instance + Docker Compose (simplest).
  2. Single EC2 instance + single-node K3s (only if NudgeBee requires Kubernetes).
  3. Managed EKS (only with compelling reason and approved cost).
- **Security & Cost Guardrails:** Single replica, least-privilege IAM, private management access (SSM), restricted security groups, HTTPS/WSS via approved domain, no public metrics/Kubernetes API, no NAT gateways or managed databases unless justified, verified teardown plan.
