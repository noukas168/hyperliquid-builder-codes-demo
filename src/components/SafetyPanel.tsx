"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { BNB_CHAIN } from "@/config/chains";
import { checkHoneypot, checkMintAuthority, checkOwnership, checkTax } from "@/lib/safety";
import {
  CHECK_LABELS,
  CHECK_ORDER,
  type CheckId,
  type CheckStatus,
  type SafetyCheck,
  type SafetyResponse,
  unknownCheck,
} from "@/lib/safety-types";

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

/** On-chain equivalents, used only when GoPlus is unavailable. */
const ONCHAIN_FALLBACK: Partial<Record<CheckId, (address: Address) => Promise<SafetyCheck>>> = {
  honeypot: checkHoneypot,
  tax: checkTax,
  mintAuthority: checkMintAuthority,
  ownership: checkOwnership,
};

function StatusDot({ status }: { status: CheckStatus }) {
  return (
    <span
      aria-hidden
      className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: STATUS_COLOR[status] }}
    />
  );
}

function CheckRowView({ check }: { check: SafetyCheck }) {
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

function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <StatusDot status="UNKNOWN" />
      <div className="flex flex-col">
        <span className="text-xs font-semibold text-white">{label}</span>
        <span className="text-[11px] text-hl-muted">Checking…</span>
      </div>
    </div>
  );
}

/**
 * Fallback row: runs the on-chain check for this id, or renders UNKNOWN when
 * there is no on-chain equivalent. Each row loads independently.
 */
function FallbackRow({ address, id }: { address: Address; id: CheckId }) {
  const run = ONCHAIN_FALLBACK[id];
  const { data, isLoading, isError } = useQuery({
    queryKey: ["safety-onchain", id, address.toLowerCase()],
    queryFn: () => {
      if (!run) throw new Error("no on-chain equivalent");
      return run(address);
    },
    enabled: Boolean(run),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  if (!run) {
    return (
      <CheckRowView
        check={unknownCheck(
          id,
          "This check needs the security data service, which is unavailable right now. It cannot be answered from the chain alone.",
        )}
      />
    );
  }
  if (isLoading) return <LoadingRow label={CHECK_LABELS[id]} />;
  if (isError || !data) {
    return (
      <CheckRowView
        check={unknownCheck(
          id,
          "This check could not be completed, so nothing is known either way.",
        )}
      />
    );
  }
  return <CheckRowView check={data} />;
}

export default function SafetyPanel({ address }: { address: Address }) {
  const {
    data,
    isLoading,
    isError: goPlusFailed,
  } = useQuery<SafetyResponse>({
    queryKey: ["safety-goplus", address.toLowerCase()],
    queryFn: async () => {
      const qs = new URLSearchParams({ address, chainId: String(BNB_CHAIN.chainId) });
      const res = await fetch(`/api/safety?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Security lookup failed");
      return json as SafetyResponse;
    },
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  const byId = new Map((data?.checks ?? []).map((c) => [c.id, c]));

  return (
    <section className="flex flex-col gap-1 rounded-md border border-hl-border bg-hl-bg p-3">
      <div className="flex flex-col gap-1 pb-1">
        <h3 className="text-sm font-semibold text-white">Safety checks</h3>
        <p className="text-[11px] leading-snug text-hl-muted">
          Finding no red flag is not the same as finding it safe — a grey result means we could not
          check, not that the token passed.
        </p>
        {goPlusFailed && (
          <p className="text-[11px] font-semibold text-hl-warning">
            The security data service is unavailable, so these fall back to what we can read
            directly from BNB Chain. Fewer checks are possible this way.
          </p>
        )}
      </div>

      <div className="flex flex-col divide-y divide-hl-border">
        {CHECK_ORDER.map((id) => {
          if (isLoading) return <LoadingRow key={id} label={CHECK_LABELS[id]} />;
          if (goPlusFailed) return <FallbackRow key={id} address={address} id={id} />;
          const check = byId.get(id);
          return check ? (
            <CheckRowView key={id} check={check} />
          ) : (
            // A row the service simply did not answer is unknown, never a pass.
            <CheckRowView
              key={id}
              check={unknownCheck(id, "This check was not returned for this token.")}
            />
          );
        })}
      </div>

      <p className="border-hl-border border-t pt-2 text-[11px] font-semibold text-hl-muted">
        Basis checks what the chain can prove. It cannot tell you a token is safe.
      </p>
    </section>
  );
}
