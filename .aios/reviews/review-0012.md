---
schema: aios.review/v1
id: review-0012
project: whisky-frog-web
task: task-0010
attempt: 1
verdict: changes_requested
---

# Review of task-0010, Attempt 1

## Findings

The focused browser/layout command was only listed, not executed, so the explicit requirement that it pass and be recorded is unmet. Also, e2e/homepage.spec.ts cancels link clicks from a bubbling document listener; Next Link handles the click and initiates client navigation before that listener runs, so activating the first link can leave the homepage before the second is tested. Cancel in capture phase or test each navigation independently, then run both Playwright viewport projects and record the passing npm run e2e:homepage outcome.
