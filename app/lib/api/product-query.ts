import { API_BASE_URL, ensureOk } from "../auth";
import type { components, operations, paths } from "./types.gen";

/**
 * One public setting chooses the list/facet pair for a client instance.
 * It is intentionally read only while the client is being constructed: requests
 * never retry against the other contract version.
 */
export const PRODUCT_API_VERSION_ENV = "NEXT_PUBLIC_PRODUCT_API_VERSION";
export type ProductApiVersion = "v2" | "legacy";

export function resolveProductApiVersion(
  configured: string | undefined = process.env.NEXT_PUBLIC_PRODUCT_API_VERSION,
): ProductApiVersion {
  if (configured === undefined) return "v2";
  if (configured === "v2" || configured === "legacy") return configured;
  throw new Error(
    `${PRODUCT_API_VERSION_ENV} must be either \"v2\" or \"legacy\"`,
  );
}

export type FacetValue = string | number | boolean;

export interface TermsSelection {
  kind: "terms";
  values: FacetValue[];
}

export interface RangeSelection {
  kind: "range";
  /** Decimal strings retain the exact server/query representation, including zero. */
  min: string | null;
  max: string | null;
}

export type FacetSelection = TermsSelection | RangeSelection;

/** Canonical state shared by catalog and per-market product queries. */
export interface ProductQueryState {
  /** Selections are indexed by the stable group key, never by a display label. */
  facets: Readonly<Record<string, FacetSelection>>;
  search: string | null;
  available: boolean | null;
  sort: string | null;
  limit: number | null;
  offset: number;
}

export const EMPTY_PRODUCT_QUERY_STATE: ProductQueryState = Object.freeze({
  facets: Object.freeze({}),
  search: null,
  available: null,
  sort: null,
  limit: null,
  offset: 0,
});

type GeneratedTermsQuery = components["schemas"]["TermsQueryV2"];
type GeneratedRangeQuery = components["schemas"]["RangeQueryV2"];

/**
 * The deliberately small metadata view is structurally implemented by the
 * generated v2 group union. It also makes pure tests independent of labels and
 * other renderer-only response fields.
 */
export type FacetQueryMetadata =
  | {
      kind: "terms";
      key: string;
      query: GeneratedTermsQuery;
      selection_mode: "single" | "multiple";
      options?: readonly { value: FacetValue }[];
    }
  | {
      kind: "range";
      key: string;
      query: GeneratedRangeQuery;
      selection_mode: "range";
    };

type GeneratedFacetGroup =
  | components["schemas"]["CatalogTermsFacetGroupV2"]
  | components["schemas"]["MarketTermsFacetGroupV2"]
  | components["schemas"]["RangeFacetGroupV2"];

/** Compile-time proof that deployed structured groups provide query metadata. */
const generatedGroupContract: GeneratedFacetGroup extends FacetQueryMetadata
  ? true
  : never = true;
void generatedGroupContract;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function metadataInCanonicalOrder(
  metadata: readonly FacetQueryMetadata[],
): FacetQueryMetadata[] {
  return [...metadata].sort((a, b) => {
    const aName = a.kind === "terms" ? a.query.parameter : a.query.min_parameter;
    const bName = b.kind === "terms" ? b.query.parameter : b.query.min_parameter;
    return compareText(aName, bName) || compareText(a.key, b.key);
  });
}

function decimalOrNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return null;
  return Number.isFinite(Number(trimmed)) ? trimmed : null;
}

function integerOrNull(
  value: string | null,
  minimum: number,
): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : null;
}

function optionValue(
  raw: string,
  options: readonly { value: FacetValue }[] | undefined,
): FacetValue | undefined {
  if (!options) return raw;
  return options.find((option) => String(option.value) === raw)?.value;
}

function valueIdentity(value: FacetValue): string {
  return `${typeof value}:${String(value)}`;
}

function valuesInCanonicalOrder(values: readonly FacetValue[]): FacetValue[] {
  return [...values].sort((a, b) => compareText(valueIdentity(a), valueIdentity(b)));
}

