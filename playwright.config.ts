import { defineConfig, devices } from "@playwright/test";

// Support environments that route external traffic through an egress proxy
// (e.g. devcontainers). Chromium needs the proxy explicitly configured so the
// app's Supabase API calls can reach the internet.
function parseProxy() {
  const raw = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return {
      server: `${url.protocol}//${url.hostname}:${url.port}`,
      username: url.username || undefined,
      password: url.password || undefined,
      bypass: "localhost,127.0.0.1",
    };
  } catch {
    return { server: raw, bypass: "localhost,127.0.0.1" };
  }
}

const proxy = parseProxy();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30_000,

  use: {
    baseURL: "http://localhost:8081",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Route browser traffic through the egress proxy when one is configured.
    ...(proxy ? { proxy, ignoreHTTPSErrors: true } : {}),
  },

  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "./e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "pnpm dev:web",
    url: "http://localhost:8081",
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
});
