"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchExchangeRates,
  formatRate,
  type ExchangeRate,
} from "../lib/exchangeRates";
import { RiseFall } from "./RiseFall";
import { PRIMARY_CURRENCIES } from "../lib/markets";

type Status = "loading" | "error" | "ready";

/** 미니 표에 노출할 통화 — 공용 주요 통화 기준(표시 순서도 이 배열). KRW는 기준 통화라 제외. */
const MINI_CURRENCIES = PRIMARY_CURRENCIES;

/** 최소화 상태 저장 키 — 새로고침/페이지 이동 후에도 사용자 선택 유지. */
const COLLAPSED_KEY = "exchangeMini.collapsed";

/** 홈 좌하단 요약 표 — 주요 통화만 압축해서 보여주고, 전체보기로 상세 페이지 연결. */
export function ExchangeRateMini() {
  const [status, setStatus] = useState<Status>("loading");
  const [rows, setRows] = useState<ExchangeRate[]>([]);
  const [collapsed, setCollapsed] = useState(false);

  // localStorage 값은 마운트 후에만 읽어 SSR/CSR 마크업 불일치를 피한다.
  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      return next;
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetchExchangeRates(controller.signal)
      .then((data) => {
        const order = new Map<string, number>(
          MINI_CURRENCIES.map((c, i) => [c, i]),
        );
        const picked = data
          .filter((r) => order.has(r.currency))
          .sort((a, b) => order.get(a.currency)! - order.get(b.currency)!);
        setRows(picked);
        setStatus("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        title="환율표 펼치기"
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white/90 px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm backdrop-blur hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/90 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        주간 고시환율
        <span aria-hidden className="text-gray-400 dark:text-gray-500">
          ▢
        </span>
      </button>
    );
  }

  return (
    <section className="w-72 rounded-lg border border-gray-200 bg-white/90 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/90">
      <header className="flex items-center justify-between border-b border-gray-100 px-3 py-2 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          주간 고시환율
        </h2>
        <div className="flex items-center gap-2">
          <Link
            href="/exchange-rates"
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            전체보기 →
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            title="최소화"
            aria-label="환율표 최소화"
            className="-mr-1 flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            <span aria-hidden className="leading-none">
              ─
            </span>
          </button>
        </div>
      </header>

      {status === "loading" && (
        <div className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
          불러오는 중…
        </div>
      )}

      {status === "error" && (
        <div className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
          환율을 불러오지 못했습니다.
        </div>
      )}

      {status === "ready" && rows.length === 0 && (
        <div className="px-3 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
          수집된 환율이 없습니다.
        </div>
      )}

      {status === "ready" && rows.length > 0 && (
        <table className="w-full text-xs">
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.currency}
                className="border-b border-gray-50 last:border-0 dark:border-gray-800"
              >
                <td className="px-3 py-1.5">
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {r.currency}
                  </span>
                  <span className="ml-1 text-gray-400 dark:text-gray-500">
                    {r.name}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-gray-800 dark:text-gray-200">
                  {formatRate(r.rate_krw)}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <RiseFall
                    rate={r.rate_krw}
                    prev={r.prev_rate_krw}
                    magnitude={r.rise_fall}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
