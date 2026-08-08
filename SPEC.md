# Basis discovery cockpit, Phase 0

Research and specification gate. **Complete.** Nothing beyond this has been
built, per the instruction to stop here for review.

Every claim is labelled **Verified** with how it was established, or **Not
verified**. Where the brief supplied a number it was re-checked rather than
copied, and in one case (0b) the brief's own formula was found to be wrong.

Verified on 2026-08-08.

---

## Trust posture

Basis positions against specific, documented trust failures at its
competitors. This section binds the code, not the marketing.

**What happened elsewhere.** On 2026-02-26 ZachXBT reported that senior Axiom
staff, including business development lead Broox Bauer, used internal "God
mode" admin dashboards to look up private user wallet data and front-run users
over roughly ten months, allegedly netting over $400,000 at a firm generating
about $390M in revenue. Axiom said it was "shocked and disappointed to hear
that someone on our team abused internal customer support tools to look up user
wallets" and removed the access. GMGN holds a 2.1 out of 5 "Poor" Trustpilot
score, 79% one-star across the sampled reviews, with recurring complaints about
copy-trading failures, unexpected fees and pervasive phishing-clone
impersonation, alongside a hot-wallet model.

*(Figures as supplied in the product brief, recorded here as the rationale for
the rules below. Not independently re-verified. They should be before any of it
is published externally.)*

**What Basis therefore never builds.**

- No internal tool that maps a user identity to a wallet address. Not an admin
  dashboard, not a support lookup, not a debug view. The capability is the
  vulnerability: it cannot be abused if it does not exist.
- No logging of wallet-to-session linkage. A wallet address is never written to
  a log, an analytics event or an error report alongside anything identifying a
  person or a session.
- Non-custodial only. No hot wallet holds user funds at any point.
- **A check that could not run is never a pass.** Neutral grey. This is already
  how `SafetyPanel` behaves and extends unchanged to every feed row.

## Hard product exclusions

By decision, not oversight. Do not build even where easy: predictions or event
contracts; perpetuals or leverage; points, rewards or referral programmes;
trading competitions.

## Deferred, explicitly

Wallet tracking; Twitter/X tracking; copy trading; limit orders, take-profit
and stop-loss; bubble maps. Scope decision recorded, not built in Phases 0 to 3.

## Brand red: resolved

The brief specified `#E23A2E`. The shipped token is **`#D6362B`** and **stays**,
decided 2026-08-08. White on `#E23A2E` measures 4.31:1 and fails the 4.5:1 AA
requires for the primary action's label; `#D6362B` measures 4.75:1 and passes.
The two are near indistinguishable by eye. Wherever any document says
`#E23A2E`, read `#D6362B`.

---

# 0b. Graduation threshold. VERIFIED ON-CHAIN. This is the headline finding.

Done first because it is the only item settled by direct measurement rather
than by reading documentation, and because it overturns part of the brief.

## Method

`getTokenInfo(address)` called on **TokenManagerHelper3**,
`0xF251F83e40a78868FcfA3FA4599Dad6494E46034` (BSC), against five live
Four.meme tokens, cross-read against each token's ERC-20 `totalSupply` and
`balanceOf(tokenManager)`. Token addresses taken from Bitquery's own Four.meme
documentation samples.

**Return struct, confirmed decoding cleanly on all five:**

```
(uint256 version, address tokenManager, address quote,
 uint256 lastPrice, uint256 tradingFeeRate, uint256 minTradingFee,
 uint256 launchTime, uint256 offers, uint256 maxOffers,
 uint256 funds, uint256 maxFunds, bool liquidityAdded)
```

`offers` is tokens not yet sold. `maxOffers` is the maximum sellable before the
PancakeSwap pair is created. `quote` of `0x0` means the token trades against
BNB. `tradingFeeRate` is divided by 10,000.

## Results

| Token | Symbol | maxFunds | funds | offers | maxOffers | supply | mgr balance | by offers | by funds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `0x1337…4444` | 没有 | **24 BNB** | 1.3073 | 652,621,148.7 | 800,000,000 | 1,000,000,000 | 852,621,148.7 | 18.42% | 5.44% |
| `0x87c5…4444` | PANDA | **24 BNB** | 0.000349 | 799,954,355.9 | 800,000,000 | 1,000,000,000 | 999,954,355.9 | 0.00% | 0.00% |
| `0x2157…4444` | 福布斯CZ | **18 BNB** | 0.047055 | 791,863,995.8 | 800,000,000 | 1,000,000,000 | 991,863,995.8 | 1.01% | 0.26% |
| `0x1f60…4444` | X WALLET | **18 BNB** | 0 | 800,000,000 | 800,000,000 | 1,000,000,000 | 1,000,000,000 | 0.00% | 0.00% |

