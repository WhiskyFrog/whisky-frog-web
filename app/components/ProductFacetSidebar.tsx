"use client";

import { useEffect, useState } from "react";
import type { FacetCount, MarketFacets } from "../lib/products";

/** per-market·통합 카탈로그가 공유하는 위스키 패싯 필터 상태. `market`은 카탈로그에서만 쓴다. */
export type ProductFilters = {
  market: string[];
  cask_family: string[];
  cask_type: string[];
  cask_material: string[];
  country: string[];
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
};

export const EMPTY_FILTERS: ProductFilters = {
  market: [],
  cask_family: [],
  cask_type: [],
  cask_material: [],
  country: [],
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
};

export function toggleArray<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
}

export function numberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
      {count}
    </span>
  );
}

/** 접기/펼치기 되는 패싯 섹션 — 기본 접힘, 선택 개수 배지로 접힌 상태에서도 필터 유무 표시. */
function FacetSection({
  title,
  selected = 0,
  children,
}: {
  title: string;
  selected?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 py-2.5 text-left"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-900 dark:text-gray-100">
          {title}
          <CountBadge count={selected} />
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden
        >
          <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && <div className="pb-3">{children}</div>}
    </section>
  );
}

/** 값 배열 패싯의 체크박스 섹션 — 마켓/주종/캐스크 3축 등 동일 패턴 공용. */
function CheckboxFacetSection({
  title,
  options,
  selected,
  labelOf,
  onToggle,
}: {
  title: string;
  options: FacetCount[];
  selected: string[];
  labelOf: (f: FacetCount) => string;
  onToggle: (value: string) => void;
}) {
  return (
    <FacetSection title={title} selected={selected.length}>
      {options.map((f) => {
        const value = String(f.value);
        return (
          <FacetOption
            key={value}
            checked={selected.includes(value)}
            label={labelOf(f)}
            count={f.count}
            onChange={() => onToggle(value)}
          />
        );
      })}
    </FacetSection>
  );
}

function countLabel(f: FacetCount): string {
  return f.korean ? `${f.korean} (${f.value})` : String(f.value);
}

function rangeCount(min: string, max: string): number {
  return (min.trim() !== "" ? 1 : 0) + (max.trim() !== "" ? 1 : 0);
}

function activeFilterCount(filters: ProductFilters): number {
  return (
    filters.market.length +
    filters.cask_family.length +
    filters.cask_type.length +
    filters.cask_material.length +
    filters.country.length +
    filters.region.length +
    filters.distillery_id.length +
    filters.spirit_type.length +
    filters.volume_ml.length +
    (filters.bottling ? 1 : 0) +
    (filters.peated !== null ? 1 : 0) +
    rangeCount(filters.age_min, filters.age_max) +
    rangeCount(filters.abv_min, filters.abv_max)
  );
}

/** 운영 데이터 특성상 미분류('unknown')가 최다 카운트 — 목록 맨 아래로 내린다. */
function unknownLast(options: FacetCount[]): FacetCount[] {
  return [...options].sort(
    (a, b) => Number(a.value === "unknown") - Number(b.value === "unknown"),
  );
}

/**
 * 패싯 필터 — 평소엔 "필터" 버튼만 노출하고, 누르면 왼쪽에서 드로어가 열린다.
 * 필터는 체크 즉시 적용되므로 드로어는 열어둔 채 결과가 갱신된다.
 * 패싯은 교차 좁힘(DECISIONS 035)이라 필터가 바뀔 때마다 카운트가 갈아끼워지고,
 * 응답 `axes`에 없는 축 패널은 숨긴다(주종별 의미 없는 축 — 진에 캐스크/피트 등).
 */
