import { type NextRequest, NextResponse } from "next/server";
import { buildUpstreamParams, callZeroEx } from "@/lib/zeroex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const built = buildUpstreamParams(req.nextUrl.searchParams, { requireTaker: false });
  if ("failure" in built) {
    return NextResponse.json(built.failure.body, { status: built.failure.status });
  }
  const { status, body } = await callZeroEx("price", built.params);
  return NextResponse.json(body, { status });
}
