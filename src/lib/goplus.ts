import {
  CHECK_LABELS,
  type CheckId,
  figureCheck,
  figureUnknown,
  type SafetyCheck,
  unknownCheck,
} from "@/lib/safety-types";

/**
 * GoPlus Token Security API. Verified live against chain 56:
 *   GET https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses=0x...
 *   → { code: 1, message: "OK", result: { "<lowercased address>": {...} } }
 *
 * Encoding notes, all confirmed against live responses:
 *  - Boolean-ish fields are the STRINGS "1" / "0", and are omitted entirely
 *    when GoPlus has no answer — omission must map to UNKNOWN, never PASS.
 *  - buy_tax / sell_tax are decimal FRACTIONS where 1 = 100% (SAFEMOON
 *    returns buy_tax "1", meaning a 100% buy tax).
 *  - holders[].is_locked / lp_holders[].is_locked are NUMBERS (1 / 0),
 *    not strings, unlike the top-level flags.
 *  - percent fields are decimal fractions where 1 = 100%.
 *  - A `code: 1` response can still carry an empty `result` for a token
 *    GoPlus has not indexed.
 */
const GOPLUS_BASE = "https://api.gopluslabs.io/api/v1/token_security";

const BURN_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]);

type GoPlusHolder = {
  address?: string;
  percent?: string;
  is_locked?: number | string;
  is_contract?: number | string;
  tag?: string;
};

type GoPlusToken = {
  is_honeypot?: string;
  cannot_sell_all?: string;
  buy_tax?: string;
  sell_tax?: string;
  is_mintable?: string;
  owner_address?: string;
  transfer_pausable?: string;
  can_take_back_ownership?: string;
  hidden_owner?: string;
  owner_change_balance?: string;
  slippage_modifiable?: string;
  personal_slippage_modifiable?: string;
  is_blacklisted?: string;
  selfdestruct?: string;
  cannot_buy?: string;
  holders?: GoPlusHolder[];
  lp_holders?: GoPlusHolder[];
  token_symbol?: string;
};

/** "1" → true, "0" → false, missing/empty → undefined. Accepts numbers too. */
function flag(v: unknown): boolean | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v);
  if (s === "1") return true;
  if (s === "0") return false;
  return undefined;
}

