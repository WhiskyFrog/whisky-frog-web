// 데이터 수집(크롤) 관리 API 클라이언트 — Celery 기반.
// 계약: GET /api/admin/crawl/{history,schedule}, POST .../jobs/{task_id}/revoke,
//       POST /api/admin/markets/{market_id}/{crawl,parse}. (운영 OpenAPI 기준)
// 인증·기반 URL은 auth.ts 공통 헬퍼 재사용.

import { API_BASE_URL, authHeaders, ensureOk } from "./auth";

const base = `${API_BASE_URL}/api/admin/crawl`;

/** 완료/진행 이력 상태값 — 백엔드 status 열거와 동일. */
export type CrawlStatus = "running" | "success" | "failure" | "revoked";

/** 완료/진행 크롤 잡 이력 1건(crawl_jobs 원장). */
export interface CrawlJob {
  id: number;
  task_id: string;
  name: string;
  domain: string | null;
  status: string;
  args: string | null;
  result_count: number | null;
  error: string | null;
  started_at: string | null; // ISO datetime
  finished_at: string | null; // ISO datetime
  created_at: string; // ISO datetime
}

/** 라이브 워커 inspect 잡 상태.
 *  active=실행 중 · reserved=워커가 가져왔지만 미시작(대기) · scheduled=ETA 예약. */
export type ActiveJobState = "active" | "reserved" | "scheduled";

/** 라이브 inspect 잡 1건(GET /jobs). 워커 메모리 기준이라 무응답 시 누락 가능(best-effort).
 *  DB 원장(CrawlJob)과 달리 domain 컬럼이 없고 args/kwargs로만 식별된다. */
export interface ActiveJob {
  task_id: string;
  name: string;
  args: unknown[];
  kwargs: Record<string, unknown>;
  worker: string;
  state: ActiveJobState;
  started_at: string | null; // ISO datetime, active일 때
  eta: string | null; // ISO datetime, scheduled일 때
}

/** 브로커 큐 적재 깊이(redis LLEN). inspect로 안 보이는 '진짜 대기' overflow 분량(개수만).
 *  concurrency×prefetch를 넘겨 쌓인 잡 수. redis 브로커가 아니거나 조회 실패면 length=null. */
export interface QueueDepth {
  queue: string;
  length: number | null;
}

/** beat 스케줄 1건(정기 크롤 예정). schedule은 celery beat 정의 문자열. */
export interface ScheduleEntry {
  name: string;
  task: string;
  schedule: string;
}

/** 스케줄 수동 1회 실행 응답(비동기 enqueue 결과). task_id로 잡 상태를 폴링한다. */
export interface ScheduleRunResult {
  task_id: string;
  name: string;
  status: string; // "queued"
}

/** 단일 잡 상태/결과(트리거 후 폴링용 — GET /jobs/{task_id}).
 *  state = Celery 상태(PENDING|STARTED|PROGRESS|SUCCESS|FAILURE|REVOKED).
 *  result = SUCCESS 시 태스크 반환값. 주간 목록 크롤은 `{도메인: 적재건수}`
 *  (음수: -1=실패, -2=이미 진행 중 / 어댑터 없거나 비활성인 마켓은 키 자체가 없음). */
export interface JobStatus {
  task_id: string;
  state: string;
  result: unknown;
}

/** revoke 결과. */
export interface RevokeResult {
  task_id: string;
  revoked: boolean;
  terminated: boolean;
}

export interface HistoryQuery {
  domain?: string;
  status?: CrawlStatus;
  limit?: number;
  offset?: number;
}

/** 완료/진행 이력 목록. created_at 최신순(백엔드 정렬). */
export async function listCrawlHistory(
  query: HistoryQuery = {},
  signal?: AbortSignal,
): Promise<CrawlJob[]> {
  const params = new URLSearchParams();
  if (query.domain) params.set("domain", query.domain);
  if (query.status) params.set("status", query.status);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  const qs = params.toString();
  const res = await fetch(`${base}/history${qs ? `?${qs}` : ""}`, {
    signal,
    cache: "no-store",
    headers: authHeaders(),
  });
  await ensureOk(res);
  return (await res.json()) as CrawlJob[];
}

