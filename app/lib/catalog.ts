import { API_BASE_URL, ensureOk } from "./auth";
import type { components } from "./api/types.gen";
import { serializeLegacyFlatProductQuery } from "./api/product-query";
import type { FacetCount, MarketFacets, MarketProductQuery } from "./products";

export type CatalogProduct = components["schemas"]["CatalogProductOut"];
export type ProductOffer = components["schemas"]["ProductOfferOut"];

/** 전 마켓 통합 패싯 — per-market 패싯 + 마켓 축. 카운트는 상품(distinct) 단위. */
export interface CatalogFacets extends MarketFacets {
  market: FacetCount[];
}

export interface CatalogQuery extends MarketProductQuery {
  /** 마켓 code 필터(OR). 상품 선정에만 적용 — 오퍼는 전 마켓이 내려온다. */
  market?: string[];
  search?: string | null;
  /** name=정본명 가나다(기본) / price=근사 원화가 오름차순(세금·배송 미포함). */
  sort?: "name" | "price";
}

export async function listCatalogProducts(
  query: CatalogQuery = {},
  signal?: AbortSignal,
): Promise<CatalogProduct[]> {
  const params = serializeLegacyFlatProductQuery(query, true);

  const qs = params.toString();
  const res = await fetch(`${API_BASE_URL}/api/products${qs ? `?${qs}` : ""}`, {
    signal,
    cache: "no-store",
  });
  await ensureOk(res);
  return (await res.json()) as CatalogProduct[];
}

export async function getCatalogFacets(
  query: CatalogQuery = {},
  signal?: AbortSignal,
): Promise<CatalogFacets> {
  const params = serializeLegacyFlatProductQuery(query, false);
  const qs = params.toString();
  const res = await fetch(
    `${API_BASE_URL}/api/products/facets${qs ? `?${qs}` : ""}`,
    { signal, cache: "no-store" },
  );
  await ensureOk(res);
  return (await res.json()) as CatalogFacets;
}
