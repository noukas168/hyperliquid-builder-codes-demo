# Working rules for this repo

These are the standing rules the existing commit history already follows. They
are written down so they survive a context reset, not to introduce anything new.
Where a rule came from a specific commit, that commit is cited so the reasoning
can be read in full.

## What this repo is

Two products in one Next.js app.

- **Basis**, at `/`. Non-custodial spot trading on BNB Chain (chain 56) through
  0x, with contract-level safety checks shown before a trade.
- **Hyperliquid builder codes demo**, at `/hyperliquid`. The original reference
  implementation. Reachable by URL only, deliberately: nothing in the UI links
  to it, so it stays working without competing with Basis for the front door
  (`b03bbbd`).

## The rule that outranks the others

**Never change approval, execution or fee-routing logic as a side effect of
another task.** Every commit that does not touch them says so explicitly in its
final line, and that line is a claim to be checked before it is written, not a
formality.

Concretely, that covers:

- the approve path, which requests exactly the sell amount and never unlimited
  (`8d2d7fa`)
- swap construction and submission
- the fee recipient, the fee bps, and which side of the trade a fee is taken on

Display of a fee is not fee routing. `447cb1a` changed how fees are shown and
said so. If a change is display only, say that it is display only.

## Security posture

**Never claim a token is safe.** The panel reports what the chain can prove and
nothing more. This shapes several rules that look fussy and are not:

- A check that could not run is `UNKNOWN`, never `PASS`. A grey row means "we
  could not check", not "it passed".
- There is deliberately no aggregate verdict field (`8d2d7fa`).
- Mint detection caps at `WARN`, never `FAIL`, and returns `UNKNOWN` behind an
  EIP-1967 proxy where the bytecode scan would mean nothing.
- The honeypot check returns `UNKNOWN` unless it can run truthfully. Only a
  revert yields `FAIL`. A successful simulation is still `UNKNOWN`, because
  pairs are commonly exempt from a honeypot's own restrictions.
- Contract verification status is omitted rather than guessed.
- "Address checked by Basis" means only that the contract address is the real
  one for that token. It is not a judgement that the token is safe. The wording
  on both the positive and negative badge is chosen to keep that distinction
  (`447cb1a`).
- Non-curated tokens are labelled in warning amber, never brand red.

**Never conflate a throttle with an outage.** A rate limit clears in moments; an
outage does not. Reporting one as the other both misinforms the user and
devalues the banner for the cases where it is true (`3987cf6`, `afc91c6`).
Likewise, a condition that is simply out of scope is not a failure: the native
coin is an EIP-7528 sentinel with no contract, so it gets its own state rather
than an "unavailable" banner (`ef40394`).

**Never cache a failure.** Successful GoPlus lookups are cached server-side for
five minutes, keyed by chain ID and address. Errors and rate-limit responses are
never cached, because caching a throttle turns a momentary limit into minutes of
"we could not check" (`3987cf6`). Safety verdicts are sent `Cache-Control:
no-store` so no shared cache holds them.

**Never silently swallow a rate limit.** A swallowed 4029 body is what hid the
bug in `3987cf6`. Verbose tracing sits behind `GOPLUS_DEBUG` and is off by
default, but rate limits and unexpected codes are logged in every environment.

**Degrade visibly in seconds, not in half a minute.** The retry budget is
roughly the settle delay plus one more attempt. A longer budget turns a throttle
into a hang, and every token switched to during it renders an identical stalled
panel, which reads as the panel being stuck (`a8be318`).

## Secrets and environment

- `NEXT_PUBLIC_` ships the value to the browser, where anyone can lift it from
  the bundle or the network tab. Say so wherever such a variable is documented.
  Do not imply the exposure is safe by convention: a Dwellir key carries no
  domain, origin, referrer or IP restriction, so a quota is the only damage
  limit (`b746324`).