/** Decimal fraction where 1 = 100%. Missing/empty → undefined. */
function fraction(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const pct = (f: number) => `${(f * 100).toFixed(2)}%`;

function check(
  id: CheckId,
  status: SafetyCheck["status"],
  detail: string,
  evidence?: string,
): SafetyCheck {
  return { id, label: CHECK_LABELS[id], status, detail, evidence };
}

// ─────────────────────────── Field mapping ───────────────────────────

function mapHoneypot(t: GoPlusToken): SafetyCheck {
  const honeypot = flag(t.is_honeypot);
  const cannotSellAll = flag(t.cannot_sell_all);

  if (honeypot === true) {
    return check(
      "honeypot",
      "FAIL",
      "GoPlus simulated a sale and could not complete it. Tokens that can be bought but never sold behave exactly like this. Do not trade this.",
      "is_honeypot = 1",
    );
  }
  if (honeypot === undefined) {
    return unknownCheck(
      "honeypot",
      "GoPlus did not report whether this token can be sold. Nothing here says it can be.",
    );
  }
  if (cannotSellAll === true) {
    return check(
      "honeypot",
      "WARN",
      "A sale simulated successfully, but this token stops you selling your whole balance. You will be left holding a portion you cannot exit.",
      "cannot_sell_all = 1",
    );
  }
  return check(
    "honeypot",
    "PASS",
    "GoPlus simulated a sale and it went through. This reflects the token's behaviour when it was last checked, and it can be changed later by whoever controls the contract.",
    "is_honeypot = 0",
  );
}

const TAX_FAIL_FRACTION = 0.05; // 500 bps

function mapTax(t: GoPlusToken): SafetyCheck {
  const buy = fraction(t.buy_tax);
  const sell = fraction(t.sell_tax);

  if (buy === undefined && sell === undefined) {
    return unknownCheck(
      "tax",
      "GoPlus did not report a buy or sell tax for this token. That is not the same as there being none.",
    );
  }

  const worst = Math.max(buy ?? 0, sell ?? 0);
  const evidence = `buy ${buy === undefined ? "unknown" : pct(buy)}, sell ${
    sell === undefined ? "unknown" : pct(sell)
  }`;

  if (worst >= 1) {
    return check(
      "tax",
      "FAIL",
      "This token takes 100% of the trade. In practice that means you cannot get your money back out.",
      evidence,
    );
  }
  if (worst > TAX_FAIL_FRACTION) {
    return check(
      "tax",
      "FAIL",
      `This token takes ${pct(worst)} of every trade. You lose that immediately, on the way in and on the way out.`,
      evidence,
    );
  }
  if (worst > 0) {
    return check(
      "tax",
      "WARN",
      `This token takes a cut of each trade (${evidence}). You will receive less than the quoted amount.`,
      evidence,
    );
  }
  // One side known to be zero while the other is missing is not a clean pass.
  if (buy === undefined || sell === undefined) {
    return unknownCheck(
      "tax",
      `Only part of the tax picture was reported (${evidence}), so the full cost of trading is unknown.`,
    );
  }
  return check(
    "tax",
    "PASS",
    "No buy or sell tax was reported. A tax can still be switched on later if the contract allows it.",
    evidence,
  );
}

function mapMint(t: GoPlusToken): SafetyCheck {
  const mintable = flag(t.is_mintable);
  if (mintable === undefined) {
    return unknownCheck(
      "mintAuthority",
      "GoPlus did not report whether new supply can be created for this token.",
    );
  }
  if (mintable) {
    return check(
      "mintAuthority",
      "WARN",
      "New tokens can be created. Whoever holds that power can dilute every existing holder, including you.",
      "is_mintable = 1",
    );
  }
  return check(
    "mintAuthority",
    "PASS",
    "No mint function was found, so the supply cannot simply be increased.",
    "is_mintable = 0",
  );
}

/** Privileges the owner retains, beyond merely existing. */
const SEVERE_PRIVILEGES: Array<[keyof GoPlusToken, string]> = [
  ["hidden_owner", "the real owner is hidden"],
  ["can_take_back_ownership", "ownership can be reclaimed after being given up"],
  ["selfdestruct", "the contract can destroy itself"],
];

const MODERATE_PRIVILEGES: Array<[keyof GoPlusToken, string]> = [
  ["transfer_pausable", "all trading can be paused"],
  ["is_blacklisted", "individual wallets can be blocked from selling"],
  ["owner_change_balance", "balances can be changed directly"],
  ["slippage_modifiable", "the tax rate can be changed"],
  ["personal_slippage_modifiable", "a different tax can be set for one wallet"],
  ["cannot_buy", "buying can be blocked"],
];

function mapOwnerPrivileges(t: GoPlusToken): SafetyCheck {
  const severe = SEVERE_PRIVILEGES.filter(([f]) => flag(t[f]) === true).map(([, d]) => d);
  const moderate = MODERATE_PRIVILEGES.filter(([f]) => flag(t[f]) === true).map(([, d]) => d);
  const anyReported = [...SEVERE_PRIVILEGES, ...MODERATE_PRIVILEGES].some(
    ([f]) => flag(t[f]) !== undefined,
  );

  if (!anyReported) {
    return unknownCheck(
      "ownerPrivileges",
      "GoPlus did not report what powers this contract's owner holds.",
    );
  }
  if (severe.length > 0) {
    return check(
      "ownerPrivileges",
      "FAIL",
      `This contract gives its owner powers used to trap holders: ${severe.join(", ")}. Treat this token as unsafe.`,
      severe.join("; "),
    );
  }
  if (moderate.length > 0) {
    return check(
      "ownerPrivileges",
      "WARN",
      `The owner can still change how this token behaves: ${moderate.join(", ")}. That may be routine, or it may be used against you.`,
      moderate.join("; "),
    );
  }
  return check(
    "ownerPrivileges",
    "PASS",
    "None of the common owner powers were found: pausing trading, blacklisting wallets, rewriting balances, or changing the tax.",
  );
}

function mapOwnership(t: GoPlusToken): SafetyCheck {
  const owner = t.owner_address;
  if (owner === undefined) {
    return unknownCheck(
      "ownership",
      "GoPlus did not report an owner for this contract. It may have none, or use a permission system that is not visible here.",
    );
  }
  if (owner === "" || BURN_ADDRESSES.has(owner.toLowerCase())) {
    return check(
      "ownership",
      "PASS",
      "Ownership has been given up, so owner-only functions can no longer be called. This does not rule out powers built in elsewhere.",
      owner === "" ? "no owner" : owner,
    );
  }
  return check(
    "ownership",
    "WARN",
    "One address still owns this contract and can call whatever owner-only functions it defines.",
    owner,
  );
}

/** LP held at a burn address is gone for good, which counts as locked. */
function isLockedHolder(h: GoPlusHolder): boolean {
  if (flag(h.is_locked) === true) return true;
  return Boolean(h.address && BURN_ADDRESSES.has(h.address.toLowerCase()));
}

/**
 * Figure row, not a verdict. How much of the listed liquidity is locked or
 * burned. Whether a given figure is acceptable depends on the token's age
 * and structure, which we cannot judge, so we report the number and stop.
 */
function mapLpLock(t: GoPlusToken): SafetyCheck {
  const lp = t.lp_holders;
  if (!Array.isArray(lp) || lp.length === 0) return figureUnknown("lpLock");

  let locked = 0;
  let measured = 0;
  for (const h of lp) {
    const p = fraction(h.percent);
    if (p === undefined) continue;
    measured += p;
    if (isLockedHolder(h)) locked += p;
  }

  if (measured === 0) return figureUnknown("lpLock");
  return figureCheck("lpLock", `Liquidity locked: ${pct(locked)}`);
}

/**
 * Figure row, not a verdict. Combined share of the top holders GoPlus lists,
 * with burn addresses excluded because that supply can never be sold.
 */
function mapHolderConcentration(t: GoPlusToken): SafetyCheck {
  const holders = t.holders;
  if (!Array.isArray(holders) || holders.length === 0) {
    return figureUnknown("holderConcentration");
  }

  let total = 0;
  let measured = false;
  for (const h of holders) {
    const p = fraction(h.percent);
    if (p === undefined) continue;
    measured = true;
    if (h.address && BURN_ADDRESSES.has(h.address.toLowerCase())) continue;
    total += p;
  }

  if (!measured) return figureUnknown("holderConcentration");
  return figureCheck("holderConcentration", `Top 10 holders: ${pct(total)} (burn excluded)`);
}

// ─────────────────────────── Fetch + assemble ───────────────────────────

export type GoPlusOutcome =
  | { ok: true; checks: SafetyCheck[]; cached: boolean }
  | { ok: false; status: number; error: string };

/**
 * GoPlus reports rate limiting INSIDE a HTTP 200 body, as code 4029 with
 * message "too many requests". It does not send HTTP 429 — a `res.status`
 * check for that never fires. Verified live against chain 56: bursting the
 * endpoint returns `{"code":4029,"message":"too many requests"}` with a 200.
 */
const GOPLUS_RATE_LIMITED_CODE = 4029;

/**
 * Successful lookups only, keyed by `chainId:loweredAddress`.
 *
 * Five minutes. The figures behind these rows — ownership, mint authority,
 * tax, honeypot behaviour — are contract properties that change rarely, but
 * this is a warning system, so staleness has a real cost: a token whose owner
 * switches on a tax should stop reading PASS quickly. Five minutes is short
 * enough that such a change surfaces within one sitting, and long enough that
 * switching back and forth between tokens in a single browsing session costs
 * one GoPlus call per token rather than one per click. That matters because
 * the unauthenticated limit is reached after roughly ten calls.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Bound the map: any address can be looked up, so this must not grow freely. */
const CACHE_MAX_ENTRIES = 500;

type CacheEntry = { checks: SafetyCheck[]; expiresAt: number };

const cache = new Map<string, CacheEntry>();

const cacheKey = (address: string, chainId: number) => `${chainId}:${address.toLowerCase()}`;

function cacheGet(key: string, now: number): SafetyCheck[] | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= now) {
    cache.delete(key);
    return undefined;
  }
  return hit.checks;
}

