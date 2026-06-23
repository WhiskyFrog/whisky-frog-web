// 직구가격(수동입력 확인용) 추정 API 클라이언트.
// ⚠️ public 철칙(DECISIONS 021): 세금(관세/주세/교육세/부가세) 계산 로직은 이 레포에 두지 않는다.
//    프론트는 입력값(통화·구매금액·배송비)만 보내고, 서버가 산출한 세금 원장을 그대로 렌더한다.
// 환율은 화면에서 입력받지 않는다 — 서버가 가진 현재 주차 관세청 고시환율을 적용하고
//    응답 exchange_rate로 에코한다(프론트는 표시만).
// 계약(백엔드): POST /api/direct-price/estimate — 공개(인증 불필요), 일회성(저장 없음).
//   ※ 핸드오프: ../whisky-frog-lab/docs/handoff-frontend-to-api-cost-quote-followup.md

import { API_BASE_URL, ensureOk } from "./auth";

/** 인코텀즈 — 주세 과표에 배송비 포함 여부를 가르는 거래조건(백엔드 Market.incoterm과 동일). */
export type Incoterm = "FOB" | "DAP";

/** 추정 요청 본문 — gomisoo식 입력(통화·구매금액·배송비·인코텀즈). 환율은 보내지 않음(서버 주입). */
export interface DirectPriceInput {
  currency: string; // ISO 3 (예: USD)
  purchase_amount: string; // 구매금액(상품가 + 현지배송), 외화 Decimal 문자열
  shipping_cost: string; // 배송비(배대지/포워딩), 외화 Decimal 문자열
  incoterm: Incoterm; // FOB(배송 과표 포함) / DAP(미포함)
  fta?: boolean; // 원산지 FTA 협정 적용 여부(관세 0). 과세($150 초과) 시에만 의미.
}

/**
 * 추정 응답 — 백엔드가 산출한 세금 원장(전부 원화 Decimal 문자열) + 적용 환율 에코.
 * 프론트는 이 값을 계산하지 않고 표시만 한다.
 */
export interface DirectPriceEstimate {
  currency: string;
  exchange_rate: number | string; // 서버가 적용한 고시환율(원/통화) 에코
  goods_value_krw: number | string; // 물품가격 환산(구매금액 + 배송비)
  dutiable_value_krw: number | string; // 과세가격(CIF)
  customs_duty_krw: number | string; // 관세
  liquor_tax_krw: number | string; // 주세
  education_tax_krw: number | string; // 교육세
  vat_krw: number | string; // 부가세
  total_tax_krw: number | string; // 총 세액
  total_landed_krw: number | string; // 최종 직구 예상금액(과세가격 + 총세액)
  taxable: boolean; // 과세 대상 여부(false = 소액면세 적용 — 판정은 백엔드)
}

/**
 * 직구가격 추정 요청. 네트워크/HTTP 오류는 throw — 호출부에서 에러 상태로 처리.
 * 422(환율 미수집 친화 문구 / 입력 검증 배열)는 ensureOk가 detail로 표면화한다.
 */
export async function estimateDirectPrice(
  input: DirectPriceInput,
  signal?: AbortSignal,
): Promise<DirectPriceEstimate> {
  const res = await fetch(`${API_BASE_URL}/api/direct-price/estimate`, {
    method: "POST",
    signal,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await ensureOk(res);
  return (await res.json()) as DirectPriceEstimate;
}

/** 원화 금액 포맷 — 정수 원 단위, 천단위 구분. null/undefined는 빈 슬롯("-"). */
export function formatKrw(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (Number.isNaN(n)) return "-";
  return `${n.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}원`;
}
