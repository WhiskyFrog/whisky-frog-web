import "./setup-jsdom.mjs";

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { MarketPageView } from "../app/components/MarketView";
import { marketFacetV2Fixture, legacyMarketFacetFixture } from "./fixtures/facet-responses";
import type { MarketProduct } from "../app/lib/products";

afterEach(() => {
  cleanup();
  window.localStorage.removeItem("wf_admin_jwt");
});

const originalFetch = globalThis.fetch;
beforeEach(() => {
  globalThis.fetch = originalFetch;
});

const PUBLIC_MARKETS = [
  { id: 1, code: "market-a", name: "예시 마켓", country: null, currency: "USD", domain: "a.test", base_url: null, provides_direct_purchase: true },
  { id: 2, code: "market-b", name: "보조 마켓", country: null, currency: "USD", domain: "b.test", base_url: null, provides_direct_purchase: false },
];

function product(overrides: Partial<MarketProduct> & { product_id: number; product_url_id: number }): MarketProduct {
  return {
    product_name: "Glorpwood 12yo",
    product_name_korean: null,
    raw_name: null,
    local_price: "100.00",
    currency: "USD",
    available: true,
    source_url: "https://example.test/p",
    crawled_at: "2026-01-01T00:00:00Z",
    direct_price_krw: 130000,
    ...overrides,
  };
}

/** Routes any request by pathname/kind; `markets` serves the public-market list (`/api/markets`). */
function makeMarketFetch(routes: { list: unknown; facets: unknown; markets?: unknown }) {
  const calls: string[] = [];
  const impl: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (/\/api\/markets$/.test(new URL(url).pathname)) {
      return Response.json(routes.markets ?? PUBLIC_MARKETS);
    }
    if (url.includes("/facets")) return Response.json(routes.facets);
    return Response.json(routes.list);
  };
  return { impl, calls };
}

/** Mirrors how the real page's `onSearchChange` feeds the next `rawSearch` back in. */
function renderMarket(props: {
  marketCode?: string;
  version?: string;
  fetch: typeof fetch;
  initialSearch?: string;
}) {
  let currentSearch = props.initialSearch ?? "";
  let rerenderView: (() => void) | null = null;
  const onSearchChange = (search: string) => {
    currentSearch = search;
    rerenderView?.();
  };

  const view = render(
    <MarketPageView
      marketCode={props.marketCode ?? "market-a"}
      rawSearch={currentSearch}
      onSearchChange={onSearchChange}
      version={props.version}
      baseUrl="https://example.test"
      fetch={props.fetch}
    />,
  );
  rerenderView = () =>
    view.rerender(
      <MarketPageView
        marketCode={props.marketCode ?? "market-a"}
        rawSearch={currentSearch}
        onSearchChange={onSearchChange}
        version={props.version}
        baseUrl="https://example.test"
        fetch={props.fetch}
      />,
    );
  return view;
}

test("v2 market: header/drawer label the total as offers in this market, not a catalog product count", async () => {
  const { impl } = makeMarketFetch({
    list: [product({ product_id: 501, product_url_id: 1 })],
    facets: { ...marketFacetV2Fixture, total: 7 },
  });
  renderMarket({ fetch: impl });

  await screen.findAllByText("Glorpwood 12yo");
  assert.ok(screen.getByText(/총 7개 오퍼/));

  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /필터/ }));
  assert.ok(screen.getByText("7개 오퍼"));
  assert.equal(screen.queryByText(/개 상품/), null);
});

test("two market-scoped URLs for the same normalized product count independently as offers in each scope", async () => {
  const sameProductInA = product({ product_id: 900, product_url_id: 10 });
  const { impl: implA } = makeMarketFetch({
    list: [sameProductInA, product({ product_id: 900, product_url_id: 11 })],
    facets: { ...marketFacetV2Fixture, total: 2 },
  });
  const viewA = renderMarket({ marketCode: "market-a", fetch: implA });
  await screen.findByText(/총 2개 오퍼/);
  viewA.unmount();
  cleanup();

  const { impl: implB } = makeMarketFetch({
    list: [product({ product_id: 900, product_url_id: 12 })],
    facets: { ...marketFacetV2Fixture, total: 1 },
  });
  renderMarket({ marketCode: "market-b", fetch: implB });
  await screen.findByText(/총 1개 오퍼/);
});

test("the market code is percent-encoded in both list and facet request paths", async () => {
  const { impl, calls } = makeMarketFetch({
    list: [],
    facets: { ...marketFacetV2Fixture, total: 0 },
  });
  renderMarket({ marketCode: "market a/b", fetch: impl });
  await screen.findByText("표시할 상품이 없습니다.");

  assert.ok(calls.some((u) => u.includes("/api/markets/market%20a%2Fb/products")));
  assert.ok(calls.some((u) => u.includes("/api/v2/markets/market%20a%2Fb/facets")));
});

