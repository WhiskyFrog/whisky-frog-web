import "./setup-jsdom.mjs";

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CatalogPageView } from "../app/components/CatalogView";
import { catalogFacetV2Fixture, legacyCatalogFacetFixture } from "./fixtures/facet-responses";
import type { CatalogProduct } from "../app/lib/catalog";

afterEach(() => {
  cleanup();
});

const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = originalFetch;
});

function offer(marketCode: string, marketName: string, urlId: number, price: string) {
  return {
    market_code: marketCode,
    market_name: marketName,
    product_url_id: urlId,
    local_price: price,
    currency: "USD",
    available: true,
    source_url: `https://example.test/${marketCode}/${urlId}`,
    crawled_at: "2026-01-01T00:00:00Z",
    direct_price_krw: Number(price) * 1300,
  };
}

/** One distinct product sold across two markets — the case v2 total must count once, not twice. */
const multiMarketProduct: CatalogProduct = {
  product_id: 501,
  product_name: "Glorpwood 12yo",
  product_name_korean: "글로프우드 12년",
  offers: [offer("market-a", "예시 마켓", 1, "100"), offer("market-b", "보조 마켓", 2, "95")],
};

/** `count` distinct single-offer products, ids offset by `startId` so pages never collide. */
function makeProducts(count: number, startId: number): CatalogProduct[] {
  return Array.from({ length: count }, (_, i) => ({
    product_id: startId + i,
    product_name: `Product ${startId + i}`,
    offers: [offer("market-a", "예시 마켓", startId + i, "100")],
  }));
}

function makeCatalogFetch(routes: { list: unknown; facets: unknown }) {
  const calls: string[] = [];
  const impl: typeof fetch = async (input) => {
    calls.push(String(input));
    if (String(input).includes("/facets")) return Response.json(routes.facets);
    return Response.json(routes.list);
  };
  return { impl, calls };
}

/** Mirrors how the real page's `onSearchChange` feeds the next `rawSearch` back in. */
function renderCatalog(props: { version?: string; fetch: typeof fetch; initialSearch?: string }) {
  let currentSearch = props.initialSearch ?? "";
  let rerenderView: (() => void) | null = null;
  const onSearchChange = (search: string) => {
    currentSearch = search;
    rerenderView?.();
  };

  const view = render(
    <CatalogPageView
      rawSearch={currentSearch}
      onSearchChange={onSearchChange}
      version={props.version}
      baseUrl="https://example.test"
      fetch={props.fetch}
    />,
  );
  rerenderView = () =>
    view.rerender(
      <CatalogPageView
        rawSearch={currentSearch}
        onSearchChange={onSearchChange}
        version={props.version}
        baseUrl="https://example.test"
        fetch={props.fetch}
      />,
    );
  return view;
}

test("v2 catalog: header/result count reflects distinct products, not summed offers, and highlights the selected market", async () => {
  const fixture = { ...catalogFacetV2Fixture, total: 1 };
  const { impl } = makeCatalogFetch({ list: [multiMarketProduct], facets: fixture });
  renderCatalog({ fetch: impl, initialSearch: "market=market-a" });

  await screen.findByText("글로프우드 12년");

  // One product, two offers — the shown count must be the product total (1), never 2 (offers).
  assert.ok(screen.getByText(/총 1개/));
  assert.ok(screen.getAllByText("예시 마켓").length > 0);
  assert.ok(screen.getAllByText("보조 마켓").length > 0);

  // First offer is the backend-sorted cheapest — it still gets the badge regardless of highlight.
  assert.ok(screen.getByText("최저가"));

  // market-a is selected via the URL, so its offer row (not market-b's) must carry the
  // highlight styling used to call out the selected market among all shown offers. The facet
  // panel also renders these market names as filter labels, so scope to the offer links.
  const highlightedRow = screen.getByRole("link", { name: "예시 마켓" }).closest("li");
  const otherRow = screen.getByRole("link", { name: "보조 마켓" }).closest("li");
  assert.ok(highlightedRow?.className.includes("bg-blue-50"));
  assert.ok(!otherRow?.className.includes("bg-blue-50"));
});

test("v2 catalog: available-only toggle keeps facet selections; reset in the panel clears only facets", async () => {
  const { impl } = makeCatalogFetch({ list: [multiMarketProduct], facets: catalogFacetV2Fixture });
  renderCatalog({ fetch: impl, initialSearch: "market=market-a" });

  await screen.findByText("글로프우드 12년");

  const user = userEvent.setup();
  const availableCheckbox = screen.getByRole("checkbox", { name: "판매 가능 상품만" });
  await user.click(availableCheckbox);
  // Facet panel's active-selection badge (from the `market` selection) should remain, proving
  // the availability toggle did not wipe unrelated facet state.
  await screen.findByText("글로프우드 12년");
  const filterTrigger = screen.getByRole("button", { name: /필터/ });
  assert.ok(within(filterTrigger).getByText("1"));
});

