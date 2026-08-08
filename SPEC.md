# Basis discovery cockpit, Phase 0

> **STATUS: INCOMPLETE. This is not the Phase 0 gate.**
>
> Three of the five research items have verified findings recorded below.
> The rest are outstanding and are listed under [What is still
> open](#what-is-still-open). Nothing here is a recommendation yet, because a
> recommendation needs the cost comparison that is not yet done.
>
> Every claim below is labelled **Verified** with its source, or **Not
> verified**. Nothing is asserted from memory. Where the brief supplied a
> number, it was re-checked rather than copied.

## Trust posture

Basis positions against specific, documented trust failures at its
competitors. This section is binding on the code, not marketing.

**What happened elsewhere.** On 2026-02-26 ZachXBT reported that senior Axiom
staff, including business development lead Broox Bauer, used internal "God
mode" admin dashboards to look up private user wallet data and front-run
users over roughly ten months, allegedly netting over $400,000 at a firm
generating about $390M in revenue. Axiom said it was "shocked and disappointed
to hear that someone on our team abused internal customer support tools to
look up user wallets" and removed the access. GMGN holds a 2.1 out of 5
"Poor" Trustpilot score, 79% one-star across the sampled reviews, with
recurring complaints about copy-trading failures, unexpected fees and
pervasive phishing-clone impersonation, alongside a hot-wallet model.

*(These are the figures as supplied in the product brief. They are recorded
here as the rationale for the rules below. They have not been independently
re-verified, and should be before any of it is published externally.)*

**What Basis therefore does not build, ever.**

- No internal tool that maps a user identity to a wallet address. Not an admin
  dashboard, not a support lookup, not a debug view. The capability is the
  vulnerability: it cannot be abused if it does not exist.
- No logging of wallet-to-session linkage. Wallet addresses are never written
  to a log, an analytics event or an error report alongside anything that
  identifies a person or a session.
- Non-custodial only. No hot wallet holds user funds at any point.
- **A safety check that could not run is never rendered as a pass.** It is
  neutral grey. This is already how `SafetyPanel` behaves and it extends
  unchanged to every row of the feed.

## Hard product exclusions

By decision, not oversight. Do not build these even where they would be easy:
predictions or event contracts; perpetuals or leverage; points, rewards or
referral programmes; trading competitions.

## Deferred, explicitly

Wallet tracking; Twitter/X tracking; copy trading; limit orders, take-profit
and stop-loss; bubble maps. Scope decision recorded, not built in Phases 0
to 3.

---

## 0a. Live Four.meme data. Partial.

### Bitquery. Verified.

Bitquery documents a Four.meme API for BSC covering live trades, `TokenCreate`
events, bonding-curve maths from proxy balances, migrations to PancakeSwap,
OHLCV, liquidity events and leaderboards, over GraphQL with streaming.
Querying outside the Bitquery IDE requires a generated API access token.

Pricing, verified against Bitquery's pricing page and its points
documentation:

| Tier | Cost | Points | Streams |
| --- | --- | --- | --- |
| Developer (free) | $0 | 1,000 points/month, roughly 100k API calls; 10-row result limit; 10 requests/min | 2 concurrent |
| Personal | $49/mo | | |
| Pro | $99/mo | | |
| Scale | $299/mo | | |

New signups get 10,000 free points for the first month. A 7-day trial
includes full live WebSocket streaming: 1,000 API points, 2 simultaneous
streams, 17 stream-minutes, 0.2 GB stream bandwidth.

**Streams do not consume points on paid plans.** They are licensed separately
by concurrency, with no data or rate limits within the licence. Flat-rate
add-ons: $40 per 1M points, $20 per 100k stream-minutes, $8 per GB (yearly).

**What this means for the three-column feed.** The feed needs one persistent
stream per lifecycle column, so three concurrent streams, plus headroom. The
free Developer tier's 2 concurrent streams cannot carry three columns, and its
10-row result limit is fatal for a feed. So the free tier does not sustain the
product even at zero users.

The stream-minute and bandwidth economics are the open question, and they are
what the "at 1,000 users" number depends on. **Not yet computed**, because it
needs the per-stream bandwidth of a Four.meme trade subscription, which has to
be measured rather than guessed. Note the architectural point that makes this
tractable: streams are server-side. Basis holds three streams total and
fans out to browsers over its own channel, so **stream cost is flat with
respect to user count**. It is the same three streams at zero users and at
1,000. What scales with users is Basis's own fan-out infrastructure, not the
Bitquery bill.

### Four.meme's own API. Not verified.

The brief's finding, that there is no official public REST API and that
`github.com/four-meme-community/four-meme-ai` is a community CLI wrapping REST
detail/list/ranking endpoints and reading TokenManager2 events, is
**plausible but unconfirmed**. The repository exists and is described as a CLI
for creating and trading Four.meme tokens with structured JSON output for
config, token details, pricing quotes and on-chain events. Its terms of use,
its current availability, and whether the REST endpoints it wraps are public
or incidental have **not** been checked. A community wrapper around
undocumented endpoints is not a dependency to build a product on without
reading its terms.

### Self-hosted indexer. Not verified.

TokenManager2 is confirmed deployed at
`0x5c952063c7fc8610FFDB798152D69F0B9550762b` on BNB Chain mainnet, and is the
V2 contract supporting purchases in both BNB and BEP20 for tokens created
after 2024-09-05. Build-effort estimate and the RPC tier comparison are
**not yet done**.

### Codex, CoinGecko, Moralis, QuickNode. Not verified.

Not yet researched. Dune is research-only and not a live feed source; that
much is a given and is not in dispute.

---

## 0b. Graduation threshold. Partially verified. Do not hardcode.

**The BNB threshold is not a single fixed constant, and Basis must not treat
it as one.** The brief supplies conflicting figures from credible sources:
official Four.meme docs and 2026 launchpad reviews say approximately 18 BNB
seeded into the PancakeSwap pair; other guides and early-2025 on-chain
analyses report a roughly 24 BNB target of which about 23.5 BNB is seeded and
0.5 BNB is a fee, against a 30 BNB virtual pool asymptote. The threshold also
varies by quote token (BNB, USDT, USD1, USDC, CAKE, ASTER, U) and by
TokenManager version.

**The resolution, which sidesteps the conflict entirely.** The token-side
constants are fixed and verifiable, so the progress bar is computed from them
and the BNB target is read per token rather than assumed:

- total supply 1,000,000,000
- 200,000,000 (20%) reserved for migration
- 800,000,000 sold on the curve
- `progress = 100 - (((proxyBalance - 200000000) * 100) / 800000000)`

and the per-token quote-token target is read from `getTokenInfo(token)` on
TokenManager2, fields `funds` and `maxFunds`. `TokenManagerHelper.getTokenInfo`
is confirmed to exist as the documented way to retrieve token information.

**Never hardcode 18 or 24.** Recorded as a binding rule.

**Still to verify on-chain:** the exact return struct of `getTokenInfo`, the
field ordering, and a live read against a real graduating token confirming
that `funds` and `maxFunds` behave as the progress computation assumes. That
read has **not** been performed. Until it is, the progress bar is unimplemented,
not approximated.

---

## 0c. GoPlus load. Verified, with the sizing still to do.

**Verified verbatim from GoPlus documentation:** the Security API "is free,
and the rate limit is 30 calls/minute". Batch queries are available "only for
Pro, Ultra or Enterprise Packages", with a default throughput of "up to 100
data requests in a single batch query". Higher limits require applying for an
access token.

**The constraint this creates.** 30 calls/minute is the entire budget for
every safety cell in every visible row across every user, because the cache is
server-side and shared. A three-column feed showing 20 visible rows per column
is 60 distinct tokens on first paint. At one call per token that is two
minutes of budget for a single screen, before anyone scrolls.

**Mitigations, all of which are required rather than optional:**

- Fetch safety only for rows actually rendered in the viewport, never for the
  whole virtualized list.
- Split TTLs by mutability: long TTL for fields that cannot change (mint
  authority, ownership renounced), short TTL for those that can (LP lock %,
  holder concentration). The existing flat 5-minute server cache stays as the
  floor.
- Server-side fan-out caching so all users share one cache. This is what makes
  the 30/min survivable: it is 30/min for Basis, not per user, so the marginal
  cost of the 1,000th user is zero for any token already cached.
- A request queue that respects 30/min and degrades to grey rather than
  hammering the limit.

**Whether the free tier survives the load: not yet determined.** It needs the
expected distinct-token rate, which depends on the feed's insertion rate,
which is a Phase 0a measurement not yet taken. The paid batch plan is the
fallback and its cost has **not** been obtained.

**Binding regardless of the answer:** a feed that rate-limits GoPlus into
permanent grey rows on every scroll is worse than no feed. And a rate-limited
cell is grey, never green.

---

## 0d. OHLCV and trade history. Not verified.

Not yet researched.

## 0e. Dev-wallet, sniper, bundler, insider signals. Partially verified.

GoPlus supplies honeypot, buy/sell tax, mint authority, owner privileges,
ownership renounced, LP lock % and top-10 holder concentration. This is
confirmed by the existing working integration in `src/lib/goplus.ts`, not by
research.

GoPlus does **not** supply sniper, bundler or insider percentages.

Bitquery's ability to supply dev-wallet holdings and top-10 concentration via
on-chain queries is **not yet verified**.

**Binding decision regardless of what the research finds:** sniper, bundler
and insider percentages are deferred, and until implemented they render as
neutral grey "not checked", never as a pass. They are never fabricated,
estimated or inferred. This follows directly from the trust posture: a signal
Basis cannot compute is not a signal Basis displays.

---

## What is still open

Ordered by what blocks the most downstream work.

1. **0a cost model at 1,000 users.** Needs measured per-stream bandwidth for a
   Four.meme trade subscription, then the add-on arithmetic. Blocks the
   primary/fallback recommendation.
2. **0b on-chain verification of `getTokenInfo`.** Return struct, field order,
   and a live read against a graduating token. Blocks the progress bar.
3. **0d OHLCV and trade-history source.** Blocks Phase 3.
4. **0a Codex, CoinGecko, Moralis, QuickNode comparison.** Blocks the
   recommendation alongside item 1.
5. **0c distinct-token rate and the GoPlus paid batch plan cost.** Blocks the
   answer on whether the free tier holds.
6. **0a Four.meme community CLI terms and current availability.**
7. **0e Bitquery dev-holdings and top-10 concentration availability.**

## Unresolved conflict with the existing codebase

The brief specifies brand vermilion **`#E23A2E`**. The shipped brand token is
**`#D6362B`**, changed deliberately on request because white on `#E23A2E`
measures 4.31:1 and fails the 4.5:1 that AA requires for the primary action's
label; `#D6362B` measures 4.75:1 and passes.

Reverting to `#E23A2E` reintroduces a known accessibility failure on the one
control the whole interface funnels into. This has **not** been changed in
either direction pending a decision. Everything else in the visual system
section of the brief already matches what is shipped and is recorded in
CLAUDE.md.
