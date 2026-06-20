"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  fetchExchangeRates,
  formatDate,
  formatRate,
  type ExchangeRate,
} from "../lib/exchangeRates";
import { RiseFall } from "../components/RiseFall";

type Status = "loading" | "error" | "ready";

export default function ExchangeRatesPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [rows, setRows] = useState<ExchangeRate[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    fetchExchangeRates(controller.signal)
      .then((data) => {
        setRows(data);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return; // 언마운트로 인한 취소는 무시
        setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          ← 홈으로
        </Link>
        <h1 className="mt-2 text-2xl font-bold">주간 고시환율</h1>
        <p className="mt-1 text-sm text-gray-500">
          관세청 주간 고시환율(현재 주차) · 원/현지통화 1단위 기준
        </p>
      </header>

      {status === "loading" && (
        <div className="py-16 text-center text-gray-500">불러오는 중…</div>
      )}

      {status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-10 text-center">
          <p className="font-medium text-red-700">환율을 불러오지 못했습니다.</p>
          <p className="mt-1 text-sm text-red-500">{errorMsg}</p>
        </div>
      )}

      {status === "ready" && rows.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-16 text-center">
          <p className="font-medium text-gray-700">표시할 환율 데이터가 없습니다.</p>
          <p className="mt-1 text-sm text-gray-500">
            아직 이번 주차 고시환율이 수집되지 않았습니다. 수집 후 자동으로 표시됩니다.
          </p>
        </div>
      )}

      {status === "ready" && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 text-left text-gray-600">
                <th className="px-3 py-2 font-medium">통화</th>
                <th className="px-3 py-2 text-right font-medium">원화</th>
                <th className="px-3 py-2 text-right font-medium">전주</th>
                <th className="px-3 py-2 text-center font-medium">등락</th>
                <th className="px-3 py-2 font-medium">적용기간</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.currency}
                  className="border-b border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2">
                    <span className="font-medium">{r.currency}</span>
                    <span className="ml-1 text-gray-500">{r.name}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatRate(r.rate_krw)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                    {formatRate(r.prev_rate_krw)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <RiseFall
                      rate={r.rate_krw}
                      prev={r.prev_rate_krw}
                      magnitude={r.rise_fall}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-600">
                    {formatDate(r.apply_start)} ~ {formatDate(r.apply_end)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
