---
schema: aios.review/v1
id: review-0005
project: whisky-frog-web
task: task-0005
attempt: 1
verdict: changes_requested
---

# Review of task-0005, Attempt 1

## Findings

Implementation quality is solid — verified independently: npm test 63/63 pass, npx tsc --noEmit clean, npm run build succeeds (all 12 routes incl. /products), and CatalogCard/OfferRow/useCatalogQuery/product-query request-parity logic checked by reading the code against the pre-migration page.tsx (git show HEAD). Nothing under .aios/ was touched. However two AC bullets require test coverage that is objectively missing or mismatched to its own test name:

1. Pagination AC ('Tests cover first, middle, final, empty, and full-page boundary responses without confusing offer count with product count') is not met. tests/catalog-page.test.tsx has only one pagination test, which conflates first-page and final-partial-page into a single case (offset=0, 1 product, total=1), plus a separate empty-state test. There is no 'middle' page case (offset>0 with both prev and next enabled) and no 'full-page boundary' case (a page whose returned product count equals CATALOG_PAGE_SIZE, verifying hasNext is computed correctly both when more results remain and when the full page exactly reaches total — this is exactly where the 'offer count vs product count' confusion the AC warns about would surface, since hasNext falls back to `products.length === pageSize` when total is unset). Please add these two missing pagination scenarios.

2. Market-highlighting/lowest-price AC ('...displays one catalog result/count while retaining all offer rows and the existing selected-market highlighting/lowest-price behavior') is not actually verified anywhere. The one test using the multi-market fixture is titled 'v2 catalog: header/result count reflects distinct products, not summed offers, and highlights the selected market' (tests/catalog-page.test.tsx:84), but it renders with no market filter in the URL (marketFilter ends up empty) and its assertions only check the total-count text and that both market names appear — it never sets a market facet selection nor asserts the OfferRow highlighted styling or the '최저가' (cheapest) badge. No other test in the repo references OfferRow/CatalogCard/highlighting at all (grep confirms zero matches). Please add an assertion (e.g. render with a market facet selected via initialSearch and check for the highlighted offer row and/or the '최저가' badge) that actually exercises this behavior, since the code path is otherwise completely untested despite being explicitly named in the Acceptance Criteria and in this test's own title.

Both gaps are narrow (test-only) — I did not find functional defects in the reviewed source; the fixes are additive tests, not logic changes.