All four: `version` 2, `tokenManager`
`0x5c952063c7fc8610FFDB798152D69F0B9550762b`, `quote` `0x0` (BNB),
`tradingFeeRate` 100 (1%), `liquidityAdded` false.

## Four conclusions

**1. The 18-versus-24 BNB conflict is settled: both are real, and it is
per token.** `maxFunds` reads 24 BNB on two tokens and 18 BNB on two others,
live, right now. Neither source in the brief was wrong; they were describing
different tokens. **Never hardcode either.** Read `maxFunds` per token.

**2. Token-side constants confirmed exactly.** `totalSupply` is 1,000,000,000
and `maxOffers` is 800,000,000 on every token. `balanceOf(tokenManager) minus
offers` equals exactly 200,000,000 on all four, confirming the reserve.

**3. The brief's progress formula is wrong, and should not be used.** The brief
gives:

```
progress = 100 - (((proxyBalance - 200000000) * 100) / 800000000)
```

Integer division truncates, so it is consistently about one percentage point
high. Measured: PANDA reads 1.00% by the brief's formula against a true
0.0057%; 福布斯CZ reads 2.00% against 1.01%; 没有 reads 19.00% against 18.42%.
On a token that has barely traded, the formula reports 1% when the truth is
effectively zero.

**Use instead**, straight from the contract, exact, and per token:

```
progressByTokens = (maxOffers - offers) / maxOffers
progressByFunds  = funds / maxFunds
```

**4. The two progress measures diverge substantially, and the choice is a
product decision.** On 没有, tokens sold reads 18.42% while BNB raised reads
5.44%. The curve is non-linear: early tokens are cheap, so token-side progress
runs far ahead of funds-side progress and the two converge only near
completion.

**Recommendation for the "About to Graduate" column: use `progressByFunds`.**
`maxFunds` is the actual per-token on-chain graduation target, so a bar built
on it answers the question the column asks, "how close is this to migrating".
`progressByTokens` would show a token at 18% when it has raised 5% of what it
needs, which overstates imminence, and overstating imminence in a column whose
entire purpose is imminence is the wrong failure direction. Show
`progressByTokens` as secondary detail on the token page.

**One check still outstanding**: no token near completion was in the sample, so
the assumption that the two converge at 100% is inferred from the curve's shape
rather than observed. Confirm against a token above 90% before shipping the
column.

## Also verified, and it matters for the single-language requirement

Two of the five tokens are named 没有 and 福布斯CZ. These are **token names,
user-generated on-chain data**, not interface chrome. Basis renders them
verbatim, because rendering a token's name as anything other than its name is a
correctness bug and a phishing risk. The single-language rule applies to Basis's
own chrome, which is exactly the distinction Four.meme fails: its *interface* mixes
languages. Recorded so that nobody later "fixes" a token name.

---

# 0a. Live Four.meme data

## Bitquery. Verified.

Documented coverage for Four.meme on BSC: `TokenCreate` events and real-time
creation streams, live trades and OHLCV via subscriptions, bonding-curve
progress, PancakeSwap migration detection, top holders and dev holdings,
liquidity tracking, trader leaderboards. WebSocket subscriptions extensively
documented. Filter with `ProtocolName: { is: "fourmeme_v1" }`. Querying outside
the Bitquery IDE needs a generated access token.

| Tier | Cost | Points | Streams |
| --- | --- | --- | --- |
| Developer (free) | $0 | 1,000/mo, roughly 100k calls; **10-row result cap**; 10 req/min | **2 concurrent** |
| Personal | $49/mo | | |
| Pro | $99/mo | | |
| Scale | $299/mo | | |

New signups get 10,000 points for the first month. Add-ons: $40 per 1M points,
$20 per 100k stream-minutes, $8 per GB (yearly). **Streams do not consume
points on paid plans**; they are licensed by concurrency with no data or rate
limits inside the licence.

**The free tier cannot run this product, at any user count.** Two concurrent
streams will not carry three columns, and a 10-row result cap is fatal to a
feed. This is a floor, not a scaling problem.

## Cost at zero users and at 1,000 users

**The central architectural fact: streams are server-side.** Basis holds the
subscriptions and fans out to browsers over its own channel. The upstream bill
is therefore **flat in user count**. It is the same three streams at zero users
and at 1,000.

Three continuous streams, one per column:

```
3 streams x 43,200 min/month = 129,600 stream-minutes/month
129,600 / 100,000 x $20      = $25.92/month in stream add-on
```