test("legacy mode renders the legacy sidebar (not the v2 panel), fetches only legacy market routes, and labels the total in offers", async () => {
  const { impl, calls } = makeMarketFetch({
    list: [product({ product_id: 1, product_url_id: 1 })],
    facets: legacyMarketFacetFixture,
  });
  renderMarket({ fetch: impl, version: "legacy" });

  await screen.findAllByText("Glorpwood 12yo");

  assert.equal(calls.some((u) => u.includes("/api/v2/")), false);
  assert.ok(calls.some((u) => u.includes("/api/markets/market-a/facets")));
  await userEvent.setup().click(screen.getByRole("button", { name: /필터/ }));
  assert.ok(screen.getByText(`${legacyMarketFacetFixture.total}개 오퍼`));
});

test("available-only toggle keeps facet selections; reset in the panel clears only facets", async () => {
  const { impl } = makeMarketFetch({
    list: [product({ product_id: 1, product_url_id: 1 })],
    facets: marketFacetV2Fixture,
  });
  renderMarket({ fetch: impl, initialSearch: "spirit_type=single_malt" });

  await screen.findAllByText("Glorpwood 12yo");

  const user = userEvent.setup();
  const availableCheckbox = screen.getByRole("checkbox", { name: "판매 가능 상품만" });
  assert.equal((availableCheckbox as HTMLInputElement).checked, true);
  await user.click(availableCheckbox);
  await screen.findAllByText("Glorpwood 12yo");
  const filterTrigger = screen.getByRole("button", { name: /필터/ });
  assert.ok(within(filterTrigger).getByText("1"));
});

test("typing a search term sends an identical `search` parameter to both the list and facet requests", async () => {
  const { impl, calls } = makeMarketFetch({
    list: [product({ product_id: 1, product_url_id: 1 })],
    facets: marketFacetV2Fixture,
  });
  renderMarket({ fetch: impl });
  await screen.findAllByText("Glorpwood 12yo");

  const user = userEvent.setup();
  await user.type(
    screen.getByPlaceholderText("상품명 검색 (한국어·영문·원문)"),
    "글로프",
  );

  await waitFor(() => assert.ok(calls.some((u) => u.includes("search=%EA%B8%80"))));
  const listUrl = new URL(calls[calls.length - 2]!);
  const facetUrl = new URL(calls[calls.length - 1]!);
  assert.equal(listUrl.searchParams.get("search"), "글로프");
  assert.equal(facetUrl.searchParams.get("search"), "글로프");
});

test("pagination: previous is disabled on the first page, next is disabled on a final partial page", async () => {
  const { impl } = makeMarketFetch({
    list: [product({ product_id: 1, product_url_id: 1 })],
    facets: { ...marketFacetV2Fixture, total: 1 },
  });
  renderMarket({ fetch: impl });

  await screen.findAllByText("Glorpwood 12yo");
  assert.equal((screen.getByRole("button", { name: "이전" }) as HTMLButtonElement).disabled, true);
  assert.equal((screen.getByRole("button", { name: "다음" }) as HTMLButtonElement).disabled, true);
});

function makeOffers(count: number, startId: number): MarketProduct[] {
  return Array.from({ length: count }, (_, i) =>
    product({ product_id: startId + i, product_url_id: startId + i, product_name: `Offer ${startId + i}` }),
  );
}

test("pagination: a middle page has both previous and next enabled", async () => {
  const offers = makeOffers(3, 1000);
  const { impl } = makeMarketFetch({
    list: offers,
    facets: { ...marketFacetV2Fixture, total: 250 },
  });
  renderMarket({ fetch: impl, initialSearch: "offset=100" });

  await screen.findAllByText("Offer 1000");
  assert.equal((screen.getByRole("button", { name: "이전" }) as HTMLButtonElement).disabled, false);
  assert.equal((screen.getByRole("button", { name: "다음" }) as HTMLButtonElement).disabled, false);
});

test("pagination: a full page (offers.length === page size) still enables next when more offers remain", async () => {
  const offers = makeOffers(100, 2000);
  const { impl } = makeMarketFetch({
    list: offers,
    facets: { ...marketFacetV2Fixture, total: 250 },
  });
  renderMarket({ fetch: impl });

  await screen.findAllByText("Offer 2000");
  assert.equal((screen.getByRole("button", { name: "이전" }) as HTMLButtonElement).disabled, true);
  assert.equal((screen.getByRole("button", { name: "다음" }) as HTMLButtonElement).disabled, false);
});

