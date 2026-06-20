// 마켓 관리(admin) CRUD API 클라이언트.
// 계약: docs/handoff-frontend-admin-markets-api.md (구현 backend/app/api/admin_markets.py).
// 금액/세율 Decimal은 정밀도 보존 위해 JSON에서 "문자열"로 오간다.

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** 백엔드 ADMIN_API_TOKEN이 설정된 경우 X-Admin-Token 헤더로 실어 보낸다.
 *  로컬(미설정)에선 없어도 통과. 토큰은 관리화면에서 localStorage에 보관. */
const TOKEN_KEY = "wb_admin_token";

export function getAdminToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_KEY) ?? "";
}

export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

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

function authHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  const token = getAdminToken();
  if (token) headers["X-Admin-Token"] = token;
  return headers;
}

/** 응답을 검사하고 실패 시 detail 메시지로 throw. */
async function ensureOk(res: Response): Promise<void> {
  if (res.ok) return;
  let detail = `HTTP ${res.status}`;
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") detail = body.detail;
    else if (Array.isArray(body?.detail)) {
      // FastAPI 422 검증 오류
      detail = body.detail
        .map((e: { loc?: unknown[]; msg?: string }) => {
          const field = Array.isArray(e.loc) ? e.loc.slice(1).join(".") : "";
          return field ? `${field}: ${e.msg}` : e.msg;
        })
        .join(", ");
    }
  } catch {
    /* 본문 없음 */
  }
  if (res.status === 401) detail = "관리자 토큰이 필요하거나 올바르지 않습니다.";
  throw new Error(detail);
}

const base = `${API_BASE_URL}/api/admin/markets`;

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