/** Parse a browser query using only server-supplied structured facet metadata. */
export function parseProductQueryState(
  input: URLSearchParams | string,
  metadata: readonly FacetQueryMetadata[],
): ProductQueryState {
  const params =
    typeof input === "string"
      ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input)
      : input;
  const facets: Record<string, FacetSelection> = {};

  for (const group of metadataInCanonicalOrder(metadata)) {
    if (group.kind === "terms") {
      const values = params
        .getAll(group.query.parameter)
        .map((raw) => optionValue(raw, group.options))
        .filter((value): value is FacetValue => value !== undefined);
      if (values.length === 0) continue;

      if (group.selection_mode === "single" || group.query.encoding === "single") {
        facets[group.key] = { kind: "terms", values: [values.at(-1)!] };
        continue;
      }

      const seen = new Set<string>();
      facets[group.key] = {
        kind: "terms",
        values: valuesInCanonicalOrder(values.filter((value) => {
          const identity = valueIdentity(value);
          if (seen.has(identity)) return false;
          seen.add(identity);
          return true;
        })),
      };
    } else {
      const min = decimalOrNull(params.get(group.query.min_parameter));
      const max = decimalOrNull(params.get(group.query.max_parameter));
      if (min !== null || max !== null) {
        facets[group.key] = { kind: "range", min, max };
      }
    }
  }

  const rawAvailable = params.get("available");
  const available =
    rawAvailable === "true" ? true : rawAvailable === "false" ? false : null;
  const rawSearch = params.get("search");
  const search = rawSearch?.trim() ? rawSearch.trim() : null;
  const rawSort = params.get("sort");
  const sort = rawSort?.trim() ? rawSort.trim() : null;

  return {
    facets,
    search,
    available,
    sort,
    limit: integerOrNull(params.get("limit"), 1),
    offset: integerOrNull(params.get("offset"), 0) ?? 0,
  };
}

function appendTerms(
  params: URLSearchParams,
  group: Extract<FacetQueryMetadata, { kind: "terms" }>,
  selection: TermsSelection,
) {
  if (selection.values.length === 0) return;
  const values =
    group.selection_mode === "single" || group.query.encoding === "single"
      ? [selection.values.at(-1)!]
      : valuesInCanonicalOrder(
          selection.values.filter(
            (value, index, all) =>
              all.findIndex((candidate) => valueIdentity(candidate) === valueIdentity(value)) ===
              index,
          ),
        );
  for (const value of values) params.append(group.query.parameter, String(value));
}

/**
 * Serialize only parameters supported by both list and facet operations.
 * No deployed facet parameter name or selection encoding is duplicated here.
 */
export function serializeCommonV2Filters(
  state: ProductQueryState,
  metadata: readonly FacetQueryMetadata[],
): URLSearchParams {
  const params = new URLSearchParams();
  if (state.available !== null) params.append("available", String(state.available));
  if (state.search !== null && state.search.trim() !== "") {
    params.append("search", state.search.trim());
  }

  for (const group of metadataInCanonicalOrder(metadata)) {
    const selection = state.facets[group.key];
    if (!selection) continue;
    if (group.kind === "terms" && selection.kind === "terms") {
      appendTerms(params, group, selection);
    } else if (group.kind === "range" && selection.kind === "range") {
      if (selection.min !== null) {
        params.append(group.query.min_parameter, selection.min);
      }
      if (selection.max !== null) {
        params.append(group.query.max_parameter, selection.max);
      }
    }
  }
  return params;
}

/** Canonical browser query: common filters followed by list-only state. */
export function serializeProductQueryState(
  state: ProductQueryState,
  metadata: readonly FacetQueryMetadata[],
): URLSearchParams {
  const params = serializeCommonV2Filters(state, metadata);
  if (state.sort !== null && state.sort.trim() !== "") {
    params.append("sort", state.sort.trim());
  }
  if (state.limit !== null) params.append("limit", String(state.limit));
  if (state.offset !== 0) params.append("offset", String(state.offset));
  return params;
}

export function canonicalProductSearch(
  input: URLSearchParams | string,
  metadata: readonly FacetQueryMetadata[],
): { state: ProductQueryState; search: string; needsReplacement: boolean } {
  const original =
    typeof input === "string"
      ? input.replace(/^\?/, "")
      : input.toString();
  const state = parseProductQueryState(input, metadata);
  const search = serializeProductQueryState(state, metadata).toString();
  return { state, search, needsReplacement: original !== search };
}

function facetSelectionEqual(
  left: FacetSelection | undefined,
  right: FacetSelection | undefined,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** A criterion change starts over at the first page without clearing facets. */
export function setFacetSelection(
  state: ProductQueryState,
  key: string,
  selection: FacetSelection | null,
): ProductQueryState {
  if (facetSelectionEqual(state.facets[key], selection ?? undefined)) return state;
  const facets = { ...state.facets };
  if (
    selection === null ||
    (selection.kind === "terms" && selection.values.length === 0) ||
    (selection.kind === "range" && selection.min === null && selection.max === null)
  ) {
    delete facets[key];
  } else {
    facets[key] = selection;
  }
  return { ...state, facets, offset: 0 };
}

export function setQueryCriteria(
  state: ProductQueryState,
  criteria: Partial<Pick<ProductQueryState, "search" | "available" | "sort">>,
): ProductQueryState {
  const next = { ...state, ...criteria };
  const changed =
    next.search !== state.search ||
    next.available !== state.available ||
    next.sort !== state.sort;
  return changed ? { ...next, offset: 0 } : state;
}

export function setPageOffset(
  state: ProductQueryState,
  offset: number,
): ProductQueryState {
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("offset must be a non-negative safe integer");
  }
  return offset === state.offset ? state : { ...state, offset };
}

