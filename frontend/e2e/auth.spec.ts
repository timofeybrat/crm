import { expect, test } from "@playwright/test";
import { loginPage } from "./auth-helpers";

test("login protects CRM, survives reload, and keeps session cookie HttpOnly", async ({ page }) => {
  await page.goto("/companies");
  await expect(page).toHaveURL(/\/login\?next=/);
  expect((await page.request.get("/api/companies")).status()).toBe(401);
  await page.getByLabel("Логин", { exact: true }).fill("manager1");
  await page.getByLabel("Пароль", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Войти в CRM" }).click();
  await expect(page.locator(".error-notice")).toContainText("Неверный логин или пароль");
  await loginPage(page);
  await expect(page.getByRole("heading", { name: "Организации", exact: true })).toBeVisible();
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "crm_session")?.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain("crm_session=");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Организации", exact: true })).toBeVisible();
  await page.screenshot({ path: "../.cache/auth-workspace.png", fullPage: true });
});

test("logout revokes cookies and clears another tab", async ({ page, context }) => {
  await page.goto("/login");
  await loginPage(page);
  const other = await context.newPage();
  await other.goto("/companies");
  await expect(other.getByRole("heading", { name: "Организации", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Выйти из CRM" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(other).toHaveURL(/\/login/);
  expect((await context.request.get("/api/companies")).status()).toBe(401);
});

test("cookie authentication alone cannot mutate CRM without valid CSRF and origin", async ({
  page,
}) => {
  await page.goto("/login");
  await loginPage(page);
  const body = { name: "Rejected CSRF company", bin: "000000088888", phone: "00000" };
  const request = page.context().request;
  expect(
    (
      await request.post("/api/companies", {
        data: body,
        headers: { Origin: "http://127.0.0.1:3001" },
      })
    ).status(),
  ).toBe(403);
  const csrf = (await page.context().cookies()).find((c) => c.name === "crm_csrf")!.value;
  expect(
    (
      await request.post("/api/companies", {
        data: body,
        headers: { Origin: "https://evil.example", "X-CSRF-Token": csrf },
      })
    ).status(),
  ).toBe(403);
  const result = await request.get("/api/companies?search=Rejected%20CSRF%20company");
  expect((await result.json()).total).toBe(0);
});

test("manager sees own scheduling options and backend rejects another manager", async ({
  page,
}) => {
  await page.goto("/login");
  await loginPage(page, "manager2");
  await page.goto("/schedule");
  await page.getByRole("button", { name: "Назначить встречу", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Менеджер", { exact: true }).locator('option:not([value="0"])'),
  ).toHaveCount(1);
  await expect(dialog.getByLabel("Менеджер", { exact: true })).toHaveValue("2");
  const csrf = (await page.context().cookies()).find((c) => c.name === "crm_csrf")!.value;
  const response = await page.context().request.post("/api/meetings", {
    data: { company_id: 999999, manager_id: 1, starts_at: "2030-01-07T05:00:00Z" },
    headers: { Origin: "http://127.0.0.1:3001", "X-CSRF-Token": csrf },
  });
  expect(response.status()).toBe(403);
});
