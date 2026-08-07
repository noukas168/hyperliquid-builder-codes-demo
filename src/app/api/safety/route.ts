import { type NextRequest, NextResponse } from "next/server";
import { fetchGoPlusChecks } from "@/lib/goplus";
import type { SafetyResponse } from "@/lib/safety-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const SUPPORTED_CHAIN_ID = 56;

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") ?? "";
  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  const chainId = req.nextUrl.searchParams.get("chainId") ?? String(SUPPORTED_CHAIN_ID);
  if (chainId !== String(SUPPORTED_CHAIN_ID)) {
    return NextResponse.json(
      { error: `Unsupported chainId — only ${SUPPORTED_CHAIN_ID} is enabled` },
      { status: 400 },
    );
  }

  const outcome = await fetchGoPlusChecks(address, SUPPORTED_CHAIN_ID);
  if (!outcome.ok) {
    // The client falls back to on-chain checks on any non-200 here. A 429 is
    // called out separately so the panel can say "throttled, try again"
    // rather than the false claim that the service is down.
    return NextResponse.json(
      { error: outcome.error, throttled: outcome.status === 429 },
      { status: outcome.status },
    );
  }

  const body: SafetyResponse = { address, source: "goplus", checks: outcome.checks };
  return NextResponse.json(body, {
    status: 200,
    // Never let a shared cache hold safety verdicts; the server-side cache in
    // fetchGoPlusChecks is the only intended layer.
    headers: { "Cache-Control": "no-store", "X-Safety-Cache": outcome.cached ? "hit" : "miss" },
  });
}