/** Explicit reset clears every selection, including currently irrelevant ones. */
export function resetProductQueryState(
  state: ProductQueryState,
): ProductQueryState {
  return {
    ...EMPTY_PRODUCT_QUERY_STATE,
    limit: state.limit,
  };
}

export type ProductQueryScope =
  | { kind: "catalog" }
  | { kind: "market"; marketCode: string };

export function productPagePath(scope: ProductQueryScope): string {
  return scope.kind === "catalog"
    ? "/products"
    : `/markets/${encodeURIComponent(scope.marketCode)}`;
}

const CLIENT_ROUTES = {
  catalog: {
    list: "/api/products",
    v2Facet: "/api/v2/products/facets",
    legacyFacet: "/api/products/facets",
  },
  market: {
    list: "/api/markets/{market_code}/products",
    v2Facet: "/api/v2/markets/{market_code}/facets",
    legacyFacet: "/api/markets/{market_code}/facets",
  },
} as const satisfies {
  catalog: Record<string, keyof paths>;
  market: Record<string, keyof paths>;
};

type CatalogList = operations["list_catalog_products_api_products_get"]["responses"][200]["content"]["application/json"];
type MarketList = operations["list_market_products_api_markets__market_code__products_get"]["responses"][200]["content"]["application/json"];
type CatalogV2Facets = components["schemas"]["CatalogFacetResponseV2"];
type MarketV2Facets = components["schemas"]["MarketFacetResponseV2"];
type CatalogLegacyFacets = components["schemas"]["CatalogFacetsOut"];
type MarketLegacyFacets = components["schemas"]["MarketFacetsOut"];

export type ProductQueryPair =
  | { scope: "catalog"; version: "v2"; list: CatalogList; facets: CatalogV2Facets }
  | { scope: "catalog"; version: "legacy"; list: CatalogList; facets: CatalogLegacyFacets }
  | { scope: "market"; version: "v2"; list: MarketList; facets: MarketV2Facets }
  | { scope: "market"; version: "legacy"; list: MarketList; facets: MarketLegacyFacets };

export type CommonFilterSerializer = (
  state: ProductQueryState,
  metadata: readonly FacetQueryMetadata[],
) => URLSearchParams;

export interface ProductQueryClientOptions {
  version?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Test seam used to assert one common snapshot per refresh. */
  serializeCommonFilters?: CommonFilterSerializer;
}

function scopeRoute(template: string, scope: ProductQueryScope): string {
  if (scope.kind === "catalog") return template;
  return template.replace("{market_code}", encodeURIComponent(scope.marketCode));
}

function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

/**
 * Creates a coherent, immutable list/facet client pair. A failed v2 request is
 * surfaced to the caller and is never retried against the legacy facet route.
 */
export function createProductQueryClient(
  scope: ProductQueryScope,
  options: ProductQueryClientOptions = {},
) {
  const version = resolveProductApiVersion(options.version);
  const baseUrl = options.baseUrl ?? API_BASE_URL;
  const request = options.fetch ?? fetch;
  const commonSerializer =
    options.serializeCommonFilters ??
    (version === "v2" ? serializeCommonV2Filters : serializeLegacyCommonFilters);
  const routes = CLIENT_ROUTES[scope.kind];
  const listPath = scopeRoute(routes.list, scope);
  const facetPath = scopeRoute(
    version === "v2" ? routes.v2Facet : routes.legacyFacet,
    scope,
  );

  return Object.freeze({
    version,
    scope,
    async refresh(
      state: ProductQueryState,
      metadata: readonly FacetQueryMetadata[],
      signal?: AbortSignal,
    ): Promise<ProductQueryPair> {
      // This is the only common serialization call in a refresh. Both requests
      // clone the same byte snapshot before list-only parameters are appended.
      const commonQuery = commonSerializer(state, metadata).toString();
      const facetParams = new URLSearchParams(commonQuery);
      const listParams = new URLSearchParams(commonQuery);
      if (
        scope.kind === "catalog" &&
        state.sort !== null &&
        state.sort.trim() !== ""
      ) {
        listParams.append("sort", state.sort.trim());
      }
      if (state.limit !== null) listParams.append("limit", String(state.limit));
      listParams.append("offset", String(state.offset));

      const [listResponse, facetResponse] = await Promise.all([
        request(withQuery(`${baseUrl}${listPath}`, listParams), {
          signal,
          cache: "no-store",
        }),
        request(withQuery(`${baseUrl}${facetPath}`, facetParams), {
          signal,
          cache: "no-store",
        }),
      ]);
      await Promise.all([ensureOk(listResponse), ensureOk(facetResponse)]);
      const [list, facets] = await Promise.all([
        listResponse.json(),
        facetResponse.json(),
      ]);
      return {
        scope: scope.kind,
        version,
        list,
        facets,
      } as ProductQueryPair;
    },
  });
}

