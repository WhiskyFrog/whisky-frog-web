---
schema: aios.review/v1
id: review-0015
project: whisky-frog-web
task: task-0012
attempt: 1
verdict: pass
---

# Review of task-0012, Attempt 1

## Findings

Verified against the actual repository, not just the Attempt narrative. TopNav.tsx now uses a content-sized 2-row mobile grid (base styles) collapsing to the original single-row flex at sm:+, with no `hidden`/`display:none` classes on the 가격 비교 (/products) and 직구가 계산 (/direct-price) links; both are native <Link> anchors with focus-visible outline styling, scoped inside the single <nav> landmark alongside Whisky Frog home link, 마켓 market menu, and 관리자 admin button (unchanged onClick/LoginModal wiring). Ran `npm test` (123/123 pass, includes new tests/top-nav.test.tsx scoping link role/name/href assertions to `within(navigation)` so it can't match homepage CTAs), `npm run build` (succeeds), and `npm run e2e:homepage` (6/6 pass, no live/persistent server — E2E_STATIC_BUILD routes prerendered HTML, market API mocked via installProductApiMocks). e2e/homepage.spec.ts's 'contains every TopNav control' test iterates real 320/768 (narrow project) and 1280 (wide project) viewports, asserts document and nav scrollWidth<=clientWidth, per-control unclipped/unobscured bounding-box + elementFromPoint hit testing, keyboard focus+visible outline+Enter activation to the correct href, market menu loading, and mainRect.top >= navRect.bottom (sticky nav doesn't obscure main). To verify the pre-correction-failure claim independently, I checked out the pre-change TopNav.tsx (via git show HEAD) while keeping the new e2e spec/mocks, rebuilt, and ran the narrow-project 'contains every TopNav control' test in isolation: it failed exactly as claimed (가격 비교 link not found at 320px, since old TopNav had `hidden sm:block`). Restored the corrected TopNav.tsx afterward and confirmed diff match; full test/build/e2e suite re-passes with the restored file. Diff is scoped to TopNav.tsx, e2e/homepage.spec.ts, tests/typescript-loader.mjs (next/navigation loader mapping) plus new tests/top-nav.test.tsx and tests/next-navigation.ts — no touches to LoginModal, auth, backend, API clients, generated types, or env config. Note (non-blocking): the jsdom unit test (tests/top-nav.test.tsx) does not actually fail against the pre-correction markup since jsdom doesn't apply Tailwind's compiled CSS, so only the Playwright e2e assertion demonstrates the required pre/post-correction contrast — this satisfies the AC as written but is worth knowing if the DOM test is ever cited as the failing/passing pair. Working tree left in the same state as originally found.
