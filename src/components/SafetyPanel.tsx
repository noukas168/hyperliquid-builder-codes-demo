"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { Address } from "viem";
import { BNB_CHAIN } from "@/config/chains";
import { checkHoneypot, checkMintAuthority, checkOwnership, checkTax } from "@/lib/safety";
import {
  CHECK_HELP,
  CHECK_LABELS,
  CHECK_ORDER,
  type CheckId,
  type CheckStatus,
  FIGURE_PREFIX,
  figureUnknown,
  isFigureCheck,
  missingCheck,
  type SafetyCheck,
  type SafetyResponse,
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

/**
 * Question-mark affordance. Opens on hover for a mouse, on tap for touch
 * (pointerType is checked so a tap doesn't fire hover and immediately
 * un-toggle), and on keyboard focus. Escape closes it.
 */
function HelpTip({ id, detail }: { id: CheckId; detail?: string }) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = pinned || hovered;

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`What does “${CHECK_LABELS[id]}” mean?`}
        aria-expanded={open}
        onClick={() => setPinned((v) => !v)}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setHovered(true);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setHovered(false);
        }}
        onFocus={() => setHovered(true)}
        onBlur={() => {
          setHovered(false);
          setPinned(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setPinned(false);
            setHovered(false);
          }
        }}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-hl-border text-[9px] font-bold text-hl-muted hover:border-hl-muted hover:text-white"
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute top-5 left-0 z-20 w-60 rounded border border-hl-border bg-hl-card p-2 text-[11px] font-normal leading-snug text-hl-text shadow-lg"
        >
          <span className="block">{CHECK_HELP[id]}</span>
          {detail && <span className="mt-1 block text-hl-muted">{detail}</span>}
        </span>
      )}
    </span>
  );
}

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/** Raw field value. Addresses link out rather than sitting there bare. */
function EvidenceValue({ value }: { value: string }) {
  if (ADDRESS_RE.test(value)) {
    return (
      <a
        href={BNB_CHAIN.addressUrl(value)}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-[10px] text-hl-muted underline hover:text-white"
      >
        {value.slice(0, 6)}…{value.slice(-4)} on BscScan
      </a>
    );
  }
  return <span className="break-all font-mono text-[10px] text-hl-muted">{value}</span>;
}

function StatusDot({ status }: { status: CheckStatus }) {
  return (
    <span
      aria-hidden
      className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: STATUS_COLOR[status] }}
    />
  );
}

/** Bare figure: no dot, no colour, no status pill. */
function FigureRowView({ check }: { check: SafetyCheck }) {
  return (
    <div className="flex items-center gap-1.5 py-1.5">
      <span className="text-xs text-hl-text">{check.detail}</span>
      <HelpTip id={check.id} />
    </div>
  );
}

function CheckRowView({ check }: { check: SafetyCheck }) {
  if (check.kind === "figure") return <FigureRowView check={check} />;

  return (
    <div className="flex items-start gap-2 py-1.5">
      <StatusDot status={check.status} />
      <div className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-white">{check.label}</span>
            <HelpTip id={check.id} detail={check.detail} />
          </span>
          <span
            className="text-[10px] font-semibold uppercase tracking-wide"
            style={{ color: STATUS_COLOR[check.status] }}
          >
            {STATUS_WORD[check.status]}
          </span>
        </span>
        {check.evidence && (
          <span className="mt-0.5">
            <EvidenceValue value={check.evidence} />
          </span>
        )}
      </div>
    </div>
  );
}

function LoadingRow({ id }: { id: CheckId }) {
  if (isFigureCheck(id)) {
    return (
      <div className="flex items-center gap-1.5 py-1.5">
        <span className="text-xs text-hl-muted">{FIGURE_PREFIX[id]}: checking…</span>
        <HelpTip id={id} />
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 py-1.5">
      <StatusDot status="UNKNOWN" />
      <div className="flex flex-col">
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-white">{CHECK_LABELS[id]}</span>
          <HelpTip id={id} />
        </span>
        <span className="text-[11px] text-hl-muted">Checking…</span>
      </div>
    </div>
  );
}

/**
 * Fallback row: runs the on-chain check for this id, or renders the
 * "no answer" row when there is no on-chain equivalent.
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
        check={missingCheck(
          id,
          "This check needs the security data service, which is unavailable right now. It cannot be answered from the chain alone.",
        )}
      />
    );
  }
  if (isLoading) return <LoadingRow id={id} />;
  if (isError || !data) {
    return (
      <CheckRowView
        check={missingCheck(
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
          Finding no red flag is not the same as finding it safe. A grey result means we could not
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
          if (isLoading) return <LoadingRow key={id} id={id} />;
          if (goPlusFailed) return <FallbackRow key={id} address={address} id={id} />;
          const check = byId.get(id);
          if (check) return <CheckRowView key={id} check={check} />;
          // A row the service did not answer is unknown, never a pass.
          return isFigureCheck(id) ? (
            <FigureRowView key={id} check={figureUnknown(id)} />
          ) : (
            <CheckRowView
              key={id}
              check={missingCheck(id, "This check was not returned for this token.")}
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
