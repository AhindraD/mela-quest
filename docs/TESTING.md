# Mela.io — Testing & Verification

## 1. Observed Environment (CP-00 — 2026-11-25)

| Component | Observed Value | Notes |
| --- | --- | --- |
| OS | Windows (`Microsoft Windows NT 10.0.26300.0`) | Host OS |
| Node.js | `v26.13.1` | Installed |
| npm | `11.4.2` | Installed |
| Git | `2.56.1.windows.1` | Installed; workspace is **not** yet a git repository |
| Docker CLI | `29.9.3` (build `5457199`) | Installed at `C:\Program Files\Docker\Docker\resources\bin\docker.exe` |
| Docker Compose | `v5.7.0` | Installed at `C:\Program Files\Docker\cli-plugins\docker-compose.exe` |
| Docker Daemon | **Not accessible from sandbox** | `docker info` returned `permission denied while trying to connect to the docker API at npipe:////./pipe/docker_engine` and `Access is denied` on `C:\Users\offic\.docker\config.json` |
| Browsers | Google Chrome & Microsoft Edge | `chrome.exe` and `msedge.exe` present in `Program Files` |
| Disk (C:) | ~141.46 GB free (`141463687168` bytes) | Sufficient for Node dependencies, Playwright, and Docker images |

## 2. Cumulative Verification Contract

These commands will be established in CP-01/CP-02 and run at every applicable checkpoint thereafter:

| Command | Introduced In | CP-01 Status |
| --- | --- | --- |
| `npm ci` | CP-01 | PASS (`npm install --save-exact` generated `package-lock.json`, 486 packages audited, 0 vulnerabilities) |
| `npm run lint` | CP-01 | PASS (exit `0`, `eslint .`) |
| `npm run typecheck` | CP-01 | PASS (exit `0`, `tsc --noEmit`) |
| `npm run test:unit` | CP-01 | PASS (exit `0`, 1 file, 2 tests passed) |
| `npm run test:integration` | CP-03 | NOT APPLICABLE (introduced in CP-03) |
| `npm run build` | CP-01 | PASS (exit `0`, `next build --webpack`) |
| `docker compose config` | CP-02 | NOT APPLICABLE (introduced in CP-02) |
| `docker compose up --build -d` | CP-02 | NOT APPLICABLE |
| `docker compose ps` | CP-02 | NOT APPLICABLE |
| `curl -fsS http://localhost:3000/api/health` | CP-02 | PASS on local `next start` probe (`200`, `{"status":"ok","service":"mela-io",...}`) |
| `npm run test:e2e` | CP-05 | NOT APPLICABLE (introduced in CP-05) |
| `docker compose logs --tail=100 app` | CP-02 | NOT APPLICABLE |

## 3. Observed Test Runs

### CP-00 Environment & Baseline Inspection (2026-11-25)
- `Get-ChildItem -Force; git status; node -v; npm -v; git --version; docker --version; docker compose version; Get-PSDrive C` -> Exit `0` (with `git status` reporting `fatal: not a git repository` and `docker compose` reporting `unknown command` due to sandboxed plugin/config access).
- `where.exe docker; docker info; docker-compose --version; Get-ItemProperty ...chrome.exe/msedge.exe` -> Exit `0`. Confirmed `docker-compose.exe v5.7.0`, `chrome.exe`, `msedge.exe`, and Docker API pipe permission denial from sandbox.

### CP-01 Reproducible Next.js Skeleton (2026-11-25)
- `npm install --save-exact next react react-dom; npm install --save-dev --save-exact typescript @types/node @types/react @types/react-dom eslint eslint-config-next tailwindcss @tailwindcss/postcss vitest` (unsandboxed for registry network) -> Exit `0`, 0 vulnerabilities.
- `npm run lint && npm run typecheck && npm run test:unit && npm run build` -> Exit `0`:
  - `eslint .` -> 0 errors/warnings
  - `tsc --noEmit` -> 0 errors
  - `vitest run tests/unit` -> 1 file passed, 2 tests passed (`tests/unit/health.test.ts`)
  - `next build --webpack` -> compiled and generated `/`, `/_not-found`, `/api/health`
- Production server probe (`node node_modules/next/dist/bin/next start -H 127.0.0.1 -p 3000`, unsandboxed for loopback binding) -> Exit `0`:
  - `GET /api/health` -> `200` `{"status":"ok","service":"mela-io","uptimeSeconds":0,"timestamp":"2026-11-25T07:37:17.933Z"}`
  - `GET /` -> `200` (`Welcome to the Festive Carnival` present)

## 4. Manual Verification Instructions
Manual browser and multi-client verification instructions will be added starting in CP-02 (landing page) and CP-05 (multiplayer invite flow).
