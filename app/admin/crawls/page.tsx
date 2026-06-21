"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listMarkets, type Market } from "../../lib/markets";
import {
  listActiveJobs,
  listCrawlHistory,
  listSchedule,
  revokeJob,
  type ActiveJob,
  type CrawlJob,
  type CrawlStatus,
  type ScheduleEntry,
} from "../../lib/crawl";

type Tab = "active" | "history" | "schedule";
type Status = "loading" | "error" | "ready";

const PAGE_SIZE = 50;
const POLL_MS = 4000; // 진행 중 탭 자동 새로고침 주기

const HISTORY_STATUSES: CrawlStatus[] = [
  "running",
  "success",
  "failure",
  "revoked",
];

/** 상태 배지 색. */
const STATUS_BADGE: Record<string, string> = {
  success: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  running: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  failure: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  revoked: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
};

function badgeCls(status: string): string {
  return (
    STATUS_BADGE[status] ??
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
  );
}

/** ISO datetime → "YYYY.MM.DD HH:mm:ss" (로컬). null이면 "–". */
function formatDateTime(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 경과/소요 시간 "HH:MM:SS" (start~end, end 없으면 now까지). */
function formatDuration(start: string | null, end: number | null): string {
  if (!start) return "–";
  const s = new Date(start).getTime();
  if (Number.isNaN(s)) return "–";
  const e = end ?? Date.now();
  let sec = Math.max(0, Math.floor((e - s) / 1000));
  const h = Math.floor(sec / 3600);
  sec -= h * 3600;
  const m = Math.floor(sec / 60);
  sec -= m * 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(sec)}`;
}

const tabBtn = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    active
      ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
      : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
  }`;

export default function CrawlsAdminPage() {
  const [tab, setTab] = useState<Tab>("active");

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-xl font-bold">데이터 수집 관리</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          크롤러 작업 현황·이력·스케줄. 진행 중 작업은 종료할 수 있습니다.
        </p>
      </div>

      <div className="mb-4 flex gap-2">
        <button onClick={() => setTab("active")} className={tabBtn(tab === "active")}>
          진행 중
        </button>
        <button
          onClick={() => setTab("history")}
          className={tabBtn(tab === "history")}
        >
          완료됨
        </button>
        <button
          onClick={() => setTab("schedule")}
          className={tabBtn(tab === "schedule")}
        >
          스케줄
        </button>
      </div>

      {tab === "active" && <ActiveTab />}
      {tab === "history" && <HistoryTab />}
      {tab === "schedule" && <ScheduleTab />}
    </div>
  );
}

