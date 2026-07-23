# Runbook — facet v2 rollout, fallback, and legacy-removal gate

Task: `task-0007` (verification matrix + legacy removal gate). This document is the
operator-facing procedure the Task's acceptance criteria requires. It only
*documents and verifies*; it does not deploy, change production configuration,
or remove the legacy fallback. Those remain separate, explicitly approved
operator actions.

## 0. What "the whole client pair" means here

The public product client is selected **once per build**, by
`NEXT_PUBLIC_PRODUCT_API_VERSION` (`v2` default, or `legacy`) — see
`.env.example` and `app/lib/api/product-query.ts`'s `resolveProductApiVersion`.
Because this is a `NEXT_PUBLIC_*` variable, it is inlined at `next build` time,
not read at runtime: **switching versions is a rebuild + redeploy, never a
live toggle**, and a single build can never mix a v2 list response with a
legacy facet response (`createProductQueryClient` resolves the pair once, and
never retries against the other version — see `product-query.test.mts`'s
"version selection … never retries legacy" test).

## 1. Joined automated verification matrix (acceptance criterion 1)

One command runs the generated-contract, query-serialization, reducer/
component, accessibility, catalog-integration, and per-market-integration
tests — deterministically, with no server and no billable provider:

```
npm test        # tsc --noEmit + node's test runner over tests/*.test.{mts,tsx}
```

At the time of this Task, this is **117/117 passing** (91 pre-existing from
tasks 0002–0006, plus 26 new joined request-parity cases added in this Task —
see §2). `npm run build` and `npx tsc --noEmit` also pass standalone.

## 2. Request-parity suite (acceptance criterion 2)

`tests/request-parity.test.mts` drives the real `createProductQueryClient`
(catalog scope and per-market scope, the latter with a reserved-character
market code) through 12 representative cases — default, multi-select,
single-select, zero/false, ranges, a dependency-parent-bearing selection,
a selected-but-`relevant:false` selection, explicit `peated_state: "unknown"`,
`edition_state`, search, availability, and pagination — asserting the list and
facet requests share byte-identical filter parameters (only sort/limit/offset
may differ), using the same generated-contract fixture the unit suite already
relies on (no second handwritten facet table). It separately asserts that the
catalog scope's total is `count_unit: "product"` and the per-market scope's is
`count_unit: "offer"` — proving the two scopes are never presented under the
same count noun even when their filter parameters are provably identical.
Included in `npm test` (§1).

## 3. Read-only production backend smoke (acceptance criterion 5)

```
npm run smoke:prod -- \
  --frontend-base-url=<deployed frontend origin> \
  --backend-base-url=<deployed backend origin, e.g. the same-origin proxy path> \
  --market-code=<a real, currently-active market code> \
  [--report-path=<file to write the JSON report to>]
```

(Equivalently `SMOKE_FRONTEND_BASE_URL` / `SMOKE_BACKEND_BASE_URL` /
`SMOKE_MARKET_CODE` / `SMOKE_REPORT_PATH` env vars.) Implemented in
`scripts/prod-smoke.mts`. It performs **GET only** — no admin routes, no
authentication, no writes — and fails closed (non-zero exit) on: a missing
argument, an OpenAPI document that doesn't validate (wrong operation ids or
missing v2 discriminator schemas), any non-2xx response, a facet response
whose `count_unit`/`version`/shape doesn't match the expected scope, or an
unreachable frontend page. It reuses the real `FACET_ROUTES`/
`FACET_OPERATION_IDS` constants and `createProductQueryClient` from
`app/lib/api/facet-contract.ts` / `app/lib/api/product-query.ts` — the same
code the browser runs, not a duplicated contract description.

This was actually executed against the deployed backend and frontend
(`https://whisky-frog.vercel.app`) during this Task, market code `wp`:
**13/13 checks passed**, both on 2026-07-22 and again on 2026-07-23 (re-run to
confirm nothing regressed while this Task's browser-level evidence, §4, was
being completed). The redacted reports are committed at
`plans/facet-v2-web-migration/evidence/prod-smoke-2026-07-22.json` and
`plans/facet-v2-web-migration/evidence/prod-smoke-2026-07-23.json`.

