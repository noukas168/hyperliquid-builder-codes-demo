"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

/**
 * Being throttled is not the same as the service being down, and the panel
 * must not conflate them: one clears itself in a moment, the other does not.
 * `status` is carried so the retry policy can tell a transient failure from a
 * settled answer.
 */
class SafetyLookupError extends Error {
  readonly status: number;
  readonly throttled: boolean;
  constructor(message: string, status: number, throttled: boolean) {
    super(message);
    this.name = "SafetyLookupError";
    this.status = status;
    this.throttled = throttled;
  }
}

/**
 * Two retries, not three. The whole chain has to finish in about the time a
 * user is willing to look at a spinner: a longer budget turns a throttle into
 * a hang, and every token switched to during it shows the same stalled panel,
 * which reads as the panel being stuck on one token.
 */
const MAX_LOOKUP_RETRIES = 2;

/**
 * Retry only what can plausibly succeed on a second ask.
 *
 * 404 means GoPlus has no data for this token. That is a real answer — the
 * token is unindexed — and asking again will return the same thing, so it must
 * settle immediately rather than spin. Other 4xx are our own malformed request
 * and will not fix themselves either. A 429 is the opposite: it says nothing
 * about the token, only that we asked too often, so it is always worth
 * retrying. 5xx and thrown network/parse errors are transient by nature.
 */
function shouldRetryLookup(failureCount: number, error: Error): boolean {
  if (failureCount >= MAX_LOOKUP_RETRIES) return false;
  if (error instanceof SafetyLookupError) {
    if (error.throttled) return true;
    return error.status >= 500;
  }
  // Not a SafetyLookupError: fetch itself threw, or the body would not parse.
  return true;
}

/**
 * Total retry budget is roughly the settle delay plus one more attempt —
 * about 5s for a throttle (1.5s + 3s), 1.5s for anything else (0.5s + 1s).
 *
 * A GoPlus throttle can outlast that; waiting it out is not the job here. Two
 * quick attempts catch a window that has already cleared, and anything longer
 * is caught by the query going stale on failure, which refetches on remount or
 * window refocus. Better to degrade visibly in seconds and recover later than
 * to hold the panel on "Checking…" for half a minute.
 */
function lookupRetryDelay(failureCount: number, error: Error): number {
  const base = error instanceof SafetyLookupError && error.throttled ? 1_500 : 500;
  return Math.min(base * 2 ** failureCount, 5_000);
}

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

/**
 * How long a token must stay selected before we look it up. Clicking through
 * the picker should not spend a GoPlus call on every token passed over — the
 * unauthenticated limit is reached after roughly ten.
 */
const SELECTION_SETTLE_MS = 400;

/** Single source of the key, so the cache probe below cannot drift from it. */
const safetyQueryKey = (address: string) => ["safety-goplus", address.toLowerCase()] as const;

