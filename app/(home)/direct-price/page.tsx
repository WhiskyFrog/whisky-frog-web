"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  quoteCost,
  formatKrw,
  type CostQuote,
} from "../../lib/directPrice";
import { listPublicMarkets, type PublicMarket } from "../../lib/markets";

type Status = "idle" | "loading" | "error" | "ready";

/** 세금 내역 행 — 응답에 값이 있으면 표시, 없으면 칸만 열어둔다(formatKrw가 "-"). */
const TAX_ROWS: { label: string; key: keyof CostQuote }[] = [
  { label: "관세", key: "tariff" },
  { label: "주세", key: "liquor_tax" },
  { label: "교육세", key: "education_tax" },
  { label: "부가세", key: "vat" },
];

export default function DirectPricePage() {
  // 마켓 목록(드롭다운)
  const [markets, setMarkets] = useState<PublicMarket[]>([]);
  const [marketsError, setMarketsError] = useState("");

  // 입력값
  const [marketId, setMarketId] = useState("");
  const [localPrice, setLocalPrice] = useState("");
  const [volumeMl, setVolumeMl] = useState("700");
  const [abv, setAbv] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [shippingLocal, setShippingLocal] = useState("");

  // 결과
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<CostQuote | null>(null);

  const selected = markets.find((m) => String(m.id) === marketId);
  const currency = selected?.currency ?? "";

  useEffect(() => {
    const controller = new AbortController();
    listPublicMarkets(controller.signal)
      .then(setMarkets)
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setMarketsError(
          err instanceof Error ? err.message : "마켓 목록을 불러오지 못했습니다.",
        );
      });
    return () => controller.abort();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!marketId) return fail("마켓을 선택해 주세요.");
    if (!(Number(localPrice) > 0)) return fail("현지가격을 0보다 큰 숫자로 입력해 주세요.");
    if (!(Number(volumeMl) > 0)) return fail("용량(ml)을 0보다 큰 숫자로 입력해 주세요.");
    const abvNum = Number(abv);
    if (abv.trim() === "" || Number.isNaN(abvNum) || abvNum < 0 || abvNum > 100)
      return fail("도수(%)를 0~100 사이로 입력해 주세요.");
    if (!(Number(quantity) >= 1)) return fail("수량은 1 이상이어야 합니다.");

    setStatus("loading");
    setErrorMsg("");
    quoteCost({
      market_id: Number(marketId),
      local_price: localPrice,
      volume_ml: Number(volumeMl),
      abv,
      quantity: Number(quantity),
      shipping_local: shippingLocal.trim() === "" ? null : shippingLocal,
    })
      .then((data) => {
        setResult(data);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
        setResult(null);
        setStatus("error");
      });
  }

  function fail(msg: string) {
    setStatus("error");
    setErrorMsg(msg);
    setResult(null);
  }

  const inputClass =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm tabular-nums outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900";
  const labelClass =
    "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";
  const curSuffix = currency ? ` (${currency})` : "";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-6">
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          ← 홈으로
        </Link>
        <h1 className="mt-2 text-2xl font-bold">직구가격 수동입력 확인</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          마켓·현지가격·용량·도수를 입력하면 예상 직구가격(관세·주세·교육세·부가세
          포함)을 조회합니다. 환율은 서버가 현재 주차 관세청 고시환율을 적용하며,
          실제 통관 세액과 다를 수 있습니다.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="market" className={labelClass}>
              마켓
            </label>
            <select
              id="market"
              value={marketId}
              onChange={(e) => setMarketId(e.target.value)}
              className={inputClass}
            >
              <option value="">마켓 선택…</option>
              {markets.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {m.currency}
                  {m.country ? ` · ${m.country}` : ""}
                </option>
              ))}
            </select>
            {marketsError && (
              <p className="mt-1 text-xs text-red-500">{marketsError}</p>
            )}
          </div>

          <div>
            <label htmlFor="localPrice" className={labelClass}>
              현지가격{curSuffix}
            </label>
            <input
              id="localPrice"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="현지통화 표시가"
              value={localPrice}
              onChange={(e) => setLocalPrice(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="shippingLocal" className={labelClass}>
              배송비{curSuffix} <span className="text-gray-400">(선택)</span>
            </label>
            <input
              id="shippingLocal"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="비우면 0"
              value={shippingLocal}
              onChange={(e) => setShippingLocal(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="volumeMl" className={labelClass}>
              용량 (ml)
            </label>
            <input
              id="volumeMl"
              type="number"
              inputMode="numeric"
              step="1"
              min="0"
              placeholder="700"
              value={volumeMl}
              onChange={(e) => setVolumeMl(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="abv" className={labelClass}>
              도수 (%)
            </label>
            <input
              id="abv"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              max="100"
              placeholder="예: 46"
              value={abv}
              onChange={(e) => setAbv(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="quantity" className={labelClass}>
              수량 (병)
            </label>
            <input
              id="quantity"
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-400">
              자가사용 소액면세는 1병 기준
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={status === "loading"}
          className="mt-5 w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "계산 중…" : "직구가격 계산"}
        </button>
      </form>

      {status === "error" && (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-4 text-center dark:border-red-900 dark:bg-red-950/40">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            {errorMsg}
          </p>
        </div>
      )}

      {status === "ready" && result && (
        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">예상 직구가격</h2>
            <span
              className={
                result.duty_free
                  ? "rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300"
                  : "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              }
            >
              {result.duty_free ? "소액면세 적용" : "과세 대상"}
            </span>
          </div>

          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 text-gray-500 dark:text-gray-400">
                  적용 환율
                </td>
                <td className="py-2 text-right tabular-nums">
                  {Number(result.fx_rate).toLocaleString("ko-KR", {
                    maximumFractionDigits: 4,
                  })}{" "}
                  원/{result.currency}
                </td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 text-gray-500 dark:text-gray-400">
                  물품가격(과세가격)
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatKrw(result.goods_krw)}
                </td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 text-gray-500 dark:text-gray-400">배송비</td>
                <td className="py-2 text-right tabular-nums">
                  {formatKrw(result.shipping_krw)}
                </td>
              </tr>

              {/* 세금 내역 — 각 항목을 아래로 펼쳐서 표시(값 없으면 빈 칸) */}
              {TAX_ROWS.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-gray-100 dark:border-gray-800"
                >
                  <td className="py-2 pl-3 text-gray-500 dark:text-gray-400">
                    {row.label}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatKrw(result[row.key] as number)}
                  </td>
                </tr>
              ))}

              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 font-medium text-gray-700 dark:text-gray-300">
                  총 세액
                </td>
                <td className="py-2 text-right font-medium tabular-nums">
                  {formatKrw(result.total_tax)}
                </td>
              </tr>
              <tr>
                <td className="pt-3 text-base font-bold">최종 직구 예상금액</td>
                <td className="pt-3 text-right text-base font-bold tabular-nums text-blue-600 dark:text-blue-400">
                  {formatKrw(result.landed_cost)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
