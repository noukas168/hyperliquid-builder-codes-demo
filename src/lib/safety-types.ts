/**
 * Shared safety-check types. Kept free of "use client" and of any runtime
 * imports so both the server route and the browser can use them.
 */

export type CheckStatus = "PASS" | "WARN" | "FAIL" | "UNKNOWN";

export type CheckId =
  | "honeypot"
  | "tax"
  | "mintAuthority"
  | "ownerPrivileges"
  | "ownership"
  | "lpLock"
  | "holderConcentration";

export type SafetyCheck = {
  id: CheckId;
  label: string;
  status: CheckStatus;
  /** Plain English. Must read correctly on its own, without the status. */
  detail: string;
  /** Raw value behind the verdict, for the curious. */
  evidence?: string;
};

export type SafetySource = "goplus" | "onchain";

export type SafetyResponse = {
  address: string;
  source: SafetySource;
  checks: SafetyCheck[];
};

/** Row order and labels, shared by both data sources. */
export const CHECK_LABELS: Record<CheckId, string> = {
  honeypot: "Can it be sold",
  tax: "Transfer tax",
  mintAuthority: "Mint authority",
  ownerPrivileges: "Owner privileges",
  ownership: "Ownership",
  lpLock: "Liquidity lock",
  holderConcentration: "Holder concentration",
};

export const CHECK_ORDER: CheckId[] = [
  "honeypot",
  "tax",
  "mintAuthority",
  "ownerPrivileges",
  "ownership",
  "lpLock",
  "holderConcentration",
];

/** A check we could not make is never a pass. */
export function unknownCheck(id: CheckId, detail: string): SafetyCheck {
  return { id, label: CHECK_LABELS[id], status: "UNKNOWN", detail };
}
