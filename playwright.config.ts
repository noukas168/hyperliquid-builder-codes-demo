import { defineConfig, devices } from "@playwright/test";

/**
 * The suite drives the real app but never the real upstreams. Every test stubs
 * /api/safety and /api/0x/* at the network boundary, for three reasons:
 *
 *  - GoPlus rate limits an unauthenticated caller after roughly ten lookups, so
 *    a suite that called it for real would start failing on its own second run.
 *  - The defects these tests cover are all client-side state machine bugs
 *    (debounce, cancellation, per-token correctness, fee scaling). Stubbing the
 *    boundary isolates exactly that layer.
 *  - Stubs make response timing an input, which is what lets the stale-render
 *    test reproduce a race deterministically instead of hoping to catch it.
 *
 * Nothing here touches approval, execution or fee-routing logic; no test signs
 * or sends a transaction, and no wallet is ever connected.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Several tests deliberately wait out a stubbed delay, and the first test to
  // reach a cold dev server pays for compiling the route.
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  /**
   * One worker, deliberately.
   *
   * Each worker is a browser competing with the Next dev server for the same
   * cores, and every stubbed response round-trips through the Playwright driver
   * rather than being served in-process. On a busy machine that starves: the
   * whole suite failed on stub timeouts at three and four workers while passing
   * serially. Measured on this repo, serial is also the faster of the two, 34s
   * against 41s, because the parallel workers were mostly contending.
   *
   * This is a gate that runs before every debrief, so a wrong answer costs more
   * than a slow one.
   */
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  // Several assertions wait on a stubbed response that crosses the Playwright
  // driver, which is slower than a same-process fetch under load.
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000",
    // Reuse a dev server the developer already has running; in CI always start
    // a clean one.
    reuseExistingServer: !process.env.CI,
    // First request to a cold Next dev server compiles the route, which can
    // take a while on a slow machine.
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
