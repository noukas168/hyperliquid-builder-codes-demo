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

/**
 * "verdict" rows carry a PASS/WARN/FAIL/UNKNOWN judgement.
 * "figure" rows report a raw number only — no colour, no status pill —
 * because the honest reading of them depends on context we do not have.
 */
export type CheckKind = "verdict" | "figure";

export type SafetyCheck = {
  id: CheckId;
  label: string;
  /** Ignored for kind === "figure". */
  status: CheckStatus;
  kind?: CheckKind;
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

/**
 * One sentence per row, in plain language. Each says what the number means
 * for someone about to trade, not what the underlying field is called.
 */
export const CHECK_HELP: Record<CheckId, string> = {
  honeypot:
    "Whether a test sale actually went through. If it did not, you could put money in and never get it back out.",
  tax: "The share of every trade the token keeps for itself, which you lose both when you buy and when you sell.",
  mintAuthority:
    "Whether someone can still create new tokens out of thin air, which would make the ones you hold worth less.",
  ownerPrivileges:
    "What the person running this token can still change after you buy, such as pausing all trading or blocking your wallet from selling.",
  ownership:
    "Whether anyone still controls this contract, or control has been given up so nobody can change it any more.",
  lpLock:
    "How much of the money that lets you sell is locked in place, rather than free for someone to pull out and leave you stuck.",
  holderConcentration:
    "How much of the total supply sits in the ten biggest wallets, who could crash the price if they decide to sell.",
};

/** Rows shown as a bare figure, with no verdict attached. */
export const FIGURE_CHECKS: CheckId[] = ["lpLock", "holderConcentration"];

export function isFigureCheck(id: CheckId): boolean {
  return FIGURE_CHECKS.includes(id);
}

/** Left-hand text for figure rows, used for the value and the unknown case. */
export const FIGURE_PREFIX: Partial<Record<CheckId, string>> = {
  holderConcentration: "Top 10 holders",
  lpLock: "Liquidity locked",
};

export function figureCheck(id: CheckId, text: string): SafetyCheck {
  return { id, label: CHECK_LABELS[id], status: "UNKNOWN", kind: "figure", detail: text };
}

/** The figure row when the value is missing — never blank, never a pass. */
export function figureUnknown(id: CheckId): SafetyCheck {
  return figureCheck(id, `${FIGURE_PREFIX[id] ?? CHECK_LABELS[id]}: Unknown`);
}

/** A check we could not make is never a pass. */
export function unknownCheck(id: CheckId, detail: string): SafetyCheck {
  return { id, label: CHECK_LABELS[id], status: "UNKNOWN", kind: "verdict", detail };
}

/** Whichever "we have no answer" row is right for this id. */
export function missingCheck(id: CheckId, detail: string): SafetyCheck {
  return isFigureCheck(id) ? figureUnknown(id) : unknownCheck(id, detail);
}
