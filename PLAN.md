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

---

## Design follow-ups

Raised on 2026-08-08 against the interface as of `f2d7e4b`. These are judgement
calls about how the thing looks, so they are settled by eye against a reference,
not by picking a number and reasoning forward from it. Colour discipline and the
figures-are-the-product rules in CLAUDE.md still bind: none of these is a licence
to give brand red a second job or to drop a focus state.

- [ ] **D1. Header brand presence is still too small.**
      The mark and wordmark together should sit at the scale of Axiom's or
      GMGN's header branding. Currently the mark is 28px and the wordmark 15px
      semibold (`text-bs-md`), in `src/app/page.tsx`.
      **Compare against those screenshots before sizing.** Do not pick a size
      from this file: get the references up, match the lockup's presence, then
      write down what it landed on. Both halves move together, and the mark is
      sized by its ink rather than its box, since the Spread's ink is 24 x 12
      inside a 32-unit square.

- [ ] **D2. Retune the amount scale; `bs-num-xl` may be oversized.**
      The pay and receive amounts are at `text-bs-num-xl`, 36px, against the
      card's 17px heading and 13px body. It reads slightly goofy for the width
      of the card. Likely one step down to `bs-num-lg` at 31px, or the same size
      at a tighter weight. **Judge visually against the whole card, not
      numerically.** They must stay the largest text on the card; that was the
      point of raising them. Two things worth having in view while judging:
      the two amounts and the 20px card padding are what set the impression,
      and a smaller size also buys back the truncation headroom noted below.

- [ ] **D3. Replace the focus outline on the amount input.**
      A bright ring sits on the amount field when it has focus and clashes with
      the dark surface. It is not a browser default: it is deliberate, from
      `.bs-surface :focus-visible` in `globals.css`, a 2px outline in
      `--bs-focus` (`#E8EBEF`), applied at the container so no control can
      forget it. Replace it with something theme-consistent, most likely a
      dimmer neutral or a border-and-inset-shadow treatment rather than a hard
      outline.
      **Keep a visible focus state. Never remove it.** Whatever replaces it has
      to stay clearly visible against `--bs-n0`, `--bs-n1` and `--bs-n2`, since
      focusable controls sit on all three, and it must not reuse a semantic
      colour: success, alarm and warning each already mean one thing, and focus
      is not a verdict. Check the amount field, the token buttons, the slippage
      presets and inputs, the picker rows, the help triggers and the primary
      action, not just the field that prompted this.

- [ ] **D4. Amount truncation headroom at mobile width.**
      Follows from D2 rather than standing alone. At 390px the receive field
      fits ten characters exactly: `612.430000` renders in full, and a longer
      figure such as `1234567.890000` truncates, measured at 297px against
      256px available. The page gains no horizontal scrollbar either way, and
      truncation predates the larger size, but the threshold moved down from
      roughly fourteen characters when the field grew. Low-priced tokens
      produce exactly those long amounts. If D2 lands on a smaller size this
      may resolve itself; if it does not, `text-bs-num-lg sm:text-bs-num-xl`
      gives desktop the full size and mobile one step less.
