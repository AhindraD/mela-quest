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

## 9. CP-07 local avatar and controls (2026-11-25)

| Check | Observed result |
| --- | --- |
| `npm.cmd ci` | Exit 0. Installed 521 packages, audited 528 and reported zero vulnerabilities. Existing ESLint deprecation warning present. |
| `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build` | Exit 0. Three unit files, fifteen tests passed. The movement suite checked cardinal directions, equal diagonal speed at 15, 30, 60 and 120 simulated FPS, all four map boundaries, fountain and stall collision, sliding, and long-frame capping. |
| `docker compose config`, `docker compose up --build -d --wait --wait-timeout 90`, `docker compose ps`, `curl.exe -fsS http://localhost:3000/api/health`, `docker compose logs --tail=100 app` | Exit 0. The production image built and started healthy on loopback. Readiness returned `status: "ok"`; startup logs showed no warnings or errors. |
| `npm.cmd run test:integration` | Exit 0. Two files, five tests passed in 7.08 seconds against the final isolated Compose app at `127.0.0.1:53062` with a 6000 ms reconnect grace period. |
| `npm.cmd run test:e2e -- --output test-results/cp07-verified` | Exit 0. Five tests passed in 21.6 seconds. Chromium verified all three avatar choices, movement with WASD/arrows, a stable position at the fence, camera follow, pause on text focus, modal focus and window blur, and Escape returning focus to the room button. The first run's no-motion comparison also captured the focus ring. The corrected comparison masks just the header while leaving keyboard focus intact. The failed trace is under `test-results/cp07/`. |
| Screenshot inspection | Examined all three avatar silhouettes at spawn and the cat follow view at the fountain. Images are kept under `test-results/cp07-verified/`. The renderer used ANGLE SwiftShader for these functional checks. |

To reproduce in the browser, choose an avatar and select **Enter carnival**. Walk toward the fountain, move sideways along its edge, then walk back toward the entrance fence. Focus the invitation field while holding a key and verify movement stops. Focus the carnival again and verify movement resumes only on a fresh keypress. Press Escape to return to the room.

### CP-07 Prototype A revision, 2026-11-25

The source image for visual review is [Painted Wood A](../public/assets/painted-wood-a.webp). Compare the pavilion and wheel on the back skyline, merchandise and awnings on the two foreground stalls, fountain tiers, entrance lanterns, and character silhouette. The current picker contains twelve portraits baked from the same playable meshes. The source sheet depicts the man. The woman and cat are original extensions of the selected style.

Intermediate runs exposed two obsolete straight walking routes that crossed new planting beds, a color assertion that also matched the new portrait, and unreliable screenshot comparisons during focus changes. One pair of 864 × 658 idle frames differed in only 40 pixels by one channel level. The movement test now reads the avatar and camera transforms actually rendered by Chromium through Three's inspection events, polls until the fence is reached, and asserts identical transforms during focus, modal and blur checks. Screenshots still cover the visual result and character switching. Corner and planting-bed contact have separate unit checks. An intermediate lint run also included the temporary portrait bake bundle. Archiving that disposable source restored normal source discovery.

Final run: clean host install exited 0 (521 packages installed). Lint, typecheck, 17 unit tests, production build, Compose config and image startup passed. The final lint rerun removed one unused palette entry. Compose reported healthy at `127.0.0.1:3000`, the HTTP health probe returned `status: ok`, and the app logs showed normal startup. An isolated copy at `127.0.0.1:54043` with 6000 ms reconnect grace passed all 5 socket integration tests in 7.02 seconds and all 5 Chromium tests in 25.0 seconds. Browser error assertions passed. Desktop and narrow WebGL captures are in `test-results/painted-wood-reviewed/`. [Reference and final entrance](design/painted-wood-comparison.webp). Chromium used SwiftShader for functional verification. Hardware frame time was not measured.

## 10. CP-08 networked movement (2026-11-25)

