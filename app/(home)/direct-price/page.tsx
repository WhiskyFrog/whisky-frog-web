"use client";

import { useState } from "react";
import {
  estimateDirectPrice,
  formatKrw,
  type DirectPriceEstimate,
  type Incoterm,
} from "../../lib/directPrice";
import { CURRENCY_OPTIONS } from "../../lib/markets";

type Status = "idle" | "loading" | "error" | "ready";

/** 인코텀즈 선택지 — 백엔드 Market.incoterm(FOB/DAP)과 동일. */
const INCOTERM_OPTIONS: { value: Incoterm; label: string }[] = [
  { value: "DAP", label: "DAP · 도착지인도(배송 과표 미포함)" },
  { value: "FOB", label: "FOB · 본선인도(배송 과표 포함)" },
];

/** 세금 내역 행 — 응답에 값이 있으면 표시, 없으면 칸만 열어둔다(formatKrw가 "-"). */
const TAX_ROWS: { label: string; key: keyof DirectPriceEstimate }[] = [
  { label: "관세", key: "customs_duty_krw" },
  { label: "주세", key: "liquor_tax_krw" },
  { label: "교육세", key: "education_tax_krw" },
  { label: "부가세", key: "vat_krw" },
];

export default function DirectPricePage() {
  const [currency, setCurrency] = useState("USD");
  const [incoterm, setIncoterm] = useState<Incoterm>("DAP");
  const [purchaseAmount, setPurchaseAmount] = useState("");
  const [shippingCost, setShippingCost] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<DirectPriceEstimate | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(purchaseAmount);
    if (!purchaseAmount || Number.isNaN(amount) || amount <= 0) {
      setStatus("error");
      setErrorMsg("구매금액을 0보다 큰 숫자로 입력해 주세요.");
      setResult(null);
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    estimateDirectPrice({
      currency,
      purchase_amount: purchaseAmount,
      shipping_cost: shippingCost.trim() === "" ? "0" : shippingCost,
      incoterm,
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

  const inputClass =
    "w-full rounded-md border border-gray-300 px-3 py-2 text-sm tabular-nums outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900";
  const labelClass =
    "mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">직구가격 수동입력 확인</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          구매금액·배송비를 입력하면 예상 직구가격(관세·주세·교육세·부가세 포함)을
          조회합니다. 환율은 서버가 보유한 현재 주차 관세청 고시환율을 적용하며,
          실제 통관 세액과 다를 수 있습니다.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="currency" className={labelClass}>
              통화
            </label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inputClass}
            >
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} · {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="incoterm" className={labelClass}>
              인코텀즈
            </label>
            <select
              id="incoterm"
              value={incoterm}
              onChange={(e) => setIncoterm(e.target.value as Incoterm)}
              className={inputClass}
            >
              {INCOTERM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="purchaseAmount" className={labelClass}>
              구매금액 ({currency})
            </label>
            <input
              id="purchaseAmount"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="상품가 + 현지 배송비"
              value={purchaseAmount}
              onChange={(e) => setPurchaseAmount(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-400">
              배대지 이용 시 상품가 + 현지배송비를 함께 입력
            </p>
          </div>

          <div>
            <label htmlFor="shippingCost" className={labelClass}>
              배송비 ({currency})
            </label>
            <input
              id="shippingCost"
              type="number"
              inputMode="decimal"
              step="any"
              min="0"
              placeholder="0"
              value={shippingCost}
              onChange={(e) => setShippingCost(e.target.value)}
              className={inputClass}
            />
            <p className="mt-1 text-xs text-gray-400">
              국제배송비 / 배대지(포워딩) 비용
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
                result.taxable
                  ? "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  : "rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300"
              }
            >
              {result.taxable ? "과세 대상" : "면세 대상"}
            </span>
          </div>

          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 text-gray-500 dark:text-gray-400">
                  적용 환율
                </td>
                <td className="py-2 text-right tabular-nums">
                  {Number(result.exchange_rate).toLocaleString("ko-KR", {
                    maximumFractionDigits: 4,
                  })}{" "}
                  원/{result.currency}
                </td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 text-gray-500 dark:text-gray-400">
                  물품가격(환산)
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatKrw(result.goods_value_krw)}
                </td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 text-gray-500 dark:text-gray-400">
                  과세가격
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatKrw(result.dutiable_value_krw)}
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
                    {formatKrw(result[row.key] as number | string)}
                  </td>
                </tr>
              ))}

              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="py-2 font-medium text-gray-700 dark:text-gray-300">
                  총 세액
                </td>
                <td className="py-2 text-right font-medium tabular-nums">
                  {formatKrw(result.total_tax_krw)}
                </td>
              </tr>
              <tr>
                <td className="pt-3 text-base font-bold">최종 직구 예상금액</td>
                <td className="pt-3 text-right text-base font-bold tabular-nums text-blue-600 dark:text-blue-400">
                  {formatKrw(result.total_landed_krw)}
                </td>
              </tr>
            </tbody>
          </table>

          {result.notes && (
            <p className="mt-3 text-xs text-gray-400">{result.notes}</p>
          )}
        </section>
      )}
    </main>
  );
}
