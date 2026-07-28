/**
 * Presentation-only visibility policy shared by both public catalog facet
 * renderers (structured v2 `ProductFacetPanel` and legacy `ProductFacetSidebar`).
 * These three keys stay fully present in `ProductFilters`, query state, and the
 * API contract — this only decides which groups get a rendered control. Keeping
 * both renderers reading from the same definition is what prevents them from
 * drifting apart as facet keys are added or renamed.
 */
export const PUBLIC_HIDDEN_FACET_KEYS = [
  "cask_family",
  "cask_type",
  "cask_material",
] as const;

export type PublicHiddenFacetKey = (typeof PUBLIC_HIDDEN_FACET_KEYS)[number];

const publicHiddenFacetKeySet: ReadonlySet<string> = new Set(PUBLIC_HIDDEN_FACET_KEYS);

export function isPublicHiddenFacetKey(key: string): boolean {
  return publicHiddenFacetKeySet.has(key);
}
