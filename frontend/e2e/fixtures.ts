import { test as base } from "@playwright/test";
import { loginPage, loginRequest } from "./auth-helpers";

export { expect } from "@playwright/test";
export const test = base.extend({
  request: async ({ playwright }, provide) => {
    const initial = await playwright.request.newContext();
    const headers = await loginRequest(initial);
    const state = await initial.storageState();
    await initial.dispose();
    const authenticated = await playwright.request.newContext({
      storageState: state,
      extraHTTPHeaders: headers,
    });
    await provide(authenticated);
    await authenticated.dispose();
  },
  page: async ({ page }, provide) => {
    await page.goto("/login");
    await loginPage(page);
    await provide(page);
  },
});