function cacheSet(key: string, checks: SafetyCheck[], now: number) {
  // Re-inserting moves the key to the end, so the first key is the oldest.
  cache.delete(key);
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(key, { checks, expiresAt: now + CACHE_TTL_MS });
}

/**
 * Verbose per-call tracing, including a prefix of the raw response body.
 * Useful when GoPlus starts answering in a shape we do not expect, noisy
 * otherwise, so it is off unless GOPLUS_DEBUG is set. Read once at module
 * load: changing it takes a restart.
 */
const GOPLUS_DEBUG = /^(1|true)$/i.test(process.env.GOPLUS_DEBUG ?? "");

function line(address: string, fields: Record<string, unknown>) {
  return `[goplus] ${address} ${Object.entries(fields)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" ")}`;
}

/**
 * Failures worth seeing in any environment. Kept to parsed fields — never the
 * raw body — so it stays a single short line. A swallowed rate limit is what
 * made this bug invisible in the first place; it should not go quiet again.
 */
function logGoPlus(address: string, fields: Record<string, unknown>) {
  console.warn(line(address, fields));
}

/** Off by default. Carries the response body, so it must stay opt-in. */
function debugGoPlus(address: string, fields: Record<string, unknown>) {
  if (!GOPLUS_DEBUG) return;
  console.log(line(address, fields));
}

