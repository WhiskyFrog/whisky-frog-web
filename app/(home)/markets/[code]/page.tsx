"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listPublicMarkets, type PublicMarket } from "../../../lib/markets";
import {
  formatDateTime,
  formatLocalPrice,
  getMarketFacets,
  listMarketProducts,
  type FacetCount,
  type MarketFacets,
  type MarketProduct,
} from "../../../lib/products";
import { formatKrw } from "../../../lib/directPrice";

type Status = "loading" | "error" | "ready";

const PAGE_SIZE = 100;

type ProductFilters = {
  cask_family: string[];
  region: string[];
  distillery_id: number[];
  bottling: "official" | "independent" | null;
  spirit_type: string[];
  peated: boolean | null;
  age_min: string;
  age_max: string;
  abv_min: string;
  abv_max: string;
  volume_ml: number[];
  limited: boolean | null;
};

const EMPTY_FILTERS: ProductFilters = {
  cask_family: [],
  region: [],
  distillery_id: [],
  bottling: null,
  spirit_type: [],
  peated: null,
  age_min: "",
  age_max: "",
  abv_min: "",
  abv_max: "",
  volume_ml: [],
  limited: null,
};

function toggleArray<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
}

function numberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function DirectPriceBlock({ product }: { product: MarketProduct }) {
  if (product.direct_price_krw == null) {
    return (
      <span
        className="text-gray-400 dark:text-gray-500"
        title="환율 미수집 또는 용량·도수 미정규화로 산출 보류"
      >
        —
      </span>
    );
  }

  return (
    <>
      <div className="whitespace-nowrap font-semibold text-blue-600 dark:text-blue-400">
        {formatKrw(product.direct_price_krw)}
      </div>
      {product.shipping_krw != null && (
        <div className="mt-0.5 whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">
          배송 {formatKrw(product.shipping_krw)} 포함
        </div>
      )}
    </>
  );
}

function shouldShowDirectPrice(
  product: MarketProduct,
  market: PublicMarket | undefined,
): boolean {
  if (market?.provides_direct_purchase !== undefined) {
    return market.provides_direct_purchase;
  }
  return product.direct_price_krw != null || product.local_price_krw == null;
}

function MarketPriceLabel({
  product,
  market,
}: {
  product: MarketProduct;
  market: PublicMarket | undefined;
}) {
  return shouldShowDirectPrice(product, market) ? "예상 직구가" : "판매가";
}

function MarketPriceBlock({
  product,
  market,
}: {
  product: MarketProduct;
  market: PublicMarket | undefined;
}) {
  const showDirectPrice = shouldShowDirectPrice(product, market);
  const price = showDirectPrice
    ? product.direct_price_krw
    : product.local_price_krw;

  if (price == null) {
    return (
      <span
        className="text-gray-400 dark:text-gray-500"
        title="환율 미수집 또는 가격 계산 보류"
      >
        -
      </span>
    );
  }

  return (
    <>
      <div
        className={
          showDirectPrice
            ? "whitespace-nowrap font-semibold text-blue-600 dark:text-blue-400"
            : "whitespace-nowrap font-semibold text-gray-900 dark:text-gray-100"
        }
      >
        {formatKrw(price)}
      </div>
      {showDirectPrice && product.shipping_krw != null && (
        <div className="mt-0.5 whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">
          배송 {formatKrw(product.shipping_krw)} 포함
        </div>
      )}
    </>
  );
}

