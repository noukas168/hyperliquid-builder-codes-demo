import { type NextRequest, NextResponse } from "next/server";
import { buildUpstreamParams, callZeroEx } from "@/lib/zeroex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // A firm quote returns executable calldata, so 0x requires the taker.
  const built = buildUpstreamParams(req.nextUrl.searchParams, { requireTaker: true });
  if ("failure" in built) {
    return NextResponse.json(built.failure.body, { status: built.failure.status });
  }
  const { status, body } = await callZeroEx("quote", built.params);
  return NextResponse.json(body, { status });
}