| | Zero users | 1,000 users |
| --- | --- | --- |
| Bitquery base plan | $49 (Personal) | $49 to $99 |
| Stream add-on, 3 continuous | ~$26 | ~$26 |
| Points, non-stream queries | within plan | within plan |
| **Upstream total** | **~$75/mo** | **~$75 to $125/mo** |

The step from Personal to Pro is driven by points for on-demand queries (token
page loads, backfill), not by streams. **What actually scales with users is
Basis's own fan-out infrastructure**, which is a hosting cost, not a data cost.

Bandwidth is the one number not independently measured: the $8/GB add-on
depends on Four.meme's trade volume through the subscription, which has to be
measured against a live stream rather than estimated. Budget for it; do not
assume it is zero.

## Codex. Verified, price undisclosed.

Exposes `graduationPercent`, `completed`, `migrated`, `launchpadName`,
`protocol`, plus volume, buy/sell counts and holder balances. WebSocket
subscriptions supported, including "Subscribe to All Four.meme Token Events".
Their own docs warn that "launchpad events are extremely high-frequency and
will send a large number of requests".

Pricing: "a monthly flat-rate option with unlimited requests" for the launchpad
subscription, **amount not published**, contact `hello@codex.io`. No OHLCV
documented on the Four.meme page.

Strong on graduation state specifically. Unusable as a primary pick until a
number exists, and a flat rate with unlimited requests is worth getting a quote
for as a hedge against Bitquery's bandwidth exposure.

## CoinGecko. Verified.

Launchpad (pre-graduation) API covers Four.meme explicitly, alongside Pump.fun
and Raydium Launchlab, with bonding-curve data, graduation status and OHLCV at
resolutions down to one second. Analyst plan $129/month; commercial licensing
from $35/month.

## Four.meme's own API. Not verified, and not recommended.

No official public REST API from the platform. The community CLI at
`github.com/four-meme-community/four-meme-ai` exists and wraps
detail/list/ranking endpoints with structured JSON output while reading
TokenManager2 events. **Its terms of use and the public status of the endpoints
it wraps were not established.** A community wrapper around undocumented
endpoints is not a foundation for a product. Do not depend on it.

## Self-hosted indexer. Verified, and harder than the brief assumes.

TokenManager2 confirmed at `0x5c952063c7fc8610FFDB798152D69F0B9550762b`, V2,
supporting BNB and BEP20 purchases for tokens created after 2024-09-05.

**Measured, not assumed: public BSC RPC endpoints will not serve this at all.**
`eth_getLogs` against TokenManager2 was rejected by every public endpoint
tried, at both a 900-block and a 40-block range:

- `bsc-dataseed.bnbchain.org`: `-32005 limit exceeded`
- `bsc-dataseed1.defibit.io`: `-32005 limit exceeded`
- `rpc.ankr.com/bsc`: `-32602 missing or invalid parameters`

This is stronger than the brief's "rate-limited and unstable". A 40-block log
query is trivial, and it was refused outright. **A paid dedicated endpoint is
mandatory for this path, not a production nicety.** A full node with
`eth_subscribe` and `eth_getLogs` suffices for live events; an archive node is
needed only for historical backfill from genesis, and should be avoided.

Dedicated WebSocket RPC, current pricing:

| Provider | Shape | Cost |
| --- | --- | --- |
| Chainstack | Unlimited Node add-on, chain-agnostic flat pool | from **$149/mo** on Growth and above |
| QuickNode | Flat-rate RPS, one endpoint / one chain / one region | **$799/mo** at 75 RPS, $1,499 at 150, $1,949 at 250 |
| Dwellir | per-request | **$1.96/M** requests; dedicated BSC node **$2,000/mo** |
| Ankr | per-request | $20/M requests |
| QuickNode | per-request | $12.25/M requests |

Build effort on top of the endpoint: a `TokenManager2` event decoder, a
PancakeSwap migration watcher, reorg handling, backfill on reconnect, and the
storage and query layer the feed reads from. This is a service, not a module.

## Recommendation

**Primary: Bitquery.** Decoded events, no contract reverse-engineering, three
streams at roughly $75/month flat in user count, and it already covers OHLCV,
dev holdings and top-10 concentration, which collapses 0d and most of 0e into
the same vendor.

**Fallback: self-hosted indexer on a Chainstack Unlimited Node.** At $149/month
flat it is the cost-control path once Bitquery's bandwidth add-on starts to
bite, and the $149 flat pool is the cheapest credible dedicated option
measured. Treat it as a second implementation of a stable internal interface,
not as a switch to flip.

