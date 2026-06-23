import { API_BASE_URL, ensureOk } from "./auth";
import type { components } from "./api/types.gen";

export type MarketProduct = components["schemas"]["MarketProductOut"];

export interface MarketProductQuery {
  available?: boolean | null;
  limit?: number;
  offset?: number;
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

export function formatLocalPrice(
  value: number | string,
  currency: string,
): string {
  const n = Number(value);
  if (Number.isNaN(n)) return `${value} ${currency}`;
  return `${currency} ${n.toLocaleString("ko-KR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