function ProductThumb({
  src,
  alt,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const box = `flex shrink-0 items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-900 ${className ?? ""}`;

  if (!src || failed) {
    return (
      <div className={box} aria-hidden>
        <svg
          className="h-1/2 w-1/2 text-gray-300 dark:text-gray-600"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </div>
    );
  }

  return (
    <div className={box}>
      {/* 외부 마켓 호스트 이미지 — next/image 도메인 화이트리스트 회피 위해 일반 img. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain"
      />
    </div>
  );
}

function ProductStatusBadge({ available }: { available: boolean }) {
  return (
    <span
      className={
        available
          ? "shrink-0 whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-950/50 dark:text-green-300"
          : "shrink-0 whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400"
      }
    >
      {available ? "판매중" : "품절"}
    </span>
  );
}

/** 이미지 중심 카드 — 이미지가 잘 나오는 마켓(위스키피플 등)에서 그리드로 노출. */
function ProductCard({
  product: p,
  market,
}: {
  product: MarketProduct;
  market: PublicMarket | undefined;
}) {
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <ProductThumb
        src={p.image_url}
        alt={p.product_name}
        className="aspect-square w-full border-b border-gray-100 dark:border-gray-800"
      />
      <div className="flex flex-1 flex-col p-3">
        {/* 제목은 가로폭을 다 쓰게 두고(최대 2줄), 상태 배지는 아래 줄에 배치.
            좁은 카드에서 제목 옆에 끼우면 '판매중'이 세로로 깨지므로 분리한다. */}
        <h2 className="line-clamp-2 font-medium leading-5 text-gray-900 dark:text-gray-100">
          {p.product_name}
        </h2>
        {p.raw_name && p.raw_name !== p.product_name && (
          <p className="mt-1 line-clamp-1 text-xs leading-4 text-gray-500 dark:text-gray-400">
            {p.raw_name}
          </p>
        )}
        <div className="mt-1.5">
          <ProductStatusBadge available={p.available} />
        </div>

        <div className="mt-auto pt-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                현지 가격
              </div>
              <div className="mt-0.5 whitespace-nowrap font-medium tabular-nums">
                {formatLocalPrice(p.local_price, p.currency)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <MarketPriceLabel product={p} market={market} />
              </div>
              <div className="mt-0.5 tabular-nums">
                <MarketPriceBlock product={p} market={market} />
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-2 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <span>{formatDateTime(p.crawled_at)}</span>
            <Link
              href={p.source_url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              구매 링크
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

function FacetOption({
  checked,
  label,
  count,
  onChange,
}: {
  checked: boolean;
  label: string;
  count: number;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded px-1.5 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800">
      <span className="flex min-w-0 items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="h-3.5 w-3.5 shrink-0 accent-blue-600"
        />
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 tabular-nums text-gray-400">{count}</span>
    </label>
  );
}

function FacetSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-gray-100 pt-3 first:border-t-0 first:pt-0 dark:border-gray-800">
      <h2 className="mb-1.5 text-xs font-semibold text-gray-900 dark:text-gray-100">
        {title}
      </h2>
      {children}
    </section>
  );
}

function countLabel(f: FacetCount): string {
  return f.korean ? `${f.korean} (${f.value})` : String(f.value);
}

function ProductFacetSidebar({
  facets,
  filters,
  onFilters,
  onReset,
}: {
  facets: MarketFacets | null;
  filters: ProductFilters;
  onFilters: (updater: (prev: ProductFilters) => ProductFilters) => void;
  onReset: () => void;
}) {
  const ready = facets !== null;
  return (
    <aside className="w-full rounded-lg border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 xl:fixed xl:left-4 xl:top-20 xl:z-10 xl:max-h-[calc(100vh-6rem)] xl:w-72 xl:overflow-y-auto">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            필터
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">
            {ready ? `${facets.total}개 기준` : "불러오는 중"}
          </p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          초기화
        </button>
      </div>

      {!ready && (
        <div className="py-8 text-center text-xs text-gray-400">
          필터를 불러오는 중
        </div>
      )}

      {ready && (
        <div className="space-y-3">
          {facets.cask_family.length > 0 && (
            <FacetSection title="캐스크">
              {facets.cask_family.map((f) => {
                const value = String(f.value);
                return (
                  <FacetOption
                    key={value}
                    checked={filters.cask_family.includes(value)}
                    label={countLabel(f)}
                    count={f.count}
                    onChange={() =>
                      onFilters((prev) => ({
                        ...prev,
                        cask_family: toggleArray(prev.cask_family, value),
                      }))
                    }
                  />
                );
              })}
            </FacetSection>
          )}

          {facets.region.length > 0 && (
            <FacetSection title="지역">
              {facets.region.map((f) => {
                const value = String(f.value);
                return (
                  <FacetOption
                    key={value}
                    checked={filters.region.includes(value)}
                    label={countLabel(f)}
                    count={f.count}
                    onChange={() =>
                      onFilters((prev) => ({
                        ...prev,
                        region: toggleArray(prev.region, value),
                      }))
                    }
                  />
                );
              })}
            </FacetSection>
          )}

          {facets.distillery.length > 0 && (
            <FacetSection title="증류소">
              {facets.distillery.slice(0, 12).map((f) => (
                <FacetOption
                  key={f.id}
                  checked={filters.distillery_id.includes(f.id)}
                  label={f.korean ? `${f.korean} (${f.name})` : f.name}
                  count={f.count}
                  onChange={() =>
                    onFilters((prev) => ({
                      ...prev,
                      distillery_id: toggleArray(prev.distillery_id, f.id),
                    }))
                  }
                />
              ))}
            </FacetSection>
          )}

          {facets.spirit_type.length > 0 && (
            <FacetSection title="주종">
              {facets.spirit_type.map((f) => {
                const value = String(f.value);
                return (
                  <FacetOption
                    key={value}
                    checked={filters.spirit_type.includes(value)}
                    label={countLabel(f)}
                    count={f.count}
                    onChange={() =>
                      onFilters((prev) => ({
                        ...prev,
                        spirit_type: toggleArray(prev.spirit_type, value),
                      }))
                    }
                  />
                );
              })}
            </FacetSection>
          )}

          <FacetSection title="병입 / 피트 / 한정">
            <div className="grid grid-cols-2 gap-1">
              {[
                ["official", "공식", facets.bottling.official],
                ["independent", "독립", facets.bottling.independent],
              ].map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    onFilters((prev) => ({
                      ...prev,
                      bottling:
                        prev.bottling === value
                          ? null
                          : (value as "official" | "independent"),
                    }))
                  }
                  className={`rounded border px-2 py-1 text-xs ${
                    filters.bottling === value
                      ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                  }`}
                >
                  {label} {count}
                </button>
              ))}
              {[
                [true, "피트", facets.peated.peated],
                [false, "논피트", facets.peated.unpeated],
              ].map(([value, label, count]) => (
                <button
                  key={String(value)}
                  type="button"
                  onClick={() =>
                    onFilters((prev) => ({
                      ...prev,
                      peated: prev.peated === value ? null : (value as boolean),
                    }))
                  }
                  className={`rounded border px-2 py-1 text-xs ${
                    filters.peated === value
                      ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                      : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                  }`}
                >
                  {label} {count}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  onFilters((prev) => ({
                    ...prev,
                    limited: prev.limited === true ? null : true,
                  }))
                }
                className={`col-span-2 rounded border px-2 py-1 text-xs ${
                  filters.limited === true
                    ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                }`}
              >
                한정판 {facets.limited}
              </button>
            </div>
          </FacetSection>

          {facets.volume_ml.length > 0 && (
            <FacetSection title="용량">
              <div className="flex flex-wrap gap-1">
                {facets.volume_ml.map((f) => {
                  const value = Number(f.value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        onFilters((prev) => ({
                          ...prev,
                          volume_ml: toggleArray(prev.volume_ml, value),
                        }))
                      }
                      className={`rounded border px-2 py-1 text-xs ${
                        filters.volume_ml.includes(value)
                          ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                          : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                      }`}
                    >
                      {value}ml {f.count}
                    </button>
                  );
                })}
              </div>
            </FacetSection>
          )}

          <FacetSection title="숙성 / 도수">
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                max={100}
                placeholder={`숙성 ${facets.age_years.min ?? ""}`}
                value={filters.age_min}
                onChange={(e) =>
                  onFilters((prev) => ({ ...prev, age_min: e.target.value }))
                }
                className="min-w-0 rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
              />
              <input
                type="number"
                min={0}
                max={100}
                placeholder={`~ ${facets.age_years.max ?? ""}`}
                value={filters.age_max}
                onChange={(e) =>
                  onFilters((prev) => ({ ...prev, age_max: e.target.value }))
                }
                className="min-w-0 rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
              />
              <input
                type="number"
                min={0}
                max={100}
                placeholder={`도수 ${facets.abv.min ?? ""}`}
                value={filters.abv_min}
                onChange={(e) =>
                  onFilters((prev) => ({ ...prev, abv_min: e.target.value }))
                }
                className="min-w-0 rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
              />
              <input
                type="number"
                min={0}
                max={100}
                placeholder={`~ ${facets.abv.max ?? ""}`}
                value={filters.abv_max}
                onChange={(e) =>
                  onFilters((prev) => ({ ...prev, abv_max: e.target.value }))
                }
                className="min-w-0 rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
              />
            </div>
          </FacetSection>
        </div>
      )}
    </aside>
  );
}

export default function MarketProductsPage() {
  const params = useParams<{ code: string }>();
  const marketCode = params.code;

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [markets, setMarkets] = useState<PublicMarket[]>([]);
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [facets, setFacets] = useState<MarketFacets | null>(null);
  const [offset, setOffset] = useState(0);
  const [availableOnly, setAvailableOnly] = useState(true);
  const [filters, setFilters] = useState<ProductFilters>(EMPTY_FILTERS);

  const market = useMemo(
    () => markets.find((m) => m.code === marketCode),
    [marketCode, markets],
  );

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus("loading");
      Promise.all([
        listPublicMarkets(signal),
        getMarketFacets(
          marketCode,
          { available: availableOnly ? true : null },
          signal,
        ),
        listMarketProducts(
          marketCode,
          {
            available: availableOnly ? true : null,
            cask_family: filters.cask_family,
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
            limited: filters.limited,
            limit: PAGE_SIZE,
            offset,
          },
          signal,
        ),
      ])
        .then(([marketRows, facetData, productRows]) => {
          setMarkets(marketRows);
          setFacets(facetData);
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
    [availableOnly, filters, marketCode, offset],
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
  const showDirectPriceColumn =
    market?.provides_direct_purchase ??
    (products.some((p) => p.direct_price_krw != null) ||
      !products.some((p) => p.local_price_krw != null));
  const priceColumnLabel = showDirectPriceColumn ? "예상 직구가" : "판매가";
  const priceSummary = showDirectPriceColumn
    ? "매칭 완료된 상품의 최신 현지 가격과 예상 직구가(원화)입니다."
    : "매칭 완료된 상품의 최신 현지 가격과 판매가(원화)입니다.";

  // 이미지가 잘 나오는 마켓(위스키피플 등) 판별 — 상품 절반 이상이 이미지를 가지면
  // 테이블 대신 이미지 중심 카드 그리드(큰 화면 한 줄 4개)로 노출.
  const imageRich = useMemo(() => {
    if (products.length === 0) return false;
    const withImage = products.filter((p) => p.image_url).length;
    return withImage / products.length >= 0.5;
  }, [products]);

  const updateFilters = useCallback(
    (updater: (prev: ProductFilters) => ProductFilters) => {
      setOffset(0);
      setFilters(updater);
    },
    [],
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 xl:hidden">
        <ProductFacetSidebar
          facets={facets}
          filters={filters}
          onFilters={updateFilters}
          onReset={() => {
            setOffset(0);
            setFilters(EMPTY_FILTERS);
          }}
        />
      </div>
      <div className="hidden xl:block">
        <ProductFacetSidebar
          facets={facets}
          filters={filters}
          onFilters={updateFilters}
          onReset={() => {
            setOffset(0);
            setFilters(EMPTY_FILTERS);
          }}
        />
      </div>
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">마켓</p>
          <h1 className="mt-1 text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {priceSummary}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
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

      {status === "ready" && products.length > 0 && imageRich && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.product_url_id} product={p} market={market} />
          ))}
        </div>
      )}

      {status === "ready" && products.length > 0 && !imageRich && (
        <>
          <div className="space-y-3 sm:hidden">
            {products.map((p) => (
              <article
                key={p.product_url_id}
                className="rounded-md border border-gray-200 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <ProductThumb
                      src={p.image_url}
                      alt={p.product_name}
                      className="h-14 w-14 rounded-md border border-gray-100 dark:border-gray-800"
                    />
                    <div className="min-w-0">
                      <h2 className="font-medium leading-5 text-gray-900 dark:text-gray-100">
                        {p.product_name}
                      </h2>
                      {p.raw_name && p.raw_name !== p.product_name && (
                        <p className="mt-1 text-xs leading-4 text-gray-500 dark:text-gray-400">
                          {p.raw_name}
                        </p>
                      )}
                    </div>
                  </div>
                  <ProductStatusBadge available={p.available} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      현지 가격
                    </div>
                    <div className="mt-1 whitespace-nowrap font-medium tabular-nums">
                      {formatLocalPrice(p.local_price, p.currency)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      <MarketPriceLabel product={p} market={market} />
                    </div>
                    <div className="mt-1 tabular-nums">
                      <MarketPriceBlock product={p} market={market} />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <span>{formatDateTime(p.crawled_at)}</span>
                  <Link
                    href={p.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    구매 링크
                  </Link>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300 text-left text-gray-600 dark:border-gray-700 dark:text-gray-400">
                  <th className="px-3 py-2 font-medium">상품</th>
                  <th className="px-3 py-2 text-right font-medium">현지 가격</th>
                  <th className="px-3 py-2 text-right font-medium">
                    {priceColumnLabel}
                  </th>
                  <th className="px-3 py-2 text-center font-medium">상태</th>
                  <th className="px-3 py-2 font-medium">수집 시각</th>
                  <th className="px-3 py-2 text-right font-medium">구매 링크</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr
                    key={p.product_url_id}
                    className="border-b border-gray-100 align-top hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-3">
                        <ProductThumb
                          src={p.image_url}
                          alt={p.product_name}
                          className="h-12 w-12 rounded border border-gray-100 dark:border-gray-800"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {p.product_name}
                          </div>
                          {p.raw_name && p.raw_name !== p.product_name && (
                            <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                              {p.raw_name}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">
                      {formatLocalPrice(p.local_price, p.currency)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      <MarketPriceBlock product={p} market={market} />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <ProductStatusBadge available={p.available} />
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
                        바로가기
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {status === "ready" && products.length > 0 && (
        <>
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
            {showDirectPriceColumn
              ? "예상 직구가는 현재 주차 관세청 고시환율 + 마켓 세금설정 + 대표배송(활성 배송옵션 최저가) 기준 추정값이며, 실제 통관 세액·배송비와 다를 수 있습니다. 정밀 계산은 직구가격 계산 페이지에서 옵션을 직접 입력하세요."
              : "직구를 제공하지 않는 마켓은 예상 직구가 대신 현지 주문 기준 판매가를 원화로 표시합니다."}
          </p>
        </>
      )}
    </main>
  );
}
