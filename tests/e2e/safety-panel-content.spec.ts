import { expect, test } from "@playwright/test";
import { CHECK_ORDER } from "../../src/lib/safety-types";
import {
  evidenceFor,
  forbidLiveCalls,
  SENTINEL,
  safetyPanel,
  selectBuyToken,
  stubPrice,
  stubSafety,
  TOKENS,
  verdictRow,
  visit,
} from "./helpers";

/**
 * The panel must render the selected token's own answers, in the right rows,
 * with the right status words. Each stubbed row carries `SYMBOL/checkId` as its
 * evidence, so a single assertion pins both the token and the row.
 */
test.describe("safety panel, per-token content", () => {
  test("renders every check for the selected token and nothing from another", async ({ page }) => {
    await forbidLiveCalls(page);
    await stubSafety(page);
    await stubPrice(page);

    await visit(page);
    const panel = safetyPanel(page);

    for (const id of CHECK_ORDER) {
      await expect(panel).toContainText(evidenceFor("USDT", id));
    }

    await selectBuyToken(page, TOKENS.CAKE);
    for (const id of CHECK_ORDER) {
      await expect(panel).toContainText(evidenceFor("CAKE", id));
      await expect(panel).not.toContainText(evidenceFor("USDT", id));
    }
  });

  test("puts each status word on its own row", async ({ page }) => {
    await forbidLiveCalls(page);
    await stubSafety(page);
    await stubPrice(page);

    await visit(page);

    // USDT is stubbed as clean throughout.
    await expect(verdictRow(page, "honeypot")).toContainText("No problem found");
    await expect(verdictRow(page, "tax")).toContainText("No problem found");

    // CAKE is stubbed FAIL on honeypot and WARN on tax, and those must land on
    // their own rows rather than colouring the whole panel.
    await selectBuyToken(page, TOKENS.CAKE);
    await expect(verdictRow(page, "honeypot")).toContainText("Serious problem");
    await expect(verdictRow(page, "tax")).toContainText("Take care");
    await expect(verdictRow(page, "mintAuthority")).toContainText("No problem found");

    // USDC is stubbed UNKNOWN on ownership: a check we could not make is never
    // allowed to read as a pass.
    await selectBuyToken(page, TOKENS.USDC);
    await expect(verdictRow(page, "ownership")).toContainText("Could not check");
  });

  test("treats the native coin as out of scope, not as a failed lookup", async ({ page }) => {
    await forbidLiveCalls(page);
    const safety = await stubSafety(page);
    await stubPrice(page);

    await visit(page);
    await expect(safetyPanel(page)).toContainText(evidenceFor("USDT", "honeypot"));

    await selectBuyToken(page, TOKENS.BNB);

    const panel = safetyPanel(page);
    await expect(panel).toContainText("There is no contract here to do any of them");
    await expect(panel).toContainText("This is not a verdict that BNB is a safe thing to hold");
    await expect(panel).not.toContainText("The security data service is unavailable");
    await expect(panel).not.toContainText("Checking…");

    // The sentinel is not a deployed contract, so no lookup may be spent on it.
    expect(safety.requests).not.toContain(SENTINEL.toLowerCase());
  });
});
