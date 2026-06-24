// 마켓 관리(admin) CRUD API 클라이언트.
// 계약: docs/handoff-frontend-admin-markets-api.md (구현 backend/app/api/admin_markets.py).
// 금액/세율 Decimal은 정밀도 보존 위해 JSON에서 "문자열"로 오간다.
// 인증(JWT Bearer)·기반 URL·에러 처리는 auth.ts 공통 헬퍼 사용.

import { API_BASE_URL, authHeaders, ensureOk } from "./auth";

export interface ShippingOption {
  id?: number; // 응답에만 존재
  name: string;
  cost: string; // Decimal 문자열
  active: boolean;
}

/** 생성/수정 요청 본문 (MarketInput). */
export interface MarketInput {
  code: string; // 메뉴/URL 라우팅 키, unique, ^[a-z0-9][a-z0-9-]*$ (2~16자)
  domain: string;
  name: string;
  currency: string; // ISO 3
  country: string | null;
  language: string | null;
  base_url: string | null;
  active: boolean;
  vat_rate: string;
  price_includes_vat: boolean;
  local_alcohol_tax_per_liter: string;
  price_includes_local_alcohol_tax: boolean;
  incoterm: "FOB" | "DAP";
  fta: boolean;
  domestic_shipping_cost: string;
  crawl_ship_to: string; // 2자
  notes: string | null;
  shipping_options: ShippingOption[];
}

/** 응답 (Market = MarketInput + id/타임스탬프 + 각 옵션 id). */
export interface Market extends MarketInput {
  id: number;
  created_at: string;
  updated_at: string;
}

export const base = `${API_BASE_URL}/api/admin/markets`;

// ── 공개 마켓 목록 (홈 상단 네비 드롭다운 + 직구가 계산용) — 인증 불필요 ──
// 계약: GET /api/markets → MarketPublicOut[] (active만, 이름순, 세금 내부필드 미노출).
// 관리용 /api/admin/markets(Bearer 필요)와 별개. id는 /api/cost/quote 의 market_id로 사용.

/** 공개 마켓 1건 — 백엔드 MarketPublicOut 계약과 1:1. */
export interface PublicMarket {
  id: number; // 계산 API의 market_id로 그대로 사용
  code: string; // 메뉴/URL 라우팅 키
  name: string;
  country: string | null;
  currency: string;
  domain: string;
  base_url: string | null;
}

/** 공개 마켓 목록 조회(인증 없음). 네트워크/HTTP 오류는 throw. */
export async function listPublicMarkets(
  signal?: AbortSignal,
): Promise<PublicMarket[]> {
  const res = await fetch(`${API_BASE_URL}/api/markets`, {
    signal,
    cache: "no-store",
  });
  await ensureOk(res);
  return (await res.json()) as PublicMarket[];
}

export async function listMarkets(signal?: AbortSignal): Promise<Market[]> {
  const res = await fetch(base, {
    signal,
    cache: "no-store",
    headers: authHeaders(),
  });
  await ensureOk(res);
  return (await res.json()) as Market[];
}

