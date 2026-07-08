import { API_BASE_URL, ensureOk } from "./auth";
import { CURRENCY_SYMBOLS } from "./markets";
import type { components } from "./api/types.gen";

export type MarketProduct = components["schemas"]["MarketProductOut"];

export interface MarketProductQuery {
  available?: boolean | null;
  cask_family?: string[];
  country?: string[];
  region?: string[];
  distillery_id?: number[];
  bottling?: "official" | "independent" | null;
  spirit_type?: string[];
  peated?: boolean | null;
  age_min?: number | null;
  age_max?: number | null;
  abv_min?: number | null;
  abv_max?: number | null;
  volume_ml?: number[];
  limited?: boolean | null;
  limit?: number;
  offset?: number;
}

export interface FacetCount {
  value: string | number;
  count: number;
  korean: string | null;
}

export interface DistilleryFacet {
  id: number;
  name: string;
  korean: string | null;
  count: number;
}

export interface DistilleryRegionFacet {
  region: string | null;
  count: number;
  distilleries: DistilleryFacet[];
}

export interface DistilleryCountryFacet {
  country: string | null;
  count: number;
  regions: DistilleryRegionFacet[];
}

export interface RangeFacet {
  min: string | number | null;
  max: string | number | null;
}

export interface MarketFacets {
  total: number;
  cask_family: FacetCount[];
  country: FacetCount[];
  region: FacetCount[];
  spirit_type: FacetCount[];
  distillery: DistilleryCountryFacet[];
  bottling: Record<"official" | "independent", number>;
  peated: Record<"peated" | "unpeated" | "unknown", number>;
  volume_ml: FacetCount[];
  age_years: RangeFacet;
  abv: RangeFacet;
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

export async function listMarketProducts(
  marketCode: string,
  query: MarketProductQuery = {},
  signal?: AbortSignal,
): Promise<MarketProduct[]> {
  const params = new URLSearchParams();
  if (query.available !== undefined && query.available !== null) {
    params.set("available", String(query.available));
  }
  appendValues(params, "cask_family", query.cask_family);
  appendValues(params, "country", query.country);
  appendValues(params, "region", query.region);
  appendValues(params, "distillery_id", query.distillery_id);
  if (query.bottling) params.set("bottling", query.bottling);
  appendValues(params, "spirit_type", query.spirit_type);
  if (query.peated !== undefined && query.peated !== null) {
    params.set("peated", String(query.peated));
  }
  if (query.age_min !== undefined && query.age_min !== null) {
    params.set("age_min", String(query.age_min));
  }
  if (query.age_max !== undefined && query.age_max !== null) {
    params.set("age_max", String(query.age_max));
  }
  if (query.abv_min !== undefined && query.abv_min !== null) {
    params.set("abv_min", String(query.abv_min));
  }
  if (query.abv_max !== undefined && query.abv_max !== null) {
    params.set("abv_max", String(query.abv_max));
  }
  appendValues(params, "volume_ml", query.volume_ml);
  if (query.limited !== undefined && query.limited !== null) {
    params.set("limited", String(query.limited));
  }
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));

  const qs = params.toString();
  const res = await fetch(
    `${API_BASE_URL}/api/markets/${encodeURIComponent(marketCode)}/products${qs ? `?${qs}` : ""}`,
    { signal, cache: "no-store" },
  );
  await ensureOk(res);
  return (await res.json()) as MarketProduct[];
}

export async function getMarketFacets(
  marketCode: string,
  query: Pick<MarketProductQuery, "available"> = {},
  signal?: AbortSignal,
): Promise<MarketFacets> {
  const params = new URLSearchParams();
  if (query.available !== undefined && query.available !== null) {
    params.set("available", String(query.available));
  }
  const qs = params.toString();
  const res = await fetch(
    `${API_BASE_URL}/api/markets/${encodeURIComponent(marketCode)}/facets${qs ? `?${qs}` : ""}`,
    { signal, cache: "no-store" },
  );
  await ensureOk(res);
  return (await res.json()) as MarketFacets;
}

export function formatLocalPrice(
  value: number | string,
  currency: string,
): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const n = Number(value);
  if (Number.isNaN(n)) {
    return symbol ? `${symbol}${value}` : `${value} ${currency}`;
  }
  const num = n.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  // 기호가 있으면 "£82.51", 없으면 코드 폴백 "TWD 1,200".
  return symbol ? `${symbol}${num}` : `${currency} ${num}`;
}

// 무카와(Color Me Shop)는 크롤 데이터에 이미지 URL이 없지만, 상품 이미지가
// source_url의 pid로 유도된다. 확장자가 상품마다 jpg/png로 갈려 후보를 순서대로
// 준다 — 썸네일이 onError로 다음 후보를 시도한다.
const MUKAWA_IMAGE_BASE = "https://img07.shop-pro.jp/PA01356/240/product";

/** 상품 썸네일 후보 URL — image_url이 있으면 그대로, 없으면 마켓별 유도 규칙. */
export function productImageCandidates(
  marketCode: string | null | undefined,
  imageUrl: string | null | undefined,
  sourceUrl: string | null | undefined,
): string[] {
  if (imageUrl) return [imageUrl];
  if (marketCode === "muk" && sourceUrl) {
    const pid = /[?&]pid=(\d+)/.exec(sourceUrl)?.[1];
    if (pid) {
      return [`${MUKAWA_IMAGE_BASE}/${pid}.jpg`, `${MUKAWA_IMAGE_BASE}/${pid}.png`];
    }
  }
  return [];
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
