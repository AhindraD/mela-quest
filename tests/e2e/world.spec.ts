import { expect, test, type Page } from "@playwright/test";

test.use({
  launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
});

async function openPreview(page: Page) {
  await page.goto("/");
  await page.getByLabel("Nickname").fill("Anika");
  await page.getByRole("button", { name: "Create room", exact: true }).click();
  await page.getByRole("button", { name: "View carnival" }).click();
  await expect(page.getByRole("heading", { name: "Carnival preview" })).toBeFocused();
  return page.getByRole("region", { name: "Carnival preview" });
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
  await page.getByRole("button", { name: "Close carnival preview" }).click();
  await expect(canvas).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Guests" })).toContainText("Anika");
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
