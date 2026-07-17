"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCatalogFacets,
  listCatalogProducts,
  type CatalogFacets,
  type CatalogProduct,
  type ProductOffer,
} from "../../lib/catalog";
import {
  formatLocalPrice,
  productImageCandidates,
} from "../../lib/products";
import { ProductThumb } from "../../components/ProductThumb";
import { PriceHistorySection } from "../../components/PriceHistorySection";
import { formatKrw } from "../../lib/directPrice";
import {
  EMPTY_FILTERS,
  numberOrNull,
  ProductFacetSidebar,
  type ProductFilters,
} from "../../components/ProductFacetSidebar";

type Status = "loading" | "error" | "ready";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;
// 백엔드 search(ILIKE)는 정본 영문명·마켓 원문만 보고 한국어명은 못 본다 — 한글 검색은
// 전체를 최대 limit으로 받아 클라이언트에서 거른다(현재 카탈로그 271개 < 500).
// 카탈로그가 이 수를 넘으면 서버 검색의 한국어명 지원이 필요하다(핸드오프 회신 참조).
const KOREAN_RE = /[ㄱ-ㅎㅏ-ㅣ가-힣]/;
const CLIENT_SEARCH_LIMIT = 500;

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
        <Link
          href={offer.source_url}
          target="_blank"
          rel="noreferrer"
          className="truncate font-medium text-gray-800 hover:text-blue-600 hover:underline dark:text-gray-200 dark:hover:text-blue-400"
        >
          {offer.market_name}
        </Link>
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
      const candidates = productImageCandidates(
        o.market_code,
        o.image_url,
        o.source_url,
      );
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
              selectedMarkets.length > 0 &&
              selectedMarkets.includes(offer.market_code)
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

export default function CatalogPage() {
  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  // 한글 검색(클라이언트 필터링) 시의 매칭 건수 — 서버 검색이면 null(facets.total 사용).
  const [matchedTotal, setMatchedTotal] = useState<number | null>(null);
  const [facets, setFacets] = useState<CatalogFacets | null>(null);
  const [offset, setOffset] = useState(0);
  const [availableOnly, setAvailableOnly] = useState(true);
  const [filters, setFilters] = useState<ProductFilters>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // 검색 입력 디바운스 — 타이핑 멈추면 offset 리셋 후 재조회.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch((prev) => {
        if (prev !== searchInput.trim()) setOffset(0);
        return searchInput.trim();
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus("loading");
      // 목록·패싯이 같은 필터를 받는다 — 패싯 카운트가 현재 선택으로 교차
      // 좁혀지고(DECISIONS 035), total이 결과 건수 헤더가 된다.
      const koreanSearch = KOREAN_RE.test(search);
      const query = {
        available: availableOnly ? true : null,
        market: filters.market,
        search: koreanSearch ? null : search || null,
        cask_family: filters.cask_family,
        cask_type: filters.cask_type,
        cask_material: filters.cask_material,
        country: filters.country,
        region: filters.region,
        distillery_id: filters.distillery_id,
        bottling: filters.bottling,
        spirit_type: filters.spirit_type,
        peated: filters.peated,
        age_min: numberOrNull(filters.age_min),
        age_max: numberOrNull(filters.age_max),
        abv_min: numberOrNull(filters.abv_min),
        abv_max: numberOrNull(filters.abv_max),
        volume_ml: filters.volume_ml,
      } as const;
      Promise.all([
        getCatalogFacets(query, signal),
        listCatalogProducts(
          koreanSearch
            ? { ...query, sort: "price", limit: CLIENT_SEARCH_LIMIT }
            : { ...query, sort: "price", limit: PAGE_SIZE, offset },
          signal,
        ),
      ])
        .then(([facetData, productRows]) => {
          setFacets(facetData);
          if (koreanSearch) {
            const q = search.toLowerCase();
            const matched = productRows.filter((p) =>
              [p.product_name, p.product_name_korean].some(
                (s) => s && s.toLowerCase().includes(q),
              ),
            );
            setMatchedTotal(matched.length);
            setProducts(matched.slice(offset, offset + PAGE_SIZE));
          } else {
            setMatchedTotal(null);
            setProducts(productRows);
          }
          setStatus("ready");
        })
        .catch((err: unknown) => {
          if (signal?.aborted) return;
          setErrorMsg(err instanceof Error ? err.message : "알 수 없는 오류");
          setProducts([]);
          setStatus("error");
        });
    },
    [availableOnly, filters, offset, search],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const updateFilters = useCallback(
    (updater: (prev: ProductFilters) => ProductFilters) => {
      setOffset(0);
      setFilters(updater);
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setOffset(0);
    setFilters(EMPTY_FILTERS);
  }, []);

  const selectedMarketNames = useMemo(() => {
    if (!facets || filters.market.length === 0) return [];
    return facets.market
      .filter((f) => filters.market.includes(String(f.value)))
      .map((f) => f.korean ?? String(f.value));
  }, [facets, filters.market]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const hasPrev = offset > 0;
  const hasNext =
    matchedTotal != null
      ? offset + PAGE_SIZE < matchedTotal
      : products.length === PAGE_SIZE;
  // 한글 검색은 facets가 검색어를 모른 채 집계되므로 매칭 건수를 총계로 쓴다.
  const totalCount = matchedTotal ?? facets?.total ?? null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            전 마켓 통합
          </p>
          <h1 className="mt-1 text-2xl font-bold">상품 가격 비교</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            같은 위스키를 어느 몰이 가장 싸게 파는지 마켓별 가격을 한눈에
            비교합니다.
            {selectedMarketNames.length > 0 &&
              ` (${selectedMarketNames.join(", ")}에서 파는 상품만 표시 — 타 몰 가격도 함께 비교됩니다)`}
          </p>
        </div>

        <label className="flex shrink-0 items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => {
              setOffset(0);
              setAvailableOnly(e.target.checked);
              setFilters(EMPTY_FILTERS);
            }}
            className="h-4 w-4 accent-blue-600"
          />
          판매 가능 상품만
        </label>
      </header>

      <div className="mb-5 flex items-center gap-2">
        <ProductFacetSidebar
          facets={facets}
          filters={filters}
          onFilters={updateFilters}
          onReset={resetFilters}
          marketOptions={facets?.market}
        />
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
            검색어나 필터 조건에 맞는 상품이 없습니다.
          </p>
        </div>
      )}

      {status === "ready" && products.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {products.map((p) => (
              <CatalogCard
                key={p.product_id}
                product={p}
                selectedMarkets={filters.market}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {totalCount != null && `총 ${totalCount.toLocaleString("ko-KR")}개 · `}
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
            직구가는 현재 주차 관세청 고시환율 + 마켓 세금설정 + 대표배송 기준
            추정값입니다. 직구 미지원 마켓은 환율만 적용한 원화 환산가로
            표시하며, 마켓 필터를 선택해도 비교를 위해 전 마켓 가격이 함께
            보입니다.
          </p>
        </>
      )}
    </main>
  );
}