/** 라이브 진행/대기 잡 목록(워커 inspect). active(실행 중)+reserved/scheduled(큐 대기) 합산.
 *  워커 무응답 시 빈 목록(best-effort) — 진행 중 원장 조회와 별개로 보조 신호로만 쓴다. */
export async function listActiveJobs(signal?: AbortSignal): Promise<ActiveJob[]> {
  const res = await fetch(`${base}/jobs`, {
    signal,
    cache: "no-store",
    headers: authHeaders(),
  });
  await ensureOk(res);
  return (await res.json()) as ActiveJob[];
}

/** 브로커 큐 적재 깊이 — inspect로 안 보이는 overflow 대기량(개수만). */
export async function getQueueDepth(signal?: AbortSignal): Promise<QueueDepth> {
  const res = await fetch(`${base}/queue`, {
    signal,
    cache: "no-store",
    headers: authHeaders(),
  });
  await ensureOk(res);
  return (await res.json()) as QueueDepth;
}

/** beat 정기 스케줄 목록. */
export async function listSchedule(
  signal?: AbortSignal,
): Promise<ScheduleEntry[]> {
  const res = await fetch(`${base}/schedule`, {
    signal,
    cache: "no-store",
    headers: authHeaders(),
  });
  await ensureOk(res);
  return (await res.json()) as ScheduleEntry[];
}

/** 진행 중 잡 종료(revoke). terminate=true면 실행 중 워커 프로세스 강제 종료(SIGTERM). */
export async function revokeJob(
  taskId: string,
  terminate = false,
): Promise<RevokeResult> {
  const res = await fetch(
    `${base}/jobs/${encodeURIComponent(taskId)}/revoke?terminate=${terminate}`,
    { method: "POST", headers: authHeaders() },
  );
  await ensureOk(res);
  return (await res.json()) as RevokeResult;
}

/** 마켓 수동 크롤 실행 트리거. maxPages 지정 시 스모크(예: 1페이지=24건). */
export async function triggerCrawl(
  marketId: number,
  maxPages?: number,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/markets/${marketId}/crawl`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(maxPages !== undefined ? { max_pages: maxPages } : {}),
  });
  await ensureOk(res);
}

/** 마켓 상세 원문 파싱(stage-2) 트리거. limit 지정 시 이번 런 처리 수 제한.
 *  미파싱/재등장 product_urls의 상세를 fetch해 raw_html 적재(같은 마켓 락 공유). */
export async function triggerParse(
  marketId: number,
  limit?: number,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/admin/markets/${marketId}/parse`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify(limit !== undefined ? { limit } : {}),
  });
  await ensureOk(res);
}

/** 등록된 정기 스케줄(환율·정기 크롤 등)을 즉시 1회 실행. name = ScheduleEntry.name.
 *  같은 태스크 진행 중이면 409, 없는 스케줄이면 404(마켓 트리거와 동일 가드).
 *  반환 task_id로 `getJobStatus`를 폴링해 마켓별 결과를 확인할 수 있다. */
export async function triggerSchedule(name: string): Promise<ScheduleRunResult> {
  const res = await fetch(
    `${base}/schedule/${encodeURIComponent(name)}/run`,
    { method: "POST", headers: authHeaders() },
  );
  await ensureOk(res);
  return (await res.json()) as ScheduleRunResult;
}

/** 단일 잡 상태/결과 조회(트리거 후 폴링). 결과 백엔드에서 읽으므로 캐시 금지. */
export async function getJobStatus(
  taskId: string,
  signal?: AbortSignal,
): Promise<JobStatus> {
  const res = await fetch(`${base}/jobs/${encodeURIComponent(taskId)}`, {
    signal,
    cache: "no-store",
    headers: authHeaders(),
  });
  await ensureOk(res);
  return (await res.json()) as JobStatus;
}
