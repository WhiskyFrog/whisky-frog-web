"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogFacets, CatalogProduct, ProductOffer } from "../lib/catalog";
import type { ProductQueryPair } from "../lib/api/product-query";
import { formatLocalPrice, productImageCandidates } from "../lib/products";
import { ProductThumb } from "./ProductThumb";
import { PriceHistorySection } from "./PriceHistorySection";
import { formatKrw } from "../lib/directPrice";
import { ProductFacetSidebar } from "./ProductFacetSidebar";
import { ProductFacetPanel } from "./ProductFacetPanel";
import { applyLegacyFilters, filtersFromQueryState } from "../lib/legacyCatalogFilters";
import { CATALOG_PAGE_SIZE, useCatalogQuery } from "../lib/useCatalogQuery";

const SEARCH_DEBOUNCE_MS = 350;

function isCatalogV2Pair(
  pair: ProductQueryPair,
): pair is Extract<ProductQueryPair, { scope: "catalog"; version: "v2" }> {
  return pair.scope === "catalog" && pair.version === "v2";
}

function isCatalogLegacyPair(
  pair: ProductQueryPair,
): pair is Extract<ProductQueryPair, { scope: "catalog"; version: "legacy" }> {
  return pair.scope === "catalog" && pair.version === "legacy";
}

/** Labels for currently-selected market codes, from whichever pair shape is live. */
function selectedMarketLabels(pair: ProductQueryPair | null, codes: string[]): string[] {
  if (!pair || codes.length === 0) return [];
  if (isCatalogV2Pair(pair)) {
    const group = pair.facets.groups.find((g) => g.kind === "terms" && g.key === "market");
    if (!group || group.kind !== "terms") return [];
    return group.options
      .filter((o) => codes.includes(String(o.value)))
      .map((o) => o.label);
  }
  if (isCatalogLegacyPair(pair)) {
    return pair.facets.market
      .filter((f) => codes.includes(String(f.value)))
      .map((f) => f.korean ?? String(f.value));
  }
  return [];
}

function AttributeBadges({ product: p }: { product: CatalogProduct }) {
  const badges: string[] = [];
  if (p.spirit_type) badges.push(p.spirit_type);
  if (p.cask_korean) badges.push(p.cask_korean);
  else if (p.cask_family) badges.push(p.cask_family);
  if (p.country) badges.push(p.country);
  if (p.region) badges.push(p.region);
  if (p.age_years != null) badges.push(`${p.age_years}년`);
  if (p.abv != null) badges.push(`${p.abv}%`);
  if (p.volume_ml != null) badges.push(`${p.volume_ml}ml`);
  if (p.peated === true) badges.push("피트");

  if (badges.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {badges.map((b) => (
        <span
          key={b}
          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
        >
          {b}
        </span>
      ))}
    </div>
  );
}

