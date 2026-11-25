import { expect, test, type Page } from "@playwright/test";

test.use({
  launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

async function openPreview(page: Page) {
  await page.goto("/");
  await page.getByLabel("Nickname").fill("Anika");
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await page.getByRole("button", { name: "Enter carnival" }).click();
  await expect(page.getByRole("heading", { name: "Carnival", exact: true })).toBeFocused();
  return page.getByRole("region", { name: "Carnival", exact: true });
}

test("renders the carnival in WebGL and resizes the scene", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  const preview = await openPreview(page);
  const canvas = preview.getByRole("img", { name: "Painted Wood carnival scene" }).locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(preview.getByText("Loading the 3D carnival…")).toBeHidden();
  const drawingWidth = () => canvas.evaluate((element: HTMLCanvasElement) =>
    element.getContext("webgl2")?.drawingBufferWidth ?? 0,
  );
  const originalWidth = await drawingWidth();
  expect(originalWidth).toBeGreaterThan(0);

  await preview.screenshot({ path: testInfo.outputPath("carnival-desktop.png") });
  await page.setViewportSize({ width: 430, height: 820 });
  await expect.poll(drawingWidth).toBeLessThan(originalWidth);
  expect(await drawingWidth()).toBeGreaterThan(0);
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(430);
  await preview.screenshot({ path: testInfo.outputPath("carnival-narrow.png") });

  await canvas.evaluate((element: HTMLCanvasElement) => {
    const extension = element.getContext("webgl2")?.getExtension("WEBGL_lose_context");
    if (!extension) throw new Error("Context loss extension is unavailable");
    extension.loseContext();
  });
  await expect(preview.getByRole("status")).toContainText("3D preview unavailable");
  await page.getByRole("button", { name: "Return to room" }).click();
  await expect(canvas).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Guests" })).toContainText("Anika");
  expect(errors).toEqual([]);
});

async function renderFor(page: Page, milliseconds: number) {
  // Pace held input by actual animation frames on the software WebGL renderer.
  await page.evaluate((duration) => new Promise<void>((resolve) => {
    const end = performance.now() + duration;
    function nextFrame(now: number) {
      if (now >= end) resolve();
      else requestAnimationFrame(nextFrame);
    }
    requestAnimationFrame(nextFrame);
  }), milliseconds);
}

async function hold(page: Page, key: string, milliseconds: number) {
  await page.keyboard.down(key);
  await renderFor(page, milliseconds);
  await page.keyboard.up(key);
}

test("local avatars move with WASD and arrows, follow the camera, and pause safely", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  // Observe the same Three scene and camera Chromium actually renders.
  await page.addInitScript(() => {
    const devtools = new EventTarget();
    Object.assign(window, { __THREE_DEVTOOLS__: devtools });
    devtools.addEventListener("observe", event => {
      const scene = (event as CustomEvent).detail as import("three").Scene;
      if (!scene.isScene) return;
      scene.onAfterRender = (_gl, _scene, camera) => {
        const player = scene.getObjectByName("local-avatar");
        if (player) Object.assign(window, { renderedPose: {
          x: player.position.x, z: player.position.z, cameraX: camera.position.x, cameraZ: camera.position.z,
        } });
      };
    });
  });
  const pose = () => page.evaluate(() => {
    const point = (window as Window & {
      renderedPose?: { x: number; z: number; cameraX: number; cameraZ: number };
    }).renderedPose;
    if (!point) throw new Error("The player has not rendered");
    return point;
  });
  const world = await openPreview(page);
  const canvas = world.getByRole("img", { name: "Painted Wood carnival scene" });
  const heading = world.getByRole("heading", { name: "Carnival", exact: true });
  const selector = page.getByLabel("Local avatar");
  // Use a solid backdrop to exclude browser gradient dithering. Exclude the header's keyboard focus ring.
  const frame = () => page.locator(".world-canvas").screenshot({
    style: ".world-preview-header { opacity: 0 !important; } .world-canvas { background: #211a32 !important; }",
  });
  await expect(canvas).toBeVisible();
  await expect(selector.locator("option")).toHaveText(["Man", "Woman", "Cat"]);
  await canvas.screenshot({ path: testInfo.outputPath("man-at-entrance.png") });
  const man = await frame();
  await selector.selectOption("Woman");
  await expect.poll(async () => (await frame()).equals(man)).toBe(false);
  await expect(page.getByRole("img", { name: "Marigold Woman avatar" })).toBeVisible();
  const woman = await frame();
  await canvas.screenshot({ path: testInfo.outputPath("woman-at-entrance.png") });
  await selector.selectOption("Cat");
  await expect.poll(async () => (await frame()).equals(woman)).toBe(false);
  await heading.focus();
  await canvas.screenshot({ path: testInfo.outputPath("cat-at-entrance.png") });

  for (const [key, axis, cameraAxis, sign] of [
    ["w", "z", "cameraZ", -1], ["ArrowLeft", "x", "cameraX", -1],
    ["ArrowDown", "z", "cameraZ", 1], ["d", "x", "cameraX", 1],
  ] as const) {
    const before = await pose();
    await hold(page, key, 360);
    const after = await pose();
    expect((after[axis] - before[axis]) * sign).toBeGreaterThan(0);
    expect((after[cameraAxis] - before[cameraAxis]) * sign).toBeGreaterThan(0);
  }

  await page.keyboard.down("ArrowDown");
  await expect.poll(async () => (await pose()).z).toBeCloseTo(13.24, 4);
  await page.keyboard.up("ArrowDown");
  const atFence = await pose();
  await canvas.screenshot({ path: testInfo.outputPath("cat-at-boundary.png") });
  await hold(page, "ArrowDown", 320);
  expect(await pose()).toEqual(atFence);

  await page.keyboard.down("w");
  await renderFor(page, 280);
  await page.getByLabel("Invitation link").focus();
  const whenTyping = await pose();
  await renderFor(page, 220);
  expect(await pose(), "text focus stops held movement").toEqual(whenTyping);
  await page.keyboard.up("w");
  await heading.focus();
  await renderFor(page, 220);
  expect(await pose(), "restoring focus does not resume held movement").toEqual(whenTyping);

  await page.keyboard.down("w");
  await renderFor(page, 280);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const whenBlurred = await pose();
  await renderFor(page, 220);
  expect(await pose(), "window blur stops held movement").toEqual(whenBlurred);
  await page.keyboard.up("w");

  await page.evaluate(() => {
    const dialog = document.createElement("dialog");
    dialog.id = "controls-test-modal";
    dialog.innerHTML = "<input aria-label='Test modal input'>";
    document.body.append(dialog);
    dialog.showModal();
  });
  const whenModal = await pose();
  await hold(page, "ArrowUp", 300);
  expect(await pose(), "modal focus prevents movement").toEqual(whenModal);
  await page.evaluate(() => document.getElementById("controls-test-modal")?.remove());

  await heading.focus();
  await hold(page, "w", 560);
  await canvas.screenshot({ path: testInfo.outputPath("cat-follow-camera.png") });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Enter carnival" })).toBeFocused();
  expect(errors).toEqual([]);
});

test("explains the WebGL fallback and keeps room controls available", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value(this: HTMLCanvasElement, type: string, ...args: unknown[]) {
        if (type === "webgl" || type === "webgl2") return null;
        return Reflect.apply(original, this, [type, ...args]);
      },
    });
  });

  const preview = await openPreview(page);
  await expect(preview.getByRole("status")).toContainText("3D preview unavailable");
  await expect(preview.getByRole("status")).toContainText("WebGL 2");
  await expect(preview.locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy link" })).toBeEnabled();
  await page.getByRole("button", { name: "Leave room" }).click();
  await expect(page.getByRole("heading", { name: "Create a room" })).toBeVisible();
  expect(errors).toEqual([]);
});
