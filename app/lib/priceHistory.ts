import { API_BASE_URL, ensureOk } from "./auth";
import type { components } from "./api/types.gen";

export type PriceHistoryItem = components["schemas"]["PriceHistoryItemOut"];
export type ProductPriceHistory = components["schemas"]["ProductPriceHistoryOut"];

export interface PriceHistoryQuery {
  /** 활성 마켓 code 필터(OR). 생략하면 모든 활성 마켓. */
  market?: string[];
  limit?: number;
  offset?: number;
}

/**
 * 상품의 마켓별 현지가 이력(최신순). 환율·세금·배송은 섞이지 않은 원본 local_price
 * 시계열이다 — 오퍼 카드의 직구가/환산가와는 별도 계약(module-api.md 참조).
 */
export async function getProductPriceHistory(
  productId: number,
  query: PriceHistoryQuery = {},
  signal?: AbortSignal,
): Promise<ProductPriceHistory> {
  const params = new URLSearchParams();
  for (const code of query.market ?? []) params.append("market", code);
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.offset != null) params.set("offset", String(query.offset));
  const qs = params.toString();
  const res = await fetch(
    `${API_BASE_URL}/api/products/${productId}/price-history${qs ? `?${qs}` : ""}`,
    { signal, cache: "no-store" },
  );
  await ensureOk(res);
  return (await res.json()) as ProductPriceHistory;
}