/** 오퍼 한 줄 — 직구가 우선, 없으면 원화환산가. 첫 오퍼가 최저가(백엔드 정렬). */
function OfferRow({
  offer,
  cheapest,
  highlighted,
}: {
  offer: ProductOffer;
  cheapest: boolean;
  highlighted: boolean;
}) {
  const priceKrw = offer.direct_price_krw ?? offer.local_price_krw;
  const priceLabel = offer.direct_price_krw != null ? "직구" : "환산";

  return (
    <li
      className={`flex items-center justify-between gap-3 rounded px-2 py-1.5 text-sm ${
        highlighted
          ? "bg-blue-50 dark:bg-blue-950/30"
          : "odd:bg-gray-50/60 dark:odd:bg-gray-900/40"
      }`}
    >
      <div className="flex min-w-0 items-center gap-2">
        {cheapest && (
          <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-950/50 dark:text-green-300">
            최저가
          </span>
        )}
        <a
          href={offer.source_url}
          target="_blank"
          rel="noreferrer"
          className="truncate font-medium text-gray-800 hover:text-blue-600 hover:underline dark:text-gray-200 dark:hover:text-blue-400"
        >
          {offer.market_name}
        </a>
        {!offer.available && (
          <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            품절
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {formatLocalPrice(offer.local_price, offer.currency)}
        </span>
        {priceKrw != null ? (
          <span
            className={`whitespace-nowrap font-semibold ${
              cheapest
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-900 dark:text-gray-100"
            }`}
            title={
              priceLabel === "직구"
                ? "예상 직구가(배송·세금 포함 추정)"
                : "원화 환산가(환율만 적용)"
            }
          >
            {formatKrw(priceKrw)}
            <span className="ml-1 text-[10px] font-normal text-gray-400">
              {priceLabel}
            </span>
          </span>
        ) : (
          <span className="text-gray-400" title="환율 미수집으로 산출 보류">
            —
          </span>
        )}
      </div>
    </li>
  );
}

function CatalogCard({
  product: p,
  selectedMarkets,
}: {
  product: CatalogProduct;
  selectedMarkets: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const koreanName = p.product_name_korean;
  const representative = p.min_direct_price_krw ?? p.min_local_price_krw;
  const visibleOffers = expanded ? p.offers : p.offers.slice(0, 4);

  // 실제 image_url을 가진 오퍼 우선, 없으면 URL 유도가 되는 오퍼(무카와)의 후보 사용.
  const thumbSrcs = (() => {
    const real = p.offers.find((o) => o.image_url)?.image_url;
    if (real) return [real];
    for (const o of p.offers) {
      const candidates = productImageCandidates(o.market_code, o.image_url, o.source_url);
      if (candidates.length > 0) return candidates;
    }
    return [];
  })();

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="flex items-start gap-4">
        <ProductThumb
          srcs={thumbSrcs}
          alt={p.product_name}
          className="h-20 w-20 rounded-md border border-gray-100 dark:border-gray-800 sm:h-24 sm:w-24"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold leading-5 text-gray-900 dark:text-gray-100">
                {koreanName ?? p.product_name}
              </h2>
              {koreanName && (
                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                  {p.product_name}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                최저 {p.min_direct_price_krw != null ? "직구가" : "환산가"}
              </div>
              <div className="mt-0.5 whitespace-nowrap font-bold tabular-nums text-blue-600 dark:text-blue-400">
                {representative != null ? formatKrw(representative) : "—"}
              </div>
            </div>
          </div>
          <AttributeBadges product={p} />
        </div>
      </div>

      <ul className="mt-3 space-y-0.5 border-t border-gray-100 pt-2 dark:border-gray-800">
        {visibleOffers.map((offer, i) => (
          <OfferRow
            key={offer.product_url_id}
            offer={offer}
            cheapest={i === 0 && p.offers.length > 1}
            highlighted={
              selectedMarkets.length > 0 && selectedMarkets.includes(offer.market_code)
            }
          />
        ))}
      </ul>
      {p.offers.length > 4 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          {expanded ? "접기" : `오퍼 ${p.offers.length - 4}개 더 보기`}
        </button>
      )}

      <button
        type="button"
        onClick={() => setShowHistory((v) => !v)}
        className="mt-1.5 w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
        aria-expanded={showHistory}
      >
        {showHistory ? "가격 추이 접기" : "가격 추이 보기"}
      </button>
      {showHistory && (
        <div className="mt-1.5 border-t border-gray-100 pt-2 dark:border-gray-800">
          <PriceHistorySection productId={p.product_id} />
        </div>
      )}
    </article>
  );
}

/**
 * All catalog fetching/rendering, independent of `next/navigation`. Kept separate from
 * `CatalogPageContent` so page-level tests can drive it directly with a fake
 * `rawSearch`/`onSearchChange` pair (mirroring back/forward nav) and a mocked `fetch`,
 * without needing a real Next.js router context.
 */
export function CatalogPageView({
  rawSearch,
  onSearchChange,
  initialSearchInput = "",
  version,
  baseUrl,
  fetch: fetchOverride,
}: {
  rawSearch: string;
  onSearchChange: (search: string, mode: "push" | "replace") => void;
  initialSearchInput?: string;
  version?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}) {
  const {
    status,
    errorMessage,
    version: resolvedVersion,
    queryState,
    pair,
    setFacet,
    setFilters,
    setSearch,
    setAvailableOnly,
    setPage,
    resetFacets,
    retry,
  } = useCatalogQuery({ rawSearch, onSearchChange, version, baseUrl, fetch: fetchOverride });

  const [searchInput, setSearchInput] = useState(initialSearchInput);

  // External changes (back/forward nav, our own committed search) resync the visible input.
  useEffect(() => {
    setSearchInput(queryState.search ?? "");
  }, [queryState.search]);

  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchInput.trim();
      if (trimmed !== (queryState.search ?? "")) setSearch(trimmed || null);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const products = (pair?.list ?? []) as CatalogProduct[];
  const total = pair?.facets.total ?? null;
  const legacyFacets =
    pair && isCatalogLegacyPair(pair) ? (pair.facets as unknown as CatalogFacets) : null;
  const pageSize = queryState.limit ?? CATALOG_PAGE_SIZE;
  const offset = queryState.offset;
  const page = Math.floor(offset / pageSize) + 1;
  const hasPrev = offset > 0;
  const hasNext =
    total != null ? offset + products.length < total : products.length === pageSize;

  const marketFilter = useMemo(() => {
    const selection = queryState.facets.market;
    return selection?.kind === "terms" ? selection.values.map(String) : [];
  }, [queryState.facets.market]);

  const selectedMarketNames = useMemo(
    () => selectedMarketLabels(pair, marketFilter),
    [pair, marketFilter],
  );

  const availableOnly = queryState.available !== false;
  const resultSummary = total != null ? `${total.toLocaleString("ko-KR")}개 상품` : "불러오는 중";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">전 마켓 통합</p>
          <h1 className="mt-1 text-2xl font-bold">상품 가격 비교</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            같은 위스키를 어느 몰이 가장 싸게 파는지 마켓별 가격을 한눈에 비교합니다.
            {selectedMarketNames.length > 0 &&
              ` (${selectedMarketNames.join(", ")}에서 파는 상품만 표시 — 타 몰 가격도 함께 비교됩니다)`}
          </p>
        </div>

        <label className="flex shrink-0 items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
            className="h-4 w-4 accent-blue-600"
          />
          판매 가능 상품만
        </label>
      </header>

      <div className="mb-5 flex items-center gap-2">
        {resolvedVersion === "v2" ? (
          <ProductFacetPanel
            response={pair && isCatalogV2Pair(pair) ? pair.facets : null}
            selection={queryState.facets}
            onSelectionChange={setFacet}
            onReset={resetFacets}
            resultSummary={resultSummary}
          />
        ) : (
          <ProductFacetSidebar
            facets={legacyFacets}
            filters={filtersFromQueryState(queryState)}
            onFilters={(updater) =>
              setFilters((state) => applyLegacyFilters(state, updater(filtersFromQueryState(state))))
            }
            onReset={resetFacets}
            marketOptions={legacyFacets?.market}
          />
        )}
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="상품명 검색 (한국어·영문·원문)"
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-950 sm:max-w-md"
        />
      </div>

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
          <p className="mt-1 text-sm text-red-500 dark:text-red-400">{errorMessage}</p>
          <button
            onClick={retry}
            className="mt-3 rounded border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            다시 시도
          </button>
        </div>
      )}

      {status === "ready" && products.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-16 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="font-medium text-gray-700 dark:text-gray-300">표시할 상품이 없습니다.</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            검색어나 필터 조건에 맞는 상품이 없습니다.
          </p>
        </div>
      )}

      {status === "ready" && products.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {products.map((p) => (
              <CatalogCard key={p.product_id} product={p} selectedMarkets={marketFilter} />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {total != null && `총 ${total.toLocaleString("ko-KR")}개 · `}
              {page}페이지 · {products.length}건 표시
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, offset - pageSize))}
                disabled={!hasPrev}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                이전
              </button>
              <button
                onClick={() => setPage(offset + pageSize)}
                disabled={!hasNext}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                다음
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
            직구가는 현재 주차 관세청 고시환율 + 마켓 세금설정 + 대표배송 기준 추정값입니다. 직구
            미지원 마켓은 환율만 적용한 원화 환산가로 표시하며, 마켓 필터를 선택해도 비교를 위해
            전 마켓 가격이 함께 보입니다.
          </p>
        </>
      )}
    </main>
  );
}
