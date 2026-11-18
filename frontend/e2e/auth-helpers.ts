import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const TEST_PASSWORD = "public-test-password-only";
export async function loginPage(page: Page, login = "manager1") {
  await page.getByLabel("Логин", { exact: true }).fill(login);
  await page.getByLabel("Пароль", { exact: true }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Войти в CRM" }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}
export async function loginRequest(
  request: APIRequestContext,
  origin = "http://127.0.0.1:3001",
  login = "manager1",
) {
  const challenge = await request.get(`${origin}/api/auth/csrf`);
  const { csrf_token } = await challenge.json();
  const response = await request.post(`${origin}/api/auth/login`, {
    data: { login, password: TEST_PASSWORD },
    headers: { Origin: origin, "X-CSRF-Token": csrf_token },
  });
  expect(response.status()).toBe(200);
  const state = await request.storageState();
  const csrf = state.cookies.find((c) => c.name.endsWith("crm_csrf"))?.value;
  if (!csrf) throw new Error("Missing test CSRF cookie");
  return { Origin: origin, "X-CSRF-Token": csrf };
}
