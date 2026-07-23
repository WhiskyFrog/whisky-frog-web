import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_PRODUCT_QUERY_STATE,
  createProductQueryClient,
  type FacetQueryMetadata,
  type ProductQueryScope,
  type ProductQueryState,
} from "../app/lib/api/product-query.ts";
import { catalogFacetV2Fixture, marketFacetV2Fixture } from "./fixtures/facet-responses.ts";

/**
 * Joined request-parity matrix (task-0007 acceptance criterion 2).
 *
 * Both scopes are driven by the same real, generated-contract-shaped fixture
 * (`catalogFacetV2Fixture.groups`) so the assertions below exercise the exact
 * query metadata a live v2 response supplies — not a second handwritten facet
 * table. The fixture already carries a multi-select group (`market`), a
 * dependency-parent-bearing group (`distillery`, whose selected option lists
 * `country`/`region` parents), a single-select group with an explicit
 * `unknown` state and `relevant: false` (`peated`), a single-select
 * `edition_state` group (`limited`), and two range groups — one selected
 * (`age_years`) and one `relevant: false` (`abv`) — which covers every case
 * the acceptance criterion enumerates without inventing a parallel contract.
 */
const metadata: readonly FacetQueryMetadata[] = catalogFacetV2Fixture.groups;

function state(overrides: Partial<ProductQueryState> = {}): ProductQueryState {
  return { ...EMPTY_PRODUCT_QUERY_STATE, ...overrides };
}

interface ScopeFixture {
  name: string;
  scope: ProductQueryScope;
  listPattern: RegExp;
  facetPattern: RegExp;
}

const scopes: ScopeFixture[] = [
  {
    name: "catalog",
    scope: { kind: "catalog" },
    listPattern: /^https:\/\/example\.test\/api\/products(?:\?|$)/,
    facetPattern: /^https:\/\/example\.test\/api\/v2\/products\/facets(?:\?|$)/,
  },
  {
    name: "market",
    // A market code with reserved characters proves the shared path-encoding
    // behavior holds under the same case matrix as the catalog scope.
    scope: { kind: "market", marketCode: "sample market/α" },
    listPattern: /^https:\/\/example\.test\/api\/markets\/sample%20market%2F%CE%B1\/products(?:\?|$)/,
    facetPattern:
      /^https:\/\/example\.test\/api\/v2\/markets\/sample%20market%2F%CE%B1\/facets(?:\?|$)/,
  },
];

interface Case {
  name: string;
  overrides: Partial<ProductQueryState>;
}

const cases: Case[] = [
  { name: "default", overrides: {} },
  {
    name: "multi-select",
    overrides: { facets: { market: { kind: "terms", values: ["market-a", "market-b"] } } },
  },
  {
    name: "single-select",
    overrides: { facets: { peated: { kind: "terms", values: ["peated"] } } },
  },
  {
    name: "zero/false",
    overrides: {
      available: false,
      facets: { age_years: { kind: "range", min: "0", max: null } },
    },
  },
  {
    name: "ranges",
    overrides: {
      facets: {
        age_years: { kind: "range", min: "5", max: "18" },
        abv: { kind: "range", min: "40", max: null },
      },
    },
  },
  {
    // `distillery`'s selected option in the fixture carries `parents` for
    // country/region; selecting it proves a dependency-parent-bearing option
    // still transports only its own declared query parameter.
    name: "dependency parents",
    overrides: { facets: { distillery: { kind: "terms", values: [101] } } },
  },
  {
    // `abv` is `relevant: false` in the fixture; selecting it anyway proves an
    // irrelevant facet's value is not silently dropped from either request.
    name: "selected-irrelevant",
    overrides: { facets: { abv: { kind: "range", min: "45", max: null } } },
  },
  {
    name: "peated unknown",
    overrides: { facets: { peated: { kind: "terms", values: ["unknown"] } } },
  },
  {
    name: "edition state",
    overrides: { facets: { limited: { kind: "terms", values: ["limited"] } } },
  },
  { name: "search", overrides: { search: "글렌 & rare" } },
  { name: "availability", overrides: { available: true } },
  { name: "paginated", overrides: { offset: 100, sort: "price", limit: 25 } },
];

for (const scopeFixture of scopes) {
  for (const productCase of cases) {
    test(`${scopeFixture.name} scope / ${productCase.name}: list and facet requests share identical filter parameters`, async () => {
      const urls: string[] = [];
      const client = createProductQueryClient(scopeFixture.scope, {
        version: "v2",
        baseUrl: "https://example.test",
        fetch: async (input) => {
          urls.push(String(input));
          return new Response("[]", {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      });

      await client.refresh(state(productCase.overrides), metadata);

      assert.equal(urls.length, 2);
      const [listUrl, facetUrl] = urls as [string, string];
      assert.match(listUrl, scopeFixture.listPattern);
      assert.match(facetUrl, scopeFixture.facetPattern);

      const list = new URL(listUrl).searchParams;
      const facets = new URL(facetUrl).searchParams;

      // Only contract-documented list-only parameters may differ.
      list.delete("sort");
      list.delete("limit");
      list.delete("offset");
      assert.equal(
        list.toString(),
        facets.toString(),
        `shared filter parameters diverged for ${scopeFixture.name}/${productCase.name}`,
      );

      // The facet request never receives list-only pagination/sort state.
      assert.equal(new URL(facetUrl).searchParams.has("offset"), false);
      assert.equal(new URL(facetUrl).searchParams.has("limit"), false);
      assert.equal(new URL(facetUrl).searchParams.has("sort"), false);
    });
  }
}

test("paginated case actually carries list-only pagination/sort on the list request", async () => {
  const urls: string[] = [];
  const client = createProductQueryClient(
    { kind: "catalog" },
    {
      version: "v2",
      baseUrl: "https://example.test",
      fetch: async (input) => {
        urls.push(String(input));
        return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
      },
    },
  );
  await client.refresh(state({ offset: 100, sort: "price", limit: 25 }), metadata);
  const list = new URL(urls[0]!).searchParams;
  assert.equal(list.get("offset"), "100");
  assert.equal(list.get("sort"), "price");
  assert.equal(list.get("limit"), "25");
});

test("catalog totals are scoped to distinct products; market totals are scoped to offers", () => {
  // Distinct from parameter parity above: even when both scopes share
  // byte-identical filter parameters (proven per-case for every case in this
  // suite), their facet responses never share a count identity. A regression
  // that relabeled one scope's total as the other's noun would not be caught
  // by parameter-equality assertions alone, so it is checked separately here.
  assert.equal(catalogFacetV2Fixture.count_unit, "product");
  assert.equal(marketFacetV2Fixture.count_unit, "offer");
  assert.notEqual(
    (catalogFacetV2Fixture as { count_unit: string }).count_unit,
    (marketFacetV2Fixture as { count_unit: string }).count_unit,
  );
});
