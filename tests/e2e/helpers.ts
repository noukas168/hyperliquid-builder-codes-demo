import type { Locator, Page } from "@playwright/test";
import {
  BNB_TOKENS,
  getToken,
  NATIVE_TOKEN_SENTINEL,
  type TokenInfo,
} from "../../src/config/tokens";
import {
  CHECK_LABELS,
  CHECK_ORDER,
  type CheckId,
  type CheckStatus,
  FIGURE_PREFIX,
  isFigureCheck,
  type SafetyCheck,
  type SafetyResponse,
} from "../../src/lib/safety-types";

/**
 * Token fixtures are imported from src rather than restated here. The addresses
 * carry a BscScan verification recorded in CLAUDE.md; a copy in the test tree
 * would be a second, unverified source of the same constants.
 */
export const TOKENS = {
  BNB: BNB_TOKENS[0],
  WBNB: BNB_TOKENS[1],
  USDT: BNB_TOKENS[2],
  USDC: BNB_TOKENS[3],
  CAKE: BNB_TOKENS[4],
} satisfies Record<string, TokenInfo>;

/** A token address that is on neither side of any trade the tests set up. */
export const UNRELATED_TOKEN = "0x1111111111111111111111111111111111111111";

/**
 * Statuses that differ per token, so a test can prove the panel is rendering
 * the selected token's answer and not a neighbour's. Anything unlisted is PASS.
 */
const STATUS_OVERRIDES: Record<string, Partial<Record<CheckId, CheckStatus>>> = {
  CAKE: { honeypot: "FAIL", tax: "WARN" },
  USDC: { ownership: "UNKNOWN" },
};

/**
 * Every row carries `SYMBOL/checkId` as its evidence, which is unique per token
 * per row. An assertion on that string therefore pins both which token the
 * panel is showing and which row the value landed in.
 */
export function evidenceFor(symbol: string, id: CheckId): string {
  return `${symbol}/${id}`;
}

function checkFor(symbol: string, id: CheckId): SafetyCheck {
  if (isFigureCheck(id)) {
    return {
      id,
      label: CHECK_LABELS[id],
      status: "UNKNOWN",
      kind: "figure",
      detail: `${FIGURE_PREFIX[id]}: ${evidenceFor(symbol, id)}`,
    };
  }
  return {
    id,
    label: CHECK_LABELS[id],
    status: STATUS_OVERRIDES[symbol]?.[id] ?? "PASS",
    kind: "verdict",
    detail: `Stubbed ${id} answer for ${symbol}.`,
    evidence: evidenceFor(symbol, id),
  };
}

export function safetyPayload(address: string): SafetyResponse {
  const symbol = getToken(address)?.symbol ?? "CUSTOM";
  return {
    address,
    source: "goplus",
    checks: CHECK_ORDER.map((id) => checkFor(symbol, id)),
  };
}

export type SafetyStub = {
  /** Lower-cased addresses, in the order the browser asked for them. */
  requests: string[];
  /** Wall-clock ms at which each request above arrived, same indices. */
  requestedAt: number[];
};

/**
 * Stub /api/safety. `delays` holds a per-address response delay in ms, which is
 * how the stale-render test forces a slow answer to land after the user has
 * already switched away.
 */
export async function stubSafety(
  page: Page,
  delays: Record<string, number> = {},
): Promise<SafetyStub> {
  const stub: SafetyStub = { requests: [], requestedAt: [] };
  const normalisedDelays = Object.fromEntries(
    Object.entries(delays).map(([addr, ms]) => [addr.toLowerCase(), ms]),
  );

  await page.route("**/api/safety*", async (route) => {
    const address = new URL(route.request().url()).searchParams.get("address") ?? "";
    stub.requests.push(address.toLowerCase());
    stub.requestedAt.push(Date.now());

    const delay = normalisedDelays[address.toLowerCase()] ?? 0;
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: { "Cache-Control": "no-store" },
        body: JSON.stringify(safetyPayload(address)),
      });
    } catch {
      // A delayed response whose request React Query has since aborted. That
      // cancellation is the behaviour under test, so it is not an error here.
    }
  });

  return stub;
}

