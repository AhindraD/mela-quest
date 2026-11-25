# Mela.io — Deployment & Runtime Contract

> [!IMPORTANT]
> **Current Executed State:** Nothing has been built, containerized, or deployed yet (CP-00). AWS deployment is **explicitly NOT authorized** during local checkpoints (CP-00 through CP-25).

## 1. Local Container Contract (Target for CP-02+) — *Proposed*

- **Service:** `app` in `compose.yaml`
- **Port Binding:** `127.0.0.1:3000:3000` by default (server listens on `0.0.0.0:3000` inside container). LAN testing requires explicit opt-in.
- **Same-Origin Transport:** HTTP + Next.js App Router + Socket.IO on `/socket.io`.
- **Image:** Multi-stage `Dockerfile` using pinned Node.js LTS base, `npm ci`, production `next build`, compiled/runtime custom server (`server.ts`), non-root user, `public/` and `.next/` artifacts, health check (`/api/health`), and graceful `SIGTERM` handling.
- **Environment:** `.env.example` documents all variables with safe mock defaults; `.env` is gitignored and supplied at runtime only (never baked into build args or image layers).
- **Commands (once CP-02 is implemented):**
  - Start: `docker compose up --build -d`
  - Status: `docker compose ps`
  - Logs: `docker compose logs --tail=100 app`
  - Stop: `docker compose down` (do not run `docker compose down -v` or global prune without approval)

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
