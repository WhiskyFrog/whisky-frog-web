import type { components, operations, paths } from "./types.gen";

/** Public facet endpoints retained during the v2 migration and fallback window. */
export const FACET_ROUTES = {
  catalogV2: "/api/v2/products/facets",
  marketV2: "/api/v2/markets/{market_code}/facets",
  catalogLegacy: "/api/products/facets",
  marketLegacy: "/api/markets/{market_code}/facets",
} as const satisfies Record<string, keyof paths>;

/** Operation ids are checked here so regeneration fails compilation if one disappears. */
export const FACET_OPERATION_IDS = [
  "catalog_facets_v2_api_v2_products_facets_get",
  "market_facets_v2_api_v2_markets__market_code__facets_get",
  "catalog_facets_api_products_facets_get",
  "market_facets_api_markets__market_code__facets_get",
] as const satisfies readonly (keyof operations)[];

export type CatalogFacetPathV2 = paths[(typeof FACET_ROUTES)["catalogV2"]];
export type MarketFacetPathV2 = paths[(typeof FACET_ROUTES)["marketV2"]];
export type CatalogFacetPathLegacy = paths[(typeof FACET_ROUTES)["catalogLegacy"]];
export type MarketFacetPathLegacy = paths[(typeof FACET_ROUTES)["marketLegacy"]];

export type CatalogFacetOperationV2 = operations[(typeof FACET_OPERATION_IDS)[0]];
export type MarketFacetOperationV2 = operations[(typeof FACET_OPERATION_IDS)[1]];
export type CatalogFacetOperationLegacy = operations[(typeof FACET_OPERATION_IDS)[2]];
export type MarketFacetOperationLegacy = operations[(typeof FACET_OPERATION_IDS)[3]];

export type CatalogFacetQueryV2 = NonNullable<
  CatalogFacetOperationV2["parameters"]["query"]
>;
export type MarketFacetQueryV2 = NonNullable<
  MarketFacetOperationV2["parameters"]["query"]
>;

export type CatalogFacetResponseV2 =
  CatalogFacetOperationV2["responses"][200]["content"]["application/json"];
export type MarketFacetResponseV2 =
  MarketFacetOperationV2["responses"][200]["content"]["application/json"];
export type CatalogFacetResponseLegacy =
  CatalogFacetOperationLegacy["responses"][200]["content"]["application/json"];
export type MarketFacetResponseLegacy =
  MarketFacetOperationLegacy["responses"][200]["content"]["application/json"];

export type CatalogFacetGroupV2 = CatalogFacetResponseV2["groups"][number];
export type MarketFacetGroupV2 = MarketFacetResponseV2["groups"][number];
export type CatalogTermsFacetGroupV2 = components["schemas"]["CatalogTermsFacetGroupV2"];
export type MarketTermsFacetGroupV2 = components["schemas"]["MarketTermsFacetGroupV2"];
export type RangeFacetGroupV2 = components["schemas"]["RangeFacetGroupV2"];

/** Union of both deployed scopes' structured responses, for a scope-agnostic renderer. */
export type FacetResponseV2 = CatalogFacetResponseV2 | MarketFacetResponseV2;
/** Union of every generated structured group variant across both scopes. */
export type FacetGroupV2 = CatalogTermsFacetGroupV2 | MarketTermsFacetGroupV2 | RangeFacetGroupV2;
/** Either scope's terms group variant, before the range/terms `kind` split. */
export type TermsFacetGroupV2 = CatalogTermsFacetGroupV2 | MarketTermsFacetGroupV2;
export type FacetOptionV2 = components["schemas"]["FacetOptionV2"];
export type FacetParentV2 = components["schemas"]["FacetParentV2"];
