// 검토(사람 검수) API 클라이언트 — AI 앙상블이 결론 못 낸 분류/매칭을 운영자가 확정.
// 계약: GET /api/admin/processing/reviews, POST .../reviews/{product_url_id}/resolve.
//        (handoff-api-review-queue.md / 운영 OpenAPI 기준)
// 인증(JWT Bearer)·기반 URL·에러 처리는 auth.ts 공통 헬퍼 사용.

import { API_BASE_URL, authHeaders, ensureOk } from "./auth";

const base = `${API_BASE_URL}/api/admin/processing/reviews`;

/** consensus 한 속성의 투표 결과. backend는 opaque dict이라 느슨하게 표기.
 *  method = agree|partial|none|conflict|judge, votes = {모델: 그 모델의 답}. */
export interface ConsensusEntry {
  value?: unknown;
  method?: string;
  votes?: Record<string, unknown>;
}

/** 모델별 원답 1건. output = WhiskyAttributes 형태(느슨), confidence 0~1. */
export interface ModelOutput {
  model?: string;
  output?: Record<string, unknown>;
  confidence?: number;
}

/** 검수 대기 1건 — 식별/우선순위 + '왜 애매한지' 근거(최신 classification_run).
 *  consensus·model_outputs는 backend가 opaque JSON으로 내려 느슨하게 받는다. */
export interface ReviewListItem {
  product_url_id: number;
  name: string | null;
  url: string | null;
  image_url: string | null;
  market_id: number;
  market_code: string | null;
  market_domain: string | null;
  priority: number | null;
  norm_abv: string | null;
  norm_volume_ml: number | null;
  run_id: number | null;
  method: string | null; // agree | conflict | …
  agreement: number | null; // 0~1 전체 일치도
  consensus: Record<string, ConsensusEntry> | null;
  model_outputs: ModelOutput[] | null;
  needs_review: boolean | null;
  run_created_at: string | null;
}

/** 한국어 표기 보조 속성(운영 UI/검색용). */
export interface WhiskyKoreanAttributes {
  distillery?: string | null;
  bottler?: string | null;
  brand?: string | null;
  cask_type?: string | null;
  edition?: string | null;
  spirit_type?: string | null;
}

/** 캐스크 구성 1단계(role=maturation|finish, seq=0부터). */
export interface ProductCaskAttribute {
  cask_type: string | null;
  role: string;
  seq: number;
  finish_months: number | null;
}

/** 운영자가 확정한 위스키 속성(LLM 분류와 동형). confidence는 서버가 1.0 고정. */
export interface ReviewResolveIn {
  distillery?: string | null;
  bottler?: string | null;
  brand?: string | null;
  cask_type?: string | null;
  age_years?: number | null;
  edition?: string | null;
  spirit_type: string; // 기본 "whisky"
  vintage_year?: number | null;
  peated?: boolean | null;
  product_casks?: ProductCaskAttribute[];
  korean?: WhiskyKoreanAttributes;
}

/** 검수 확정 결과 — 적재/매칭 건수. */
export interface ReviewResolveOut {
  product_url_id: number;
  product_id: number | null;
  products_inserted: number;
  urls_matched: number;
  aliases_inserted: number;
  prices_inserted: number;
  product_casks_inserted: number;
  runs_reviewed: number;
}

/** 검수 대기 목록. priority(=q:review score) 우선순위 순, 이미 검수된 항목 제외. */
export async function listReviews(
  limit = 50,
  signal?: AbortSignal,
): Promise<ReviewListItem[]> {
  const qs = new URLSearchParams({ limit: String(limit) }).toString();
  const res = await fetch(`${base}?${qs}`, {
    signal,
    cache: "no-store",
    headers: authHeaders(),
  });
  await ensureOk(res);
  return (await res.json()) as ReviewListItem[];
}

/** 운영자 확정 속성으로 적재하고 검수 종료. 대상 URL 없으면 404. */
export async function resolveReview(
  productUrlId: number,
  body: ReviewResolveIn,
): Promise<ReviewResolveOut> {
  const res = await fetch(
    `${base}/${encodeURIComponent(productUrlId)}/resolve`,
    {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(body),
    },
  );
  await ensureOk(res);
  return (await res.json()) as ReviewResolveOut;
}
