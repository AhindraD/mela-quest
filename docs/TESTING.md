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
| `npm ci` | CP-01 | PASS (follow-up clean lockfile install, 486 packages audited, 0 vulnerabilities) |
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

### CP-01 follow-up and CP-02 Docker runtime (2026-11-25)

| Check | Observed result |
| --- | --- |
| `npm.cmd ci` | Initial sandbox attempt exited 1 with EPERM creating a directory in `node_modules`. Retry outside the sandbox exited 0, installed 479 packages, audited 486 and reported 0 vulnerabilities. npm warned that the pinned ESLint release is unsupported. |
| `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test:unit` | Exit 0 for each. One test file, two tests passed. |
| `npm.cmd run build` | Initial sandbox attempt exited 1 with webpack EPERM creating a directory in `.next`. Retry outside the sandbox exited 0. Routes generated for `/`, `/_not-found` and `/api/health`. |
| `docker version --format '{{.Server.Os}}/{{.Server.Arch}}'`, `docker compose config` | Engine accessible outside the sandbox, Linux/amd64. Config exited 0 and resolved a loopback-only port mapping and Compose init. |
| `docker compose build --no-cache --pull app` | Exit 0. Linux lockfile build installed 395 packages, built all expected routes and installed 27 production packages separately. |
| `docker compose up --build -d --wait --wait-timeout 90`, `docker compose ps` | Exit 0. Final runtime image included both Next.js configuration files and became healthy. Local image manifest digest `sha256:1ef372549d63597bf240b3444353585b0877eb4b663118f974b3a7f5a6759fc1`. |
| `curl.exe -fsS http://localhost:3000/api/health` | Exit 0 before and after restart. JSON returned `status: "ok"` and `service: "mela-io"`. |
| `docker compose exec -T app id` and runtime file inspection | UID/GID 1000. App directory matched the expected build, assets, configs, manifests and dependencies. A filename scan of `.next` and `public` found no environment, npm config or key files. |
| In-app Chromium | Opened `http://127.0.0.1:3000/`, inspected the screenshot and read the console. The expected welcome heading rendered. Zero captured warnings or errors. |
| `docker run --rm -p 127.0.0.1:3000:3000 mela-quest-app true` | Expected exit 125 with “port is already allocated”. |
| `docker compose stop app`, `docker inspect`, `docker compose start --wait --wait-timeout 60 app` | First harness run wrongly expected container exit 0 and stopped after seeing 143. The installed Next.js CLI explicitly exits 143 after SIGTERM cleanup. Corrected rerun observed exit 143 in 0.48 seconds, no OOM, a fresh container start timestamp and healthy status. |
| `docker compose logs --tail=100 app` | Exit 0 before and after restart. Startup logs showed readiness and no fatal errors. |
| `npm run test:integration`, `npm run test:e2e` | Not applicable until CP-03 and CP-05. Socket handshake verification begins with CP-03. |

## 4. Manual Verification Instructions

Run `docker compose up --build -d --wait`. Open `http://127.0.0.1:3000/` in a desktop browser and confirm the welcome heading is visible. Check the developer console, run `curl.exe -fsS http://localhost:3000/api/health` on Windows, and inspect `docker compose logs --tail=100 app`. To verify restart, run `docker compose stop app` followed by `docker compose start --wait app` and repeat the health probe.

## 5. CP-03 Socket.IO transport (2026-11-25)