## 4. Browser-level production-build smoke (acceptance criteria 3–4)

`playwright.config.ts` + `e2e/catalog.spec.ts` + `e2e/market.spec.ts` implement
every scenario the Task requires — load, search, availability toggle,
mouse/keyboard drawer open+close, every structured control family, zero-count/
irrelevant-selection retention, pagination, reload/deep-link/back/forward, one-
value clear, full reset, and recovery from a mocked facet error — at both a
narrow (iPhone 13 viewport/UA/touch, rendered on Chromium — see note below)
and a wide (`1280×800`) viewport project, for both `/products` and a
configured `/markets/[code]` route. The catalog spec also expands a card's
offer list and proves the price-history card stays lazy until expansion, then
renders. The market spec proves the image-rich responsive card grid vs. the
mobile-card/desktop-table split, and the "N개 오퍼" (offer, not product) total
wording. All backend calls are mocked at the network boundary
(`e2e/support/mock-api.ts`) against a fake `https://mock-backend.e2e.invalid`
origin baked in at build time — no real backend is contacted and no
admin/write route is ever registered.

**This suite has been executed against real forced-v2 and forced-legacy
production builds in this Task** (superseding Attempt 1, which only enumerated
it via `npx playwright test --list` and did not run it — Playwright's
`webServer` starts `next start` as a foreground child process scoped to the
single `playwright test` invocation and is torn down when that command exits,
which does not conflict with the "no persistent server/daemon" rule the same
way a manually started, long-lived server would):

```
npm run e2e:v2       # next build (v2-forced) + @critical subset  → 22/22 passed
npm run e2e:legacy   # next build (legacy-forced) + @critical subset → 22/22 passed
```

The full (non-`@critical`-filtered) matrix was also run against both forced
builds directly (`PW_VERSION=v2 npx playwright test` / `PW_VERSION=legacy
npx playwright test`): **42/42 passed for v2**, **34 passed / 8 skipped for
legacy** (the 8 skips are the 4 v2-only structured-control-family tests,
skipped by explicit `test.skip(isLegacy, …)` at both viewports — legacy has
no structured v2 renderer to exercise those against).

Real execution surfaced and fixed four genuine bugs no prior attempt had
observed (none weaken any assertion — see `git diff` for exact changes):

- **WebKit unavailable in this execution environment** (missing system
  libraries, no root to install them, no CI config pinning an image that has
  them). The `narrow` project now renders the same iPhone 13
  viewport/UA/touch profile on Chromium instead of WebKit — still proves
  narrow-viewport/touch behavior, portable to any plain runner.
- **Facet checkbox/radio `checked` state is asynchronous**: `useCatalogQuery`/
  `useMarketQuery` only flip `checked` after a full commit → URL → refetch →
  state round trip, but Playwright's `.check()` does a single-shot post-click
  state check. Fixed in the test harness only (`e2e/support/dom.ts`'s new
  `checkControl` helper: click, then an auto-retrying `toBeChecked()`
  assertion) — this is a real, correct characteristic of the app, not a bug.
- **`aria-disabled` on an irrelevant facet group blocked real interaction**:
  `ProductFacetPanel.tsx`'s terms/range `<section>`s set
  `aria-disabled={!group.relevant}` for a purely visual/informational note,
  but the controls inside stay genuinely operable by design (users may
  pre-select a value the current result set doesn't support yet — the
  "selected-irrelevant" scenario §2 also covers). `aria-disabled` cascades to
  descendants per ARIA semantics, so it falsely told assistive tech and
  automation the controls couldn't be operated. Removed; the dimmed styling
  and the "현재 선택과 맞지 않는 항목입니다" note remain. A genuine
  accessibility correctness fix, not a test workaround.