test("legacy mode renders the legacy sidebar (not the v2 panel) and fetches only legacy routes", async () => {
  const { impl, calls } = makeCatalogFetch({
    list: [multiMarketProduct],
    facets: legacyCatalogFacetFixture,
  });
  renderCatalog({ fetch: impl, version: "legacy" });

  await screen.findByText("글로프우드 12년");

  assert.equal(calls.some((u) => u.includes("/api/v2/")), false);
  assert.ok(calls.some((u) => u.includes("/api/products/facets")));
  // The legacy sidebar shows the (legacy) facet total in its drawer subtitle once opened.
  await userEvent.setup().click(screen.getByRole("button", { name: /필터/ }));
  assert.ok(screen.getByText(`${legacyCatalogFacetFixture.total}개 상품`));
});

test("pagination: previous is disabled on the first page, next is disabled on a final partial page", async () => {
  const { impl } = makeCatalogFetch({
    list: [multiMarketProduct],
    facets: { ...catalogFacetV2Fixture, total: 1 },
  });
  renderCatalog({ fetch: impl });

  await screen.findByText("글로프우드 12년");
  assert.equal((screen.getByRole("button", { name: "이전" }) as HTMLButtonElement).disabled, true);
  assert.equal((screen.getByRole("button", { name: "다음" }) as HTMLButtonElement).disabled, true);
});

test("pagination: a middle page has both previous and next enabled", async () => {
  const products = makeProducts(3, 1000);
  const { impl } = makeCatalogFetch({
    list: products,
    facets: { ...catalogFacetV2Fixture, total: 120 },
  });
  // offset=50 with 3 results back: not the first page (offset > 0) and not the last
  // (offset + returned count = 53 < total 120), so both nav buttons must be enabled.
  renderCatalog({ fetch: impl, initialSearch: "offset=50" });

  await screen.findByText("Product 1000");
  assert.equal((screen.getByRole("button", { name: "이전" }) as HTMLButtonElement).disabled, false);
  assert.equal((screen.getByRole("button", { name: "다음" }) as HTMLButtonElement).disabled, false);
});

test("pagination: a full page (products.length === page size) still enables next when more results remain", async () => {
  const products = makeProducts(50, 2000);
  const { impl } = makeCatalogFetch({
    list: products,
    facets: { ...catalogFacetV2Fixture, total: 120 },
  });
  // offset=0, a full 50-product page, total=120: 0 + 50 = 50 < 120, so more remain and
  // `next` must stay enabled — a naive `products.length === pageSize` check alone would
  // wrongly disable it once list.length hits the page size.
  renderCatalog({ fetch: impl });

  await screen.findByText("Product 2000");
  assert.equal((screen.getByRole("button", { name: "이전" }) as HTMLButtonElement).disabled, true);
  assert.equal((screen.getByRole("button", { name: "다음" }) as HTMLButtonElement).disabled, false);
});

test("pagination: a full page that exactly reaches the total disables next (no phantom next page)", async () => {
  const products = makeProducts(50, 3000);
  const { impl } = makeCatalogFetch({
    list: products,
    facets: { ...catalogFacetV2Fixture, total: 150 },
  });
  // offset=100, a full 50-product page, total=150: 100 + 50 = 150, not < total, so this is
  // the last page even though it's a full page — offer count must not be mistaken for more
  // products existing.
  renderCatalog({ fetch: impl, initialSearch: "offset=100" });

  await screen.findByText("Product 3000");
  assert.equal((screen.getByRole("button", { name: "이전" }) as HTMLButtonElement).disabled, false);
  assert.equal((screen.getByRole("button", { name: "다음" }) as HTMLButtonElement).disabled, true);
});

test("price-history card stays lazy: no history request before expansion, exactly one after", async () => {
  const { impl } = makeCatalogFetch({
    list: [multiMarketProduct],
    facets: catalogFacetV2Fixture,
  });
  const historyCalls: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    historyCalls.push(String(input));
    return Response.json({
      product_id: multiMarketProduct.product_id,
      total: 0,
      limit: 30,
      offset: 0,
      next_offset: null,
      items: [],
    });
  }) as typeof fetch;

  renderCatalog({ fetch: impl });
  await screen.findByText("글로프우드 12년");
  assert.equal(historyCalls.length, 0);

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "가격 추이 보기" }));

  await waitFor(() => assert.equal(historyCalls.length, 1));
  assert.match(historyCalls[0]!, /\/api\/products\/501\/price-history/);
});

test("empty result set shows the empty state without a false 'error' status", async () => {
  const { impl } = makeCatalogFetch({ list: [], facets: { ...catalogFacetV2Fixture, total: 0 } });
  renderCatalog({ fetch: impl });

  await screen.findByText("표시할 상품이 없습니다.");
});

test("a request error shows the retry affordance, and retrying recovers", async () => {
  let fail = true;
  const impl: typeof fetch = async (input) => {
    if (fail) return new Response("boom", { status: 500 });
    if (String(input).includes("/facets")) return Response.json(catalogFacetV2Fixture);
    return Response.json([multiMarketProduct]);
  };
  renderCatalog({ fetch: impl });

  await screen.findByText("상품 목록을 불러오지 못했습니다.");
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  await screen.findByText("글로프우드 12년");
});
