import assert from "node:assert/strict";
import test from "node:test";

import {
  EMPTY_PRODUCT_QUERY_STATE,
  LEGACY_FACET_QUERY_METADATA,
  canonicalProductSearch,
  createProductQueryClient,
  parseProductQueryState,
  productPagePath,
  resetProductQueryState,
  resolveProductApiVersion,
  serializeCommonV2Filters,
  serializeLegacyCommonFilters,
  serializeLegacyFlatProductQuery,
  serializeProductQueryState,
  setFacetSelection,
  setPageOffset,
  setQueryCriteria,
  type FacetQueryMetadata,
  type ProductQueryState,
} from "../app/lib/api/product-query.ts";
import { catalogFacetV2Fixture } from "./fixtures/facet-responses.ts";

const metadata: readonly FacetQueryMetadata[] = catalogFacetV2Fixture.groups;

function state(
  partial: Partial<ProductQueryState> = {},
): ProductQueryState {
  return { ...EMPTY_PRODUCT_QUERY_STATE, ...partial };
}

test("empty and invalid browser state normalizes to canonical defaults", () => {
  assert.deepEqual(parseProductQueryState("", metadata), EMPTY_PRODUCT_QUERY_STATE);

  const canonical = canonicalProductSearch(
    "?available=maybe&limit=0&offset=-2&age_min=wat&unknown=x&search=%20%20",
    metadata,
  );
  assert.deepEqual(canonical.state, EMPTY_PRODUCT_QUERY_STATE);
  assert.equal(canonical.search, "");
  assert.equal(canonical.needsReplacement, true);
});

test("multi values repeat, deduplicate, and use stable metadata/value ordering", () => {
  const parsed = parseProductQueryState(
    "market=market-b&market=market-a&market=market-b&distillery_id=101",
    metadata,
  );
  assert.deepEqual(parsed.facets.market, {
    kind: "terms",
    values: ["market-a", "market-b"],
  });
  assert.deepEqual(parsed.facets.distillery, { kind: "terms", values: [101] });
  assert.equal(
    serializeProductQueryState(parsed, [...metadata].reverse()).toString(),
    "distillery_id=101&market=market-a&market=market-b",
  );
});

test("single-select duplicates replace with the last valid value", () => {
  const parsed = parseProductQueryState(
    "peated_state=peated&peated_state=bogus&peated_state=unknown" +
      "&edition_state=standard&edition_state=limited",
    metadata,
  );
  assert.deepEqual(parsed.facets.peated, { kind: "terms", values: ["unknown"] });
  assert.deepEqual(parsed.facets.limited, { kind: "terms", values: ["limited"] });
  assert.equal(
    serializeProductQueryState(parsed, metadata).toString(),
    "edition_state=limited&peated_state=unknown",
  );
});

test("Unicode search and reserved facet characters round trip safely", () => {
  const reservedMetadata: readonly FacetQueryMetadata[] = [
    {
      kind: "terms",
      key: "unfamiliar",
      query: { parameter: "server_filter", encoding: "repeat" },
      selection_mode: "multiple",
      options: [{ value: "a&b=c / 한글" }],
    },
  ];
  const initial = state({
    search: "한글 & cask=wine",
    facets: {
      unfamiliar: { kind: "terms", values: ["a&b=c / 한글"] },
    },
  });
  const encoded = serializeProductQueryState(initial, reservedMetadata).toString();
  assert.equal(
    encoded,
    "search=%ED%95%9C%EA%B8%80+%26+cask%3Dwine&server_filter=a%26b%3Dc+%2F+%ED%95%9C%EA%B8%80",
  );
  assert.deepEqual(parseProductQueryState(encoded, reservedMetadata), initial);
});

test("range endpoints preserve zero and both deployed range variants", () => {
  const parsed = parseProductQueryState(
    "age_min=0&age_max=25&abv_min=0.0&abv_max=62.50",
    metadata,
  );
  assert.deepEqual(parsed.facets.age_years, {
    kind: "range",
    min: "0",
    max: "25",
  });
  assert.deepEqual(parsed.facets.abv, {
    kind: "range",
    min: "0.0",
    max: "62.50",
  });
  assert.equal(
    serializeCommonV2Filters(parsed, metadata).toString(),
    "abv_min=0.0&abv_max=62.50&age_min=0&age_max=25",
  );
});

