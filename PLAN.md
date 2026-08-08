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

- [x] **D1. Header brand presence is still too small.** Done.
      Mark 28px to 36px, wordmark 15px to 20px on a new `bs-xl` step. At 36px
      the mark's ink spans 27 x 13.5, which sets its ink height against the
      wordmark's cap height rather than against its box.
      **Caveat on the acceptance test: the Axiom and GMGN references were not
      viewed.** They were sized by judgement against the scale trading terminals
      generally use for header branding, then checked in the rendered app. If
      the reference comparison matters, put those screenshots side by side with
      `after/header.png` and reopen this.

- [x] **D2. Retune the amount scale; `bs-num-xl` may be oversized.** Done.
      One step down, `bs-num-xl` to `bs-num-lg`, 36px to 31px.
      Against the card's 15px heading that is 2.07x rather than 2.4x, still
      unambiguously the largest text on the card. Weight left at regular: the
      figures are already the heaviest thing there by size, and thickening a
      monospace numeral costs legibility at a glance. `bs-num-xl` stays defined
      as the top of the scale.

- [x] **D3. Replace the focus outline on the amount input.** Done.
      `--bs-focus` moves from `#E8EBEF` to `#8A929D`, a step on the neutral
      ramp. The mechanism is unchanged and still applied at the surface, so no
      control can forget it: 6.3:1 against `--bs-n0`, 6.0:1 against `--bs-n1`,
      5.6:1 against `--bs-n2`, all above the 3:1 WCAG 2.2 asks of a non-text
      indicator. The original item, kept for the constraints it records:
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

- [ ] **D4. Amount truncation headroom at mobile width.** Improved by D2, not
      closed. Re-measured at 390px after the step down to 31px: `612.430000`
      and `1234567.890000` both fit at 256px, where the latter truncated at
      297px before. The threshold is back to roughly fourteen characters, where
      it sat before the field grew. Still truncating above that:
      `600000000.000000` needs 293px and `12345678901.000000` needs 329px, and
      a low-priced token bought in size produces exactly those. No horizontal
      scrollbar in any case. Remaining options if this is worth closing: let
      the figure shrink to fit its box, or abbreviate above a threshold with
      the full value on hover, which costs precision at a glance and should not
      be done casually to a number someone is about to trade on.
