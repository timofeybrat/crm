import { expect, test, type BrowserContext, type Page } from "@playwright/test";

// Public credentials for the isolated livekit-test / crm_test environment only.
const managerKey = "test-manager-key-for-disposable-local-e2e-only";
const authorization = { Authorization: `Bearer ${managerKey}` };

async function mediaInstrumentation(context: BrowserContext) {
  await context.addInitScript(() => {
    const original = window.RTCPeerConnection;
    const connections: RTCPeerConnection[] = [];
    Object.defineProperty(window, "__videoTestPeers", { value: connections });
    window.RTCPeerConnection = class extends original {
      constructor(config?: RTCConfiguration) {
        super(config);
        connections.push(this);
      }
    };
  });
}

async function enableDevices(page: Page) {
  const mic = page.getByRole("button", { name: "Микрофон", exact: true });
  const camera = page.getByRole("button", { name: "Камера", exact: true });
  await mic.click();
  await camera.click();
  await expect(mic).toHaveAttribute("data-lk-enabled", "true");
  await expect(camera).toHaveAttribute("data-lk-enabled", "true");
}

async function receivedAudioAndVideo(page: Page) {
  return page.evaluate(async () => {
    const peers = (window as unknown as { __videoTestPeers: RTCPeerConnection[] }).__videoTestPeers;
    let audio = false,
      video = false;
    for (const peer of peers) {
      const stats = await peer.getStats();
      stats.forEach((report) => {
        if (report.type !== "inbound-rtp" || report.bytesReceived <= 0) return;
        if (report.kind === "audio") audio = true;
        if (report.kind === "video" && report.framesDecoded > 0) video = true;
      });
    }
    return audio && video;
  });
}

test("two participants exchange real media, leave/rejoin, and manager closes access", async ({
  browser,
  request,
}) => {
  const managerContext = await browser.newContext({
    permissions: ["camera", "microphone"],
    viewport: { width: 1440, height: 1000 },
  });
  const guestContext = await browser.newContext({
    permissions: ["camera", "microphone"],
    viewport: { width: 390, height: 844 },
  });
  await mediaInstrumentation(managerContext);
  await mediaInstrumentation(guestContext);
  const manager = await managerContext.newPage();
  const guest = await guestContext.newPage();
  const errors: string[] = [];
  manager.on("pageerror", (e) => errors.push(e.name));
  guest.on("pageerror", (e) => errors.push(e.name));
  try {
    await manager.goto("http://127.0.0.1:3001/video/meetings/90001");
    await manager.getByLabel("Ключ менеджера").fill(managerKey);
    await manager.getByRole("button", { name: "Открыть встречу" }).click();
    await manager.getByRole("button", { name: "Создать комнату" }).click();
    await manager.getByRole("button", { name: "Пригласить гостя" }).click();
    const invitationUrl = await manager.getByLabel("Личная ссылка гостя").inputValue();
    await manager.getByRole("button", { name: "Присоединиться", exact: true }).click();
    await expect(manager.getByText("Вы в эфире", { exact: true })).toBeVisible();
    await enableDevices(manager);

    await guest.goto(invitationUrl);
    await expect(guest).toHaveURL("http://127.0.0.1:3001/video/guest");
    await guest.getByRole("button", { name: "Проверить приглашение" }).click();
    await guest.getByLabel("Ваше имя").fill("Тестовый гость");
    await guest.getByRole("button", { name: "Присоединиться", exact: true }).click();
    await expect(guest.getByText("Вы в эфире", { exact: true })).toBeVisible();
    await enableDevices(guest);
    await expect(manager.getByText("2/2", { exact: true })).toBeVisible();
    await expect(guest.getByText("2/2", { exact: true })).toBeVisible();
    await expect.poll(() => receivedAudioAndVideo(manager), { timeout: 30_000 }).toBe(true);
    await expect.poll(() => receivedAudioAndVideo(guest), { timeout: 30_000 }).toBe(true);
    await expect
      .poll(() => guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await manager.screenshot({ path: "../.cache/video-desktop.png", fullPage: true });
    await guest.screenshot({ path: "../.cache/video-mobile.png", fullPage: true });

    // A temporary CRM API outage must not interrupt established media transport.
    await guest.route("**/api/video/guest", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Video service unavailable" }),
      }),
    );
    await expect(guest.locator(".error-notice")).toBeVisible({ timeout: 20_000 });
    await expect(guest.getByText("2/2", { exact: true })).toBeVisible();
    expect(await receivedAudioAndVideo(guest)).toBe(true);
    await guest.unroute("**/api/video/guest");
    await expect(guest.locator(".error-notice")).toHaveCount(0, { timeout: 20_000 });

    const mic = guest.getByRole("button", { name: "Микрофон", exact: true });
    await mic.click();
    await expect(mic).toHaveAttribute("data-lk-enabled", "false");
    await guest.getByRole("button", { name: /Выйти/ }).click();
    await expect(guest.getByText(/Вы вышли из созвона/)).toBeVisible();
    await expect(manager.getByText("1/2", { exact: true })).toBeVisible();
    await guest.getByLabel("Ваше имя").fill("Тестовый гость");
    await guest.getByRole("button", { name: "Присоединиться", exact: true }).click();
    await expect(guest.getByText("Вы в эфире", { exact: true })).toBeVisible();

    await manager.getByRole("button", { name: "Завершить созвон", exact: true }).click();
    await manager.getByRole("button", { name: "Да, завершить созвон" }).click();
    await expect(manager.getByRole("heading", { name: "Созвон завершён" })).toBeVisible();
    await expect(guest.locator(".error-notice")).toBeVisible({ timeout: 20_000 });
    const secret = new URL(invitationUrl).hash.split("=")[1];
    const denied = await request.post("http://127.0.0.1:18001/video/guest/join", {
      data: { invitation: secret, name: "Guest" },
    });
    expect(denied.status()).toBe(403);
    expect(errors).toEqual([]);
  } finally {
    await request
      .post("http://127.0.0.1:18001/video/meetings/90001/close", {
        headers: authorization,
      })
      .catch(() => undefined);
    await managerContext.close();
    await guestContext.close();
  }
});

test("guest with missing or invalid invitation sees a useful error", async ({ page }) => {
  await page.goto("/video/guest");
  await expect(page.getByText(/В ссылке нет приглашения/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Проверить приглашение" })).toBeDisabled();
  await page.goto(`/video/guest#invite=${"x".repeat(43)}`);
  await page.getByRole("button", { name: "Проверить приглашение" }).click();
  await expect(page.locator(".error-notice")).toContainText(/приглашени/i);
});