test("false availability, pagination, and list-only sort are not lost", () => {
  const parsed = parseProductQueryState(
    "available=false&sort=price&limit=50&offset=0",
    metadata,
  );
  assert.equal(parsed.available, false);
  assert.equal(parsed.limit, 50);
  assert.equal(parsed.offset, 0);
  assert.equal(parsed.sort, "price");
  assert.equal(
    serializeProductQueryState(parsed, metadata).toString(),
    "available=false&sort=price&limit=50",
  );
});

test("generated metadata controls repeat, single, and range API encoding", () => {
  const selected = state({
    available: false,
    search: "雪 & smoke",
    facets: {
      market: { kind: "terms", values: ["market-b", "market-a"] },
      distillery: { kind: "terms", values: [101, 0] },
      peated: { kind: "terms", values: ["unknown", "peated"] },
      limited: { kind: "terms", values: ["standard", "limited"] },
      age_years: { kind: "range", min: "0", max: null },
      abv: { kind: "range", min: null, max: "60" },
    },
  });
  assert.equal(
    serializeCommonV2Filters(selected, metadata).toString(),
    "available=false&search=%E9%9B%AA+%26+smoke&abv_max=60&age_min=0&distillery_id=0&distillery_id=101&edition_state=limited&market=market-a&market=market-b&peated_state=peated",
  );
});

test("generic term transport distinguishes absent, numeric zero, and boolean false", () => {
  const typedMetadata: readonly FacetQueryMetadata[] = [
    {
      kind: "terms",
      key: "typed",
      query: { parameter: "deployed_name", encoding: "repeat" },
      selection_mode: "multiple",
      options: [{ value: 0 }, { value: false }],
    },
  ];
  assert.equal(serializeCommonV2Filters(state(), typedMetadata).toString(), "");
  const selected = state({
    facets: { typed: { kind: "terms", values: [false, 0] } },
  });
  assert.equal(
    serializeCommonV2Filters(selected, typedMetadata).toString(),
    "deployed_name=false&deployed_name=0",
  );
  assert.deepEqual(
    parseProductQueryState("deployed_name=false&deployed_name=0", typedMetadata)
      .facets.typed,
    { kind: "terms", values: [false, 0] },
  );
});

test("criteria reset pagination, page changes retain selections, reset clears all facets", () => {
  const selected = state({
    offset: 100,
    limit: 50,
    available: true,
    search: "whisky",
    sort: "price",
    facets: {
      relevant: { kind: "terms", values: ["x"] },
      currently_irrelevant: { kind: "terms", values: ["unknown"] },
    },
  });
  assert.equal(setQueryCriteria(selected, { search: "new" }).offset, 0);
  assert.equal(setQueryCriteria(selected, { available: false }).offset, 0);
  assert.equal(setQueryCriteria(selected, { sort: "name" }).offset, 0);
  assert.equal(
    setFacetSelection(selected, "relevant", { kind: "terms", values: ["y"] })
      .offset,
    0,
  );

  const nextPage = setPageOffset(selected, 150);
  assert.deepEqual(nextPage.facets, selected.facets);
  assert.equal(nextPage.offset, 150);
  assert.deepEqual(resetProductQueryState(selected), {
    ...EMPTY_PRODUCT_QUERY_STATE,
    limit: 50,
  });
});

test("deep links, back/forward parsing, and canonical replacement are pure", () => {
  const deepLink =
    "?offset=50&market=market-b&search=%ED%94%BC%ED%8A%B8&available=true&limit=50";
  const first = canonicalProductSearch(deepLink, metadata);
  assert.equal(
    first.search,
    "available=true&search=%ED%94%BC%ED%8A%B8&market=market-b&limit=50&offset=50",
  );
  assert.equal(first.needsReplacement, true);
  const forward = parseProductQueryState(first.search, metadata);
  const back = parseProductQueryState("market=market-a&offset=0", metadata);
  assert.deepEqual(forward.facets.market, { kind: "terms", values: ["market-b"] });
  assert.deepEqual(back.facets.market, { kind: "terms", values: ["market-a"] });
  assert.equal(back.offset, 0);
  assert.deepEqual(
    parseProductQueryState(
      serializeProductQueryState(forward, metadata),
      metadata,
    ),
    forward,
  );
});

