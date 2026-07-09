import { API_BASE_URL, ensureOk } from "./auth";
import type { components } from "./api/types.gen";
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

function appendValues(
  params: URLSearchParams,
  key: string,
  values: Array<string | number> | undefined,
) {
  for (const value of values ?? []) {
    params.append(key, String(value));
  }
}

function setIfPresent(
  params: URLSearchParams,
  key: string,
  value: string | number | boolean | null | undefined,
) {
  if (value !== undefined && value !== null && value !== "") {
    params.set(key, String(value));
  }
}

/** 목록·패싯 공용 필터 파라미터 — 패싯도 교차 좁힘(DECISIONS 035)으로 같은 필터를 받는다. */
function appendCatalogFilterParams(params: URLSearchParams, query: CatalogQuery) {
  setIfPresent(params, "available", query.available);
  appendValues(params, "market", query.market);
  setIfPresent(params, "search", query.search?.trim() || null);
  appendValues(params, "cask_family", query.cask_family);
  appendValues(params, "cask_type", query.cask_type);
  appendValues(params, "cask_material", query.cask_material);
  appendValues(params, "country", query.country);
  appendValues(params, "region", query.region);
  appendValues(params, "distillery_id", query.distillery_id);
  setIfPresent(params, "bottling", query.bottling);
  setIfPresent(params, "peated", query.peated);
  setIfPresent(params, "age_min", query.age_min);
  setIfPresent(params, "age_max", query.age_max);
  setIfPresent(params, "abv_min", query.abv_min);
  setIfPresent(params, "abv_max", query.abv_max);
  appendValues(params, "spirit_type", query.spirit_type);
  appendValues(params, "volume_ml", query.volume_ml);
  setIfPresent(params, "limited", query.limited);
}

export async function listCatalogProducts(
  query: CatalogQuery = {},
  signal?: AbortSignal,
): Promise<CatalogProduct[]> {
  const params = new URLSearchParams();
  appendCatalogFilterParams(params, query);
  setIfPresent(params, "sort", query.sort);
  setIfPresent(params, "limit", query.limit);
  setIfPresent(params, "offset", query.offset);

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
  const params = new URLSearchParams();
  appendCatalogFilterParams(params, query);
  const qs = params.toString();
  const res = await fetch(
    `${API_BASE_URL}/api/products/facets${qs ? `?${qs}` : ""}`,
    { signal, cache: "no-store" },
  );
  await ensureOk(res);
  return (await res.json()) as CatalogFacets;
}