- Unset is the safe default. `constants.ts` falls back to public endpoints.
- Server-side keys (`ZEROX_API_KEY`, `GOPLUS_ACCESS_TOKEN`) stay server-side and
  are reached through a route, never from the browser.
- `.env.local.example` must match the live values it documents. It once said
  `ZEROX_FEE_BPS=25` while the live value was 100, which would have had a reader
  ship a quarter of the intended fee.

## Verified identifiers

Address literals are not changed, and not trusted, without verification against
both a block explorer and the chain itself. What was confirmed is recorded in a
comment beside the literal, so a later reader can tell a checked address from a
remembered one.

Verified on BscScan on **2026-08-06** and cross-checked by reading the contracts
on chain 56 (`5608a32`):

| Identifier | Address | Decimals | What was confirmed |
| --- | --- | --- | --- |
| PancakeSwap V2 factory | `0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73` | n/a | Contract `PancakeFactory`, labelled "PancakeSwap: Factory v2". 2,664,023 pairs. `getPair(WBNB, USDT)` returns a pair whose `token0`/`token1` are those two tokens and whose `factory()` points back at this address. |
| WBNB | `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` | 18 | Symbol `WBNB`, name "Wrapped BNB". |
| USDT | `0x55d398326f99059fF775485246999027B3197955` | 18 | Symbol `USDT`, on-chain name "Tether USD". **18 on BSC, not the 6 it uses on Ethereum and Arbitrum.** |
| USDC | `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d` | 18 | Symbol `USDC`, on-chain name "USD Coin". **18 on BSC, not 6.** |
| CAKE | `0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82` | 18 | Name "PancakeSwap Token". On-chain symbol is `Cake`; displayed as `CAKE`, which is how the project brands it. |
| Native BNB | `0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE` | 18 | **Not verified on BscScan, because there is nothing there to verify.** This is the EIP-7528 sentinel, not a deployed contract. It must never be used in an ERC-20 `approve()` call. |

The factory round trip is the part worth keeping: a lookalike factory could
return a plausible pair address, but not one that names it as its own factory.

The decimals column closes a real hazard. Getting USDT or USDC wrong on BNB
Chain misprices a trade by 10^12.

## The build loop

1. **Reproduce or measure before fixing.** The history does this with a real
   browser and real numbers: "throttled banner first shown at 778ms", "the
   tenth request failed", "the retry chain was 5s + 10s + 20s". A fix aimed at a
   guessed cause is not a fix.
2. **Find the actual cause, not the nearest plausible one.** `3987cf6` is the
   worked example: the `res.status === 429` check had never once fired, because
   GoPlus signals a rate limit inside an HTTP 200 body.
3. **Fix it, and keep the scope of the fix honest.** If something adjacent is
   wrong, either fix it and say so in its own paragraph, or leave it and say so.
4. **Verify by observation.** Drive the real component, read the real response,
   count the real requests. Then write down what was observed, with figures.
5. **Run `npm run verify`.** See below.
6. **Commit, then debrief.**

## The check

```
npm run verify
```

runs, in order and stopping at the first failure:

- `tsc --noEmit`
- `biome check .` over `src/`, `tests/` and `playwright.config.ts`
- `playwright test`, the end-to-end suite in `tests/e2e/`

**`npm run verify` runs before every debrief.** A debrief reports its result
with the actual numbers: exit status, and the warning count if it is non-zero.
There are currently 14 pre-existing Biome warnings, none of them errors; a
change that leaves that count unchanged should say so, and a change that adds to
it should explain why.

The suite stubs `/api/safety` and `/api/0x/*` at the network boundary and never
calls the real upstreams. GoPlus rate limits an unauthenticated caller after
roughly ten lookups, so a suite that called it for real would fail on its own
second run. Stubbing also makes response timing an input, which is what lets the
stale-render test reproduce a race deterministically. No test connects a wallet
or signs anything.