**Get a Codex quote** before committing. Flat-rate unlimited on the highest
frequency data in the product is the one pricing shape that removes the
bandwidth risk entirely.

---

# 0c. GoPlus load. Verified.

**Verbatim from GoPlus documentation:** the Security API "is free, and the rate
limit is 30 calls/minute". Batch queries are available "only for Pro, Ultra or
Enterprise Packages", with a default throughput of "up to 100 data requests in
a single batch query". Higher limits require applying for an access token.
**No price is published for the paid packages**; the documented route is to
contact them.

## Does the free tier survive the feed?

Only with a shared server-side cache, and that is what makes it work.

The 30/min ceiling applies to **Basis in total, not per user**, because the
cache is server-side. So:

- **The marginal GoPlus cost of the 1,000th user is zero** for any token
  already cached. Users overlap almost completely: everyone watching "Newly
  Created" sees the same tokens.
- The real driver is the **rate of distinct new tokens**, which is set by
  Four.meme's creation rate, not by user count.

First paint of three columns at 20 visible rows is 60 distinct tokens, which is
two minutes of budget at 30/min. That is survivable once, at startup, and
thereafter the working set is warm and only genuinely new tokens cost a call.
A sustained creation rate above 30 new tokens per minute would exhaust the
budget, and that is the number to measure against a live stream in Phase 1.

**Required mitigations, all of them:**

- Fetch safety only for rows actually rendered in the viewport, never the whole
  virtualized list.
- Split TTLs by mutability. Long for fields that cannot change (mint authority,
  ownership renounced); short for those that can (LP lock %, holder
  concentration). The existing 5-minute server cache is the floor.
- Server-side fan-out caching, shared across all users. This is the load-bearing
  mitigation.
- A request queue that respects 30/min and degrades to grey rather than
  hammering the limit.

**Binding regardless:** a feed that rate-limits GoPlus into permanent grey rows
on every scroll is worse than no feed. And a rate-limited cell is grey, never
green.

---

# 0d. OHLCV and trade history. Verified.

**Recommendation: Bitquery**, because it is already the primary and its
Four.meme coverage explicitly includes OHLCV and live trades via subscription.
Adding no second vendor for Phase 3 is worth more than any marginal difference
in candle quality.

**Fallback: CoinGecko launchpad API.** It covers Four.meme, offers OHLCV down
to one-second resolution and pre-graduation bonding-curve data, and has a
published price ($129/month Analyst, commercial licensing from $35/month). It
is the better pick if Phase 3 needs sub-second candles on pre-graduation
tokens, which Bitquery's OHLCV has not been checked for.

Codex is out for this: no OHLCV documented on its Four.meme page.

**Nothing beyond the primary pick is required for Phase 3.**

---

# 0e. Dev, sniper, bundler, insider signals. Verified.

**GoPlus supplies** honeypot, buy/sell tax, mint authority, owner privileges,
ownership renounced, LP lock % and top-10 holder concentration. Confirmed by the
working integration in `src/lib/goplus.ts`.

**GoPlus does not supply** sniper, bundler or insider percentages.

**Bitquery documents both top holders and dev holdings percentage
calculations** for Four.meme. So on the recommended primary, **dev-holdings %
and top-10 concentration both ship in Phase 1** as in-row signals. The fifth
in-row slot is filled rather than reserved.

**Sniper, bundler and insider percentages are deferred.** They need
bubble-map-style transaction graphing, which is a separate build. Until
implemented they render **neutral grey "not checked", never as a pass, and are
never fabricated, estimated or inferred**. This follows directly from the trust
posture: a signal Basis cannot compute is not a signal Basis displays.

---

# Open questions carried into Phase 1

1. **Stream bandwidth.** Measure a live Bitquery Four.meme subscription for a
   day to size the $8/GB add-on. It is the only material unknown in the cost
   model.
2. **Distinct-token creation rate.** Measure against the same stream. Decides
   whether GoPlus free holds or a paid batch package is needed.
3. **Convergence of the two progress measures near 100%.** Confirm against a
   token above 90% before shipping the About to Graduate bar.
4. **Codex quote.** Flat-rate unlimited would remove the bandwidth risk.
5. **GoPlus paid package price.** Not published; requires contacting them.
6. **Bitquery OHLCV resolution on pre-graduation tokens.** Decides whether
   CoinGecko is needed for Phase 3 after all.
7. **"Dex Paid" equivalent on BNB Chain.** Not researched. Phase 2 asks whether
   one exists; the answer is still unknown, and the filter is not built until
   it is.
