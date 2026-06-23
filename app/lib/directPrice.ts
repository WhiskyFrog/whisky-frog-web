// 직구가격(수동입력 확인용) 추정 API 클라이언트.
// ⚠️ public 철칙(DECISIONS 021): 세금(관세/주세/교육세/부가세) 계산 로직은 이 레포에 두지 않는다.
//    프론트는 입력값만 보내고, 실제 계산은 backend가 수행한 결과(원장)를 그대로 렌더한다.
// 계약(백엔드 구현 예정): POST /api/direct-price/estimate — 공개(인증 불필요), 일회성(저장 없음).
// 금액/환율 Decimal은 정밀도 보존을 위해 JSON에서 "문자열"로 오간다(number도 허용).

import { API_BASE_URL } from "./auth";

/** 추정 요청 본문 — gomisoo식 입력(구매금액·배송비·통화). */
export interface DirectPriceInput {
  currency: string; // ISO 3 (예: USD)
  purchase_amount: string; // 구매금액(상품가 + 현지배송), 외화 Decimal 문자열
  shipping_cost: string; // 배송비(배대지/포워딩), 외화 Decimal 문자열
  exchange_rate?: string | null; // 선택: 적용 고시환율(원/통화) 직접 지정. null/생략이면 백엔드 고시환율.
}

/**
 * 추정 응답 — 백엔드가 산출한 세금 원장(전부 원화 Decimal 문자열).
 * 프론트는 이 값을 계산하지 않고 표시만 한다.
 */
export interface DirectPriceEstimate {
  currency: string;
  exchange_rate: number | string; // 적용 고시환율(원/통화)
  goods_value_krw: number | string; // 물품가격 환산(구매금액 + 배송비)
  dutiable_value_krw: number | string; // 과세가격(CIF)
  customs_duty_krw: number | string; // 관세
  liquor_tax_krw: number | string; // 주세
  education_tax_krw: number | string; // 교육세
  vat_krw: number | string; // 부가세
  total_tax_krw: number | string; // 총 세액
  total_landed_krw: number | string; // 최종 직구 예상금액(물품가 + 총세액)
  taxable: boolean; // 과세 대상 여부($150 초과 등 — 판정은 백엔드)
  notes?: string | null; // 안내문(적용 세율 요약 등)
}

/**
 * 직구가격 추정 요청. 네트워크/HTTP 오류는 throw — 호출부에서 에러 상태로 처리.
 * 백엔드 엔드포인트 미배포 시 404/연결오류가 나며, UI가 안내 메시지로 표시한다.
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
  if (!res.ok) {
    if (res.status === 404)
      throw new Error(
        "직구가격 계산 API가 아직 백엔드에 준비되지 않았습니다 (404).",
      );
    let detail = `직구가격 계산 실패 (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* 본문 없음 */
    }
    throw new Error(detail);
  }
  return (await res.json()) as DirectPriceEstimate;
}

/** 원화 금액 포맷 — 정수 원 단위, 천단위 구분. */
export function formatKrw(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (Number.isNaN(n)) return "-";
  return `${n.toLocaleString("ko-KR", { maximumFractionDigits: 0 })}원`;
}
