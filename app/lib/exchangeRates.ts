// 환율 API 클라이언트 (DECISIONS 014 계약).
// GET /api/exchange-rates → 현재 주차 관세청 주간 고시환율 목록(통화 오름차순).

/** 응답 한 행 — 백엔드 ExchangeRateOut 계약과 1:1. */
export interface ExchangeRate {
  currency: string;
  name: string;
  // Pydantic Decimal은 JSON에서 문자열로 올 수 있어 number|string 모두 허용.
  rate_krw: number | string;
  prev_rate_krw: number | string | null;
  rise_fall: string | null; // 등락 '폭' 숫자 문자열(예 "6.23"). 방향 아님 — null 가능.
  apply_start: string; // ISO date "YYYY-MM-DD"
  apply_end: string;
}

/** 백엔드 베이스 URL. 로컬은 docker compose의 web 서비스(.env.local에서 주입). */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/**
 * 현재 주차 환율 목록 조회.
 * 네트워크/HTTP 오류는 throw — 호출부에서 에러 상태로 처리한다.
 */
export async function fetchExchangeRates(
  signal?: AbortSignal,
): Promise<ExchangeRate[]> {
  const res = await fetch(`${API_BASE_URL}/api/exchange-rates`, {
    signal,
    // 항상 최신 고시환율을 받도록 캐시 비활성.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`환율 조회 실패 (HTTP ${res.status})`);
  }
  return (await res.json()) as ExchangeRate[];
}

/** 환율값 포맷 — 원/현지통화 1단위, 소수점 최대 4자리. */
export function formatRate(value: number | string | null): string {
  if (value === null || value === "") return "-";
  const n = Number(value);
  if (Number.isNaN(n)) return "-";
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 4 });
}

/** ISO date "YYYY-MM-DD" → "YYYY.MM.DD". */
export function formatDate(iso: string): string {
  return iso.replaceAll("-", ".");
}
