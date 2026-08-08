import { expect, test } from "@playwright/test";
import { amountInput, forbidLiveCalls, safetyPanel, stubPrice, stubSafety, visit } from "./helpers";

/**
 * Regression cover for 9defc96: the card used to be gated behind a connected
 * wallet, so a visitor saw a headline and an empty page. Everything except the
 * final button has to work with no account.
 */
test.describe("a visitor with no wallet", () => {
  test("sees the card, a live quote and the safety checks", async ({ page }) => {
    await forbidLiveCalls(page);
    await stubSafety(page);
    const price = await stubPrice(page);

    await visit(page);

    // Present before any amount is typed and before any wallet exists.
    await expect(page.getByRole("heading", { name: "Swap" })).toBeVisible();
    await expect(safetyPanel(page)).toBeVisible();

    await amountInput(page).fill("1");

    // 600 USDT against 1 BNB, from the stubbed quote.
    await expect(page.getByText("600.000000", { exact: true })).toBeVisible();
    await expect(page.getByText("597.000000 USDT")).toBeVisible();
    expect(price.urls.length).toBeGreaterThan(0);

    // 0x only needs a taker for a firm quote, so the indicative one must go out
    // without an account rather than wait for one.
    expect(new URL(price.urls[0]).searchParams.get("taker")).toBeNull();
  });

  test("asks for a wallet only at the final button", async ({ page }) => {
    await forbidLiveCalls(page);
    await stubSafety(page);
    await stubPrice(page);

    await visit(page);
    await amountInput(page).fill("1");
    await expect(page.getByText("600.000000", { exact: true })).toBeVisible();

    await expect(page.getByRole("button", { name: "Connect wallet", exact: true })).toBeVisible();
    // The wrong-network box is for connected wallets only; it must not appear
    // for someone who has not connected at all.
    await expect(page.getByText("Wrong network.")).toHaveCount(0);
  });
});