// ── 진행 중 ──────────────────────────────────────────────
function ActiveTab() {
  const [status, setStatus] = useState<Status>("loading");
  const [rows, setRows] = useState<ActiveJob[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [, setTick] = useState(0); // 경과시간 라이브 갱신용 리렌더 트리거
  const [busy, setBusy] = useState<string | null>(null); // revoke 진행 중 task_id

  const load = useCallback((signal?: AbortSignal) => {
    listActiveJobs(signal)
      .then((data) => {
        setRows(data);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (signal?.aborted) return;
        setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
        setStatus("error");
      });
  }, []);

  // 폴링 + 1초 경과시간 갱신.
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    const poll = setInterval(() => load(), POLL_MS);
    const ticker = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      controller.abort();
      clearInterval(poll);
      clearInterval(ticker);
    };
  }, [load]);

  async function handleRevoke(taskId: string, terminate: boolean) {
    const msg = terminate
      ? "이 작업을 강제 종료할까요? (실행 중 워커 프로세스 SIGTERM)"
      : "이 작업을 종료할까요? (큐 취소 — 이미 실행 중이면 안 멈출 수 있음)";
    if (!window.confirm(msg)) return;
    setBusy(taskId);
    try {
      await revokeJob(taskId, terminate);
      load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "종료 실패");
    } finally {
      setBusy(null);
    }
  }

  if (status === "loading") {
    return (
      <div className="py-16 text-center text-gray-500 dark:text-gray-400">
        불러오는 중…
      </div>
    );
  }
  if (status === "error") {
    return <ErrorBox msg={errorMsg} onRetry={() => load()} label="작업" />;
  }
  if (rows.length === 0) {
    return (
      <EmptyBox
        title="진행 중인 작업이 없습니다."
        sub={`${POLL_MS / 1000}초마다 자동 새로고침됩니다.`}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="mb-2 text-xs text-gray-400 dark:text-gray-500">
        ↻ {POLL_MS / 1000}초마다 자동 새로고침
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-gray-300 text-left text-gray-600 dark:border-gray-600 dark:text-gray-400">
            <th className="px-3 py-2 font-medium">작업</th>
            <th className="px-3 py-2 font-medium">워커</th>
            <th className="px-3 py-2 font-medium">시작시각</th>
            <th className="px-3 py-2 font-medium">경과</th>
            <th className="px-3 py-2 text-right font-medium">동작</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((j) => (
            <tr
              key={j.task_id}
              className="border-b border-gray-100 align-top hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
            >
              <td className="px-3 py-2">
                <div className="font-medium text-gray-900 dark:text-gray-100">
                  {j.name}
                </div>
                <div className="font-mono text-[11px] text-gray-400 dark:text-gray-500">
                  {j.task_id}
                </div>
              </td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                {j.worker}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-400">
                {formatDateTime(j.started_at)}
              </td>
              <td className="px-3 py-2 whitespace-nowrap tabular-nums text-gray-600 dark:text-gray-400">
                {formatDuration(j.started_at, null)}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <button
                  onClick={() => handleRevoke(j.task_id, false)}
                  disabled={busy === j.task_id}
                  className="rounded px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-40 dark:text-amber-300 dark:hover:bg-amber-950/40"
                >
                  종료
                </button>
                <button
                  onClick={() => handleRevoke(j.task_id, true)}
                  disabled={busy === j.task_id}
                  className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  강제 종료
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 완료됨(이력) ─────────────────────────────────────────
function HistoryTab() {
  const [status, setStatus] = useState<Status>("loading");
  const [rows, setRows] = useState<CrawlJob[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [markets, setMarkets] = useState<Market[]>([]);

  const [domain, setDomain] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | CrawlStatus>("");
  const [offset, setOffset] = useState(0);

  // 도메인 필터 옵션용 마켓 목록(1회).
  useEffect(() => {
    const c = new AbortController();
    listMarkets(c.signal)
      .then(setMarkets)
      .catch(() => {
        /* 필터 옵션 실패는 무시 */
      });
    return () => c.abort();
  }, []);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus("loading");
      listCrawlHistory(
        {
          domain: domain || undefined,
          status: statusFilter || undefined,
          limit: PAGE_SIZE,
          offset,
        },
        signal,
      )
        .then((data) => {
          setRows(data);
          setStatus("ready");
        })
        .catch((err: unknown) => {
          if (signal?.aborted) return;
          setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
          setStatus("error");
        });
    },
    [domain, statusFilter, offset],
  );

  useEffect(() => {
    const c = new AbortController();
    load(c.signal);
    return () => c.abort();
  }, [load]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const hasPrev = offset > 0;
  const hasNext = rows.length === PAGE_SIZE;

  const selectCls =
    "rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
          도메인
          <select
            value={domain}
            onChange={(e) => {
              setOffset(0);
              setDomain(e.target.value);
            }}
            className={selectCls}
          >
            <option value="">전체</option>
            {markets.map((m) => (
              <option key={m.id} value={m.domain}>
                {m.code} ({m.domain})
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
          상태
          <select
            value={statusFilter}
            onChange={(e) => {
              setOffset(0);
              setStatusFilter(e.target.value as "" | CrawlStatus);
            }}
            className={selectCls}
          >
            <option value="">전체</option>
            {HISTORY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {status === "loading" && (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">
          불러오는 중…
        </div>
      )}
      {status === "error" && (
        <ErrorBox msg={errorMsg} onRetry={() => load()} label="이력" />
      )}
      {status === "ready" && rows.length === 0 && (
        <EmptyBox
          title={
            domain || statusFilter || offset > 0
              ? "조건에 맞는 이력이 없습니다."
              : "수집 이력이 없습니다."
          }
          sub="크롤이 한 번 실행되면 여기에 기록됩니다."
        />
      )}

      {status === "ready" && rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 text-left text-gray-600 dark:border-gray-600 dark:text-gray-400">
                  <th className="px-3 py-2 font-medium">작업 / 도메인</th>
                  <th className="px-3 py-2 text-center font-medium">상태</th>
                  <th className="px-3 py-2 font-medium">시작</th>
                  <th className="px-3 py-2 font-medium">완료</th>
                  <th className="px-3 py-2 font-medium">소요</th>
                  <th className="px-3 py-2 text-right font-medium">결과</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((j) => (
                  <tr
                    key={j.id}
                    className="border-b border-gray-100 align-top hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {j.name}
                        {j.domain && (
                          <span className="ml-1 font-normal text-gray-500 dark:text-gray-400">
                            · {j.domain}
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-gray-400 dark:text-gray-500">
                        {j.task_id}
                      </div>
                      {j.error && (
                        <div
                          className="mt-0.5 max-w-md truncate text-xs text-red-500 dark:text-red-400"
                          title={j.error}
                        >
                          ⚠ {j.error}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${badgeCls(j.status)}`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-400">
                      {formatDateTime(j.started_at)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-400">
                      {formatDateTime(j.finished_at)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums text-gray-600 dark:text-gray-400">
                      {formatDuration(
                        j.started_at,
                        j.finished_at ? new Date(j.finished_at).getTime() : null,
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {j.result_count ?? "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {page} 페이지 · {rows.length}건 표시
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={!hasPrev}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                ← 이전
              </button>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={!hasNext}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:hover:bg-gray-800"
              >
                다음 →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── 스케줄 ───────────────────────────────────────────────
function ScheduleTab() {
  const [status, setStatus] = useState<Status>("loading");
  const [rows, setRows] = useState<ScheduleEntry[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const load = useCallback((signal?: AbortSignal) => {
    setStatus("loading");
    listSchedule(signal)
      .then((data) => {
        setRows(data);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (signal?.aborted) return;
        setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
        setStatus("error");
      });
  }, []);

  useEffect(() => {
    const c = new AbortController();
    load(c.signal);
    return () => c.abort();
  }, [load]);

  if (status === "loading") {
    return (
      <div className="py-16 text-center text-gray-500 dark:text-gray-400">
        불러오는 중…
      </div>
    );
  }
  if (status === "error") {
    return <ErrorBox msg={errorMsg} onRetry={() => load()} label="스케줄" />;
  }
  if (rows.length === 0) {
    return (
      <EmptyBox
        title="등록된 정기 스케줄이 없습니다."
        sub="celery beat 스케줄이 설정되면 여기에 표시됩니다."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-xs text-gray-400 dark:text-gray-500">
        정기 크롤 예정(읽기 전용). 주기는 celery beat 정의값입니다.
      </p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-gray-300 text-left text-gray-600 dark:border-gray-600 dark:text-gray-400">
            <th className="px-3 py-2 font-medium">이름</th>
            <th className="px-3 py-2 font-medium">작업(task)</th>
            <th className="px-3 py-2 font-medium">주기</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr
              key={s.name}
              className="border-b border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
            >
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">
                {s.name}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                {s.task}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                {s.schedule}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 공통 상태 박스 ───────────────────────────────────────
function ErrorBox({
  msg,
  onRetry,
  label,
}: {
  msg: string;
  onRetry: () => void;
  label: string;
}) {
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-10 text-center dark:border-red-900 dark:bg-red-950/40">
      <p className="font-medium text-red-700 dark:text-red-300">
        {label}을(를) 불러오지 못했습니다.
      </p>
      <p className="mt-1 text-sm text-red-500 dark:text-red-400">{msg}</p>
      <button
        onClick={onRetry}
        className="mt-3 rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
      >
        다시 시도
      </button>
    </div>
  );
}

function EmptyBox({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
      <p className="font-medium text-gray-700 dark:text-gray-300">{title}</p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{sub}</p>
    </div>
  );
}
