---
schema: aios.plan/v1
id: facet-v2-web-migration
project: whisky-frog-web
profile: migration
profile_reason: "The brief is an explicit compatibility migration between a legacy and versioned API contract whose dominant risks are contract preflight, behavioral integrity during conversion, production validation, and a tested fallback/removal boundary. The migration profile is narrower than software-feature because the desired UI already exists and must retain its behavior while its contract and state model change."
---

# Plan facet-v2-web-migration

## Brief

Analyze and produce a reviewed implementation plan for migrating whisky-frog-web product catalog and per-market filtering from the legacy flat facet responses to whisky-frog-lab's versioned structured v2 facet routes. Trace every current consumer and URL/query-state path; regenerate OpenAPI types from the deployed contract; design a discriminator-driven generic renderer using server-supplied labels, query metadata, selection_mode, selected, relevant, bounds, units, and dependency parents; support peated_state including unknown and edition_state while preserving selected-zero and selected-irrelevant values until explicitly cleared; retain list/facet parity, catalog product counts versus per-market offer counts, search, availability, pagination, responsive drawer behavior, keyboard/accessibility behavior, and the existing price-history card. Define automated contract, query-serialization, component, and production smoke evidence, plus a safe legacy fallback/removal gate. Do not implement or deploy in this planning task, do not change whisky-frog-lab, and do not contact billable providers or mutate production data.

## Profile Application

The `migration` profile supplies five explicit boundaries for this plan:

- **Preflight.** Regenerate the checked-in OpenAPI types from the deployed,
  read-only contract and fail closed unless the generated operations and
  discriminated schemas describe both v2 facet scopes. Record the current
  consumer and state-flow inventory before changing it, and establish the
  automated test harness that will prove the contract rather than shadowing it
  with handwritten response interfaces.
- **Backup.** This is a stateless frontend/API migration, so there is no data
  backup to take. The recovery asset is the known-good legacy client,
  serializer behavior, and representative response fixtures. Preserve that
  code behind an explicit version selector and prove it with the same smoke
  scenarios before any removal is considered.
- **Conversion.** Convert the shared query model and facet renderer first,
  then attach the catalog and per-market pages separately. The conversion is
  driven by generated discriminators and server metadata rather than another
  page-specific field map.
- **Validation.** Contract tests, query round-trip tests, reducer/component
  tests, request-parity integration tests, a production build, and read-only
  smoke scenarios provide evidence at progressively wider boundaries. Counts,
  search, availability, pagination, responsive behavior, accessibility, and
  price-history behavior are explicit invariants, not visual spot checks.
- **Rollback readiness.** Keep the legacy route path selectable for at least
  one verified release boundary, exercise the fallback rather than merely
  documenting it, and make legacy removal a separate approval gate backed by
  v2 production evidence. No automatic fallback may silently mix a v2 list
  with legacy facet semantics.

## Assumptions and Risks

- **Current consumer inventory is small but duplicated.** The public catalog
  page `app/(home)/products/page.tsx` calls `getCatalogFacets` and
  `listCatalogProducts` from `app/lib/catalog.ts`; the per-market page
  `app/(home)/markets/[code]/page.tsx` calls `getMarketFacets` and
  `listMarketProducts` from `app/lib/products.ts`. Both pass their response to
  `app/components/ProductFacetSidebar.tsx`. No other public runtime consumer
  of the two facet routes was found. Admin product taxonomy endpoints also use
  the word “facets,” but they are a separate editing contract and are out of
  scope.
- **There is currently no browser query-state path.** Both pages hold filters,
  availability, search, and offset in component-local React state. Only the
  market code is represented in the route path; neither page reads or writes
  URL search parameters, so reload, sharing, and back/forward navigation lose
  filter state. The API query path is duplicated between `catalog.ts` and
  `products.ts`, while each page separately maps `ProductFilters` to request
  fields. The migration must introduce one canonical URL/API state boundary
  and explicitly test initialization and navigation, not assume an existing
  URL format must be preserved.
- **The checked-in generated contract is stale for this goal.** At planning
  time `app/lib/api/types.gen.ts` exposes only
  `/api/products/facets` → `CatalogFacetsOut` and
  `/api/markets/{market_code}/facets` → `MarketFacetsOut`, both legacy flat
  shapes. The configured production generator is `npm run gen:api:prod`.
  Network resolution was unavailable during this planning session, so exact
  v2 path strings and discriminator literals are deliberately not guessed in
  the proposals; the generated deployed contract is the authority and a
  missing/incompatible v2 contract is a preflight blocker, not permission to
  hand-author substitute types.
- **Legacy state cannot express the whole v2 domain.** `ProductFilters.peated`
  is `boolean | null`, so it cannot select an explicit unknown value, and
  there is no edition state. The sidebar hardcodes axes, Korean labels,
  controls, min/max limits, and dependency layout. It also hides panels based
  on `axes`/non-empty arrays and therefore has no general rule to keep a
  selected value whose count becomes zero or whose facet becomes irrelevant.
  The converted state must be keyed by server query metadata and must preserve
  such values until the user clears that value or invokes the explicit reset.
