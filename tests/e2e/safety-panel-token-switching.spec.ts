import { expect, test } from "@playwright/test";
import {
  buyTokenButton,
  evidenceFor,
  forbidLiveCalls,
  panelRenders,
  recordPanelRenders,
  safetyPanel,
  selectBuyToken,
  stubPrice,
  stubSafety,
  TOKENS,
  visit,
} from "./helpers";

/**
 * Regression cover for 00e0318, e99034d and a8be318: the safety panel spending
 * a GoPlus lookup on every token clicked past, and showing one token's verdict
 * under another token's name.
 */
test.describe("safety panel, switching tokens", () => {
  test("waits for the selection to settle before spending a lookup", async ({ page }) => {
    await forbidLiveCalls(page);
    const safety = await stubSafety(page);
    await stubPrice(page);

    await visit(page);
    await expect(safetyPanel(page)).toContainText(evidenceFor("USDT", "honeypot"));

    // Open the picker first so the measurement starts at the selection itself
    // and not at the click that opened the list.
    await buyTokenButton(page).click();
    const cake = TOKENS.CAKE;
    const truncated = `${cake.address.slice(0, 6)}…${cake.address.slice(-4)}`;
    const selectedAt = Date.now();
    await page.getByRole("button", { name: new RegExp(truncated) }).click();

    await expect(safetyPanel(page)).toContainText(evidenceFor("CAKE", "honeypot"));

    // The settle delay is 400ms and a timer can only fire late, so this bound
    // holds however slow the machine is. Without the delay the lookup would go
    // out within a few ms of the click.
    const cakeRequestIndex = safety.requests.indexOf(cake.address.toLowerCase());
    expect(cakeRequestIndex).toBeGreaterThanOrEqual(0);
    expect(safety.requestedAt[cakeRequestIndex] - selectedAt).toBeGreaterThanOrEqual(300);
  });

  test("a slow answer for a token switched away from never lands on the new one", async ({
    page,
  }) => {
    await forbidLiveCalls(page);
    // CAKE answers slowly, so its response is still in flight when the user
    // moves on. This is the race in 00e0318, made deterministic.
    const safety = await stubSafety(page, { [TOKENS.CAKE.address]: 2_500 });
    await stubPrice(page);

    await visit(page);
    await expect(safetyPanel(page)).toContainText(evidenceFor("USDT", "honeypot"));

    await selectBuyToken(page, TOKENS.CAKE);
    // Long enough for the settle delay to elapse and the slow lookup to start.
    await page.waitForTimeout(800);
    expect(safety.requests).toContain(TOKENS.CAKE.address.toLowerCase());

    await selectBuyToken(page, TOKENS.USDC);
    await expect(safetyPanel(page)).toContainText(evidenceFor("USDC", "honeypot"));

    // CAKE's answer arrives about here. It must not replace what is on screen.
    await page.waitForTimeout(2_500);
    await expect(safetyPanel(page)).toContainText(evidenceFor("USDC", "honeypot"));
    await expect(safetyPanel(page)).not.toContainText(evidenceFor("CAKE", "honeypot"));
  });

  test("switching back to a token already checked skips both the delay and the lookup", async ({
    page,
  }) => {
    await forbidLiveCalls(page);
    // A slow stub widens the gap between the cached path and the network path:
    // uncached costs 400ms of settle plus 800ms of response, cached costs none.
    const safety = await stubSafety(page, { [TOKENS.CAKE.address]: 800 });
    await stubPrice(page);

    await visit(page);
    await expect(safetyPanel(page)).toContainText(evidenceFor("USDT", "honeypot"));

    await selectBuyToken(page, TOKENS.CAKE);
    await expect(safetyPanel(page)).toContainText(evidenceFor("CAKE", "honeypot"));

    await selectBuyToken(page, TOKENS.USDC);
    await expect(safetyPanel(page)).toContainText(evidenceFor("USDC", "honeypot"));

    const lookupsBefore = safety.requests.length;
    await selectBuyToken(page, TOKENS.CAKE);
    await expect(safetyPanel(page)).toContainText(evidenceFor("CAKE", "honeypot"), {
      timeout: 600,
    });
    expect(safety.requests.length).toBe(lookupsBefore);
  });

  test("never shows the previous token's verdict under the new token's name", async ({ page }) => {
    await forbidLiveCalls(page);
    const safety = await stubSafety(page, { [TOKENS.USDC.address]: 1_200 });
    await stubPrice(page);

    await visit(page);
    await expect(safetyPanel(page)).toContainText(evidenceFor("USDT", "honeypot"));

    // Every render from here on is recorded. A stale verdict is visible only
    // briefly, so asserting on the settled state would miss it entirely.
    await recordPanelRenders(page);
    await selectBuyToken(page, TOKENS.USDC);
    await expect(safetyPanel(page)).toContainText(evidenceFor("USDC", "honeypot"));

    const stale = (await panelRenders(page)).filter(
      (r) => r.buy.startsWith("USDC") && r.text.includes(evidenceFor("USDT", "honeypot")),
    );
    expect(stale).toEqual([]);
    expect(safety.requests).not.toContain(TOKENS.BNB.address.toLowerCase());
  });
});
