import { defineConfig, devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

const config: PlaywrightTestConfig = {
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'reduced-motion',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--force-prefers-reduced-motion'],
        },
        contextOptions: {
          reducedMotion: 'reduce',
        },
      },
    },
  ],
};

if (!process.env.PLAYWRIGHT_SKIP_WEBSERVER) {
  config.webServer = {
    command: 'npm run build && npm run start',
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  };
}

export default defineConfig(config);
