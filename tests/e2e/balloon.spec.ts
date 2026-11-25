import { expect, test, type Page } from "@playwright/test";

test.use({
  launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

async function enterCarnival(page: Page) {
  await page.getByRole("button", { name: "Enter carnival" }).click();
  await expect(page.getByRole("heading", { name: "Carnival", exact: true })).toBeFocused();
  await expect(page.getByRole("img", { name: "Painted Wood carnival scene" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Loading the 3D carnival…")).toBeHidden();
}

async function walkToBalloonStall(page: Page) {
  await page.keyboard.down("a");
  await page.keyboard.down("w");
  await expect(page.getByRole("button", { name: "Press E to open Balloon Stall" })).toBeVisible({ timeout: 15_000 });
  await page.keyboard.up("a");
  await page.keyboard.up("w");
}

test("CP-13 two players play a full balloon round, sync scores, earn coins, replay, and exit cleanly", async ({ page, browser }, testInfo) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  const contexts: import("@playwright/test").BrowserContext[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  try {
    await page.goto("/");
    await page.getByLabel("Nickname").fill("Mira");
    await page.getByRole("button", { name: "Create room", exact: true }).click();
    const invite = await page.getByLabel("Invitation link").inputValue();

    const guestContext = await browser.newContext();
    contexts.push(guestContext);
    const guest = await guestContext.newPage();
    guest.on("pageerror", (error) => errors.push(error.message));
    guest.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    await guest.goto(invite);
    await guest.getByLabel("Nickname").fill("Asha");
    await guest.getByRole("button", { name: "Join room", exact: true }).click();

    await enterCarnival(page);
    await enterCarnival(guest);

    await Promise.all([walkToBalloonStall(page), walkToBalloonStall(guest)]);

    await page.keyboard.press("e");
    await guest.keyboard.press("e");
    const hostDialog = page.getByRole("dialog", { name: "Balloon Stall" });
    const guestDialog = guest.getByRole("dialog", { name: "Balloon Stall" });
    await expect(hostDialog).toBeVisible();
    await expect(guestDialog).toBeVisible();

    await hostDialog.getByRole("button", { name: "Start round" }).click();
    await guestDialog.getByRole("button", { name: "Start round" }).click();

    await expect(hostDialog.getByLabel("Time remaining")).toBeVisible();
    await expect(guestDialog.getByLabel("Time remaining")).toBeVisible();

    // Pop visible topmost balloon targets in both browsers.
    const hostTarget = hostDialog.locator(".balloon-target").last();
    await expect(hostTarget).toBeVisible({ timeout: 5000 });
    await hostTarget.click();
    await expect(hostDialog.locator(".balloon-feedback")).toContainText("pts!");

    const guestTarget = guestDialog.locator(".balloon-target").last();
    await expect(guestTarget).toBeVisible({ timeout: 5000 });
    await guestTarget.click();

    // Shared scoreboard synchronizes both players' scores.
    await expect(hostDialog.getByRole("list", { name: "Balloon scoreboard" })).toContainText("Mira");
    await expect(hostDialog.getByRole("list", { name: "Balloon scoreboard" })).toContainText("Asha");
    await expect(guestDialog.getByRole("list", { name: "Balloon scoreboard" })).toContainText("Mira");
    await page.locator(".world-preview").screenshot({ path: testInfo.outputPath("cp13-balloon-active.png") });

    // Wait for round completion and verify coins update.
    await expect(hostDialog.getByText(/Round complete!/)).toBeVisible({ timeout: 15_000 });
    await expect(guestDialog.getByText(/Round complete!/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel(/Coins: [1-9]\d*/)).toBeVisible({ timeout: 5000 });
    await page.locator(".world-preview").screenshot({ path: testInfo.outputPath("cp13-balloon-results.png") });

    // Replay works, and exiting mid-round cleans up and returns focus to Carnival.
    await hostDialog.getByRole("button", { name: "Play again" }).click();
    await expect(hostDialog.getByLabel("Time remaining")).toBeVisible({ timeout: 5000 });
    await hostDialog.getByRole("button", { name: "Leave game" }).click();
    await expect(hostDialog).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Carnival", exact: true })).toBeFocused();
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