export function ProductFacetSidebar({
  facets,
  filters,
  onFilters,
  onReset,
  marketOptions,
}: {
  facets: MarketFacets | null;
  filters: ProductFilters;
  onFilters: (updater: (prev: ProductFilters) => ProductFilters) => void;
  onReset: () => void;
  /** 통합 카탈로그 전용 — 마켓 축(facets.market). 주면 최상단에 마켓 섹션을 렌더한다. */
  marketOptions?: FacetCount[];
}) {
  const ready = facets !== null;
  const [open, setOpen] = useState(false);
  const activeCount = activeFilterCount(filters);

  // 드로어 열림 동안 Esc 닫기 + 바디 스크롤 잠금.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const axisOn = (axis: string) => facets !== null && facets.axes.includes(axis);
  const toggleOf =
    (key: "market" | "cask_family" | "cask_type" | "cask_material" | "country" | "region" | "spirit_type") =>
    (value: string) =>
      onFilters((prev) => ({ ...prev, [key]: toggleArray(prev[key], value) }));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-900"
      >
        <svg
          className="h-4 w-4 text-gray-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden
        >
          <path
            d="M4 5h16l-6.5 7.5V19l-3-1.5v-5L4 5Z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        필터
        <CountBadge count={activeCount} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        inert={!open}
        aria-hidden={!open}
        className={`fixed inset-y-0 left-0 z-50 flex w-80 max-w-[85vw] transform flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-200 dark:border-gray-800 dark:bg-gray-950 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
              필터
              <CountBadge count={activeCount} />
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {ready ? `${facets.total}개 상품` : "불러오는 중"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {activeCount > 0 && (
              <button
                type="button"
                onClick={onReset}
                className="whitespace-nowrap rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              >
                초기화
              </button>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="필터 닫기"
              className="rounded p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-gray-900 dark:hover:text-gray-300"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden
              >
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-1">
          {!ready && (
            <div className="py-8 text-center text-xs text-gray-400">
              필터를 불러오는 중
            </div>
          )}

          {ready && (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {/* 1차 축(마켓/주종)은 상단 고정 — axes 재구성의 기준 축. */}
              {marketOptions &&
                marketOptions.length > 0 &&
                axisOn("market") && (
                  <CheckboxFacetSection
                    title="마켓"
                    options={marketOptions}
                    selected={filters.market}
                    labelOf={(f) => f.korean ?? String(f.value)}
                    onToggle={toggleOf("market")}
                  />
                )}

              {facets.spirit_type.length > 0 && axisOn("spirit_type") && (
                <CheckboxFacetSection
                  title="주종"
                  options={facets.spirit_type}
                  selected={filters.spirit_type}
                  labelOf={countLabel}
                  onToggle={toggleOf("spirit_type")}
                />
              )}

              {facets.cask_family.length > 0 && axisOn("cask_family") && (
                <CheckboxFacetSection
                  title="캐스크"
                  options={unknownLast(facets.cask_family)}
                  selected={filters.cask_family}
                  labelOf={countLabel}
                  onToggle={toggleOf("cask_family")}
                />
              )}

              {facets.cask_type.length > 0 && axisOn("cask_type") && (
                <CheckboxFacetSection
                  title="캐스크 타입"
                  options={facets.cask_type}
                  selected={filters.cask_type}
                  labelOf={countLabel}
                  onToggle={toggleOf("cask_type")}
                />
              )}

              {facets.cask_material.length > 0 && axisOn("cask_material") && (
                <CheckboxFacetSection
                  title="캐스크 재질"
                  options={facets.cask_material}
                  selected={filters.cask_material}
                  labelOf={countLabel}
                  onToggle={toggleOf("cask_material")}
                />
              )}

              {/* 국가·지역은 별개 축 — 한 리스트에 섞으면 Scotland와 Speyside가 같은
                  레벨로 보인다(Speyside ⊂ Scotland). region은 사실상 스카치 하위 지역. */}
              {facets.country.length > 0 && axisOn("country") && (
                <CheckboxFacetSection
                  title="국가"
                  options={facets.country}
                  selected={filters.country}
                  labelOf={countLabel}
                  onToggle={toggleOf("country")}
                />
              )}

              {facets.region.length > 0 && axisOn("region") && (
                <CheckboxFacetSection
                  title="지역"
                  options={facets.region}
                  selected={filters.region}
                  labelOf={countLabel}
                  onToggle={toggleOf("region")}
                />
              )}

              {facets.distillery.length > 0 && axisOn("distillery") && (
                <FacetSection
                  title="증류소"
                  selected={filters.distillery_id.length}
                >
                  {facets.distillery.flatMap((countryGroup) =>
                    countryGroup.regions.flatMap((regionGroup) =>
                      regionGroup.distilleries.map((f) => (
                        <FacetOption
                          key={f.id}
                          checked={filters.distillery_id.includes(f.id)}
                          label={f.korean ? `${f.korean} (${f.name})` : f.name}
                          count={f.count}
                          onChange={() =>
                            onFilters((prev) => ({
                              ...prev,
                              distillery_id: toggleArray(
                                prev.distillery_id,
                                f.id,
                              ),
                            }))
                          }
                        />
                      )),
                    ),
                  )}
                </FacetSection>
              )}

              {(axisOn("bottling") || axisOn("peated")) && (
                <FacetSection
                  title={[
                    axisOn("bottling") && "병입",
                    axisOn("peated") && "피트",
                  ]
                    .filter(Boolean)
                    .join(" / ")}
                  selected={
                    (filters.bottling ? 1 : 0) +
                    (filters.peated !== null ? 1 : 0)
                  }
                >
                  <div className="grid grid-cols-2 gap-1">
                    {axisOn("bottling") &&
                      [
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
                    {axisOn("peated") &&
                      [
                        [true, "피트", facets.peated.peated],
                        [false, "논피트", facets.peated.unpeated],
                      ].map(([value, label, count]) => (
                        <button
                          key={String(value)}
                          type="button"
                          onClick={() =>
                            onFilters((prev) => ({
                              ...prev,
                              peated:
                                prev.peated === value
                                  ? null
                                  : (value as boolean),
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
                  </div>
                </FacetSection>
              )}

              {facets.volume_ml.length > 0 && axisOn("volume_ml") && (
                <FacetSection title="용량" selected={filters.volume_ml.length}>
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

              {(axisOn("age_years") || axisOn("abv")) && (
                <FacetSection
                  title={[axisOn("age_years") && "숙성", axisOn("abv") && "도수"]
                    .filter(Boolean)
                    .join(" / ")}
                  selected={
                    (axisOn("age_years")
                      ? rangeCount(filters.age_min, filters.age_max)
                      : 0) +
                    (axisOn("abv")
                      ? rangeCount(filters.abv_min, filters.abv_max)
                      : 0)
                  }
                >
                  <div className="grid grid-cols-2 gap-2">
                    {axisOn("age_years") && (
                      <>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          placeholder={`숙성 ${facets.age_years.min ?? ""}`}
                          value={filters.age_min}
                          onChange={(e) =>
                            onFilters((prev) => ({
                              ...prev,
                              age_min: e.target.value,
                            }))
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
                            onFilters((prev) => ({
                              ...prev,
                              age_max: e.target.value,
                            }))
                          }
                          className="min-w-0 rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
                        />
                      </>
                    )}
                    {axisOn("abv") && (
                      <>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          placeholder={`도수 ${facets.abv.min ?? ""}`}
                          value={filters.abv_min}
                          onChange={(e) =>
                            onFilters((prev) => ({
                              ...prev,
                              abv_min: e.target.value,
                            }))
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
                            onFilters((prev) => ({
                              ...prev,
                              abv_max: e.target.value,
                            }))
                          }
                          className="min-w-0 rounded border border-gray-200 bg-white px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-950"
                        />
                      </>
                    )}
                  </div>
                </FacetSection>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            결과 보기
          </button>
        </div>
      </aside>
    </>
  );
}