| Check | Observed result |
| --- | --- |
| `npm.cmd ci` | Exit 0. Installed 521 packages, audited 528, and reported zero vulnerabilities. ESLint printed its existing deprecation warning. |
| `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test:unit`, `npm.cmd run build` | Exit 0 before the container syntax fix. Four unit files, 22 tests passed. The new cases cover interpolation, one second of server walking, a capped stalled tick, stale and impossible input, room separation, and resume through the room manager. |
| `docker compose config`, first `docker compose up --build -d --wait --wait-timeout 90` | Config exit 0. The image built, then `mela-quest-app-1` exited 1. Node 24 strip-only mode rejected a TypeScript parameter property in `src/server/world.mts` (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`). |
| Constructor assigned without a parameter property, then `docker compose up --build -d --wait --wait-timeout 90` | Exit 0. Healthy on `127.0.0.1:3000`. Image ID `sha256:fc7228e526200ed5b2cdffba985164179e3fd64dd10f53a46e7a9f8edbdbbc60`. |
| `docker compose ps`, `curl.exe -fsS http://127.0.0.1:3000/api/health`, `docker compose exec -T app id`, `docker compose logs --tail=80 app` | Exit 0. Readiness returned `status: "ok"`. Runtime user was `uid=1000(node)`. Startup logs showed no warnings or errors. |
| Isolated `npm.cmd run test:integration` | Exit 0. Three files, seven tests passed in 8.97 seconds against `127.0.0.1:63996` with `MELA_RECONNECT_GRACE_MS=6000`. Two clients, then five, saw server poses move. A second room received none of those poses. Invalid, non-finite, extra-field, and stale input did not change position. The 31st input in a burst was rate limited. Disconnect froze the avatar, resume continued from that pose, and grace expiry removed it. |
| Metrics rerun, `npx.cmd vitest run tests/integration/movement.test.ts --disableConsoleIntercept` | Exit 0 on `127.0.0.1:50468` with the same 6000 ms grace. Two tests passed in 8.90 seconds. Printed `CP08_METRICS {"samples":14,"minIntervalMs":2.2088999999999714,"medianIntervalMs":49.76710000000003,"maxIntervalMs":76.46069999999997,"inputToSnapshotMs":68.899}`. The shortest interval is the gap between immediate presence updates. The median matches the configured 50 ms simulation tick. `inputToSnapshotMs` is the time from sending a direction until another client saw that avatar more than 0.4 units from spawn. |
| `npm.cmd run test:e2e -- --output test-results/cp08` | First attempt exit 1 in about 4 seconds. Playwright looked for Chromium under the sandbox browser cache and the executable was absent. Rerun with `PLAYWRIGHT_BROWSERS_PATH` set to `%LOCALAPPDATA%\ms-playwright` exited 0. Six tests passed in 1.4 minutes. The movement test took 58.5 seconds: two browsers saw each other move, then three more joined and the fifth saw further movement. Existing lobby, avatar, focus, resize, and WebGL fallback checks still passed. |
| `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test:unit` after the syntax fix | Exit 0. 22 unit tests passed. |
| `docker compose stop app`, inspect, `docker compose start --wait --wait-timeout 60 app`, health probe, logs | Exit 0. Stop reported `exited 0`. Restart became healthy and readiness returned `status: "ok"`. Logs showed a second clean listen line and no errors. |

The movement browser check uses Chromium with ANGLE SwiftShader. It records rendered transforms through Three's inspection hook and saves `guest-sees-host.png` and `fifth-sees-movement.png` under `test-results/cp08/`. Those captures show separate avatars in one carnival. They are functional evidence, not a GPU performance measurement. Hardware frame time was not measured.

## 11. CP-09 carnival art pass (2026-11-25)

| Check | Observed result |
| --- | --- |
| `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` | All exited 0. Five unit files, 25 tests passed, including `tests/unit/carnival-layout.test.ts` (unobstructed spawn, aligned landmark collisions, clear `INTERACTION_ZONES` approach points, and BFS reachability of all 5 landmarks from spawn via `walk()`). `npm run build` hit a transient sandbox `EPERM` on `mkdir` on the first run and exited 0 on retry. |
| `docker compose config -q && docker compose up --build -d --wait --wait-timeout 90` | Exit 0. Clean Linux production build (`sha256:91be4d6f1a6943168753cd7115ac878c7110a0373d60c198c870eb225a02db92`). `mela-quest-app-1` healthy on `127.0.0.1:3000`; `/api/health` returned `{"status":"ok","service":"mela-io"}`; logs showed no errors. |
| Isolated `npm.cmd run test:integration` | Exit 0. Three files, 7 tests passed in 8.28 seconds against the CP-09 Docker image. |
| Isolated `npx.cmd playwright test --output test-results/cp09` | First run: 6 passed, 1 failed (`movement.spec.ts` timed out at 5000 ms waiting for the 5th concurrent SwiftShader WebGL2 canvas). Raised `toBeVisible` timeout in `tests/e2e/movement.spec.ts` to 15000 ms and reran: all 7 E2E tests passed in 1.7 minutes with zero console errors, zero page errors, and zero failed asset requests. |
| Rendering measurement (Chromium SwiftShader) | `CP09_RENDER_METRICS`: `29` draw calls, `14428` triangles, `40.6` ms median frame interval across `59` samples on `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`. |
| Screenshot inspection | Inspected `cp09-desktop-1280.png` (1280×720) and `cp09-desktop-1440.png` (1440×900) under `test-results/cp09/`. Confirmed readable signs (`MELA PLAZA`, `BALLOONS`, `MITHAI SHOP`, `DANCE PAVILION`, `FERRIS WHEEL`), connecting paths, and Dance Pavilion diya centerpiece. |

## 12. CP-10 interaction framework and HUD (2026-11-25)

| Check | Observed result |
| --- | --- |
| `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build` | All exited 0. Five unit files, 26 tests passed, including proximity/schema/availability/distance checks in `tests/unit/world.test.ts`. |
| `docker compose config -q && docker compose up --build -d --wait --wait-timeout 90` | Exit 0. Clean Linux production build (`sha256:046614560662eeb995389079e4fcca7d09d358383330d62c0c3c7a1109a15c77`). `mela-quest-app-1` healthy on `127.0.0.1:3000`; `/api/health` returned `{"status":"ok","service":"mela-io"}`; logs showed no errors. |
| Isolated `npm.cmd run test:integration` | Exit 0. Three files, 8 tests passed in 10.67 seconds against the CP-10 Docker image, including independent per-client `attraction:interact` distance and spoofed-payload rejection. |
| Isolated `npx.cmd playwright test --output test-results/cp10` | First run failed in the new CP-10 test because `track()` was omitted on the test contexts. After adding `track()`, all 8 E2E tests passed in 1.2 minutes: prompt appears on approach, `E` opens `Plaza Fountain` dialog and focuses `Close`, `WASD` is suppressed while modal is open, Guest moves independently, `Escape` closes only the modal and returns focus to `Carnival`, and HUD displays `Coins: 0` and roster. |
| Screenshot inspection | Inspected `cp10-hud-and-modal.png` under `test-results/cp10/`. Confirmed HUD (`Coins: 0`, `Mira`, `Asha`), `Plaza Fountain` modal with focused `Close` button, and both avatars visible in the 3D scene. |
