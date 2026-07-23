import type { FacetSelection, FacetValue, ProductQueryState } from "./api/product-query";
import { setFacetSelection } from "./api/product-query";
import { EMPTY_FILTERS, type ProductFilters } from "../components/ProductFacetSidebar";

/**
 * Legacy-mode-only bridge between the canonical, generated-metadata-keyed query state and the
 * pre-migration `ProductFacetSidebar`'s flat `ProductFilters` shape. `ProductFacetSidebar` cannot
 * render v2 structured groups (see task-0004's scope), so legacy mode keeps rendering it; this
 * adapter lets it keep operating purely on `ProductFilters` while requests still flow through the
 * shared canonical state. `ProductFilters.peated` cannot distinguish "unknown" from "unselected",
 * matching the legacy UI's existing, already-known limitation rather than adding a new one.
 */

function terms(state: ProductQueryState, key: string): readonly FacetValue[] {
  const selection = state.facets[key];
  return selection?.kind === "terms" ? selection.values : [];
}

function range(
  state: ProductQueryState,
  key: string,
): { min: string | null; max: string | null } {
  const selection = state.facets[key];
  return selection?.kind === "range" ? selection : { min: null, max: null };
}

export function filtersFromQueryState(state: ProductQueryState): ProductFilters {
  const age = range(state, "age_years");
  const abv = range(state, "abv");
  const bottling = terms(state, "bottling")[0];
  const peated = terms(state, "peated")[0];

  return {
    ...EMPTY_FILTERS,
    market: terms(state, "market").map(String),
    cask_family: terms(state, "cask_family").map(String),
    cask_type: terms(state, "cask_type").map(String),
    cask_material: terms(state, "cask_material").map(String),
    country: terms(state, "country").map(String),
    region: terms(state, "region").map(String),
    distillery_id: terms(state, "distillery").map(Number),
    bottling:
      bottling === "official" || bottling === "independent" ? bottling : null,
    spirit_type: terms(state, "spirit_type").map(String),
    peated: peated === "peated" ? true : peated === "unpeated" ? false : null,
    age_min: age.min ?? "",
    age_max: age.max ?? "",
    abv_min: abv.min ?? "",
    abv_max: abv.max ?? "",
    volume_ml: terms(state, "volume_ml").map(Number),
  };
}

function setTerms(
  state: ProductQueryState,
  key: string,
  values: readonly (string | number)[],
): ProductQueryState {
  const selection: FacetSelection | null = values.length > 0 ? { kind: "terms", values: [...values] } : null;
  return setFacetSelection(state, key, selection);
}

/** Folds a full `ProductFilters` snapshot back into canonical query state, key by key. */
export function applyLegacyFilters(
  state: ProductQueryState,
  filters: ProductFilters,
): ProductQueryState {
  let next = state;
  next = setTerms(next, "market", filters.market);
  next = setTerms(next, "cask_family", filters.cask_family);
  next = setTerms(next, "cask_type", filters.cask_type);
  next = setTerms(next, "cask_material", filters.cask_material);
  next = setTerms(next, "country", filters.country);
  next = setTerms(next, "region", filters.region);
  next = setTerms(next, "distillery", filters.distillery_id);
  next = setTerms(next, "spirit_type", filters.spirit_type);
  next = setTerms(next, "volume_ml", filters.volume_ml);
  next = setFacetSelection(
    next,
    "bottling",
    filters.bottling ? { kind: "terms", values: [filters.bottling] } : null,
  );
  next = setFacetSelection(
    next,
    "peated",
    filters.peated === true
      ? { kind: "terms", values: ["peated"] }
      : filters.peated === false
        ? { kind: "terms", values: ["unpeated"] }
        : null,
  );
  next = setFacetSelection(
    next,
    "age_years",
    filters.age_min.trim() || filters.age_max.trim()
      ? { kind: "range", min: filters.age_min.trim() || null, max: filters.age_max.trim() || null }
      : null,
  );
  next = setFacetSelection(
    next,
    "abv",
    filters.abv_min.trim() || filters.abv_max.trim()
      ? { kind: "range", min: filters.abv_min.trim() || null, max: filters.abv_max.trim() || null }
      : null,
  );
  return next;
}
