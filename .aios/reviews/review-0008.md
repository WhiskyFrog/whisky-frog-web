---
schema: aios.review/v1
id: review-0008
project: whisky-frog-web
task: task-0007
attempt: 1
verdict: changes_requested
---

# Review of task-0007, Attempt 1

## Findings

Static evidence checks out: tests/request-parity.test.mts, scripts/prod-smoke.mts, e2e/{catalog,market}.spec.ts, playwright.config.ts, and RUNBOOK.md all exist and match the described content; npm test passes 117/117 (confirmed by re-running); npx tsc --noEmit is clean; npm run build succeeds with 12 routes; the committed prod-smoke evidence JSON shows a real 13/13 passing run with concrete OpenAPI/operationId/count detail. However, the Attempt does not meet several explicit Acceptance Criteria, and says so itself: the browser-level Playwright smoke suite and the two forced-configuration production-build drills (route selector forced to v2, then to legacy) were never executed — only enumerated via `npx playwright test --list`. AC bullet 7 requires 'Two production builds and the same critical smoke scenarios pass with the route selector forced to v2 and legacy respectively'; the final AC bullet requires 'both configuration-specific verification runs pass, with commands and outcomes recorded in the Task's Implementer Verification' — the Attempt reports these as 'Not run' and 'code-complete but not yet observed.' AC bullets 3 and 4 (actual browser coverage of load/search/drawer mouse+keyboard/every control family/zero-count retention/pagination/reload-deep-link-back-forward/clear/reset/mocked-error-recovery, plus the catalog lazy-price-history-after-expansion proof and the market responsive card/table + offer-total-wording proof) are likewise unobserved. Most importantly, the Task Objective requires exercising 'the explicit legacy mode as a real whole-client recovery drill' — this is the crux of the Task and it has not actually happened; well-structured, unexecuted code does not satisfy a 'drill' requirement. Required changes: actually run `npm run e2e:v2` and `npm run e2e:legacy` (or an equivalent) against real forced-v2 and forced-legacy production builds, capture pass/fail outcomes, and record the executed commands and results in the Task's Implementer Verification section. If the Implementer Worker's hard rule against starting servers/daemons truly prevents this (Playwright's webServer launches `next start`), that constraint conflict must be surfaced/escalated rather than the Task being submitted as complete with this evidence missing.
