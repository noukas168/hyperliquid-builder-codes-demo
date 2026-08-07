"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import {
  type CheckId,
  type CheckStatus,
  checkHoneypot,
  checkMintAuthority,
  checkOwnership,
  checkTax,
  type SafetyCheck,
} from "@/lib/safety";

/**
 * Traffic-light colours. None of these is the brand red (#E5341F), which is
 * reserved for the logo and the Swap button.
 */
const STATUS_COLOR: Record<CheckStatus, string> = {
  PASS: "#3FB950",
  WARN: "#F59F00",
  FAIL: "#F03E3E",
  UNKNOWN: "#8B949E",
};

const STATUS_WORD: Record<CheckStatus, string> = {
  PASS: "No problem found",
  WARN: "Take care",
  FAIL: "Serious problem",
  UNKNOWN: "Could not check",
};

type CheckConfig = {
  id: CheckId;
  label: string;
  run: (address: Address) => Promise<SafetyCheck>;
};

const CHECKS: CheckConfig[] = [
  { id: "honeypot", label: "Can it be sold", run: checkHoneypot },
  { id: "tax", label: "Transfer tax", run: checkTax },
  { id: "mintAuthority", label: "Mint authority", run: checkMintAuthority },
  { id: "ownership", label: "Ownership", run: checkOwnership },
];

function StatusDot({ status }: { status: CheckStatus }) {
  return (
    <span
      aria-hidden
      className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: STATUS_COLOR[status] }}
    />
  );
}

/** One row, loading independently so a slow check never blocks the panel. */
function CheckRow({ address, config }: { address: Address; config: CheckConfig }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["safety", config.id, address.toLowerCase()],
    queryFn: () => config.run(address),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-start gap-2 py-1.5">
        <StatusDot status="UNKNOWN" />
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-white">{config.label}</span>
          <span className="text-[11px] text-hl-muted">Checking on BNB Chain…</span>
        </div>
      </div>
    );
  }

  // A failed check is a check we could not make — never a pass.
  const check: SafetyCheck =
    isError || !data
      ? {
          id: config.id,
          label: config.label,
          status: "UNKNOWN",
          detail: "This check could not be completed, so nothing is known either way.",
        }
      : data;

  return (
    <div className="flex items-start gap-2 py-1.5">
      <StatusDot status={check.status} />
      <div className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-white">{check.label}</span>
          <span
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: STATUS_COLOR[check.status] }}
          >
            {STATUS_WORD[check.status]}
          </span>
        </span>
        <span className="text-[11px] leading-snug text-hl-text">{check.detail}</span>
        {check.evidence && (
          <span className="mt-0.5 break-all font-mono text-[10px] text-hl-muted">
            {check.evidence}
          </span>
        )}
      </div>
    </div>
  );
}

export default function SafetyPanel({ address }: { address: Address }) {
  return (
    <section className="flex flex-col gap-1 rounded-md border border-hl-border bg-hl-bg p-3">
      <div className="flex flex-col gap-1 pb-1">
        <h3 className="text-sm font-semibold text-white">Safety checks</h3>
        <p className="text-[11px] leading-snug text-hl-muted">
          These read what BNB Chain can prove about this contract. Finding no red flag is not the
          same as finding it safe — a grey result means we could not check, not that the token
          passed.
        </p>
      </div>

      <div className="flex flex-col divide-y divide-hl-border">
        {CHECKS.map((config) => (
          <CheckRow key={config.id} address={address} config={config} />
        ))}
      </div>

      <p className="border-hl-border border-t pt-2 text-[11px] font-semibold text-hl-muted">
        Basis checks what the chain can prove. It cannot tell you a token is safe.
      </p>
    </section>
  );
}
