// 직구가(수입 비용·세금) 계산 API 클라이언트.
// ⚠️ public 철칙(DECISIONS 021): 세금(관세/주세/교육세/부가세) 계산 로직은 이 레포에 두지 않는다.
//    프론트는 입력값만 보내고, 서버가 산출한 원화 landed cost·세금 내역을 그대로 렌더한다.
// 계약: POST /api/cost/quote (공개, 인증 불필요, 일회성·저장 없음).
//   환율은 클라이언트가 알 필요 없음 — 서버가 현재 주차 관세청 환율을 조회/주입하고 fx_rate로 에코한다.
//   계약서: ../whisky-frog-lab/docs/handoff-frontend-cost-quote-api.md.

import { API_BASE_URL, ensureOk } from "./auth";

/** 계산 요청 본문 — 백엔드 CostQuoteIn. 배송은 둘 중 하나만(동시 지정 시 422). */
export interface CostQuoteInput {
  market_id: number; // GET /api/markets 의 id
  local_price: string; // 현지통화 표시가(>0) Decimal 문자열
  volume_ml: number; // 용량(ml, >0)
  abv: string; // 도수 %(0~100) Decimal 문자열
  quantity: number; // 병 수(기본 1, 자가사용 면세는 1병만)
  shipping_local?: string | null; // 현지통화 배송비 직접 지정(옵션)
  shipping_option_id?: number | null; // 또는 마켓 배송옵션 id
}

/** 계산 결과 — 백엔드 CostQuoteOut. 모든 금액은 원화 정수, fx는 에코 문자열. */
export interface CostQuote {
  market_id: number;
  currency: string;
  fx_rate: string; // 계산에 쓴 원/현지통화 (에코)
  usd_fx_rate: string; // 면세 판정에 쓴 원/USD (에코)
  goods_krw: number; // 과세가격(현지세 제거 후 원화)
  shipping_krw: number;
  tariff: number; // 관세 (FTA거나 면세면 0)
  liquor_tax: number; // 주세
  education_tax: number; // 교육세
  vat: number; // 부가세 (면세면 0)
  total_tax: number;
  landed_cost: number; // = goods + shipping + total_tax
  duty_free: boolean; // 자가사용 소액면세 적용 여부
}

/**
 * 직구가 계산 요청. 네트워크/HTTP 오류는 throw — 호출부에서 에러 상태로 처리.
 * 404(마켓/배송옵션 없음)·422(환율 미수집·배송 동시지정·검증실패)는 detail 메시지로 표면화.
 */
export async function quoteCost(
  input: CostQuoteInput,
  signal?: AbortSignal,
): Promise<CostQuote> {
  const res = await fetch(`${API_BASE_URL}/api/cost/quote`, {
    method: "POST",
    signal,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await ensureOk(res); // 실패 시 detail(422 검증 포함) 메시지로 throw
  return (await res.json()) as CostQuote;
}

/** 원화 금액 포맷 — 정수 원 단위, 천단위 구분. null/undefined는 빈 슬롯("-"). */
export function formatKrw(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (Number.isNaN(n)) return "-";
  return `${n.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}원`;
}
