import { expect, test, type BrowserContext, type Page } from "@playwright/test";

test.use({
  launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

interface RemotePose {
  id: string;
  x: number;
  z: number;
}

async function track(context: BrowserContext) {
  await context.addInitScript(() => {
    const devtools = new EventTarget();
    Object.assign(window, { __THREE_DEVTOOLS__: devtools });
    devtools.addEventListener("observe", (event) => {
      const scene = (event as CustomEvent).detail as import("three").Scene;
      if (!scene.isScene) return;
      scene.onAfterRender = () => {
        const remotes: RemotePose[] = [];
        scene.getObjectByName("remote-avatars")?.children.forEach((child) => {
          remotes.push({ id: child.name, x: child.position.x, z: child.position.z });
        });
        Object.assign(window, { renderedRemotes: remotes });
      };
    });
  });
}

async function remotes(page: Page) {
  return page.evaluate(() => {
    const poses = (window as Window & { renderedRemotes?: RemotePose[] }).renderedRemotes;
    if (!poses) throw new Error("Remote avatars have not rendered");
    return poses;
  });
}

async function enterCarnival(page: Page) {
  await page.getByRole("button", { name: "Enter carnival" }).click();
  await expect(page.getByRole("heading", { name: "Carnival", exact: true })).toBeFocused();
  await expect(page.getByRole("img", { name: "Painted Wood carnival scene" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Loading the 3D carnival…")).toBeHidden();
}

test("two and then five browsers see each other move", async ({ page, browser }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  const contexts: BrowserContext[] = [];
  const observe = (observed: Page) => {
    observed.on("pageerror", (error) => errors.push(error.message));
    observed.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
  };
  async function guestPage() {
    const context = await browser.newContext();
    contexts.push(context);
    await track(context);
    const guest = await context.newPage();
    observe(guest);
    return guest;
  }

  observe(page);
  await track(page.context());
  try {
    await page.goto("/");
    await page.getByLabel("Nickname").fill("Mira");
    await page.getByRole("button", { name: "Create room", exact: true }).click();
    const invite = await page.getByLabel("Invitation link").inputValue();
    const guest = await guestPage();
    await guest.goto(invite);
    await guest.getByLabel("Nickname").fill("Asha");
    await guest.getByRole("button", { name: "Join room", exact: true }).click();
    await enterCarnival(page);
    await enterCarnival(guest);

    await page.keyboard.down("d");
    await expect.poll(async () => (await remotes(guest)).some((pose) => pose.x > 0.6), { timeout: 8000 }).toBe(true);
    await page.keyboard.up("d");
    await guest.locator(".world-canvas").screenshot({ path: testInfo.outputPath("guest-sees-host.png") });

    await guest.keyboard.down("w");
    await expect.poll(async () => (await remotes(page)).some((pose) => pose.z < 10.4), { timeout: 8000 }).toBe(true);
    await guest.keyboard.up("w");

    const more = await Promise.all(Array.from({ length: 3 }, () => guestPage()));
    await Promise.all(more.map(async (extra, index) => {
      await extra.goto(invite);
      await extra.getByLabel("Nickname").fill(`Guest ${index + 3}`);
      await extra.getByRole("button", { name: "Join room", exact: true }).click();
      await enterCarnival(extra);
    }));
    await expect.poll(async () => (await remotes(more[2])).length, { timeout: 20_000 }).toBe(4);
    const before = Math.max(...(await remotes(more[2])).map((pose) => pose.x));
    await page.keyboard.down("d");
    await expect.poll(async () => Math.max(...(await remotes(more[2])).map((pose) => pose.x)), { timeout: 8000 })
      .toBeGreaterThan(before + 0.45);
    await page.keyboard.up("d");
    await more[2].locator(".world-canvas").screenshot({ path: testInfo.outputPath("fifth-sees-movement.png") });
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("CP-10 proximity prompt, E overlay, Escape focus return, HUD, and independent guest", async ({ page, browser }, testInfo) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  const contexts: import("@playwright/test").BrowserContext[] = [];
  await track(page.context());
  async function attachGuest() {
    const context = await browser.newContext();
    await track(context);
    contexts.push(context);
    const guest = await context.newPage();
    guest.on("pageerror", (error) => errors.push(error.message));
    guest.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    return guest;
  }

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  try {
    await page.goto("/");
    await page.getByLabel("Nickname").fill("Mira");
    await page.getByRole("button", { name: "Create room", exact: true }).click();
    const invite = await page.getByLabel("Invitation link").inputValue();

    const guest = await attachGuest();
    await guest.goto(invite);
    await guest.getByLabel("Nickname").fill("Asha");
    await guest.getByRole("button", { name: "Join room", exact: true }).click();

    await enterCarnival(page);
    await enterCarnival(guest);

    await expect(page.getByLabel("Coins: 0")).toBeVisible();
    await expect(page.getByRole("list", { name: "Carnival roster" })).toContainText("Mira");
    await expect(page.getByRole("list", { name: "Carnival roster" })).toContainText("Asha");
    await expect(page.getByRole("button", { name: /Press E to open/ })).toHaveCount(0);

    // Walk toward the Plaza Fountain until proximity prompt appears.
    await page.keyboard.down("w");
    await expect(page.getByRole("button", { name: "Press E to open Plaza Fountain" })).toBeVisible({ timeout: 10_000 });
    await page.keyboard.up("w");

    await page.keyboard.press("e");
    const dialog = page.getByRole("dialog", { name: "Plaza Fountain" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Close" })).toBeFocused();
    await page.locator(".world-preview").screenshot({ path: testInfo.outputPath("cp10-hud-and-modal.png") });

    // Movement is suppressed while modal is open, while Guest continues moving independently.
    const hostPoseBefore = await remotes(guest);
    const hostZBefore = hostPoseBefore[0]?.z ?? 0;
    await page.keyboard.down("w");
    await page.waitForTimeout(350);
    await page.keyboard.up("w");
    const hostPoseAfter = await remotes(guest);
    expect(hostPoseAfter[0]?.z).toBeCloseTo(hostZBefore, 2);

    await guest.keyboard.down("d");
    await expect.poll(async () => (await remotes(page)).some((pose) => pose.x > 0.5), { timeout: 8000 }).toBe(true);
    await guest.keyboard.up("d");

    // Escape closes only the overlay and returns focus to Carnival heading.
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Carnival", exact: true })).toBeFocused();
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
