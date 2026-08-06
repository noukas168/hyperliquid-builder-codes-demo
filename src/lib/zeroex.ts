export const ZEROX_BASE_URL = "https://api.0x.org/swap/allowance-holder";
export const SUPPORTED_CHAIN_ID = 56;

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const UINT_RE = /^[0-9]{1,78}$/;

export type ProxyFailure = { status: number; body: { error: string; detail?: string } };

const fail = (status: number, error: string, detail?: string): ProxyFailure => ({
  status,
  body: detail ? { error, detail } : { error },
});

/**
 * Build the upstream query string from client-supplied params.
 * Client controls: chainId, sellToken, buyToken, sellAmount, taker, slippageBps.
 * Server controls: swapFeeRecipient, swapFeeBps, swapFeeToken.
 */
export function buildUpstreamParams(
  search: URLSearchParams,
  opts: { requireTaker: boolean },
): { params: URLSearchParams } | { failure: ProxyFailure } {
  const chainId = search.get("chainId") ?? String(SUPPORTED_CHAIN_ID);
  if (chainId !== String(SUPPORTED_CHAIN_ID)) {
    return { failure: fail(400, `Unsupported chainId — only ${SUPPORTED_CHAIN_ID} is enabled`) };
  }

  const sellToken = search.get("sellToken") ?? "";
  const buyToken = search.get("buyToken") ?? "";
  if (!ADDRESS_RE.test(sellToken)) return { failure: fail(400, "Invalid sellToken") };
  if (!ADDRESS_RE.test(buyToken)) return { failure: fail(400, "Invalid buyToken") };
  if (sellToken.toLowerCase() === buyToken.toLowerCase()) {
    return { failure: fail(400, "sellToken and buyToken must differ") };
  }

  const sellAmount = search.get("sellAmount") ?? "";
  if (!UINT_RE.test(sellAmount)) return { failure: fail(400, "Invalid sellAmount") };
  if (BigInt(sellAmount) <= BigInt(0)) {
    return { failure: fail(400, "sellAmount must be greater than zero") };
  }

  const taker = search.get("taker");
  if (taker && !ADDRESS_RE.test(taker)) return { failure: fail(400, "Invalid taker address") };
  if (opts.requireTaker && !taker) {
    return { failure: fail(400, "taker is required for a firm quote") };
  }

  const params = new URLSearchParams({ chainId, sellToken, buyToken, sellAmount });
  if (taker) params.set("taker", taker);

  const rawSlippage = search.get("slippageBps");
  if (rawSlippage !== null) {
    if (!UINT_RE.test(rawSlippage)) return { failure: fail(400, "Invalid slippageBps") };
    const slippage = Number(rawSlippage);
    if (slippage > 10_000) return { failure: fail(400, "slippageBps must be <= 10000") };
    params.set("slippageBps", String(slippage));
  }

  // ── Server-injected fee params. Never read from the client. ──
  const recipient = process.env.ZEROX_FEE_RECIPIENT;
  const feeBps = process.env.ZEROX_FEE_BPS;
  if (recipient && feeBps) {
    if (!ADDRESS_RE.test(recipient)) {
      return { failure: fail(500, "Swap fee is misconfigured") }; // detail withheld
    }
    if (!UINT_RE.test(feeBps) || Number(feeBps) > 1000) {
      return { failure: fail(500, "Swap fee is misconfigured") }; // 0x caps swapFeeBps at 1000
    }
    // Invariant: the fee is always denominated in the sellToken. Verified live
    // against 0x on BNB Chain for both ERC-20 and native (sentinel) sells.
    if (Number(feeBps) > 0) {
      params.set("swapFeeRecipient", recipient);
      params.set("swapFeeBps", feeBps);
      params.set("swapFeeToken", sellToken);
    }
  }

  return { params };
}

/** Call 0x with the API key in headers only. Never returns the key to a caller. */
export async function callZeroEx(
  endpoint: "price" | "quote",
  params: URLSearchParams,
): Promise<{ status: number; body: unknown }> {
  const apiKey = process.env.ZEROX_API_KEY;
  if (!apiKey) return { status: 500, body: { error: "Swap API is not configured" } };

  let res: Response;
  try {
    res = await fetch(`${ZEROX_BASE_URL}/${endpoint}?${params.toString()}`, {
      headers: { "0x-api-key": apiKey, "0x-version": "v2" },
      cache: "no-store",
    });
  } catch {
    // Deliberately swallow the cause — it can contain the request URL/headers.
    return { status: 502, body: { error: "Could not reach the 0x API" } };
  }

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    return { status: 502, body: { error: "Malformed response from the 0x API" } };
  }

  if (!res.ok) {
    const upstream = parsed as { reason?: string; message?: string; data?: unknown };
    return {
      status: res.status,
      body: {
        error: upstream.reason ?? upstream.message ?? "Swap request rejected",
        detail: upstream.data ?? undefined,
      },
    };
  }

  return { status: 200, body: parsed };
}
