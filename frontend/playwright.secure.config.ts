import { defineConfig } from "@playwright/test";
import video from "./playwright.video.config";

const servers = video.webServer as {
  command: string;
  url: string;
  env?: Record<string, string>;
  timeout?: number;
}[];
export default defineConfig({
  ...video,
  webServer: servers.map((server, index) =>
    index === 0 ? { ...server, env: { ...server.env, CRM_E2E_HTTPS: "1" } } : server,
  ),
  use: {
    ...video.use,
    baseURL: "https://localhost:18443",
    ignoreHTTPSErrors: true,
    launchOptions: { args: [...video.use!.launchOptions!.args!, "--ignore-certificate-errors"] },
  },
});