/**
 * Recovery-only metadata for the flat response contract. Unlike v2, legacy
 * responses cannot supply transport metadata, so this explicit adapter is
 * intentionally isolated and regression-tested.
 */
export const LEGACY_FACET_QUERY_METADATA: readonly FacetQueryMetadata[] = [
  { kind: "terms", key: "market", query: { parameter: "market", encoding: "repeat" }, selection_mode: "multiple" },
  { kind: "terms", key: "cask_family", query: { parameter: "cask_family", encoding: "repeat" }, selection_mode: "multiple" },
  { kind: "terms", key: "cask_type", query: { parameter: "cask_type", encoding: "repeat" }, selection_mode: "multiple" },
  { kind: "terms", key: "cask_material", query: { parameter: "cask_material", encoding: "repeat" }, selection_mode: "multiple" },
  { kind: "terms", key: "country", query: { parameter: "country", encoding: "repeat" }, selection_mode: "multiple" },
  { kind: "terms", key: "region", query: { parameter: "region", encoding: "repeat" }, selection_mode: "multiple" },
  { kind: "terms", key: "distillery", query: { parameter: "distillery_id", encoding: "repeat" }, selection_mode: "multiple" },
  { kind: "terms", key: "bottling", query: { parameter: "bottling", encoding: "single" }, selection_mode: "single" },
  { kind: "terms", key: "spirit_type", query: { parameter: "spirit_type", encoding: "repeat" }, selection_mode: "multiple" },
  { kind: "terms", key: "peated", query: { parameter: "peated_state", encoding: "single" }, selection_mode: "single" },
  { kind: "terms", key: "volume_ml", query: { parameter: "volume_ml", encoding: "repeat" }, selection_mode: "multiple" },
  { kind: "terms", key: "limited", query: { parameter: "edition_state", encoding: "single" }, selection_mode: "single" },
  { kind: "range", key: "age_years", query: { min_parameter: "age_min", max_parameter: "age_max" }, selection_mode: "range" },
  { kind: "range", key: "abv", query: { min_parameter: "abv_min", max_parameter: "abv_max" }, selection_mode: "range" },
];

export function serializeLegacyCommonFilters(
  state: ProductQueryState,
  _metadata: readonly FacetQueryMetadata[] = LEGACY_FACET_QUERY_METADATA,
): URLSearchParams {
  return serializeCommonV2Filters(state, LEGACY_FACET_QUERY_METADATA);
}

/** Input shape retained by the not-yet-migrated pages during this Task. */
export interface LegacyFlatProductQuery {
  available?: boolean | null;
  market?: string[];
  search?: string | null;
  cask_family?: string[];
  cask_type?: string[];
  cask_material?: string[];
  country?: string[];
  region?: string[];
  distillery_id?: number[];
  bottling?: string | null;
  spirit_type?: string[];
  peated?: boolean | null;
  age_min?: number | null;
  age_max?: number | null;
  abv_min?: number | null;
  abv_max?: number | null;
  volume_ml?: number[];
  limited?: boolean | null;
  sort?: string | null;
  limit?: number;
  offset?: number;
}

/**
 * Compatibility serializer for the existing React page props. It centralizes
 * the formerly duplicated catalog/market builders without changing page UI.
 */
export function serializeLegacyFlatProductQuery(
  query: LegacyFlatProductQuery,
  includeListOnly: boolean,
): URLSearchParams {
  const params = new URLSearchParams();
  const scalar = (
    name: string,
    value: string | number | boolean | null | undefined,
  ) => {
    if (value !== null && value !== undefined && value !== "") {
      params.append(name, String(value));
    }
  };
  const repeated = (name: string, values: readonly (string | number)[] | undefined) => {
    for (const value of values ?? []) params.append(name, String(value));
  };

  scalar("available", query.available);
  repeated("market", query.market);
  scalar("search", query.search?.trim() || null);
  repeated("cask_family", query.cask_family);
  repeated("cask_type", query.cask_type);
  repeated("cask_material", query.cask_material);
  repeated("country", query.country);
  repeated("region", query.region);
  repeated("distillery_id", query.distillery_id);
  scalar("bottling", query.bottling);
  repeated("spirit_type", query.spirit_type);
  scalar("peated", query.peated);
  scalar("age_min", query.age_min);
  scalar("age_max", query.age_max);
  scalar("abv_min", query.abv_min);
  scalar("abv_max", query.abv_max);
  repeated("volume_ml", query.volume_ml);
  scalar("limited", query.limited);
  if (includeListOnly) {
    scalar("sort", query.sort);
    scalar("limit", query.limit);
    scalar("offset", query.offset);
  }
  return params;
}
