import type {
  CatalogFacetResponseLegacy,
  CatalogFacetResponseV2,
  MarketFacetResponseLegacy,
  MarketFacetResponseV2,
} from "../../app/lib/api/facet-contract.ts";

/** Minimal recovery sample for the currently active flat catalog route. */
export const legacyCatalogFacetFixture = {
  axes: ["market", "spirit_type"],
  total: 2,
  cask_family: [],
  cask_type: [],
  cask_material: [],
  country: [],
  region: [],
  spirit_type: [{ value: "single_malt", count: 2, korean: "싱글 몰트" }],
  distillery: [],
  bottling: { official: 2, independent: 0 },
  peated: { peated: 1, unpeated: 1, unknown: 0 },
  volume_ml: [{ value: 700, count: 2, korean: null }],
  age_years: { min: "10", max: "18" },
  abv: { min: "40.0", max: "55.0" },
  market: [{ value: "market-a", count: 2, korean: "예시 마켓" }],
} as const satisfies CatalogFacetResponseLegacy;

export const catalogFacetV2Fixture = {
  version: "2",
  total: 2,
  count_unit: "product",
  count_mode: "disjunctive",
  groups: [
    {
      kind: "terms",
      key: "market",
      label: "마켓",
      relevant: true,
      query: { parameter: "market", encoding: "repeat" },
      selection_mode: "multiple",
      selected: ["market-a"],
      options: [
        { value: "market-a", label: "예시 마켓", count: 2, selected: true },
        { value: "market-b", label: "보조 마켓", count: 1, selected: false },
      ],
    },
    {
      kind: "terms",
      key: "distillery",
      label: "증류소",
      relevant: true,
      query: { parameter: "distillery_id", encoding: "repeat" },
      selection_mode: "multiple",
      selected: [101],
      options: [
        {
          value: 101,
          label: "예시 증류소",
          count: 1,
          selected: true,
          parents: [
            { key: "country", value: "sample-country", label: "예시 국가" },
            { key: "region", value: "sample-region", label: "예시 지역" },
          ],
        },
      ],
    },
    {
      kind: "terms",
      key: "peated",
      label: "피트 상태",
      relevant: false,
      query: { parameter: "peated_state", encoding: "single" },
      selection_mode: "single",
      selected: ["unknown"],
      options: [
        { value: "peated", label: "피트", count: 1, selected: false },
        { value: "unpeated", label: "논피트", count: 1, selected: false },
        { value: "unknown", label: "미상", count: 0, selected: true },
      ],
    },
    {
      kind: "terms",
      key: "limited",
      label: "에디션",
      relevant: true,
      query: { parameter: "edition_state", encoding: "single" },
      selection_mode: "single",
      selected: ["limited"],
      options: [
        { value: "standard", label: "일반", count: 2, selected: false },
        { value: "limited", label: "한정판", count: 0, selected: true },
      ],
    },
    {
      kind: "range",
      key: "age_years",
      label: "숙성 연수",
      relevant: true,
      query: { min_parameter: "age_min", max_parameter: "age_max" },
      selection_mode: "range",
      selected: { min: "10", max: null },
      bounds: { min: "3", max: "25" },
      unit: "years",
    },
    {
      kind: "range",
      key: "abv",
      label: "도수",
      relevant: false,
      query: { min_parameter: "abv_min", max_parameter: "abv_max" },
      selection_mode: "range",
      selected: { min: null, max: null },
      bounds: { min: "40.0", max: "62.5" },
      unit: "percent",
    },
  ],
} as const satisfies CatalogFacetResponseV2;

/** Minimal recovery sample for the currently active flat per-market route (no `market` axis). */
export const legacyMarketFacetFixture = {
  axes: ["spirit_type"],
  total: 3,
  cask_family: [],
  cask_type: [],
  cask_material: [],
  country: [],
  region: [],
  spirit_type: [
    { value: "single_malt", count: 3, korean: "싱글 몰트" },
    { value: "blend", count: 1, korean: "블렌드" },
  ],
  distillery: [],
  bottling: { official: 3, independent: 0 },
  peated: { peated: 2, unpeated: 1, unknown: 0 },
  volume_ml: [{ value: 700, count: 3, korean: null }],
  age_years: { min: "8", max: "21" },
  abv: { min: "40.0", max: "58.2" },
} as const satisfies MarketFacetResponseLegacy;

export const marketFacetV2Fixture = {
  version: "2",
  total: 3,
  count_unit: "offer",
  count_mode: "disjunctive",
  groups: [
    {
      kind: "terms",
      key: "spirit_type",
      label: "주종",
      relevant: true,
      query: { parameter: "spirit_type", encoding: "repeat" },
      selection_mode: "multiple",
      selected: ["single_malt"],
      options: [
        { value: "single_malt", label: "싱글 몰트", count: 3, selected: true },
        { value: "blend", label: "블렌드", count: 1, selected: false },
      ],
    },
    {
      kind: "range",
      key: "abv",
      label: "도수",
      relevant: true,
      query: { min_parameter: "abv_min", max_parameter: "abv_max" },
      selection_mode: "range",
      selected: { min: "46.0", max: null },
      bounds: { min: "40.0", max: "58.2" },
      unit: "percent",
    },
  ],
} as const satisfies MarketFacetResponseV2;