The suite runs on a single worker on purpose, and the reasoning is in
`playwright.config.ts`. Every stubbed response round-trips through the
Playwright driver, so parallel workers contend with the dev server for cores and
the stubs start answering later than the assertions waiting on them. The whole
suite failed that way at three and four workers while passing serially, and
serial is also the faster of the two here. Raising the worker count is not a
free speed-up.

A test that cannot fail is not cover. When adding one, confirm it fails against
the defect it claims to catch before trusting it. Two of these were checked that
way: removing the settle delay breaks the debounce test, and removing the
render-time address guard breaks the stale-verdict test.

## Interface design

Basis has its own token layer, `--bs-*` in `globals.css`, exposed to Tailwind as
the `bs` colour namespace and the `text-bs-*` type scale. It is deliberately
separate from the `hl-*` tokens, which are shared with the Hyperliquid wizard:
redefining those restyles `/hyperliquid` as a side effect.

**Every colour means exactly one thing.**

- **Brand** `#E23A2E` is the identity layer only: the mark, the primary action,
  the rule across the top of the page. It never touches a price, a balance, an
  address or a status. A brand colour carrying data makes the loudest signal in
  the interface meaningless.
- **Success** `#2FBF71` is a positive verdict, and nothing else. It is not a
  confirmation colour for wallet chrome.
- **Alarm** `#FF2D55` is a negative verdict. It is a hotter, pinker red than the
  brand brick on purpose, so the two never read as the same signal.
- **Warning** `#F0A21A` is a qualified verdict.
- **Uncertainty has no colour.** Unknown and could-not-check states use the
  neutral ramp. Tinting them would present an absence of a verdict as a verdict,
  which is the same mistake as a grey row reading as a pass.

Neutrals come from one ordered ramp, `--bs-n0` through `--bs-n9`, so two greys
are either the same decision or visibly different ones. Never introduce a
one-off grey.

**Figures are the product.** Every numeral renders in the monospace face with
tabular figures, via the `.bs-num` class. Numbers are brighter and larger than
the labels beside them; labels sit a step down in both size and neutral. Where
figures stack, the numeral is right-aligned and its unit sits in its own
fixed-width column, so decimal points line up down the table rather than being
pushed around by the length of the unit.

Density over decoration: no gradients, no shadows, no radii. Hairline borders
and spacing do the separating, not boxes nested inside boxes.

## Commit messages

Follow the shape the history already uses:

- Subject line in the imperative, naming the change in plain words.
- First paragraph: the symptom, or what was wrong, in user terms.
- Then: why it happened, and what changed, with the reasoning that makes the
  choice non-obvious.
- Then: what was verified, with concrete figures.
- Anything deliberately not done, and why.
- Final line, when true: `No approval, execution or fee-routing logic changed.`

Em dashes are fine here. This is not user-facing copy.

## Debrief format

A debrief is the message that closes a task. It is for a reader deciding whether
to trust the work, so it leads with the outcome and is specific about evidence.

- **Lead with what changed and whether it works.** No preamble.
- **Report the checks with real output.** Exit codes, counts, test names.
- **Separate what was observed from what was inferred.** "Verified in a browser"
  and "follows from the previous commit" are different claims and are labelled
  differently.
- **State plainly what was not done, and why.** Scope left out, checks not run,
  claims not verified. Do not let silence imply coverage.
- **Flag anything the user's framing got wrong**, rather than quietly encoding
  the wrong version into the work.
- **Do not hedge on finished work**, and do not narrate the process of getting
  there beyond what a reader needs.

## No em dashes in user-facing copy

Any string a user can read in the app carries no em dash (`—`). Rewrite as
sentence breaks or lists. Placeholder glyphs use an en dash (`–`).

This covers component copy, button and badge labels, error and status messages,
and document titles. It does **not** cover code comments or commit messages,
which are scoped out deliberately (`9defc96`, `447cb1a`).