test("market scope is encoded in the path rather than filter state", () => {
  assert.equal(productPagePath({ kind: "catalog" }), "/products");
  assert.equal(
    productPagePath({ kind: "market", marketCode: "kr/서울 & malt" }),
    "/markets/kr%2F%EC%84%9C%EC%9A%B8%20%26%20malt",
  );
});

test("one common snapshot feeds byte-equivalent list and v2 facet requests", async () => {
  const urls: string[] = [];
  let calls = 0;
  const serializer = (queryState: ProductQueryState, groups: readonly FacetQueryMetadata[]) => {
    calls += 1;
    return serializeCommonV2Filters(queryState, groups);
  };
  const client = createProductQueryClient(
    { kind: "market", marketCode: "sample/market" },
    {
      version: "v2",
      baseUrl: "https://example.test",
      serializeCommonFilters: serializer,
      fetch: async (input) => {
        urls.push(String(input));
        return new Response("[]", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  );
  await client.refresh(
    state({
      available: false,
      search: "peated & rare",
      sort: "price",
      limit: 50,
      offset: 100,
      facets: {
        peated: { kind: "terms", values: ["unknown"] },
        age_years: { kind: "range", min: "0", max: "18" },
      },
    }),
    metadata,
  );

  assert.equal(calls, 1);
  assert.equal(client.version, "v2");
  assert.match(urls[0]!, /\/api\/markets\/sample%2Fmarket\/products\?/);
  assert.match(urls[1]!, /\/api\/v2\/markets\/sample%2Fmarket\/facets\?/);
  const list = new URL(urls[0]!).searchParams;
  const facets = new URL(urls[1]!).searchParams;
  list.delete("sort");
  list.delete("limit");
  list.delete("offset");
  assert.equal(list.toString(), facets.toString());
  assert.equal(
    facets.toString(),
    "available=false&search=peated+%26+rare&age_min=0&age_max=18&peated_state=unknown",
  );
});

test("version selection defaults v2, fails closed, and never retries legacy", async () => {
  assert.equal(resolveProductApiVersion(undefined), "v2");
  assert.equal(resolveProductApiVersion("legacy"), "legacy");
  assert.throws(() => resolveProductApiVersion("auto"), /must be either/);
  assert.throws(
    () => createProductQueryClient({ kind: "catalog" }, { version: "V2" }),
    /must be either/,
  );

  const urls: string[] = [];
  const client = createProductQueryClient(
    { kind: "catalog" },
    {
      version: "v2",
      baseUrl: "https://example.test",
      fetch: async (input) => {
        urls.push(String(input));
        return new Response("contract defect", { status: 500 });
      },
    },
  );
  await assert.rejects(() => client.refresh(state(), metadata), /HTTP 500/);
  assert.equal(urls.length, 2);
  assert.equal(urls.some((url) => url.includes("/api/products/facets")), false);
});

test("legacy fallback keeps flat query behavior and a coherent legacy pair", async () => {
  assert.equal(
    serializeLegacyFlatProductQuery(
      {
        available: false,
        market: ["a", "b"],
        peated: false,
        age_min: 0,
        limited: false,
        sort: "name",
        limit: 50,
        offset: 0,
      },
      true,
    ).toString(),
    "available=false&market=a&market=b&peated=false&age_min=0&limited=false&sort=name&limit=50&offset=0",
  );

  const legacyState = state({
    available: true,
    search: "malt",
    facets: {
      peated: { kind: "terms", values: ["unknown"] },
      limited: { kind: "terms", values: ["standard"] },
    },
  });
  assert.equal(
    serializeLegacyCommonFilters(legacyState).toString(),
    "available=true&search=malt&edition_state=standard&peated_state=unknown",
  );

  const urls: string[] = [];
  const client = createProductQueryClient(
    { kind: "catalog" },
    {
      version: "legacy",
      baseUrl: "https://example.test",
      fetch: async (input) => {
        urls.push(String(input));
        return Response.json({});
      },
    },
  );
  await client.refresh(legacyState, LEGACY_FACET_QUERY_METADATA);
  assert.equal(urls.some((url) => url.includes("/api/v2/")), false);
  assert.equal(urls.some((url) => url.includes("/api/products/facets")), true);
});
