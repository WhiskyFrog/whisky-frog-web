"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listProductUrls,
  type Market,
  type ParseStatus,
  type ProductUrl,
} from "../../lib/markets";

type Status = "loading" | "error" | "ready";

const PAGE_SIZE = 50;

const PARSE_STATUSES: ParseStatus[] = ["pending", "ok", "error", "skipped"];

/** 파싱 상태 배지 색. */
const PARSE_BADGE: Record<ParseStatus, string> = {
  ok: "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300",
  pending: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  error: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  skipped: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
};

/** ISO datetime → "YYYY.MM.DD HH:mm" (로컬). null이면 "–". */
function formatDateTime(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 마켓이 크롤러로 수집한 상품 URL 목록(읽기 전용). 파싱/재고 필터 + 페이지네이션. */
export function ProductUrlList({
  market,
  onBack,
}: {
  market: Market;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [rows, setRows] = useState<ProductUrl[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  // 필터 — ""(전체) | 특정 값.
  const [parseStatus, setParseStatus] = useState<"" | ParseStatus>("");
  const [available, setAvailable] = useState<"" | "true" | "false">("");
  const [offset, setOffset] = useState(0);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus("loading");
      listProductUrls(
        market.id,
        {
          parse_status: parseStatus || undefined,
          available: available === "" ? undefined : available === "true",
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
    [market.id, parseStatus, available, offset],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // 필터 변경 시 첫 페이지로.
  function changeParseStatus(v: "" | ParseStatus) {
    setOffset(0);
    setParseStatus(v);
  }
  function changeAvailable(v: "" | "true" | "false") {
    setOffset(0);
    setAvailable(v);
  }

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const hasPrev = offset > 0;
  const hasNext = rows.length === PAGE_SIZE; // 가득 찼으면 다음 페이지 존재 가능

  const selectCls =
    "rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800";

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">
            상품 URL — {market.name}
            <span className="ml-2 font-mono text-sm font-normal text-gray-400 dark:text-gray-500">
              {market.code}
            </span>
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            크롤러가 수집한 상품 URL 원장 + 파싱 큐 상태(읽기 전용).
          </p>
        </div>
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
        >
          ← 목록으로
        </button>
      </div>

      {/* 필터 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
          파싱
          <select
            value={parseStatus}
            onChange={(e) => changeParseStatus(e.target.value as "" | ParseStatus)}
            className={selectCls}
          >
            <option value="">전체</option>
            {PARSE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
          재고
          <select
            value={available}
            onChange={(e) =>
              changeAvailable(e.target.value as "" | "true" | "false")
            }
            className={selectCls}
          >
            <option value="">전체</option>
            <option value="true">판매가능</option>
            <option value="false">품절</option>
          </select>
        </label>
      </div>

      {status === "loading" && (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">
          불러오는 중…
        </div>
      )}

      {status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-10 text-center dark:border-red-900 dark:bg-red-950/40">
          <p className="font-medium text-red-700 dark:text-red-300">
            상품 URL을 불러오지 못했습니다.
          </p>
          <p className="mt-1 text-sm text-red-500 dark:text-red-400">
            {errorMsg}
          </p>
          <button
            onClick={() => load()}
            className="mt-3 rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            다시 시도
          </button>
        </div>
      )}

      {status === "ready" && rows.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            {offset > 0 || parseStatus || available
              ? "조건에 맞는 상품 URL이 없습니다."
              : "수집된 상품 URL이 없습니다."}
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            크롤러 ①단계가 이 마켓을 돌면 여기에 쌓입니다.
          </p>
        </div>
      )}

      {status === "ready" && rows.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 text-left text-gray-600 dark:border-gray-600 dark:text-gray-400">
                  <th className="px-3 py-2 font-medium">상품명 / URL</th>
                  <th className="px-3 py-2 text-center font-medium">재고</th>
                  <th className="px-3 py-2 text-center font-medium">파싱</th>
                  <th className="px-3 py-2 font-medium">최근 발견</th>
                  <th className="px-3 py-2 font-medium">최근 파싱</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-100 align-top hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {r.name ?? (
                          <span className="text-gray-400 dark:text-gray-500">
                            (이름 없음)
                          </span>
                        )}
                      </div>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block max-w-md truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
                        title={r.url}
                      >
                        {r.url}
                      </a>
                      {r.parse_error && (
                        <div
                          className="mt-0.5 max-w-md truncate text-xs text-red-500 dark:text-red-400"
                          title={r.parse_error}
                        >
                          ⚠ {r.parse_error}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center whitespace-nowrap">
                      {r.available ? (
                        <span className="text-green-600 dark:text-green-400">
                          판매가능
                        </span>
                      ) : (
                        <span
                          className="text-gray-400 dark:text-gray-500"
                          title={r.stock_status ?? undefined}
                        >
                          품절
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${PARSE_BADGE[r.parse_status]}`}
                      >
                        {r.parse_status}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-400">
                      {formatDateTime(r.last_seen_at)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-400">
                      {formatDateTime(r.last_parsed_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 — 응답에 total이 없어 prev/next만 제공(가득참 기준). */}
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
