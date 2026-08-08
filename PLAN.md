# Backlog

Ordered by value against risk, highest first. Every item below is a confirmed
observation about the repo as it stands, not a speculative improvement; where an
item is a decision rather than a task, it says so.

Working rules live in [CLAUDE.md](./CLAUDE.md). `npm run verify` runs before
every debrief.

---

- [ ] **1. Decide what `/hyperliquid` is for.**
      Nothing in the UI links to it: there are no `<Link>` elements, no
      `router.push`/`replace` and no `redirect()` calls anywhere in `src/`, and
      every `href` is external or a block explorer URL. That was deliberate in
      `b03bbbd`, but "reachable by URL only" is a holding position, not an
      answer. Either give it an entry point, or retire it and drop the wizard
      components it alone uses. A decision, not a task.

- [ ] **2. Rewrite `README.md`.**
      It still opens "Hyperliquid Builder Codes Demo" and documents only the
      seven-step wizard. Basis has been the product at `/` since `b03bbbd` and
      is not mentioned. Anyone arriving from the repo is told about the wrong
      app. Should cover both, lead with Basis, and document `npm run verify`.

- [ ] **3. Run the checks in CI.**
      `.github/` contains no workflows, so `npm run verify` runs only when
      someone remembers. Add a workflow that runs it on push and on pull
      request. `playwright.config.ts` already branches on `CI` for retries,
      workers, reporter and `reuseExistingServer`, so the config side is done.

- [ ] **4. Add `next build` to the verified set.**
      `verify` runs `tsc`, Biome and Playwright, all against the dev server. A
      production build can fail where dev does not. Decide whether it belongs in
      `verify` itself or only in CI, given it is the slowest step by far.

- [ ] **5. Cover the throttle path with a test.**
      `a8be318` is the only one of the recent safety-panel fixes with no
      regression test. The suite covers switching, per-token content,
      disconnected quotes and fee display, but nothing asserts that a 429
      surfaces the throttled banner within seconds, that the banner's wording
      changes between "trying again" and "settled", or that two throttled tokens
      render differently. The stub already supports per-address delays; it needs
      per-address status codes.

- [ ] **6. Cover the on-chain fallback rows.**
      When GoPlus fails, `FallbackRow` runs the real on-chain checks against
      chain 56. Nothing tests it, and unlike the rest of the suite it cannot be
      covered by stubbing `/api/safety` alone, since the calls go straight to
      the chain from the browser. Needs an RPC-level stub or an injected client.

- [ ] **7. Cover the paste-an-arbitrary-token flow.**
      `useTokenInfo` rejects non-contracts, treats a reverting `decimals()` as
      "not an ERC-20", and retries `symbol`/`name` against the bytes32 ABI for
      older tokens. Three branches, all untested, all reachable by pasting an
      address into the picker.

- [ ] **8. Authenticate to GoPlus, or document living without it.**
      `GOPLUS_ACCESS_TOKEN` is empty in `.env.local.example`. The unauthenticated
      limit is reached after roughly ten lookups, which is what forced the settle
      delay, the retry budget and the server-side cache. Either provision a
      token and document the quota, or state in the README that the safety panel
      degrades to on-chain checks under normal browsing.

- [ ] **9. Clear or accept the 14 Biome warnings.**
      Seven `useButtonType` in `Header.tsx`, `NetworkToggle.tsx` and
      `PriceChart.tsx`; three `noExplicitAny` in `PriceChart.tsx` and
      `lib/hyperliquid.ts`; three `noNonNullAssertion` in `useAccountState.ts`,
      `useBuilderApproval.ts` and `useOpenOrders.ts`; one
      `useExhaustiveDependencies` in `useCandleData.ts`. All predate this work
      and all sit in Hyperliquid-side code. If item 1 retires that route, most of
      these go with it, so do this after 1.

- [ ] **10. Set `allowedDevOrigins` in `next.config.mjs`.**
      The dev server warns on every run that a future major version of Next will
      require it for cross-origin `/_next/*` requests, which is how Playwright
      reaches it at `127.0.0.1`. Harmless today, a broken suite on the next major.

- [ ] **11. Refresh `caniuse-lite`.**
      Browserslist reports its data is six months old on every build.

- [ ] **12. Decide a re-verification cadence for the identifier log.**
      The table in CLAUDE.md is stamped 2026-08-06. Contract addresses do not
      drift, but the record ages: a reader a year from now cannot tell a
      still-true entry from a stale one. Either re-confirm on a schedule, or
      state in CLAUDE.md that the stamp is the date of confirmation and that
      immutability is the reason it does not need renewing.
