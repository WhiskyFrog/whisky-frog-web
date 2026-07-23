import "./setup-jsdom.mjs";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

import { useMarketQuery, type MarketQueryResult } from "../app/lib/useMarketQuery";
import { LEGACY_FACET_QUERY_METADATA } from "../app/lib/api/product-query";
import { marketFacetV2Fixture, legacyMarketFacetFixture } from "./fixtures/facet-responses";
import type { MarketProduct } from "../app/lib/products";

afterEach(() => {
  cleanup();
});

function sampleProduct(id: number, marketCode: string): MarketProduct {
  return {
    product_id: id,
    product_url_id: id * 10,
    product_name: `Product ${id}`,
    raw_name: null,
    local_price: "100.00",
    currency: "USD",
    available: true,
    source_url: `https://example.test/${marketCode}/${id}`,
    crawled_at: "2026-01-01T00:00:00Z",
  };
}

interface MockRoutes {
  list?: unknown;
  facets?: unknown;
  facetsStatus?: number;
}

function makeFetch(routes: MockRoutes) {
  const calls: string[] = [];
  const impl: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes("/facets")) {
      return new Response(JSON.stringify(routes.facets ?? {}), {
        status: routes.facetsStatus ?? 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify(routes.list ?? []), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { impl, calls };
}

/** Drives the hook the way the real page does: `onSearchChange` feeds the next `rawSearch` prop. */
function useHarness(
  fetchImpl: typeof fetch,
  options: { version?: string; marketCode?: string; initialSearch?: string } = {},
) {
  let rerenderRef: ((props: { rawSearch: string }) => void) | null = null;
  const searchLog: { search: string; mode: "push" | "replace" }[] = [];

  const onSearchChange = (search: string, mode: "push" | "replace") => {
    searchLog.push({ search, mode });
    rerenderRef?.({ rawSearch: search });
  };

  const rendered = renderHook(
    (props: { rawSearch: string }) =>
      useMarketQuery({
        marketCode: options.marketCode ?? "market-a",
        rawSearch: props.rawSearch,
        onSearchChange,
        fetch: fetchImpl,
        baseUrl: "https://example.test",
        version: options.version,
      }),
    { initialProps: { rawSearch: options.initialSearch ?? "" } },
  );
  rerenderRef = rendered.rerender;
  return { ...rendered, searchLog };
}

async function waitReady(result: { current: MarketQueryResult }) {
  await waitFor(() => assert.notEqual(result.current.status, "loading"));
}

test("v2 mode bootstraps with the legacy parameter table, then swaps to the live response's metadata without an extra refetch", async () => {
  const { impl, calls } = makeFetch({
    list: [sampleProduct(1, "market-a")],
    facets: marketFacetV2Fixture,
  });
  const { result } = useHarness(impl);

  await waitReady(result);

  assert.equal(result.current.version, "v2");
  assert.equal(calls.length, 2);
  assert.ok(calls.some((u) => u.includes("/api/markets/market-a/products")));
  assert.ok(calls.some((u) => u.includes("/api/v2/markets/market-a/facets")));
  assert.deepEqual(result.current.metadata, marketFacetV2Fixture.groups);
  assert.notDeepEqual(result.current.metadata, LEGACY_FACET_QUERY_METADATA);
  assert.equal(result.current.pair?.list.length, 1);
});

test("the market code is safely encoded in both list and facet request paths", async () => {
  const { impl, calls } = makeFetch({
    list: [sampleProduct(1, "market a/b")],
    facets: marketFacetV2Fixture,
  });
  const { result } = useHarness(impl, { marketCode: "market a/b" });
  await waitReady(result);

  assert.ok(calls.some((u) => u.includes("/api/markets/market%20a%2Fb/products")));
  assert.ok(calls.some((u) => u.includes("/api/v2/markets/market%20a%2Fb/facets")));
});

test("legacy mode uses the static parameter table from the start and never requests /api/v2/", async () => {
  const { impl, calls } = makeFetch({
    list: [sampleProduct(1, "market-a")],
    facets: legacyMarketFacetFixture,
  });
  const { result } = useHarness(impl, { version: "legacy" });

  await waitReady(result);

  assert.equal(result.current.version, "legacy");
  assert.deepEqual(result.current.metadata, LEGACY_FACET_QUERY_METADATA);
  assert.equal(calls.some((u) => u.includes("/api/v2/")), false);
  assert.ok(calls.some((u) => u.includes("/api/markets/market-a/facets")));
});

test("list and facet requests share byte-identical common filters; only limit/offset differ (no market-only sort control)", async () => {
  const { impl, calls } = makeFetch({
    list: [sampleProduct(1, "market-a")],
    facets: marketFacetV2Fixture,
  });
  const { result } = useHarness(impl);
  await waitReady(result);

  act(() => {
    result.current.setFacet("spirit_type", { kind: "terms", values: ["single_malt", "blend"] });
  });
  await waitReady(result);

  const listUrl = new URL(calls[calls.length - 2]!);
  const facetUrl = new URL(calls[calls.length - 1]!);
  assert.match(listUrl.pathname, /\/api\/markets\/market-a\/products$/);
  assert.match(facetUrl.pathname, /\/api\/v2\/markets\/market-a\/facets$/);

  const listParams = listUrl.searchParams;
  listParams.delete("limit");
  listParams.delete("offset");
  assert.equal(listParams.toString(), facetUrl.searchParams.toString());
  assert.deepEqual(facetUrl.searchParams.getAll("spirit_type"), ["blend", "single_malt"]);
  assert.equal(listParams.has("sort"), false);
});

test("captured requests carry identical explicit-false/zero/peated_state/edition_state/range parameters on both list and facet calls", async () => {
  // Explicit `available=false` (show unavailable too — distinct from the default omitted
  // param, which the deployed contract defaults to true) and a zero-valued age bound both
  // originate from the URL directly, proving the parity holds for a real request, not just
  // hook-driven state changes. Uses legacy mode so the parameter table (which is the only one
  // covering peated/limited/age for this market fixture) stays authoritative for the whole
  // session instead of being replaced by the live v2 response's narrower group set.
  const { impl, calls } = makeFetch({
    list: [sampleProduct(1, "market-a")],
    facets: legacyMarketFacetFixture,
  });
  const { result } = useHarness(impl, {
    version: "legacy",
    initialSearch: "available=false&peated_state=unknown&edition_state=standard&age_min=0",
  });
  await waitReady(result);

  const listUrl = new URL(calls[calls.length - 2]!);
  const facetUrl = new URL(calls[calls.length - 1]!);
  listUrl.searchParams.delete("limit");
  listUrl.searchParams.delete("offset");
  assert.equal(listUrl.searchParams.toString(), facetUrl.searchParams.toString());
  assert.equal(facetUrl.searchParams.get("available"), "false");
  assert.equal(facetUrl.searchParams.get("peated_state"), "unknown");
  assert.equal(facetUrl.searchParams.get("edition_state"), "standard");
  assert.equal(facetUrl.searchParams.get("age_min"), "0");
});

test("toggling available-only does not clear an unrelated facet selection", async () => {
  const { impl } = makeFetch({ list: [sampleProduct(1, "market-a")], facets: marketFacetV2Fixture });
  const { result, searchLog } = useHarness(impl);
  await waitReady(result);

  act(() => {
    result.current.setFacet("spirit_type", { kind: "terms", values: ["single_malt"] });
  });
  await waitReady(result);
  assert.deepEqual(result.current.queryState.facets.spirit_type, {
    kind: "terms",
    values: ["single_malt"],
  });

  act(() => {
    result.current.setAvailableOnly(false);
  });
  await waitReady(result);

  assert.deepEqual(result.current.queryState.facets.spirit_type, {
    kind: "terms",
    values: ["single_malt"],
  });
  assert.equal(result.current.queryState.available, null);
  const lastSearch = searchLog[searchLog.length - 1]!.search;
  assert.ok(lastSearch.includes("spirit_type=single_malt"));
});

test("resetFacets clears only facet selections, leaving search and availability untouched", async () => {
  const { impl } = makeFetch({ list: [sampleProduct(1, "market-a")], facets: marketFacetV2Fixture });
  const { result } = useHarness(impl);
  await waitReady(result);

  act(() => {
    result.current.setAvailableOnly(true);
  });
  await waitReady(result);
  act(() => {
    result.current.setSearch("peated malt");
  });
  await waitReady(result);
  act(() => {
    result.current.setFacet("spirit_type", { kind: "terms", values: ["single_malt"] });
  });
  await waitReady(result);

  act(() => {
    result.current.resetFacets();
  });
  await waitReady(result);

  assert.deepEqual(result.current.queryState.facets, {});
  assert.equal(result.current.queryState.search, "peated malt");
  assert.equal(result.current.queryState.available, true);
});

test("a facet or search change resets pagination; changing the page preserves selections", async () => {
  const { impl } = makeFetch({ list: [sampleProduct(1, "market-a")], facets: marketFacetV2Fixture });
  const { result } = useHarness(impl);
  await waitReady(result);

  act(() => {
    result.current.setPage(200);
  });
  await waitReady(result);
  assert.equal(result.current.queryState.offset, 200);

  act(() => {
    result.current.setFacet("spirit_type", { kind: "terms", values: ["single_malt"] });
  });
  await waitReady(result);
  assert.equal(result.current.queryState.offset, 0);

  act(() => {
    result.current.setPage(100);
  });
  await waitReady(result);
  assert.equal(result.current.queryState.offset, 100);
  assert.deepEqual(result.current.queryState.facets.spirit_type, {
    kind: "terms",
    values: ["single_malt"],
  });
});

test("a failed fetch surfaces as an error state, and retry re-issues the request", async () => {
  let shouldFail = true;
  const calls: string[] = [];
  const impl: typeof fetch = async (input) => {
    calls.push(String(input));
    if (shouldFail) return new Response("boom", { status: 500 });
    if (String(input).includes("/facets")) {
      return Response.json(marketFacetV2Fixture);
    }
    return Response.json([sampleProduct(1, "market-a")]);
  };
  const { result } = useHarness(impl);

  await waitFor(() => assert.equal(result.current.status, "error"));
  assert.ok(result.current.errorMessage.length > 0);

  shouldFail = false;
  act(() => {
    result.current.retry();
  });
  await waitReady(result);
  assert.equal(result.current.status, "ready");
  assert.equal(result.current.pair?.list.length, 1);
});

test("an invalid explicit version fails closed instead of silently mixing contracts", async () => {
  const { impl } = makeFetch({ list: [], facets: marketFacetV2Fixture });
  assert.throws(() => {
    renderHook(() =>
      useMarketQuery({
        marketCode: "market-a",
        rawSearch: "",
        onSearchChange: () => {},
        fetch: impl,
        baseUrl: "https://example.test",
        version: "auto",
      }),
    );
  }, /must be either/);
});