export async function getMarket(id: number): Promise<Market> {
  const res = await fetch(`${base}/${id}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  await ensureOk(res);
  return (await res.json()) as Market;
}

export async function createMarket(payload: MarketInput): Promise<Market> {
  const res = await fetch(base, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  await ensureOk(res);
  return (await res.json()) as Market;
}

export async function updateMarket(
  id: number,
  payload: MarketInput,
): Promise<Market> {
  const res = await fetch(`${base}/${id}`, {
    method: "PUT",
    headers: authHeaders(true),
    body: JSON.stringify(payload),
  });
  await ensureOk(res);
  return (await res.json()) as Market;
}

export async function deleteMarket(id: number): Promise<void> {
  const res = await fetch(`${base}/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await ensureOk(res);
}

// ── 상품 URL (크롤러 ①단계 산출 + ②단계 파싱 큐 상태) — 읽기 전용 ──
// 계약: GET /api/admin/markets/{market_id}/product-urls → ProductUrlOut[].

/** 파싱 상태 — 백엔드 CHECK 제약과 동일. NULL last_parsed_at = 미파싱(pending). */
export type ParseStatus = "pending" | "ok" | "error" | "skipped";

/** 크롤러가 수집한 상품 URL 1건 (백엔드 ProductUrlOut 계약과 1:1). */
export interface ProductUrl {
  id: number;
  url: string;
  name: string | null; // 리스팅 표시명(상세 전 임시값)
  stock_status: string | null; // 리스팅 재고표기 원문
  available: boolean; // stock_status에서 도출한 판매가능 정규화
  parse_status: ParseStatus;
  parse_error: string | null;
  first_seen_at: string; // ISO datetime — 최초 발견(불변)
  last_seen_at: string; // ISO datetime — 재크롤마다 갱신(폐기 감지)
  last_parsed_at: string | null; // ②가 마지막 상세 파싱한 시각. NULL=미파싱
}

export interface ProductUrlQuery {
  available?: boolean; // 재고 가용 필터
  parse_status?: ParseStatus; // 파싱 상태 필터
  limit?: number;
  offset?: number;
}

/** 마켓이 수집한 상품 URL 목록 조회. id(발견 순) 오름차순. 마켓 없으면 404. */
export async function listProductUrls(
  marketId: number,
  query: ProductUrlQuery = {},
  signal?: AbortSignal,
): Promise<ProductUrl[]> {
  const params = new URLSearchParams();
  if (query.available !== undefined)
    params.set("available", String(query.available));
  if (query.parse_status) params.set("parse_status", query.parse_status);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  const qs = params.toString();
  const res = await fetch(
    `${base}/${marketId}/product-urls${qs ? `?${qs}` : ""}`,
    { signal, cache: "no-store", headers: authHeaders() },
  );
  await ensureOk(res);
  return (await res.json()) as ProductUrl[];
}

/** 새 마켓 폼 기본값 (MarketInput 백엔드 기본값과 일치). */
export function emptyMarketInput(): MarketInput {
  return {
    code: "",
    domain: "",
    name: "",
    currency: "",
    country: null,
    language: null,
    base_url: null,
    active: true,
    vat_rate: "0",
    price_includes_vat: true,
    local_alcohol_tax_per_liter: "0",
    price_includes_local_alcohol_tax: false,
    incoterm: "DAP",
    fta: false,
    domestic_shipping_cost: "0",
    crawl_ship_to: "KR",
    notes: null,
    shipping_options: [],
  };
}

/** 통화 기호 — 표시용(목록/금액). 미정의 통화는 호출부가 코드로 폴백. */
export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  HKD: "HK$",
  AUD: "A$",
  CAD: "C$",
  CHF: "CHF",
  SGD: "S$",
  NZD: "NZ$",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  TWD: "NT$",
};

/** 주요 통화 — 홈 미니 환율표·직구가 폼에서 쓰는 압축 기준(표시 순서 = 이 배열).
 *  달러/유로/파운드/엔/대만달러. */
export const PRIMARY_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "TWD"] as const;

/** 통화 선택 옵션 (백엔드 CURRENCY_NAMES 기준). */
export const CURRENCY_OPTIONS: { code: string; name: string }[] = [
  { code: "USD", name: "미국 달러" },
  { code: "EUR", name: "유로" },
  { code: "GBP", name: "영국 파운드" },
  { code: "JPY", name: "일본 엔" },
  { code: "CNY", name: "중국 위안" },
  { code: "HKD", name: "홍콩 달러" },
  { code: "AUD", name: "호주 달러" },
  { code: "CAD", name: "캐나다 달러" },
  { code: "CHF", name: "스위스 프랑" },
  { code: "SGD", name: "싱가포르 달러" },
  { code: "NZD", name: "뉴질랜드 달러" },
  { code: "SEK", name: "스웨덴 크로나" },
  { code: "NOK", name: "노르웨이 크로네" },
  { code: "DKK", name: "덴마크 크로네" },
  { code: "TWD", name: "대만 달러" },
];

/** 주요 통화 선택 옵션 — PRIMARY_CURRENCIES 순서로 정렬한 {code,name}. */
export const PRIMARY_CURRENCY_OPTIONS: { code: string; name: string }[] =
  PRIMARY_CURRENCIES.map(
    (code) => CURRENCY_OPTIONS.find((c) => c.code === code)!,
  );