| Check | Observed result |
| --- | --- |
| Dependency install and audit | The first Zod pin triggered one high-severity advisory. Updated to Zod 4.6.7. Final `npm.cmd ci` exited 0 with 499 packages installed, 506 audited and zero reported vulnerabilities. |
| `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build` | First typecheck failed with TS2540 on assignment to Next.js's read-only `NODE_ENV` type. After correcting initialization, all four host commands exited 0. One unit test file, two tests passed. |
| `docker compose config`, `docker compose build --no-cache app`, `docker compose up --build -d --wait --wait-timeout 90` | Config exited 0. Clean build installed both dependency sets and hit the same TS2540 error. Rebuild reused those install layers, reran the corrected production build, and exited 0 with the service healthy. |
| `npm.cmd run test:integration` | Exit 0. One file, three tests passed in 783 ms on an isolated Compose app at `127.0.0.1:52961`. Independent polling and WebSocket clients received their own echoes. The WebSocket client disconnected and reconnected with a new socket ID. Missing, wrong-version, wrong-type and too-long payloads were rejected. The ping rate limit and cross-origin handshake rejection passed. Landing and health returned HTTP 200. |
| `docker compose ps`, `curl.exe -fsS http://localhost:3000/api/health`, `docker compose exec -T app id`, `docker compose logs --tail=100 app` | Exit 0. Canonical service healthy at loopback on port 3000, UID/GID 1000, readiness JSON returned `status: "ok"`. Logs showed the custom listener without fatal errors. |
| `docker compose stop app`, `docker inspect`, `docker compose start --wait --wait-timeout 60 app` | Exit 0. Observed container state `exited 0 false` (not OOM-killed), then a healthy restart and a fresh HTTP readiness response. |
| `npm run test:e2e` | Not applicable before CP-05. No visual change in CP-03. |

To repeat the integration suite in isolation on Windows, build the app image with `docker compose build app`, then run:

```powershell
$testContainer = "mela-transport-test-$PID"
docker compose run -d --rm --no-deps --name $testContainer -p '127.0.0.1::3000' app
try {
    $binding = docker port $testContainer 3000/tcp
    $env:MELA_TEST_URL = "http://$binding"
    $deadline = (Get-Date).AddSeconds(30)
    do {
        $health = docker inspect --format '{{.State.Health.Status}}' $testContainer
        if ($health -eq 'healthy') { break }
        if ($health -eq 'unhealthy' -or (Get-Date) -gt $deadline) { throw "Test container health: $health" }
        Start-Sleep -Milliseconds 250
    } while ($true)
    npm.cmd run test:integration
} finally {
    docker logs --tail=100 $testContainer
    docker stop $testContainer
    Remove-Item Env:MELA_TEST_URL -ErrorAction SilentlyContinue
}
```

## 6. CP-04 Authoritative room manager (2026-11-25)

| Check | Observed result |
| --- | --- |
| `npm.cmd ci` | Exit 0. Installed 499 packages, audited 506, and reported zero vulnerabilities. The existing ESLint deprecation warning still appears. |
| `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build` | All exited 0. Two unit files, seven tests passed. Clock-injected room tests covered the exact grace boundary, invalidated tokens, restored identity, and checked empty-invite expiry both before and at its deadline. |
| `docker compose config`, `docker compose up --build -d --wait --wait-timeout 90` | Exit 0. Compose resolved the 30000 ms reconnect grace and 60000 ms empty-room TTL. The Linux production build succeeded and the local app became healthy. |
| `npm.cmd run test:integration` | Exit 0. Two files, five tests passed in 3.24 seconds against a disposable Compose instance at `127.0.0.1:63723` with a 2500 ms grace period. Six independent clients exercised capacity, duplicate join, disconnect/resume and expiry. A separate room received only its own roster. Invalid invite, invalid nickname and explicit leave checks passed. Roster broadcasts contained no invitation or session tokens. |
| `docker compose ps`, `curl.exe -fsS http://localhost:3000/api/health`, `docker compose exec -T app id`, `docker compose logs --tail=100 app` | Exit 0. App was healthy on loopback, ran as UID/GID 1000 and returned readiness JSON with no fatal startup errors. |
| `docker compose stop app`, `docker inspect`, `docker compose start --wait --wait-timeout 60 app` | Exit 0. Observed `exited 0 false`, then a healthy restart and successful readiness probe. |
| `npm run test:e2e` | Not applicable until CP-05. No UI changed. |

For the faster isolated integration run, set `$env:MELA_TEST_ROOM_GRACE_MS = "2500"` before using the PowerShell recipe above. Add `-e MELA_RECONNECT_GRACE_MS=$env:MELA_TEST_ROOM_GRACE_MS` to its `docker compose run` command and remove `Env:MELA_TEST_ROOM_GRACE_MS` afterward. With the default grace period the expiry test takes about 30 seconds.

## 7. Browser acceptance