- **The legacy facet sidebar (`ProductFacetSidebar.tsx`) had no dialog
  semantics or focus management** — no `role="dialog"`, no focus trap, no
  focus restoration on close, unlike the v2 `ProductFacetPanel`. Since this
  component is the literal recovery-mode fallback, it now carries the same
  `role="dialog"` / `aria-modal` / focus-trap / focus-restore-on-close
  behavior as v2 (mirrored, not shared code — the two clients stay
  independent per DECISIONS). A real keyboard/screen-reader accessibility gap
  in the fallback path, closed by this Task.
- A catalog pagination test only overrode the v2 facet fixture's `total`,
  so under a legacy-forced build the "다음" (next) button never had a reason
  to enable. Test-only fix: also override the legacy fixture's `total`,
  matching the pattern the equivalent market pagination test already used.

## 5. Rollout runbook

Before rolling a v2 frontend release out to production:

1. `npm test`, `npx tsc --noEmit`, and `npm run build` all pass (§1).
2. `npm run smoke:prod` against the currently deployed backend passes (§3).
3. `npm run e2e:v2` passes against a local `v2`-forced production build (§4).
4. **Operator approves the frontend rollout** (the actual deploy/promote
   action — not simulated or performed by this Task).
5. After the release is live, an operator runs a post-deployment smoke pass
   covering both the catalog and per-market scopes, e.g. `npm run smoke:prod`
   against the now-updated deployment, plus (if the operator has a way to
   point Playwright at the live deployment) the same `@critical` scenarios.
   **This step is a real operator action against a real release; it is not
   claimed as done by this Task, because no v2 frontend release exists yet at
   the time of writing.**
6. Record a fallback drill: run `npm run e2e:legacy` against a `legacy`-forced
   local production build, and confirm it passes the same `@critical`
   scenarios. Record the pass/fail result and timestamp.

Steps 1–3 and 6 (everything not requiring an actual production release) have
already been executed and passed in this Task on 2026-07-23 (§1, §3, §4).
Step 5 remains an operator action against a real release and is not claimed
here, since no v2 frontend release exists yet.

**On any failure at any step above**, the operator's only sanctioned response
is: set `NEXT_PUBLIC_PRODUCT_API_VERSION=legacy` in the deployment's
environment configuration and redeploy through the normal operator/Vercel
process. This is the single reversible configuration action — it swaps the
whole list/facet pair together, never a partial/mixed rollback. **Never**
respond to a failure by editing `whisky-frog-lab`, changing backend/database
state, or hand-patching production config outside the normal deploy path.

## 6. Legacy-removal gate

Legacy code (`ProductFacetSidebar.tsx`, `legacyCatalogFilters.ts`, the legacy
client seam in `product-query.ts`, and the legacy fixtures/tests) is **not**
removed by this Task, and must not be removed until a **separate, explicitly
approved** follow-up Task confirms all of the following:

- At least one v2 release has actually been observed running in production
  (not merely built locally) for a real release boundary.
- The read-only production smoke (§3) and the browser-level critical smoke
  (§4, both viewport classes, both mouse and keyboard drawer paths) have been
  repeated **against that live release** for both the catalog and per-market
  scopes, and are passing.
- There are no unresolved parity, count, or search defects — i.e., nothing
  contradicting the request-parity suite (§2) or the distinct-product-vs-
  offer-count assertion has been observed in production.
- The deployed backend still exposes the expected v2 contract (re-run §3's
  OpenAPI/operation-id/discriminator-schema checks immediately before
  approving removal — contract drift between the original migration and the
  removal decision must reopen this gate, not be assumed away).

Until every item above has real, recorded evidence, the legacy clients,
fixtures, tests, and the `NEXT_PUBLIC_PRODUCT_API_VERSION` selector remain in
the repository exactly as implemented in tasks 0002–0006. No Task in this
plan removes them as a side effect of unrelated work.
