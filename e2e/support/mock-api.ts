import type { Page } from "@playwright/test";
import type { CatalogProduct } from "../../app/lib/catalog";
import type { MarketProduct } from "../../app/lib/products";
import type { PublicMarket } from "../../app/lib/markets";
import type { ProductPriceHistory } from "../../app/lib/priceHistory";
import {
  MOCK_API_ORIGIN,
  catalogFacetV2Fixture,
  catalogList as buildCatalogList,
  legacyCatalogFacetFixture,
  marketFacetV2Fixture,
  priceHistoryFor,
  publicMarket,
} from "./fixtures";

/**
 * Everything a spec needs to control what the mocked backend returns, mutable across the test so
 * a single page session can exercise a facet failure followed by a successful retry.
 */
export interface MockApiState {
  catalogList: CatalogProduct[];
  catalogFacetsV2: unknown;
  catalogFacetsLegacy: unknown;
  marketList: Record<string, MarketProduct[]>;
  marketFacetsV2: Record<string, unknown>;
  marketFacetsLegacy: Record<string, unknown>;
  publicMarkets: PublicMarket[];
  priceHistory: Record<number, ProductPriceHistory>;
  /** Captured for request-shape assertions (e.g. proving the price-history card stays lazy). */
  requests: { url: string; method: string }[];
  /** If set, the next facet request whose path includes this substring fails once (HTTP 500), then this is cleared. */
  failFacetOnceFor: string | null;
}

export function defaultMockState(overrides: Partial<MockApiState> = {}): MockApiState {
  return {
    catalogList: buildCatalogList(),
    catalogFacetsV2: catalogFacetV2Fixture,
    catalogFacetsLegacy: legacyCatalogFacetFixture,
    marketList: {},
    marketFacetsV2: {},
    marketFacetsLegacy: {},
    publicMarkets: [publicMarket()],
    priceHistory: {},
    requests: [],
    failFacetOnceFor: null,
    ...overrides,
  };
}

/**
 * Installs a single origin-scoped route that dispatches on path, standing in for the whole
 * read-only backend contract this client speaks (list/facets, both scopes, both versions, plus
 * public markets and price history). The production build under test must be built with
 * `NEXT_PUBLIC_API_BASE_URL=${MOCK_API_ORIGIN}` (see the `e2e:build:*` package.json scripts) so
 * every request the rendered app makes lands here — no real network call is ever made.
 */
export async function installProductApiMocks(page: Page, state: MockApiState): Promise<void> {
  await page.route(`${MOCK_API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    state.requests.push({ url: request.url(), method: request.method() });

    if (request.method() !== "GET") {
      await route.fulfill({ status: 405, body: "e2e mocks are read-only" });
      return;
    }

    if (
      state.failFacetOnceFor !== null &&
      url.pathname.includes("facets") &&
      url.pathname.includes(state.failFacetOnceFor)
    ) {
      state.failFacetOnceFor = null;
      await route.fulfill({ status: 500, body: "mocked facet failure" });
      return;
    }

    if (url.pathname === "/api/markets") {
      await route.fulfill({ json: state.publicMarkets });
      return;
    }

    const marketMatch = /^\/api\/(v2\/)?markets\/([^/]+)\/(products|facets)$/.exec(url.pathname);
    if (marketMatch) {
      const [, v2Prefix, encodedCode, kind] = marketMatch;
      const marketCode = decodeURIComponent(encodedCode!);
      if (kind === "products") {
        await route.fulfill({ json: state.marketList[marketCode] ?? [] });
        return;
      }
      const facets = v2Prefix
        ? (state.marketFacetsV2[marketCode] ?? marketFacetV2Fixture)
        : state.marketFacetsLegacy[marketCode];
      await route.fulfill({ json: facets ?? { detail: "market not mocked" }, status: facets ? 200 : 404 });
      return;
    }

    if (url.pathname === "/api/products") {
      await route.fulfill({ json: state.catalogList });
      return;
    }
    if (url.pathname === "/api/v2/products/facets") {
      await route.fulfill({ json: state.catalogFacetsV2 });
      return;
    }
    if (url.pathname === "/api/products/facets") {
      await route.fulfill({ json: state.catalogFacetsLegacy });
      return;
    }

    const priceHistoryMatch = /^\/api\/products\/(\d+)\/price-history$/.exec(url.pathname);
    if (priceHistoryMatch) {
      const productId = Number(priceHistoryMatch[1]);
      // A deliberate delay: an instant local fulfillment would let the fetch resolve inside the
      // same tick as the click that triggers it, making PriceHistorySection's "loading" state
      // (real, and worth proving renders) too transient for a test to reliably observe.
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.fulfill({ json: state.priceHistory[productId] ?? priceHistoryFor(productId) });
      return;
    }

    await route.fulfill({ status: 404, body: `unmocked e2e route: ${url.pathname}` });
  });
}

export function requestsMatching(state: MockApiState, pathSubstring: string): string[] {
  return state.requests
    .filter((r) => new URL(r.url).pathname.includes(pathSubstring))
    .map((r) => r.url);
}