/** A 1 BNB to 600 USDT quote. Both tokens are 18 decimals on BNB Chain. */
export function priceBody(overrides: Record<string, unknown> = {}) {
  return {
    liquidityAvailable: true,
    sellAmount: "1000000000000000000",
    buyAmount: "600000000000000000000",
    minBuyAmount: "597000000000000000000",
    gas: "210000",
    route: { fills: [{ source: "PancakeSwap_V2" }] },
    fees: { integratorFee: null, zeroExFee: null, gasFee: null },
    issues: { allowance: null },
    ...overrides,
  };
}

/** Stub /api/0x/price and record every URL the browser asked for. */
export async function stubPrice(
  page: Page,
  body: Record<string, unknown> = priceBody(),
): Promise<{ urls: string[] }> {
  const calls: { urls: string[] } = { urls: [] };
  await page.route("**/api/0x/price*", async (route) => {
    calls.urls.push(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  return calls;
}

/**
 * Backstop against a live upstream. An /api call that no stub matches would
 * otherwise hit GoPlus or 0x for real and spend rate limit, so it is aborted
 * and surfaces as a visible failure instead.
 *
 * Registered before the stubs, so the stubs take precedence. Keep it to /api:
 * a broader pattern routes the app's own script chunks through Playwright,
 * which under parallel workers is slow enough to stop React hydrating at all.
 */
export async function forbidLiveCalls(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    await route.abort("blockedbyclient");
  });
}

/**
 * Load the app.
 *
 * `domcontentloaded` rather than the default `load`. The root layout pulls a
 * render-blocking stylesheet from fonts.googleapis.com, and on a machine that
 * cannot reach it the load event never fires, so every navigation times out for
 * a reason that has nothing to do with the test. The page is client-rendered
 * and every assertion auto-waits, so nothing here needs the load event.
 */
export async function visit(page: Page): Promise<void> {
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

/**
 * The two token buttons are the only ones whose accessible name ends in the
 * dropdown caret, and they appear sell-then-buy in DOM order.
 */
export function buyTokenButton(page: Page): Locator {
  return page.getByRole("button", { name: /▾$/ }).nth(1);
}

/**
 * Pick a token on the buy side. The picker row is matched on its truncated
 * address, which no other button on the page renders.
 */
export async function selectBuyToken(page: Page, token: TokenInfo): Promise<void> {
  await buyTokenButton(page).click();
  const truncated = `${token.address.slice(0, 6)}…${token.address.slice(-4)}`;
  await page.getByRole("button", { name: new RegExp(truncated) }).click();
}

/**
 * The panel is a <section> nested inside the swap card's own <section>, so both
 * match on text. The inner one comes second in document order.
 */
export function safetyPanel(page: Page): Locator {
  return page.locator("section").filter({ hasText: "Safety checks" }).last();
}

/**
 * The status word ("Serious problem", "Take care") sits beside its label inside
 * the same wrapper span, so this walks up two levels from the label to the
 * element holding both. Tied to the panel's markup on purpose: if the row
 * structure changes, a status assertion should fail loudly rather than silently
 * start matching text from a different row.
 */
export function verdictRow(page: Page, label: string): Locator {
  return safetyPanel(page).getByText(label, { exact: true }).locator("xpath=../..");
}

/** Amount box on the sell side. */
export function amountInput(page: Page): Locator {
  return page.getByPlaceholder("0.0");
}

/** One observed render: what the buy button said, and what the panel showed. */
export type PanelRender = { buy: string; text: string };

type RenderLogWindow = Window & { __panelRenders?: PanelRender[] };

/**
 * Record the panel on every DOM change, paired with the buy token's label.
 *
 * An `expect(...).not.toContainText(...)` cannot catch a stale render: it waits
 * for the condition to become true, so a wrong value shown for 200ms and then
 * replaced still passes. Catching that needs a record of what was on screen at
 * each render, which is what this collects.
 */
export async function recordPanelRenders(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as RenderLogWindow;
    w.__panelRenders = [];
    const record = () => {
      const caretButtons = Array.from(document.querySelectorAll("button")).filter((b) =>
        (b.textContent ?? "").trim().endsWith("▾"),
      );
      const sections = Array.from(document.querySelectorAll("section"));
      w.__panelRenders?.push({
        buy: caretButtons[1]?.textContent?.trim() ?? "",
        text: sections[sections.length - 1]?.textContent ?? "",
      });
    };
    record();
    new MutationObserver(record).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
}

export async function panelRenders(page: Page): Promise<PanelRender[]> {
  return page.evaluate(() => (window as RenderLogWindow).__panelRenders ?? []);
}

export const SENTINEL = NATIVE_TOKEN_SENTINEL;