export default function SafetyPanel({ address }: { address: Address }) {
  const queryClient = useQueryClient();

  // The token actually being looked up. Trails `address` by the settle delay,
  // so a token skipped past in under that never triggers a request at all.
  const [settledAddress, setSettledAddress] = useState<Address>(address);
  useEffect(() => {
    const t = setTimeout(() => setSettledAddress(address), SELECTION_SETTLE_MS);
    return () => clearTimeout(t);
  }, [address]);

  /**
   * The settle delay exists only to avoid spending a network lookup on a token
   * being skipped over. An answer already in the client cache costs nothing to
   * show, so waiting would be delay for its own sake — switch back to a token
   * seen a moment ago and its result should be there at once.
   *
   * Only a cached *success* qualifies. React Query stores no data for a failed
   * query, so `getQueryData` returns undefined for one, and an error correctly
   * goes back through the settle delay and the retry policy rather than
   * short-circuiting to a stale verdict.
   */
  const hasCachedResult = Boolean(
    queryClient.getQueryData<SafetyResponse>(safetyQueryKey(address)),
  );
  const lookupAddress = hasCachedResult ? address : settledAddress;

  // True while the selection is still settling. Counts as loading, so the
  // panel never shows one token's verdict under another token's name.
  const settling = lookupAddress.toLowerCase() !== address.toLowerCase();

  const { data, isLoading, isError, error, failureReason } = useQuery<
    SafetyResponse,
    SafetyLookupError
  >({
    queryKey: safetyQueryKey(lookupAddress),
    queryFn: async ({ signal }) => {
      const qs = new URLSearchParams({
        address: lookupAddress,
        chainId: String(BNB_CHAIN.chainId),
      });
      // `signal` is aborted by React Query as soon as this query is superseded
      // or unmounted, so a switch away cancels the request in flight instead
      // of letting it run on and spend rate limit for a token nobody is
      // looking at any more.
      const res = await fetch(`/api/safety?${qs.toString()}`, { signal });
      const json = await res.json();
      if (!res.ok) {
        throw new SafetyLookupError(
          json?.error ?? "Security lookup failed",
          res.status,
          json?.throttled === true,
        );
      }
      // Belt and braces over the query key: the body must name the token that
      // was asked for. A different address — or none at all — is rejected here
      // so it can never reach the render path. Throwing rather than returning
      // it matters: a payload that silently fails the render-time check would
      // leave the panel pending for ever.
      if (
        typeof json?.address !== "string" ||
        json.address.toLowerCase() !== lookupAddress.toLowerCase()
      ) {
        throw new SafetyLookupError(
          "Security lookup returned a different token",
          res.status,
          false,
        );
      }
      return json as SafetyResponse;
    },
    // A successful answer is backed by the server-side cache and never needs
    // re-asking. A failed one must not be frozen in place: going stale lets it
    // retry on remount or when the window regains focus, so a throttle that
    // outlives the retries above still recovers without a page reload.
    staleTime: (query) => (query.state.status === "error" ? 0 : Number.POSITIVE_INFINITY),
    retry: shouldRetryLookup,
    retryDelay: lookupRetryDelay,
  });

  // Only render a payload that names the token currently on screen. React
  // Query keys per address, so this should already hold; asserting it makes a
  // mismatch impossible to display rather than merely unlikely.
  const current = data && data.address.toLowerCase() === address.toLowerCase() ? data : undefined;

  const pending = settling || isLoading || (!current && !isError);
  const goPlusFailed = !settling && isError;

  /**
   * `error` is only set once the retry chain gives up. `failureReason` carries
   * the most recent failure while retries are still in flight, and React Query
   * clears it on success — so this reports a throttle from the first 429
   * rather than making the user wait out the retries to be told why.
   */
  const lastFailure = error ?? failureReason;
  const throttled = !settling && lastFailure?.throttled === true;
  const byId = new Map((current?.checks ?? []).map((c) => [c.id, c]));

  return (
    <section className="flex flex-col gap-1 rounded-md border border-hl-border bg-hl-bg p-3">
      <div className="flex flex-col gap-1 pb-1">
        <h3 className="text-sm font-semibold text-white">Safety checks</h3>
        <p className="text-[11px] leading-snug text-hl-muted">
          Finding no red flag is not the same as finding it safe. A grey result means we could not
          check, not that the token passed.
        </p>
        {throttled ? (
          <p className="text-[11px] font-semibold text-hl-warning">
            These checks are temporarily throttled — too many security lookups were made in a short
            time.{" "}
            {pending
              ? // Still retrying: the rows below say "checking", so promising
                // on-chain results here would be describing the wrong screen.
                "Trying again for a few seconds."
              : "Only what we can read directly from BNB Chain is shown below. Wait a moment and check again."}
          </p>
        ) : (
          goPlusFailed && (
            <p className="text-[11px] font-semibold text-hl-warning">
              The security data service is unavailable, so these fall back to what we can read
              directly from BNB Chain. Fewer checks are possible this way.
            </p>
          )
        )}
      </div>

      <div className="flex flex-col divide-y divide-hl-border">
        {CHECK_ORDER.map((id) => {
          if (pending) return <LoadingRow key={id} id={id} />;
          if (goPlusFailed) return <FallbackRow key={id} address={lookupAddress} id={id} />;
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
