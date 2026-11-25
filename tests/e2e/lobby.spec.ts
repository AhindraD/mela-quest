import { expect, test, type BrowserContext, type Page } from "@playwright/test";

async function enterInvitation(page: Page, invite: string, nickname: string) {
  await page.goto(invite);
  await page.getByLabel("Nickname").fill(nickname);
  await page.getByRole("button", { name: "Join room", exact: true }).click();
}

test("keyboard host, shared invite, five players, sixth rejection, isolation and reload", async ({ page, browser }, testInfo) => {
  const browserErrors: string[] = [];
  const contexts: BrowserContext[] = [];
  const observe = (observedPage: Page) => {
    observedPage.on("pageerror", (error) => browserErrors.push(error.message));
    observedPage.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
  };
  async function guestPage() {
    const context = await browser.newContext();
    contexts.push(context);
    const guest = await context.newPage();
    observe(guest);
    return guest;
  }

  observe(page);
  try {
    await page.goto("/");
    const create = page.getByRole("button", { name: "Create room", exact: true });
    await expect(create).toBeEnabled();
    await page.screenshot({ path: testInfo.outputPath("lobby-desktop.png") });
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Nickname")).toBeFocused();
    await page.keyboard.type("Mira");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("radio", { name: "Marigold" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("radio", { name: "Rose" })).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(create).toBeFocused();
    await page.keyboard.press("Enter");

    const heading = page.getByRole("heading", { name: "Your room" });
    await expect(heading).toBeFocused();
    const inviteInput = page.getByLabel("Invitation link");
    const invite = await inviteInput.inputValue();
    expect(new URL(invite).searchParams.get("invite")).toMatch(/^[A-Za-z0-9_-]{22}$/);
    await expect(page.getByRole("img", { name: "Rose", exact: true })).toBeVisible();

    const first = await guestPage();
    await enterInvitation(first, invite, "Asha");
    await expect(first.getByRole("list", { name: "Guests" })).toContainText("Mira");
    await expect(first.getByRole("img", { name: "Rose", exact: true })).toBeVisible();
    await expect(page.getByRole("list", { name: "Guests" })).toContainText("Asha");
    await first.reload();
    await expect(first.getByRole("heading", { name: "Your room" })).toBeVisible();
    await expect(first.getByRole("list", { name: "Guests" }).getByText("You", { exact: true })).toBeVisible();
    await expect(first.getByText("2 of 5 spots taken")).toBeVisible();
    await expect(page.getByText("2 of 5 spots taken")).toBeVisible();

    const isolated = await guestPage();
    await isolated.goto(new URL("/", invite).href);
    await isolated.getByLabel("Nickname").fill("Solo");
    await isolated.getByRole("button", { name: "Create room", exact: true }).click();
    const soloRoster = isolated.getByRole("list", { name: "Guests" });
    await expect(soloRoster.getByRole("listitem")).toHaveCount(1);

    const additional = await Promise.all(Array.from({ length: 3 }, () => guestPage()));
    await Promise.all(additional.map((guest, index) => enterInvitation(guest, invite, `Guest ${index + 3}`)));
    await expect(page.getByText("5 of 5 spots taken")).toBeVisible();
    const sixth = await guestPage();
    await enterInvitation(sixth, invite, "Sixth");
    await expect(sixth.getByRole("region", { name: "Join a room" }).getByRole("alert"))
      .toContainText("This room is full");
    await expect(soloRoster.getByRole("listitem")).toHaveCount(1);
    await expect(soloRoster).toContainText("Solo");
    await expect(page.getByRole("list", { name: "Guests" })).not.toContainText("Solo");

    // Save the visible roster without retaining the test invitation in the screenshot.
    await page.screenshot({
      path: testInfo.outputPath("room-desktop.png"), mask: [inviteInput], maskColor: "#17121f",
    });
    await first.getByRole("button", { name: "Leave room" }).click();
    await expect(first.getByRole("heading", { name: "Create a room" })).toBeFocused();
    await expect(page.getByText("4 of 5 spots taken")).toBeVisible();
    expect(browserErrors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("invalid invitations and a selectable fallback when clipboard access fails", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("Clipboard unavailable")) },
    });
  });
  await page.goto("/?invite=invalid");
  const joinAlert = page.getByRole("region", { name: "Join a room" }).getByRole("alert");
  await expect(joinAlert).toContainText("invalid or has expired");
  await page.goto(`/?invite=${"A".repeat(22)}`);
  await page.getByLabel("Nickname").fill("Visitor");
  await page.getByRole("button", { name: "Join room", exact: true }).click();
  await expect(joinAlert).toContainText("invalid or has expired");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("link", { name: "Create your own room" }).click();
  await expect(page.getByRole("button", { name: "Create room", exact: true })).toBeEnabled();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("lobby-narrow.png"), fullPage: true });
  await page.getByLabel("Nickname").fill("Visitor");
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await page.getByRole("button", { name: "Copy link" }).click();
  const link = page.getByLabel("Invitation link");
  await expect(link).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Copy the selected link" })).toBeVisible();
  expect(await link.evaluate((input: HTMLInputElement) =>
    input.selectionStart === 0 && input.selectionEnd === input.value.length,
  )).toBe(true);
});
