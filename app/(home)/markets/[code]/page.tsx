"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isAuthed } from "../../../lib/auth";
import { listPublicMarkets, type PublicMarket } from "../../../lib/markets";
import {
  displayProductKorean,
  distilleryNameMap,
  formatDateTime,
  formatLocalPrice,
  getMarketFacets,
  listMarketProducts,
  productImageCandidates,
  type MarketFacets,
  type MarketProduct,
} from "../../../lib/products";
import { ProductThumb } from "../../../components/ProductThumb";
import { formatKrw } from "../../../lib/directPrice";
import {
  EMPTY_FILTERS,
  numberOrNull,
  ProductFacetSidebar,
  type ProductFilters,
} from "../../../components/ProductFacetSidebar";

type Status = "loading" | "error" | "ready";

const PAGE_SIZE = 100;

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

/** 한국어명 우선 제목 — 한국어명이 있으면 정본 영문명을, 없으면 마켓 원문 제목을 부제로 쓴다. */
function productNameParts(
  p: MarketProduct,
  distilleryNames: ReadonlyMap<string, string>,
): {
  title: string;
  subtitle: string | null;
} {
  const korean = displayProductKorean(p, distilleryNames);
  if (korean) {
    return {
      title: korean,
      subtitle: korean !== p.product_name ? p.product_name : null,
    };
  }
  return {
    title: p.product_name,
    subtitle:
      p.raw_name && p.raw_name !== p.product_name ? p.raw_name : null,
  };
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
  marketCode,
  canEdit,
  distilleryNames,
}: {
  product: MarketProduct;
  market: PublicMarket | undefined;
  marketCode: string;
  canEdit: boolean;
  distilleryNames: ReadonlyMap<string, string>;
}) {
  const { title: productTitle, subtitle } = productNameParts(p, distilleryNames);
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <ProductThumb
        srcs={productImageCandidates(marketCode, p.image_url, p.source_url)}
        alt={p.product_name}
        className="aspect-square w-full border-b border-gray-100 dark:border-gray-800"
      />
      <div className="flex flex-1 flex-col p-3">
        {/* 제목은 가로폭을 다 쓰게 두고(최대 2줄), 상태 배지는 아래 줄에 배치.
            좁은 카드에서 제목 옆에 끼우면 '판매중'이 세로로 깨지므로 분리한다. */}
        <h2 className="line-clamp-2 font-medium leading-5 text-gray-900 dark:text-gray-100">
          {productTitle}
        </h2>
        {subtitle && (
          <p className="mt-1 line-clamp-1 text-xs leading-4 text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        )}
        <div className="mt-1.5">
          <ProductStatusBadge available={p.available} />
        </div>

        <div className="mt-auto pt-3">
          {/* 좁은 카드(모바일 2열)에서 두 가격 블록이 안 들어가면 줄바꿈 — 라벨·가격이
              글자 단위로 세로로 꺾이거나 카드 밖으로 잘리는 것을 막는다. */}
          <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
            <div>
              <div className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                현지 가격
              </div>
              <div className="mt-0.5 whitespace-nowrap font-medium tabular-nums">
                {formatLocalPrice(p.local_price, p.currency)}
              </div>
            </div>
            <div className="text-right">
              <div className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
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
              className="shrink-0 whitespace-nowrap font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              구매 링크
            </Link>
          </div>
          {canEdit && (
            <Link
              href={taxonomyEditHref(p, market)}
              className="mt-2 inline-flex w-full items-center justify-center rounded border border-blue-200 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
            >
              속성 수정
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

function taxonomyEditHref(
  product: MarketProduct & { cask_family?: string | null },
  market: PublicMarket | undefined,
) {
  return {
    pathname: `/admin/products/${product.product_id}/taxonomy`,
    query: {
      name: product.product_name,
      raw: product.raw_name ?? "",
      market: market?.code ?? "",
      distillery: product.distillery_korean ?? "",
      bottler: product.bottler_korean ?? "",
      cask: product.cask_korean ?? "",
      cask_family: product.cask_family ?? "",
    },
  };
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
  const [canEditProducts, setCanEditProducts] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  const market = useMemo(
    () => markets.find((m) => m.code === marketCode),
    [marketCode, markets],
  );

  const load = useCallback(
    (signal?: AbortSignal) => {
      setStatus("loading");
      // 목록·패싯이 같은 필터를 받는다 — 패싯 카운트가 현재 선택으로 교차
      // 좁혀지고(DECISIONS 035), total이 결과 건수 헤더가 된다.
      const query = {
        available: availableOnly ? true : null,
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
        listPublicMarkets(signal),
        getMarketFacets(marketCode, query, signal),
        listMarketProducts(
          marketCode,
          { ...query, limit: PAGE_SIZE, offset },
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

  useEffect(() => {
    setCanEditProducts(isAuthed());
  }, []);

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
  // 무카와처럼 image_url이 없어도 URL 유도가 되는 마켓은 후보 기준으로 센다.
  const imageRich = useMemo(() => {
    if (products.length === 0) return false;
    const withImage = products.filter(
      (p) => productImageCandidates(marketCode, p.image_url, p.source_url).length > 0,
    ).length;
    return withImage / products.length >= 0.5;
  }, [marketCode, products]);

  const updateFilters = useCallback(
    (updater: (prev: ProductFilters) => ProductFilters) => {
      setOffset(0);
      setFilters(updater);
    },
    [],
  );

  // 에디션 손실 한글명 판별용 — 패싯 증류소 트리에서 한글명→영문명.
  const distilleryNames = useMemo(() => distilleryNameMap(facets), [facets]);

  // 상품 검색 — 백엔드 마켓 엔드포인트에 search 파라미터가 없어 로드된 페이지에서
  // 클라이언트 필터링한다(마켓당 상품 수가 페이지 크기 수준이라 사실상 전체 검색).
  // 정본 영문명·마켓 원문 제목·한국어명 모두 부분일치.
  const searched = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.product_name, p.raw_name, p.product_name_korean].some(
        (s) => s && s.toLowerCase().includes(q),
      ),
    );
  }, [products, searchInput]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">마켓</p>
          <h1 className="mt-1 text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {priceSummary}
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
          onReset={() => {
            setOffset(0);
            setFilters(EMPTY_FILTERS);
          }}
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

      {status === "ready" && searched.length === 0 && (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-16 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="font-medium text-gray-700 dark:text-gray-300">
            표시할 상품이 없습니다.
          </p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            아직 매칭된 상품 가격이 없거나 검색·필터 조건에 맞는 상품이
            없습니다.
          </p>
        </div>
      )}

      {status === "ready" && searched.length > 0 && imageRich && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {searched.map((p) => (
            <ProductCard
              key={p.product_url_id}
              product={p}
              market={market}
              marketCode={marketCode}
              canEdit={canEditProducts}
              distilleryNames={distilleryNames}
            />
          ))}
        </div>
      )}

      {status === "ready" && searched.length > 0 && !imageRich && (
        <>
          <div className="space-y-3 sm:hidden">
            {searched.map((p) => {
              const { title: productTitle, subtitle } = productNameParts(
                p,
                distilleryNames,
              );
              return (
              <article
                key={p.product_url_id}
                className="rounded-md border border-gray-200 bg-white px-3 py-3 dark:border-gray-800 dark:bg-gray-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <ProductThumb
                      srcs={productImageCandidates(
                        marketCode,
                        p.image_url,
                        p.source_url,
                      )}
                      alt={p.product_name}
                      className="h-14 w-14 rounded-md border border-gray-100 dark:border-gray-800"
                    />
                    <div className="min-w-0">
                      <h2 className="font-medium leading-5 text-gray-900 dark:text-gray-100">
                        {productTitle}
                      </h2>
                      {subtitle && (
                        <p className="mt-1 text-xs leading-4 text-gray-500 dark:text-gray-400">
                          {subtitle}
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
                {canEditProducts && (
                  <Link
                    href={taxonomyEditHref(p, market)}
                    className="mt-3 inline-flex w-full items-center justify-center rounded border border-blue-200 px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950/40"
                  >
                    속성 수정
                  </Link>
                )}
              </article>
              );
            })}
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
                {searched.map((p) => {
                  const { title: productTitle, subtitle } = productNameParts(
                    p,
                    distilleryNames,
                  );
                  return (
                  <tr
                    key={p.product_url_id}
                    className="border-b border-gray-100 align-top hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                  >
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-3">
                        <ProductThumb
                          srcs={productImageCandidates(
                            marketCode,
                            p.image_url,
                            p.source_url,
                          )}
                          alt={p.product_name}
                          className="h-12 w-12 rounded border border-gray-100 dark:border-gray-800"
                        />
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {productTitle}
                          </div>
                          {subtitle && (
                            <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                              {subtitle}
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
                      <div className="flex flex-col items-end gap-1">
                        <Link
                          href={p.source_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                        >
                          바로가기
                        </Link>
                        {canEditProducts && (
                          <Link
                            href={taxonomyEditHref(p, market)}
                            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                          >
                            속성 수정
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {status === "ready" && products.length > 0 && (
        <>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {facets != null && `총 ${facets.total.toLocaleString("ko-KR")}개 · `}
              {page}페이지 · {searched.length}건 표시
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
