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

/**
 * Legacy public-drawer regression fixture. All three cask arrays are
 * intentionally populated and enabled in `axes`; non-cask catalog terms and
 * ranges are enabled alongside them so hiding cask controls cannot be made to
 * pass by rendering an empty drawer.
 */
export const legacyCatalogFacetFixtureWithCask = {
  ...legacyCatalogFacetFixture,
  axes: [
    "cask_material",
    "market",
    "cask_family",
    "spirit_type",
    "age_years",
    "cask_type",
    "abv",
  ],
  cask_family: [
    { value: "ex_bourbon", count: 5, korean: "버번 캐스크" },
    { value: "sherry", count: 3, korean: "셰리 캐스크" },
  ],
  cask_type: [
    { value: "hogshead", count: 4, korean: "혹스헤드" },
    { value: "barrel", count: 2, korean: "배럴" },
  ],
  cask_material: [{ value: "oak", count: 9, korean: "오크" }],
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

/**
 * Same catalog v2 response as `catalogFacetV2Fixture`, with the three public
 * cask groups spliced in at different positions in the response order, each
 * populated with counts and a selection, and one carrying a dependency parent
 * — evidence that hiding them doesn't depend on where the server places them,
 * whether they're `relevant`, or whether an option has a parent chain.
 */
export const catalogFacetV2FixtureWithCask = {
  ...catalogFacetV2Fixture,
  groups: [
    {
      kind: "terms",
      key: "cask_family",
      label: "캐스크",
      relevant: true,
      query: { parameter: "cask_family", encoding: "repeat" },
      selection_mode: "multiple",
      selected: ["ex_bourbon"],
      options: [
        { value: "ex_bourbon", label: "버번 캐스크", count: 5, selected: true },
        { value: "sherry", label: "셰리 캐스크", count: 3, selected: false },
      ],
    },
    ...catalogFacetV2Fixture.groups.slice(0, 2),
    {
      kind: "terms",
      key: "cask_type",
      label: "캐스크 타입",
      relevant: true,
      query: { parameter: "cask_type", encoding: "repeat" },
      selection_mode: "multiple",
      selected: ["hogshead"],
      options: [
        {
          value: "hogshead",
          label: "혹스헤드",
          count: 4,
          selected: true,
          parents: [{ key: "region", value: "sample-cask-parent", label: "예시 캐스크 상위" }],
        },
        { value: "barrel", label: "배럴", count: 2, selected: false },
      ],
    },
    ...catalogFacetV2Fixture.groups.slice(2),
    {
      kind: "terms",
      key: "cask_material",
      label: "캐스크 재질",
      relevant: false,
      query: { parameter: "cask_material", encoding: "repeat" },
      selection_mode: "multiple",
      selected: [],
      options: [{ value: "oak", label: "오크", count: 9, selected: false }],
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