test("pagination: a full page that exactly reaches the total disables next (no phantom next page)", async () => {
  const offers = makeOffers(100, 3000);
  const { impl } = makeMarketFetch({
    list: offers,
    facets: { ...marketFacetV2Fixture, total: 300 },
  });
  renderMarket({ fetch: impl, initialSearch: "offset=200" });

  await screen.findAllByText("Offer 3000");
  assert.equal((screen.getByRole("button", { name: "이전" }) as HTMLButtonElement).disabled, false);
  assert.equal((screen.getByRole("button", { name: "다음" }) as HTMLButtonElement).disabled, true);
});

test("empty result set shows the empty state without a false 'error' status", async () => {
  const { impl } = makeMarketFetch({ list: [], facets: { ...marketFacetV2Fixture, total: 0 } });
  renderMarket({ fetch: impl });

  await screen.findByText("표시할 상품이 없습니다.");
});

test("a request error shows the retry affordance, and retrying recovers with URL selections intact", async () => {
  let fail = true;
  const impl: typeof fetch = async (input) => {
    const url = String(input);
    if (/\/api\/markets$/.test(new URL(url).pathname)) return Response.json(PUBLIC_MARKETS);
    if (fail) return new Response("boom", { status: 500 });
    if (url.includes("/facets")) return Response.json(marketFacetV2Fixture);
    return Response.json([product({ product_id: 1, product_url_id: 1 })]);
  };
  renderMarket({ fetch: impl, initialSearch: "spirit_type=single_malt" });

  await screen.findByText("상품 목록을 불러오지 못했습니다.");
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
  await screen.findAllByText("Glorpwood 12yo");

  const filterTrigger = screen.getByRole("button", { name: /필터/ });
  assert.ok(within(filterTrigger).getByText("1"));
});

test("image-rich markets render the responsive card grid with thumbnails, badges, prices, and purchase links", async () => {
  const offers = [
    product({
      product_id: 1,
      product_url_id: 1,
      image_url: "https://example.test/img1.jpg",
      available: true,
    }),
    product({
      product_id: 2,
      product_url_id: 2,
      product_name: "Second Offer",
      image_url: "https://example.test/img2.jpg",
      available: false,
      direct_price_krw: null,
      local_price_krw: 90000,
    }),
  ];
  const { impl } = makeMarketFetch({
    list: offers,
    facets: { ...marketFacetV2Fixture, total: 2 },
  });
  renderMarket({ fetch: impl });

  await screen.findByText("Glorpwood 12yo");
  assert.ok(screen.getAllByRole("img").length >= 2);
  assert.ok(screen.getByText("판매중"));
  assert.ok(screen.getByText("품절"));
  assert.ok(screen.getAllByText("예상 직구가").length > 0);
  assert.ok(screen.getAllByText("판매가").length > 0);
  assert.ok(screen.getAllByText(/2026/).length > 0);
  assert.ok(screen.getAllByRole("link", { name: "구매 링크" }).length === 2);
  // Non-authenticated viewer never sees the taxonomy edit affordance.
  assert.equal(screen.queryByText("속성 수정"), null);
});

test("non-image-rich markets keep mobile cards and a desktop table, both showing an authenticated taxonomy edit link", async () => {
  window.localStorage.setItem("wf_admin_jwt", "test-token");
  const offers = [product({ product_id: 1, product_url_id: 1 })]; // no image_url, no muk URL pattern -> not image-rich
  const { impl } = makeMarketFetch({
    list: offers,
    facets: { ...marketFacetV2Fixture, total: 1 },
  });
  renderMarket({ fetch: impl });

  await screen.findAllByText("Glorpwood 12yo");
  // Desktop table and mobile card both render (visibility is CSS-only in jsdom).
  assert.ok(screen.getByRole("table"));
  const editLinks = screen.getAllByRole("link", { name: "속성 수정" });
  assert.ok(editLinks.length >= 2);
});

test("Korean name takes title priority with the canonical English name as subtitle", async () => {
  const offers = [
    product({
      product_id: 1,
      product_url_id: 1,
      product_name: "Glorpwood 12yo",
      product_name_korean: "글로프우드 12년",
    }),
  ];
  const { impl } = makeMarketFetch({ list: offers, facets: { ...marketFacetV2Fixture, total: 1 } });
  renderMarket({ fetch: impl });

  await screen.findAllByText("글로프우드 12년");
  assert.ok(screen.getAllByText("Glorpwood 12yo").length > 0);
});
