import { expect, test } from "@playwright/test";
import {
  amountInput,
  breakdownRow,
  forbidLiveCalls,
  priceBody,
  SENTINEL,
  stubPrice,
  stubSafety,
  TOKENS,
  UNRELATED_TOKEN,
  visit,
} from "./helpers";

const BASIS_FEE = { amount: "1000000000000000", token: SENTINEL, type: "volume" };
const ZEROEX_FEE = { amount: "150000000000000000", token: TOKENS.USDT.address, type: "volume" };

/**
 * Regression cover for 447cb1a. Both fees come straight from the live quote and
 * can be denominated in either side of the trade, so each has to be formatted
 * against its own token rather than against the sell token.
 */
test.describe("quote fee breakdown", () => {
  test("shows the Basis fee and the 0x protocol fee as separate lines", async ({ page }) => {
    await forbidLiveCalls(page);
    await stubSafety(page);
    await stubPrice(
      page,
      priceBody({ fees: { integratorFee: BASIS_FEE, zeroExFee: ZEROEX_FEE, gasFee: null } }),
    );

    await visit(page);
    await amountInput(page).fill("1");
    await expect(page.getByText("600.000000", { exact: true })).toBeVisible();

    // The Basis fee is on the sell side, the 0x fee on the buy side. Each is
    // labelled in its own token, which is the part that used to be wrong.
    await expect(breakdownRow(page, "basis-fee")).toContainText("0.001000 BNB");
    await expect(breakdownRow(page, "zeroex-fee")).toContainText("0.150000 USDT");
  });

  test("omits a fee denominated in neither side of the trade", async ({ page }) => {
    await forbidLiveCalls(page);
    await stubSafety(page);
    await stubPrice(
      page,
      priceBody({
        fees: {
          integratorFee: BASIS_FEE,
          zeroExFee: { amount: "150000000000000000", token: UNRELATED_TOKEN, type: "volume" },
          gasFee: null,
        },
      }),
    );

    await visit(page);
    await amountInput(page).fill("1");
    await expect(page.getByText("600.000000", { exact: true })).toBeVisible();

    await expect(breakdownRow(page, "basis-fee")).toContainText("0.001000 BNB");
    // Printing it against the sell token's decimals would be a wrong number, so
    // the line goes away entirely.
    await expect(page.getByText("0x protocol fee")).toHaveCount(0);
  });

  test("shows no fee line at all when the quote reports none", async ({ page }) => {
    await forbidLiveCalls(page);
    await stubSafety(page);
    await stubPrice(page, priceBody());

    await visit(page);
    await amountInput(page).fill("1");
    await expect(page.getByText("600.000000", { exact: true })).toBeVisible();

    await expect(page.getByText("Basis fee")).toHaveCount(0);
    await expect(page.getByText("0x protocol fee")).toHaveCount(0);
    // The rest of the breakdown still renders, so absence is the fee lines
    // being omitted rather than the whole block failing to appear.
    await expect(page.getByText("Minimum received")).toBeVisible();
  });
});
