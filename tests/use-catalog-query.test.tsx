import "./setup-jsdom.mjs";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

import { useCatalogQuery, type CatalogQueryResult } from "../app/lib/useCatalogQuery";
import { LEGACY_FACET_QUERY_METADATA } from "../app/lib/api/product-query";
import { catalogFacetV2Fixture, legacyCatalogFacetFixture } from "./fixtures/facet-responses";
import type { CatalogProduct } from "../app/lib/catalog";

afterEach(() => {
  cleanup();
});

function sampleProduct(id: number, marketCode = "market-a"): CatalogProduct {
  return {
    product_id: id,
    product_name: `Product ${id}`,
    offers: [
      {
        market_code: marketCode,
        market_name: "Sample Market",
        product_url_id: id * 10,
        local_price: "100.00",
        currency: "USD",
        available: true,
        source_url: "https://example.test/p",
        crawled_at: "2026-01-01T00:00:00Z",
      },
    ],
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
function useHarness(fetchImpl: typeof fetch, options: { version?: string } = {}) {
  let rerenderRef: ((props: { rawSearch: string }) => void) | null = null;
  const searchLog: { search: string; mode: "push" | "replace" }[] = [];

  const onSearchChange = (search: string, mode: "push" | "replace") => {
    searchLog.push({ search, mode });
    rerenderRef?.({ rawSearch: search });
  };

  const rendered = renderHook(
    (props: { rawSearch: string }) =>
      useCatalogQuery({
        rawSearch: props.rawSearch,
        onSearchChange,
        fetch: fetchImpl,
        baseUrl: "https://example.test",
        version: options.version,
      }),
    { initialProps: { rawSearch: "" } },
  );
  rerenderRef = rendered.rerender;
  return { ...rendered, searchLog };
}

async function waitReady(result: { current: CatalogQueryResult }) {
  await waitFor(() => assert.notEqual(result.current.status, "loading"));
}

test("v2 mode bootstraps with the legacy parameter table, then swaps to the live response's metadata without an extra refetch", async () => {
  const { impl, calls } = makeFetch({
    list: [sampleProduct(1)],
    facets: catalogFacetV2Fixture,
  });
  const { result } = useHarness(impl);

  await waitReady(result);

  assert.equal(result.current.version, "v2");
  assert.equal(calls.length, 2);
  assert.ok(calls.some((u) => u.includes("/api/products?") || u.endsWith("/api/products")));
  assert.ok(calls.some((u) => u.includes("/api/v2/products/facets")));
  assert.deepEqual(result.current.metadata, catalogFacetV2Fixture.groups);
  assert.notDeepEqual(result.current.metadata, LEGACY_FACET_QUERY_METADATA);
  assert.equal(result.current.pair?.list.length, 1);
});

test("legacy mode uses the static parameter table from the start and never requests /api/v2/", async () => {
  const { impl, calls } = makeFetch({
    list: [sampleProduct(1)],
    facets: legacyCatalogFacetFixture,
  });
  const { result } = useHarness(impl, { version: "legacy" });

  await waitReady(result);

  assert.equal(result.current.version, "legacy");
  assert.deepEqual(result.current.metadata, LEGACY_FACET_QUERY_METADATA);
  assert.equal(calls.some((u) => u.includes("/api/v2/")), false);
  assert.ok(calls.some((u) => u.includes("/api/products/facets")));
});

test("list and facet requests share byte-identical common filters; only sort/limit/offset differ", async () => {
  const { impl, calls } = makeFetch({
    list: [sampleProduct(1)],
    facets: catalogFacetV2Fixture,
  });
  const { result } = useHarness(impl);
  await waitReady(result);

  act(() => {
    result.current.setFacet("market", { kind: "terms", values: ["market-a", "market-b"] });
  });
  await waitReady(result);

  const listUrl = new URL(calls[calls.length - 2]!);
  const facetUrl = new URL(calls[calls.length - 1]!);
  assert.match(listUrl.pathname, /\/api\/products$/);
  assert.match(facetUrl.pathname, /\/api\/v2\/products\/facets$/);

  const listParams = listUrl.searchParams;
  listParams.delete("sort");
  listParams.delete("limit");
  listParams.delete("offset");
  assert.equal(listParams.toString(), facetUrl.searchParams.toString());
  assert.deepEqual(facetUrl.searchParams.getAll("market"), ["market-a", "market-b"]);
});

test("toggling available-only does not clear an unrelated facet selection", async () => {
  const { impl } = makeFetch({ list: [sampleProduct(1)], facets: catalogFacetV2Fixture });
  const { result, searchLog } = useHarness(impl);
  await waitReady(result);

  act(() => {
    result.current.setFacet("market", { kind: "terms", values: ["market-a"] });
  });
  await waitReady(result);
  assert.deepEqual(result.current.queryState.facets.market, { kind: "terms", values: ["market-a"] });

  act(() => {
    result.current.setAvailableOnly(false);
  });
  await waitReady(result);

  assert.deepEqual(result.current.queryState.facets.market, { kind: "terms", values: ["market-a"] });
  assert.equal(result.current.queryState.available, null);
  const lastSearch = searchLog[searchLog.length - 1]!.search;
  assert.ok(lastSearch.includes("market=market-a"));
  assert.equal(lastSearch.includes("available="), false);
});

test("resetFacets clears only facet selections, leaving search and availability untouched", async () => {
  const { impl } = makeFetch({ list: [sampleProduct(1)], facets: catalogFacetV2Fixture });
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
    result.current.setFacet("market", { kind: "terms", values: ["market-a"] });
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
  const { impl } = makeFetch({ list: [sampleProduct(1)], facets: catalogFacetV2Fixture });
  const { result } = useHarness(impl);
  await waitReady(result);

  act(() => {
    result.current.setPage(150);
  });
  await waitReady(result);
  assert.equal(result.current.queryState.offset, 150);

  act(() => {
    result.current.setFacet("market", { kind: "terms", values: ["market-a"] });
  });
  await waitReady(result);
  assert.equal(result.current.queryState.offset, 0);

  act(() => {
    result.current.setPage(50);
  });
  await waitReady(result);
  assert.equal(result.current.queryState.offset, 50);
  assert.deepEqual(result.current.queryState.facets.market, { kind: "terms", values: ["market-a"] });
});

test("a failed fetch surfaces as an error state, and retry re-issues the request", async () => {
  let shouldFail = true;
  const calls: string[] = [];
  const impl: typeof fetch = async (input) => {
    calls.push(String(input));
    if (shouldFail) return new Response("boom", { status: 500 });
    if (String(input).includes("/facets")) {
      return Response.json(catalogFacetV2Fixture);
    }
    return Response.json([sampleProduct(1)]);
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
  const { impl } = makeFetch({ list: [], facets: catalogFacetV2Fixture });
  assert.throws(() => {
    renderHook(() =>
      useCatalogQuery({
        rawSearch: "",
        onSearchChange: () => {},
        fetch: impl,
        baseUrl: "https://example.test",
        version: "auto",
      }),
    );
  }, /must be either/);
});
