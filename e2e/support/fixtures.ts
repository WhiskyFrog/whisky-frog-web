import type { CatalogProduct, ProductOffer } from "../../app/lib/catalog";
import type { MarketProduct } from "../../app/lib/products";
import type { PublicMarket } from "../../app/lib/markets";
import type { ProductPriceHistory } from "../../app/lib/priceHistory";
import {
  catalogFacetV2Fixture,
  legacyCatalogFacetFixture,
  legacyMarketFacetFixture,
  marketFacetV2Fixture,
} from "../../tests/fixtures/facet-responses";

/**
 * Fake, clearly-non-production origin the e2e production builds are told to use for
 * `NEXT_PUBLIC_API_BASE_URL` (see package.json's `e2e:build:*` scripts). Every request the
 * rendered app makes goes here, so Playwright's `page.route` can intercept it deterministically
 * without a real backend and without ambiguity against any real host.
 */
export const MOCK_API_ORIGIN = "https://mock-backend.e2e.invalid";

/** Reused verbatim from the unit-test fixtures — one source of truth for v2 facet shape. */
export {
  catalogFacetV2Fixture,
  marketFacetV2Fixture,
  legacyCatalogFacetFixture,
  legacyMarketFacetFixture,
};

function offer(overrides: Partial<ProductOffer> = {}): ProductOffer {
  return {
    market_code: "market-a",
    market_name: "예시 마켓",
    product_url_id: 1,
    local_price: "100000",
    currency: "JPY",
    available: true,
    source_url: "https://example.test/offer/1",
    crawled_at: "2026-07-01T00:00:00Z",
    image_url: null,
    local_price_krw: 100000,
    direct_price_krw: 120000,
    shipping_krw: 5000,
    exchange_rate: "9.1",
    ...overrides,
  };
}

/** One product with >4 offers so the catalog card's "오퍼 N개 더 보기" expander appears. */
export function catalogProductWithManyOffers(): CatalogProduct {
  return {
    product_id: 1,
    product_name: "Sample Single Malt 12",
    product_name_korean: "샘플 싱글몰트 12",
    country: "Scotland",
    region: "Speyside",
    spirit_type: "single_malt",
    peated: false,
    age_years: 12,
    abv: "43.0",
    volume_ml: 700,
    min_direct_price_krw: 118000,
    min_local_price_krw: 100000,
    offers: [
      offer({ product_url_id: 11, market_code: "market-a", market_name: "예시 마켓", direct_price_krw: 118000 }),
      offer({ product_url_id: 12, market_code: "market-b", market_name: "보조 마켓", direct_price_krw: 125000 }),
      offer({ product_url_id: 13, market_code: "market-a", market_name: "예시 마켓", direct_price_krw: 130000 }),
      offer({ product_url_id: 14, market_code: "market-b", market_name: "보조 마켓", direct_price_krw: 132000 }),
      offer({ product_url_id: 15, market_code: "market-a", market_name: "예시 마켓", direct_price_krw: 140000 }),
      offer({ product_url_id: 16, market_code: "market-b", market_name: "보조 마켓", direct_price_krw: 142000, available: false }),
    ],
  };
}

export function catalogProduct(id: number, name: string): CatalogProduct {
  return {
    product_id: id,
    product_name: name,
    product_name_korean: null,
    country: "Scotland",
    spirit_type: "single_malt",
    peated: false,
    age_years: 10,
    abv: "40.0",
    volume_ml: 700,
    min_direct_price_krw: 90000,
    min_local_price_krw: 80000,
    offers: [offer({ product_url_id: id * 100, market_code: "market-a", market_name: "예시 마켓" })],
  };
}

export function catalogList(count = 3): CatalogProduct[] {
  const products = [catalogProductWithManyOffers()];
  for (let i = 2; i <= count; i += 1) products.push(catalogProduct(i, `Sample Product ${i}`));
  return products;
}

export function marketProduct(
  id: number,
  overrides: Partial<MarketProduct> = {},
): MarketProduct {
  return {
    product_id: id,
    product_url_id: id,
    product_name: `Market Product ${id}`,
    raw_name: `raw name ${id}`,
    local_price: "50000",
    currency: "JPY",
    available: true,
    source_url: `https://example.test/market-offer/${id}`,
    crawled_at: "2026-07-01T00:00:00Z",
    image_url: null,
    local_price_krw: 50000,
    direct_price_krw: 60000,
    shipping_krw: 3000,
    exchange_rate: "9.1",
    ...overrides,
  } as MarketProduct;
}

/** Products for a market crossing the >=50% image-candidate threshold (`imageRich` grid). */
export function imageRichMarketList(count = 4): MarketProduct[] {
  return Array.from({ length: count }, (_, i) =>
    marketProduct(i + 1, { image_url: `https://example.test/img/${i + 1}.jpg` }),
  );
}

/** Products for a market below the threshold (mobile-card + desktop-table presentation). */
export function tableMarketList(count = 4): MarketProduct[] {
  return Array.from({ length: count }, (_, i) => marketProduct(i + 1));
}

export function publicMarket(overrides: Partial<PublicMarket> = {}): PublicMarket {
  return {
    id: 1,
    code: "market-a",
    name: "예시 마켓",
    country: "Japan",
    currency: "JPY",
    domain: "example.test",
    base_url: "https://example.test",
    provides_direct_purchase: true,
    ...overrides,
  };
}

export function priceHistoryFor(productId: number): ProductPriceHistory {
  const items = [
    {
      price_history_id: 1,
      product_url_id: 11,
      market_code: "market-a",
      market_name: "예시 마켓",
      local_price: "100000",
      currency: "JPY",
      available: true,
      crawled_at: "2026-07-15T00:00:00Z",
    },
    {
      price_history_id: 2,
      product_url_id: 11,
      market_code: "market-a",
      market_name: "예시 마켓",
      local_price: "98000",
      currency: "JPY",
      available: true,
      crawled_at: "2026-07-01T00:00:00Z",
    },
  ];
  return {
    product_id: productId,
    total: items.length,
    limit: 30,
    offset: 0,
    next_offset: null,
    items,
  };
}
