import type {
  FacetGroupV2,
  FacetOptionV2,
  FacetParentV2,
  RangeFacetGroupV2,
  TermsFacetGroupV2,
} from "./api/facet-contract";
import type { FacetSelection, FacetValue, ProductQueryState } from "./api/product-query";

function isTermsGroup(group: FacetGroupV2): group is TermsFacetGroupV2 {
  return group.kind === "terms";
}

function isRangeGroup(group: FacetGroupV2): group is RangeFacetGroupV2 {
  return group.kind === "range";
}

/** Compile-time proof the renderer's discriminator switch is exhaustive against the deployed union. */
function assertNeverGroupKind(group: never): never {
  throw new Error(
    `Unhandled facet group discriminator: ${String((group as { kind?: unknown })?.kind)}`,
  );
}

export function valueKey(value: FacetValue): string {
  return `${typeof value}:${String(value)}`;
}

export interface RetainedOption {
  readonly value: FacetValue;
  readonly label: string;
  readonly parents?: readonly FacetParentV2[];
}

export interface RetainedTermsMeta {
  readonly kind: "terms";
  readonly label: string;
  readonly selection_mode: "single" | "multiple";
  readonly query: { readonly parameter: string; readonly encoding: "repeat" | "single" };
  readonly options: Readonly<Record<string, RetainedOption>>;
}

export interface RetainedRangeMeta {
  readonly kind: "range";
  readonly label: string;
  readonly query: { readonly min_parameter: string; readonly max_parameter: string };
  readonly unit: string;
  readonly bounds: { readonly min: string | null; readonly max: string | null };
}

export type RetainedFacetMeta = RetainedTermsMeta | RetainedRangeMeta;

/**
 * Cross-response label/metadata cache. A server refresh can drop a group or an
 * option (dependency became irrelevant, count fell to zero and was pruned, ...)
 * without the user having cleared anything; this cache is what lets the
 * renderer keep showing a real label for a still-selected value instead of
 * silently losing it. It never removes an entry except via an explicit clear
 * or reset of the corresponding facet.
 */
export interface FacetViewState {
  readonly retained: Readonly<Record<string, RetainedFacetMeta>>;
}

