# Facet v2 contract and migration inventory

This inventory records the public client boundary regenerated from the deployed
OpenAPI document on 2026-07-22. `app/lib/api/types.gen.ts` is generated only by
`npm run gen:api:prod`; `app/lib/api/facet-contract.ts` derives application
aliases from its `paths`, `operations`, and `components` exports.

## Deployed facet boundary

- Catalog v2: `GET /api/v2/products/facets`, operation
  `catalog_facets_v2_api_v2_products_facets_get`, returns
  `CatalogFacetResponseV2`. Its total and option counts use
  `count_unit: "product"`: one distinct catalog product remains one product even
  when it has offers from several markets.
- Per-market v2: `GET /api/v2/markets/{market_code}/facets`, operation
  `market_facets_v2_api_v2_markets__market_code__facets_get`, returns
  `MarketFacetResponseV2`. Its total and option counts use
  `count_unit: "offer"`: rows/offers in that market are counted.
- Both responses have version `"2"`, disjunctive counts, and a `groups` union
  discriminated by `kind`. Catalog terms, market terms, and shared range groups
  are the generated structured variants. The server supplies labels,
  relevance, selection mode/current selection, option labels/counts/parents,
  query parameter and encoding metadata, and range query names/bounds/units.
- Recovery routes remain generated as `GET /api/products/facets` returning
  `CatalogFacetsOut` and `GET /api/markets/{market_code}/facets` returning
  `MarketFacetsOut`. The small legacy catalog fixture is the recovery baseline;
  it is not a proposed v2 shape.
- The v2 and list query contracts expose `peated_state` (`peated`, `unpeated`,
  `unknown`) and `edition_state` (`standard`, `limited`). Fixtures exercise
  these through the server-provided terms query metadata rather than duplicating
  their literals in a client interface.

## Current public consumers

| Concern | Catalog | Per-market |
| --- | --- | --- |
| Page to API module | `app/(home)/products/page.tsx` -> `app/lib/catalog.ts` | `app/(home)/markets/[code]/page.tsx` -> `app/lib/products.ts` |
| Active facet request | legacy `GET /api/products/facets` | legacy `GET /api/markets/{market_code}/facets` |
| List counterpart | `GET /api/products` via `listCatalogProducts` | `GET /api/markets/{market_code}/products` via `listMarketProducts` |
| Local/UI state | `availableOnly`, flat `ProductFilters`, `offset`, `searchInput`, debounced `search`, products/facets/status | `availableOnly`, flat `ProductFilters`, `offset`, `searchInput`, products/facets/status plus market metadata |
| Count shown | `matchedTotal` for client-side Korean search, otherwise legacy facet `total` (distinct products) | legacy facet `total` (offers in this market); the displayed page count uses locally searched rows |
| Pagination | offset/limit, 50 rows; next is inferred from a full page (or Korean match total) | offset/limit, 100 rows; next is inferred from a full page |

Neither public page reads `searchParams`, calls `useSearchParams`, nor writes
history/router state. Reload, back/forward, and copied URLs therefore do not
preserve availability, search, facet selections, or pagination. All are local
component state. Changing availability or a facet resets offset; availability
also resets all facets.

Both pages pass the same flat filter object to their legacy facet call and list
counterpart. `app/lib/catalog.ts` serializes repeated multi-value keys and
single scalar/range keys; it also serializes catalog `market`, trimmed `search`,
`sort`, `limit`, and `offset`. `app/lib/products.ts` does the equivalent for the
market scope but its current handwritten query type/serializer has no `search`,
`peated_state`, or `edition_state`. This inventory records that migration seam;
this task deliberately does not change route selection or behavior.

Catalog search debounces for 350 ms. Non-Korean input is sent to both facet and
list requests. Korean input omits server search, fetches up to 500 products,
filters product English/Korean names locally, slices the page locally, and uses
that match count because facets did not see the search. Per-market search is
immediate and filters only the already loaded page by canonical, raw, and
Korean name; it is not sent to either request.

Both pages share `app/components/ProductFacetSidebar.tsx`. Its filter button
opens a left drawer; the backdrop, close button, or Escape closes it, and body
scroll is locked while open. Checkbox/range changes apply immediately without
closing the drawer. Sections are collapsible, selected counts remain visible,
and legacy `axes` controls relevance visibility. The catalog alone supplies a
market section. This is current behavior, not a v2 renderer design.

Catalog cards separately lazy-mount `PriceHistorySection` only after expansion.
That component calls `GET /api/products/{product_id}/price-history` with limit
30 and its own abort/error/loading state. The local-price time series is
orthogonal to facet/list migration and must remain independent.

Admin whisky taxonomy pages and `app/lib/adminWhisky.ts` are explicitly out of
scope: their administrative entity facets are a different contract from these
two public product browsing scopes.

## Test baseline

`npm test` first type-checks the repository and contract fixtures, then runs
Node's deterministic, non-server-starting test runner. A small local loader uses
the already-pinned TypeScript compiler for `.ts` and `.tsx` test modules.
Contract tests run in a plain Node environment. Pure React output is covered
with React's server renderer, also without DOM globals; a future interaction
test should opt into a DOM adapter only in that component test rather than
making the contract suite browser-dependent. During setup, a temporary
assertion expecting `1 === 2`
was run and observed to fail before the temporary file was removed; the
committed baseline is the passing configuration.
