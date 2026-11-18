import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const servers = base.webServer as {
  command: string;
  url: string;
  env?: Record<string, string>;
  timeout?: number;
}[];

export default defineConfig({
  ...base,
  testMatch: "video.spec.ts",
  timeout: 90_000,
  webServer: servers.map((server, index) =>
    index === 0 ? { ...server, env: { ...server.env, CRM_E2E_VIDEO: "1" } } : server,
  ),
  use: {
    ...base.use,
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
    permissions: ["camera", "microphone"],
    trace: "off",
  },
});