- **Counts have different meanings by scope.** The checked-in contract
  documents the catalog total as distinct products even when a product has
  offers in several markets. Per-market results are market offer rows. The
  generic drawer cannot bake in one “products” noun; the page scope must supply
  the correct count semantics, and tests must detect accidental catalog-offer
  double counting.
- **Search is already asymmetric and is a migration risk.** Catalog English
  search is sent to the server, while Korean search omits `search` from the
  facet request, fetches at most 500 rows, and filters locally. Per-market
  search filters only the currently loaded page because its list endpoint is
  treated as having no search parameter. Preflight must determine what the
  deployed contract supports. Integration may use a shared server search only
  when the generated contract supports it; otherwise it must retain the
  existing matching fields as an explicitly local presentation filter and
  must not present an unsearched facet total as a search-match total.
- **List/facet parity is stricter than equal-looking objects.** Multi-value
  encoding, false and zero values, availability defaults, ranges, market
  scope, dependency selections, and search must be serialized once and reused
  for both requests. Only documented list-only controls such as pagination and
  sort may differ. Request-capture tests, rather than duplicated assertions on
  two implementations, are the integrity check.
- **Pagination currently infers continuation.** Catalog uses 50 rows and
  per-market uses 100, with “next” enabled when a full page is returned; totals
  come from facets. Changing route contracts must not turn a facet total into
  a page-row count or reset a selected filter merely because a page has no
  matching rows. Any changed pagination metadata in the deployed contract
  should be consumed only after its semantics are contract-tested.
- **Accessibility needs preservation and completion.** The existing drawer
  supports Escape, backdrop close, `inert`/`aria-hidden`, and body scroll
  locking, but it does not explicitly trap focus, move focus into the drawer,
  restore trigger focus, or expose dialog labeling. The migration should
  retain the working behavior and close these keyboard/focus gaps while
  rendering server-driven controls with native names, groups, and states.
- **The price-history card is orthogonal but easy to regress.** It is lazily
  rendered only from catalog cards and calls the unchanged
  `/api/products/{product_id}/price-history` client. The facet migration must
  leave this endpoint and its lazy expansion behavior intact; smoke and
  component evidence must prove that rather than rewriting it.
- **Production operations remain read-only in these Tasks.** Contract
  generation and smoke checks may issue GET requests to the deployed OpenAPI,
  facet, list, and page URLs. They may not change whisky-frog-lab, deploy,
  authenticate to admin surfaces, contact billable providers, or write
  production data. A release/configuration change remains an operator action.

## Decomposition Rationale

Six proposals keep each outcome focused enough for one Worker session and give
each a standalone, observable completion boundary.

The contract-preflight outcome establishes generated truth, a traceable
consumer/state inventory, representative legacy/v2 fixtures, and the missing
test harness. It does not mix contract discovery with UI decisions, so a
missing deployed route stops the migration before speculative code spreads.

The state-and-serialization outcome owns the compatibility seam: canonical URL
state, query-metadata-driven request construction, exact list/facet parity, and
an explicit whole-stack route-version choice. Its pure round-trip and request
tests make zero/false/multi-value mistakes observable without a browser.

The renderer outcome is a component boundary. It consumes the generated union
and normalized state, renders all deployed discriminator variants and
dependency relationships, and proves preservation plus accessibility with
fixture-driven tests. It does not own either page’s fetching or count meaning.

Catalog and per-market integration are separate because they have different
row identities, count units, search behavior, page sizes, and presentation.
This prevents one broad page rewrite from hiding a catalog distinct-product
regression or a per-market offer-count regression. The catalog outcome also
owns the price-history invariant; the market outcome owns its card/table
responsive modes and raw-name search invariant.

The final validation outcome joins the two scopes in production-like request
and browser scenarios, verifies both v2 and legacy configurations, and records
the evidence required at the removal gate. It intentionally does not remove
the fallback or deploy: removal and rollout are operator-approved actions
after the evidence exists.

## Execution Order

1. P-01 establishes the deployed v2 contract, current-flow inventory, fixtures,
   and automated test foundation; any absent or incompatible v2 route blocks
   conversion without modifying the backend.
2. P-02 builds the canonical URL/query serializer and the explicit v2/legacy
   client seam on the generated contract, so both pages can share exact
   request semantics and a recoverable route choice.
3. P-03 builds and verifies the discriminator-driven renderer and selection
   preservation/accessibility behavior against the structured fixtures,
   independently of page fetching.
4. P-04 moves the catalog scope onto the shared v2 seam and renderer while
   proving distinct-product counts, search/availability/pagination behavior,
   complete offers, and the unchanged lazy price-history card.
5. P-05 moves the per-market scope onto the same seam while proving offer
   counts, market-specific search, availability, pagination, and responsive
   card/table behavior.
6. P-06 runs the joined contract, serialization, component, build, and
   production smoke matrix, drills the legacy fallback as a whole-stack mode,
   and records the separate approval criteria for eventual legacy removal.
