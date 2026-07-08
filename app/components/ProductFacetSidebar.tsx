"use client";

import { useState } from "react";
import type { FacetCount, MarketFacets } from "../lib/products";

/** per-market·통합 카탈로그가 공유하는 위스키 패싯 필터 상태. `market`은 카탈로그에서만 쓴다. */
export type ProductFilters = {
  market: string[];
  cask_family: string[];
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

function activeFilterCount(filters: ProductFilters): number {
  return (
    filters.market.length +
    filters.cask_family.length +
    filters.country.length +
    filters.region.length +
    filters.distillery_id.length +
    filters.spirit_type.length +
    filters.volume_ml.length +
    (filters.bottling ? 1 : 0) +
    (filters.peated !== null ? 1 : 0) +
    (filters.age_min.trim() !== "" ? 1 : 0) +
    (filters.age_max.trim() !== "" ? 1 : 0) +
    (filters.abv_min.trim() !== "" ? 1 : 0) +
    (filters.abv_max.trim() !== "" ? 1 : 0)
  );
}

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
  // 모바일은 필터가 길어 상품을 한참 밀어내므로 기본 접힘 — xl 사이드바는 항상 펼침.
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeCount = activeFilterCount(filters);

  return (
    <aside className="w-full rounded-lg border border-gray-200 bg-white/95 p-3 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 xl:fixed xl:left-4 xl:top-20 xl:z-10 xl:max-h-[calc(100vh-6rem)] xl:w-72 xl:overflow-y-auto">
      <div className="flex items-center justify-between gap-3 xl:mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            필터
            {activeCount > 0 && (
              <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                {activeCount}
              </span>
            )}
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">
            {ready ? `${facets.total}개 기준` : "불러오는 중"}
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
            onClick={() => setMobileOpen((v) => !v)}
            className="whitespace-nowrap rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900 xl:hidden"
          >
            {mobileOpen ? "접기 ▲" : "펼치기 ▼"}
          </button>
        </div>
      </div>

      <div className={`${mobileOpen ? "mt-3 block" : "hidden"} xl:block`}>
        {!ready && (
          <div className="py-8 text-center text-xs text-gray-400">
            필터를 불러오는 중
          </div>
        )}

        {ready && (
          <div className="space-y-3">
          {marketOptions && marketOptions.length > 0 && (
            <FacetSection title="마켓">
              {marketOptions.map((f) => {
                const value = String(f.value);
                return (
                  <FacetOption
                    key={value}
                    checked={filters.market.includes(value)}
                    label={f.korean ?? value}
                    count={f.count}
                    onChange={() =>
                      onFilters((prev) => ({
                        ...prev,
                        market: toggleArray(prev.market, value),
                      }))
                    }
                  />
                );
              })}
            </FacetSection>
          )}

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

          {(facets.country.length > 0 || facets.region.length > 0) && (
            <FacetSection title="지역">
              {facets.country.map((f) => {
                const value = String(f.value);
                return (
                  <FacetOption
                    key={`country-${value}`}
                    checked={filters.country.includes(value)}
                    label={countLabel(f)}
                    count={f.count}
                    onChange={() =>
                      onFilters((prev) => ({
                        ...prev,
                        country: toggleArray(prev.country, value),
                      }))
                    }
                  />
                );
              })}
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
                          distillery_id: toggleArray(prev.distillery_id, f.id),
                        }))
                      }
                    />
                  )),
                ),
              )}
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

          <FacetSection title="병입 / 피트">
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
      </div>
    </aside>
  );
}