const BODY_LOG_LIMIT = 400;

export async function fetchGoPlusChecks(address: string, chainId: number): Promise<GoPlusOutcome> {
  const now = Date.now();
  const key = cacheKey(address, chainId);

  const cached = cacheGet(key, now);
  if (cached) {
    debugGoPlus(address, { cache: "hit" });
    return { ok: true, checks: cached, cached: true };
  }

  const url = `${GOPLUS_BASE}/${chainId}?contract_addresses=${address}`;
  const token = process.env.GOPLUS_ACCESS_TOKEN;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    });
  } catch (e) {
    logGoPlus(address, { phase: "network", authed: Boolean(token), err: String(e) });
    return { ok: false, status: 502, error: "Could not reach the GoPlus security API" };
  }

  const raw = await res.text().catch(() => "");
  debugGoPlus(address, {
    httpStatus: res.status,
    authed: Boolean(token),
    contentType: res.headers.get("content-type") ?? "none",
    bodyBytes: raw.length,
    body: raw.slice(0, BODY_LOG_LIMIT),
  });

  if (!res.ok) {
    return { ok: false, status: 502, error: "The GoPlus security API rejected the request" };
  }

  let body: { code?: number; message?: string; result?: Record<string, GoPlusToken> };
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, status: 502, error: "Malformed response from the GoPlus security API" };
  }

  // Rate limiting arrives here, not as a status code. Never cached: this says
  // nothing about the token, only that we asked too often.
  if (body.code === GOPLUS_RATE_LIMITED_CODE) {
    logGoPlus(address, { rejected: "rateLimit", code: body.code, message: body.message ?? null });
    return { ok: false, status: 429, error: "GoPlus rate limit reached" };
  }

  if (body.code !== 1) {
    logGoPlus(address, {
      rejected: "code",
      code: body.code ?? null,
      message: body.message ?? null,
    });
    return { ok: false, status: 502, error: "GoPlus could not complete this lookup" };
  }

  // The result is keyed by the LOWERCASED address, whatever casing we sent.
  const token_ = body.result?.[address.toLowerCase()];
  if (!token_) {
    // A successful call with no entry: GoPlus has not analysed this token.
    // Everything is unknown — which is emphatically not a pass.
    return { ok: false, status: 404, error: "GoPlus has no security data for this token" };
  }

  const checks = [
    mapHoneypot(token_),
    mapTax(token_),
    mapMint(token_),
    mapOwnerPrivileges(token_),
    mapOwnership(token_),
    mapLpLock(token_),
    mapHolderConcentration(token_),
  ];

  // Only a complete, successful lookup is worth keeping. Errors and rate-limit
  // responses are deliberately not cached — caching them would turn a
  // momentary throttle into minutes of "we could not check".
  cacheSet(key, checks, now);

  return { ok: true, checks, cached: false };
}
