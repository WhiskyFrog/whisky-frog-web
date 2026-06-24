"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listPublicMarkets, type PublicMarket } from "../../../lib/markets";
import {
  formatDateTime,
  formatLocalPrice,
  listMarketProducts,
  type MarketProduct,
} from "../../../lib/products";
import { formatKrw } from "../../../lib/directPrice";

type Status = "loading" | "error" | "ready";

const PAGE_SIZE = 100;

export default function MarketProductsPage() {
  const params = useParams<{ code: string }>();
  const marketCode = params.code;

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [markets, setMarkets] = useState<PublicMarket[]>([]);
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [offset, setOffset] = useState(0);
  const [availableOnly, setAvailableOnly] = useState(true);

  const market = useMemo(
    () => markets.find((m) => m.code === marketCode),
    [marketCode, markets],
  );

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus("loading");
      Promise.all([
        listPublicMarkets(signal),
        listMarketProducts(
          marketCode,
          {
            available: availableOnly ? true : null,
            limit: PAGE_SIZE,
            offset,
          },
          signal,
        ),
      ])
        .then(([marketRows, productRows]) => {
          setMarkets(marketRows);
          setProducts(productRows);
          setStatus("ready");
        })
        .catch((err: unknown) => {
          if (signal?.aborted) return;
          setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
          setProducts([]);
          setStatus("error");
        });
    },
    [availableOnly, marketCode, offset],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const hasPrev = offset > 0;
  const hasNext = products.length === PAGE_SIZE;
  const title = market?.name ?? marketCode;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">마켓</p>
          <h1 className="mt-1 text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            매칭 완료된 상품의 최신 현지 가격과 예상 직구가(원화)입니다.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => {
              setOffset(0);
              setAvailableOnly(e.target.checked);
            }}
            className="h-4 w-4 accent-blue-600"
          />
          판매 가능 상품만
        </label>
      </header>

      {status === "loading" && (
        <div className="py-20 text-center text-gray-500 dark:text-gray-400">
          상품을 불러오는 중…
        </div>
      )}

      {status === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-12 text-center dark:border-red-900 dark:bg-red-950/40">
          <p className="font-medium text-red-700 dark:text-red-300">
            상품 목록을 불러오지 못했습니다.
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

      {status === "ready" && products.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-16 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            표시할 상품이 없습니다.
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            아직 매칭된 상품 가격이 없거나 필터 조건에 맞는 상품이 없습니다.
          </p>
        </div>
      )}

      {status === "ready" && products.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 text-left text-gray-600 dark:border-gray-700 dark:text-gray-400">
                  <th className="px-3 py-2 font-medium">상품</th>
                  <th className="px-3 py-2 text-right font-medium">현지 가격</th>
                  <th className="px-3 py-2 text-right font-medium">예상 직구가</th>
                  <th className="px-3 py-2 text-center font-medium">상태</th>
                  <th className="px-3 py-2 font-medium">수집 시각</th>
                  <th className="px-3 py-2 text-right font-medium">원문</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.product_url_id}
                    className="border-b border-gray-100 align-top hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                  >
                    <td className="px-3 py-3">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {p.product_name}
                      </div>
                      {p.raw_name && p.raw_name !== p.product_name && (
                        <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {p.raw_name}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">
                      {formatLocalPrice(p.local_price, p.currency)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {p.direct_price_krw != null ? (
                        <>
                          <div className="font-semibold text-blue-600 dark:text-blue-400">
                            {formatKrw(p.direct_price_krw)}
                          </div>
                          {p.shipping_krw != null && (
                            <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                              배송 {formatKrw(p.shipping_krw)} 포함
                            </div>
                          )}
                        </>
                      ) : (
                        <span
                          className="text-gray-400 dark:text-gray-500"
                          title="환율 미수집 또는 용량·도수 미정규화로 산출 보류"
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={
                          p.available
                            ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/50 dark:text-green-300"
                            : "rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        }
                      >
                        {p.available ? "판매중" : "품절"}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-gray-600 dark:text-gray-400">
                      {formatDateTime(p.crawled_at)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={p.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                      >
                        보기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {page}페이지 · {products.length}건 표시
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={!hasPrev}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                이전
              </button>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={!hasNext}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                다음
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            예상 직구가는 현재 주차 관세청 고시환율 + 마켓 세금설정 + 대표배송(활성
            배송옵션 최저가) 기준 추정값이며, 실제 통관 세액·배송비와 다를 수
            있습니다. 정밀 계산은 직구가격 계산 페이지에서 옵션을 직접 입력하세요.
          </p>
        </>
      )}
    </main>
  );
}