From a clean checkout on Windows, run `npm ci`, `npx playwright install chromium --only-shell`, and `docker compose up --build -d --wait`. Then run `npm run test:e2e`. On supported Linux test hosts, use `npx playwright install --with-deps --only-shell chromium` to install the browser and system packages.

Playwright uses the running Docker app at `http://127.0.0.1:3000` by default. For an isolated Compose container, use the earlier PowerShell recipe and run `npm.cmd run test:e2e` while `MELA_TEST_URL` is set. The suite uses independent browser contexts for the host, guests, and a separate room. Screenshots and failure traces are written to the ignored `test-results/` directory.

### CP-05 observed results (2026-11-25)

| Check | Observed result |
| --- | --- |
| `npm.cmd ci`, `npx.cmd playwright install chromium --only-shell` | Exit 0. Installed 502 packages, audited 509, and reported zero vulnerabilities. Playwright 1.65.1 installed Chrome Headless Shell 159.0.8154.6. |
| `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build` | Final commands all exited 0. Two unit files, seven tests passed. Initial lint rejected plain home anchors and typecheck flagged untyped acknowledgment results. Switched to Next Links and annotated the reply types. |
| `docker compose config`, `docker compose up --build -d --wait --wait-timeout 90` | Final config and startup passed. The first build failed to bundle a shared `.mts` file in browser code. Renamed the shared module to `.ts` and declared ESM for its directory. The final Linux build passed. |
| `docker compose ps`, `curl.exe -fsS http://localhost:3000/api/health`, `curl.exe -I -fsS http://localhost:3000/assets/lobby-mela.webp`, `docker compose logs --tail=100 app` | Exit 0. Loopback service healthy, readiness JSON reported `status: "ok"`, illustration returned HTTP 200 with type `image/webp` and 227578 bytes. Final startup logs contained no warnings or errors. |
| `npm.cmd run test:integration` | Exit 0 on the final isolated app at `127.0.0.1:64663` with a 6000 ms reconnect grace. Two files, five tests passed in 6.96 seconds. |
| `npm.cmd run test:e2e -- --output test-results/cp05-verified` | Exit 0 on the same isolated Docker app. Two tests passed in 4.8 seconds. The first attempt failed because broad alert locators also matched Next's route announcer. Fixed by scoping alerts to the join panel. Failed-run traces remain under `test-results/`. |
| Screenshot inspection | Inspected the 1280×720 desktop lobby and five-person room, plus a 390 px narrow layout. The test checked for horizontal overflow and masked the invitation URL in the room screenshot. |

## 8. CP-06 scene foundation (2026-11-25)

| Check | Observed result |
| --- | --- |
| `npm.cmd ci` | Exit 0. Installed 521 packages, audited 528, and reported zero vulnerabilities. The existing ESLint deprecation warning remains. |
| `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build` | All exited 0 on the final run. Two unit files, seven tests passed. Initial lint rejected assigning zoom directly to the camera returned by a hook. Reading the active camera from the R3F store inside the layout effect resolved the lint error. |
| `docker compose config`, `docker compose up --build -d --wait --wait-timeout 90`, `docker compose ps`, `curl.exe -fsS http://localhost:3000/api/health`, `docker compose logs --tail=100 app` | Exit 0. The Linux production build passed. Compose reported a healthy loopback service, readiness returned `status: "ok"`, and startup logs contained no warnings or errors. |
| `npm.cmd run test:integration` | Exit 0. Two files, five tests passed in 7.20 seconds against an isolated Compose app at `127.0.0.1:52900` with a 6000 ms grace period. |
| `npm.cmd run test:e2e -- --output test-results/cp06` | Exit 0 on the same isolated Compose app. Four tests passed in 8.4 seconds. The scene opened with a real WebGL 2 context in Chromium, resized its drawing buffer at a 430 px viewport, and showed the fallback on simulated context loss and when WebGL context creation was disabled. Room controls remained usable. |
| Screenshot inspection | Inspected `carnival-desktop.png` and `carnival-narrow.png` under the CP-06 test output. Both showed the full bounded ground, entrance and placeholder landmarks. |

To reproduce the scene check, create a room in the Docker app and select **View carnival**. The Playwright scene spec uses Chromium with ANGLE SwiftShader to make software-rendered functional verification reproducible. These runs provide no hardware GPU performance benchmark.
