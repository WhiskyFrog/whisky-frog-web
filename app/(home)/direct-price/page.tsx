"use client";

import { useEffect, useState } from "react";
import {
  estimateDirectPrice,
  formatKrw,
  type DirectPriceEstimate,
  type Incoterm,
} from "../../lib/directPrice";
import {
  fetchExchangeRates,
  formatRate,
  type ExchangeRate,
} from "../../lib/exchangeRates";
import { PRIMARY_CURRENCY_OPTIONS } from "../../lib/markets";

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
  const [fta, setFta] = useState(true); // 기본 FTA 적용(과세 시 관세 0)

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<DirectPriceEstimate | null>(null);

  // 우리가 이미 보유한 고시환율(/api/exchange-rates) — 통화 라벨 옆 표시 + $150 소액면세 판정용.
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const selectedRate = rates.find((r) => r.currency === currency)?.rate_krw;

  // 구매금액을 USD로 환산($150 소액면세 기준). 환율 미로딩 시 NaN → 한도판정 보류.
  const usdRateKrw = Number(rates.find((r) => r.currency === "USD")?.rate_krw);
  const curRateKrw = Number(selectedRate);
  const purchaseUsd =
    Number(purchaseAmount) > 0 && curRateKrw > 0 && usdRateKrw > 0
      ? (Number(purchaseAmount) * curRateKrw) / usdRateKrw
      : NaN;
  // $150 초과 = 과세 대상. 이때 인코텀즈는 결과에 무관(고정), 대신 FTA 설정을 노출.
  const overDutyFree = Number.isFinite(purchaseUsd) && purchaseUsd > 150;

  useEffect(() => {
    const controller = new AbortController();
    fetchExchangeRates(controller.signal)
      .then(setRates)
      .catch(() => {
        /* 환율 표시 보조 — 실패해도 폼은 동작 */
      });
    return () => controller.abort();
  }, []);

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
      incoterm: overDutyFree ? "FOB" : incoterm,
      fta: overDutyFree ? fta : undefined,
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
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <label
                htmlFor="currency"
                className="text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                통화
              </label>
              {selectedRate != null && (
                <span className="text-xs tabular-nums text-gray-400 dark:text-gray-500">
                  {formatRate(selectedRate)} 원/{currency}
                </span>
              )}
            </div>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inputClass}
            >
              {PRIMARY_CURRENCY_OPTIONS.map((c) => (
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
              value={overDutyFree ? "FOB" : incoterm}
              onChange={(e) => setIncoterm(e.target.value as Incoterm)}
              disabled={overDutyFree}
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {INCOTERM_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {overDutyFree && (
              <p className="mt-1 text-xs text-gray-400">
                $150 초과(과세)는 인코텀즈와 무관 — 고정됩니다
              </p>
            )}
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

        {/* $150 초과(과세) 시에만 노출 — FTA 적용 여부(관세 0 분기). 기본 FTA 적용. */}
        {overDutyFree && (
          <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-gray-800/50">
            <label
              htmlFor="fta"
              className="flex cursor-pointer items-center justify-between gap-3"
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                FTA 적용
                <span className="ml-1 text-xs font-normal text-gray-400">
                  원산지 FTA 협정 → 관세 0
                </span>
              </span>
              <input
                id="fta"
                type="checkbox"
                checked={fta}
                onChange={(e) => setFta(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="mt-5 w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading" ? "계산 중…" : "직구가격 계산"}
        </button>
      </form>

      <p className="mt-3 px-1 text-xs text-gray-400">
        환율은 현재 주차 관세청 고시환율 기준이며, 정확 용량·현지세 등에 따라 실제
        통관 세액과 다를 수 있는 추정값입니다.
      </p>

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
        </section>
      )}
    </main>
  );
}