export const EMPTY_FACET_VIEW_STATE: FacetViewState = Object.freeze({
  retained: Object.freeze({}),
});

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Fold freshly returned server groups into the retained metadata cache.
 * Returns the exact same `previous` reference when nothing actually changed,
 * which callers (the component's reconcile-then-commit effect) rely on to
 * avoid re-rendering forever on an unchanged response.
 */
export function reconcileFacetViewState(
  previous: FacetViewState,
  groups: readonly FacetGroupV2[],
): FacetViewState {
  let retained: Record<string, RetainedFacetMeta> | null = null;

  for (const group of groups) {
    if (isTermsGroup(group)) {
      const prior = previous.retained[group.key];
      const priorOptions = prior?.kind === "terms" ? prior.options : {};
      const options: Record<string, RetainedOption> = { ...priorOptions };
      for (const option of group.options) {
        options[valueKey(option.value)] = {
          value: option.value,
          label: option.label,
          parents: option.parents,
        };
      }
      const next: RetainedTermsMeta = {
        kind: "terms",
        label: group.label,
        selection_mode: group.selection_mode,
        query: group.query,
        options,
      };
      if (sameJson(prior, next)) continue;
      retained ??= { ...previous.retained };
      retained[group.key] = next;
    } else if (isRangeGroup(group)) {
      const prior = previous.retained[group.key];
      const next: RetainedRangeMeta = {
        kind: "range",
        label: group.label,
        query: group.query,
        unit: group.unit,
        bounds: group.bounds,
      };
      if (sameJson(prior, next)) continue;
      retained ??= { ...previous.retained };
      retained[group.key] = next;
    } else {
      assertNeverGroupKind(group);
    }
  }

  return retained ? { retained } : previous;
}

/** Explicit per-facet clear also forgets its retained cache so a future response starts clean. */
export function forgetRetainedFacet(state: FacetViewState, key: string): FacetViewState {
  if (!(key in state.retained)) return state;
  const retained = { ...state.retained };
  delete retained[key];
  return { retained };
}

/** Explicit whole-panel reset forgets every retained facet. */
export function resetFacetViewState(): FacetViewState {
  return EMPTY_FACET_VIEW_STATE;
}

export interface FacetOptionViewModel {
  readonly value: FacetValue;
  readonly label: string;
  /** `null` when the option is no longer present in the latest server response. */
  readonly count: number | null;
  readonly selected: boolean;
  /** `true` when reconstructed from the retained cache rather than the live response. */
  readonly retained: boolean;
  readonly parents?: readonly FacetParentV2[];
}

interface BaseGroupViewModel {
  readonly key: string;
  readonly label: string;
  readonly relevant: boolean;
  /** `true` when the whole group is absent from the latest response and rendered from cache. */
  readonly retained: boolean;
}

export interface TermsFacetGroupViewModel extends BaseGroupViewModel {
  readonly kind: "terms";
  readonly selection_mode: "single" | "multiple";
  readonly query: { readonly parameter: string; readonly encoding: "repeat" | "single" };
  readonly options: readonly FacetOptionViewModel[];
}

export interface RangeFacetGroupViewModel extends BaseGroupViewModel {
  readonly kind: "range";
  readonly query: { readonly min_parameter: string; readonly max_parameter: string };
  readonly unit: string;
  readonly bounds: { readonly min: string | null; readonly max: string | null };
  readonly selectedMin: string | null;
  readonly selectedMax: string | null;
}

export type FacetGroupViewModel = TermsFacetGroupViewModel | RangeFacetGroupViewModel;

function termsSelectionValues(selection: FacetSelection | undefined): readonly FacetValue[] {
  return selection?.kind === "terms" ? selection.values : [];
}

function buildLiveTermsView(
  group: TermsFacetGroupV2,
  retainedMeta: RetainedTermsMeta | undefined,
  selection: FacetSelection | undefined,
): TermsFacetGroupViewModel {
  // Local query state is always authoritative, including when it doesn't track
  // this facet at all: an absent key means "nothing selected" (the same state an
  // explicit clear produces), never "defer to the server's echoed `selected`."
  // Trusting the server here would make a just-cleared value reappear as checked
  // because the still-mounted response object's stale `option.selected` says so.
  const selectedValues = new Set(termsSelectionValues(selection).map(valueKey));
  const options: FacetOptionViewModel[] = [];
  const covered = new Set<string>();

  for (const option of group.options) {
    const vk = valueKey(option.value);
    covered.add(vk);
    options.push({
      value: option.value,
      label: option.label,
      count: option.count,
      selected: selectedValues.has(vk),
      retained: false,
      parents: option.parents,
    });
  }

  for (const value of termsSelectionValues(selection)) {
    const vk = valueKey(value);
    if (covered.has(vk)) continue;
    covered.add(vk);
    const cached = retainedMeta?.options[vk];
    options.push({
      value,
      label: cached?.label ?? String(value),
      count: null,
      selected: true,
      retained: true,
      parents: cached?.parents,
    });
  }

  return {
    kind: "terms",
    key: group.key,
    label: group.label,
    relevant: group.relevant,
    retained: false,
    selection_mode: group.selection_mode,
    query: group.query,
    options,
  };
}

function buildRetainedTermsView(
  key: string,
  meta: RetainedTermsMeta,
  selection: FacetSelection,
): TermsFacetGroupViewModel {
  const options: FacetOptionViewModel[] = termsSelectionValues(selection).map((value) => {
    const cached = meta.options[valueKey(value)];
    return {
      value,
      label: cached?.label ?? String(value),
      count: null,
      selected: true,
      retained: true,
      parents: cached?.parents,
    };
  });

  return {
    kind: "terms",
    key,
    label: meta.label,
    relevant: false,
    retained: true,
    selection_mode: meta.selection_mode,
    query: meta.query,
    options,
  };
}

function buildLiveRangeView(
  group: RangeFacetGroupV2,
  selection: FacetSelection | undefined,
): RangeFacetGroupViewModel {
  // Local query state is always authoritative, including when it doesn't track
  // this facet at all (absent means "unselected", the same state produced by an
  // explicit clear) — never fall back to the response's possibly-stale `selected`.
  const local = selection?.kind === "range" ? selection : null;
  return {
    kind: "range",
    key: group.key,
    label: group.label,
    relevant: group.relevant,
    retained: false,
    query: group.query,
    unit: group.unit,
    bounds: group.bounds,
    selectedMin: local?.min ?? null,
    selectedMax: local?.max ?? null,
  };
}

function buildRetainedRangeView(
  key: string,
  meta: RetainedRangeMeta,
  selection: FacetSelection,
): RangeFacetGroupViewModel {
  const range = selection.kind === "range" ? selection : { min: null, max: null };
  return {
    kind: "range",
    key,
    label: meta.label,
    relevant: false,
    retained: true,
    query: meta.query,
    unit: meta.unit,
    bounds: meta.bounds,
    selectedMin: range.min,
    selectedMax: range.max,
  };
}

/**
 * Build render-ready view models for every group the server returned, plus any
 * locally selected facet that the latest response dropped entirely — those are
 * reconstructed from the retained cache so they stay visible and explicitly
 * clearable instead of disappearing as a side effect of an unrelated refresh.
 */
export function buildFacetGroupViewModels(
  groups: readonly FacetGroupV2[],
  viewState: FacetViewState,
  selection: ProductQueryState["facets"],
): FacetGroupViewModel[] {
  const seenKeys = new Set<string>();
  const result: FacetGroupViewModel[] = [];

  for (const group of groups) {
    seenKeys.add(group.key);
    if (isTermsGroup(group)) {
      const retainedMeta = viewState.retained[group.key];
      result.push(
        buildLiveTermsView(
          group,
          retainedMeta?.kind === "terms" ? retainedMeta : undefined,
          selection[group.key],
        ),
      );
    } else if (isRangeGroup(group)) {
      result.push(buildLiveRangeView(group, selection[group.key]));
    } else {
      assertNeverGroupKind(group);
    }
  }

  for (const [key, meta] of Object.entries(viewState.retained)) {
    if (seenKeys.has(key)) continue;
    const selected = selection[key];
    if (!selected) continue;
    if (meta.kind === "terms" && selected.kind === "terms" && selected.values.length > 0) {
      result.push(buildRetainedTermsView(key, meta, selected));
    } else if (
      meta.kind === "range" &&
      selected.kind === "range" &&
      (selected.min !== null || selected.max !== null)
    ) {
      result.push(buildRetainedRangeView(key, meta, selected));
    }
  }

  return result;
}

export type { FacetOptionV2 };
