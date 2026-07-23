import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogFacetResponseV2 } from "../app/lib/api/facet-contract.ts";
import {
  buildFacetGroupViewModels,
  EMPTY_FACET_VIEW_STATE,
  forgetRetainedFacet,
  reconcileFacetViewState,
  resetFacetViewState,
  type FacetGroupViewModel,
  type TermsFacetGroupViewModel,
} from "../app/lib/facet-view.ts";
import {
  parseProductQueryState,
  serializeProductQueryState,
  setFacetSelection,
  EMPTY_PRODUCT_QUERY_STATE,
  type FacetQueryMetadata,
  type ProductQueryState,
} from "../app/lib/api/product-query.ts";
import { catalogFacetV2Fixture } from "./fixtures/facet-responses.ts";

function termsGroup(view: FacetGroupViewModel[], key: string): TermsFacetGroupViewModel {
  const found = view.find((group) => group.key === key);
  assert.ok(found, `expected a group for ${key}`);
  assert.equal(found!.kind, "terms");
  return found as TermsFacetGroupViewModel;
}

test("live groups render server-supplied label/query/selection-mode/bounds/unit verbatim", () => {
  const view = buildFacetGroupViewModels(
    catalogFacetV2Fixture.groups,
    EMPTY_FACET_VIEW_STATE,
    EMPTY_PRODUCT_QUERY_STATE.facets,
  );

  const market = termsGroup(view, "market");
  assert.equal(market.label, "마켓");
  assert.equal(market.query.parameter, "market");
  assert.equal(market.selection_mode, "multiple");
  assert.equal(market.retained, false);

  const age = view.find((group) => group.key === "age_years");
  assert.ok(age && age.kind === "range");
  assert.equal(age!.label, "숙성 연수");
  assert.deepEqual((age as any).bounds, { min: "3", max: "25" });
  assert.equal((age as any).unit, "years");
});

test("a fixture with unfamiliar labels and keys renders generically without a code change", () => {
  const exotic = {
    version: "2",
    total: 1,
    count_unit: "product",
    count_mode: "disjunctive",
    groups: [
      {
        kind: "terms",
        key: "cask_type",
        label: "Zzyzx Vessel Class",
        relevant: true,
        query: { parameter: "cask_type", encoding: "repeat" },
        selection_mode: "multiple",
        selected: ["glorp"],
        options: [
          { value: "glorp", label: "Glorpwood 캐스크", count: 4, selected: true },
          { value: "fnord", label: "Fnordite 캐스크", count: 1, selected: false },
        ],
      },
    ],
  } as const satisfies CatalogFacetResponseV2;

  const view = buildFacetGroupViewModels(
    exotic.groups,
    EMPTY_FACET_VIEW_STATE,
    { cask_type: { kind: "terms", values: ["glorp"] } },
  );
  const group = termsGroup(view, "cask_type");
  assert.equal(group.label, "Zzyzx Vessel Class");
  assert.deepEqual(
    group.options.map((option) => [option.value, option.label, option.selected]),
    [
      ["glorp", "Glorpwood 캐스크", true],
      ["fnord", "Fnordite 캐스크", false],
    ],
  );
});

test("a selected option with count 0 remains visible and selected", () => {
  const view = buildFacetGroupViewModels(catalogFacetV2Fixture.groups, EMPTY_FACET_VIEW_STATE, {
    peated: { kind: "terms", values: ["unknown"] },
  });
  const peated = termsGroup(view, "peated");
  const unknown = peated.options.find((option) => option.value === "unknown");
  assert.ok(unknown);
  assert.equal(unknown!.count, 0);
  assert.equal(unknown!.selected, true);
});

test("a selected facet with relevant:false remains represented and explicitly clearable", () => {
  const view = buildFacetGroupViewModels(catalogFacetV2Fixture.groups, EMPTY_FACET_VIEW_STATE, {
    limited: { kind: "terms", values: ["limited"] },
  });
  const limited = termsGroup(view, "limited");
  assert.equal(limited.relevant, true); // sanity: fixture's "limited" is relevant

  const abv = buildFacetGroupViewModels(catalogFacetV2Fixture.groups, EMPTY_FACET_VIEW_STATE, {
    abv: { kind: "range", min: "45", max: null },
  }).find((group) => group.key === "abv");
  assert.ok(abv && abv.kind === "range");
  assert.equal(abv!.relevant, false);
  assert.equal((abv as any).selectedMin, "45");
});

test("numeric zero selected values are not dropped as falsy", () => {
  const withZero = {
    kind: "terms" as const,
    key: "volume_ml",
    label: "용량",
    relevant: true,
    query: { parameter: "volume_ml", encoding: "repeat" as const },
    selection_mode: "multiple" as const,
    selected: [0],
    options: [{ value: 0, label: "0ml (샘플)", count: 2, selected: true }],
  };
  const view = buildFacetGroupViewModels([withZero], EMPTY_FACET_VIEW_STATE, {
    volume_ml: { kind: "terms", values: [0] },
  });
  const group = termsGroup(view, "volume_ml");
  assert.equal(group.options.length, 1);
  assert.equal(group.options[0]!.value, 0);
  assert.equal(group.options[0]!.selected, true);
});

test("a group entirely dropped by a later response is reconstructed from the retained cache", () => {
  const selection: ProductQueryState["facets"] = {
    peated: { kind: "terms", values: ["unknown"] },
  };
  const viewState = reconcileFacetViewState(EMPTY_FACET_VIEW_STATE, catalogFacetV2Fixture.groups);

  const groupsWithoutPeated = catalogFacetV2Fixture.groups.filter((g) => g.key !== "peated");
  const view = buildFacetGroupViewModels(groupsWithoutPeated, viewState, selection);

  const peated = termsGroup(view, "peated");
  assert.equal(peated.retained, true);
  assert.equal(peated.relevant, false);
  assert.equal(peated.label, "피트 상태");
  const unknown = peated.options.find((o) => o.value === "unknown");
  assert.ok(unknown);
  assert.equal(unknown!.label, "미상");
  assert.equal(unknown!.retained, true);
  assert.equal(unknown!.selected, true);
});

test("a single option dropped from an otherwise-live group is reconstructed from the retained cache", () => {
  const selection: ProductQueryState["facets"] = {
    distillery: { kind: "terms", values: [101] },
  };
  const viewState = reconcileFacetViewState(EMPTY_FACET_VIEW_STATE, catalogFacetV2Fixture.groups);

  const prunedGroups = catalogFacetV2Fixture.groups.map((g) =>
    g.kind === "terms" && g.key === "distillery" ? { ...g, options: [] } : g,
  );
  const view = buildFacetGroupViewModels(prunedGroups, viewState, selection);
  const distillery = termsGroup(view, "distillery");
  assert.equal(distillery.retained, false); // the group itself is still live
  assert.equal(distillery.options.length, 1);
  const option = distillery.options[0]!;
  assert.equal(option.value, 101);
  assert.equal(option.retained, true);
  assert.equal(option.label, "예시 증류소");
  assert.deepEqual(
    option.parents?.map((p) => p.key),
    ["country", "region"],
  );
});

test("forgetting a retained facet clears its cache; reset clears the whole cache", () => {
  const viewState = reconcileFacetViewState(EMPTY_FACET_VIEW_STATE, catalogFacetV2Fixture.groups);
  assert.ok("peated" in viewState.retained);

  const forgotten = forgetRetainedFacet(viewState, "peated");
  assert.ok(!("peated" in forgotten.retained));
  assert.ok("market" in forgotten.retained);

  assert.deepEqual(resetFacetViewState(), EMPTY_FACET_VIEW_STATE);
});

test("peated_state round-trips distinct peated/unpeated/unknown choices through the real query serializer", () => {
  const peatedGroup = catalogFacetV2Fixture.groups.find(
    (g) => g.kind === "terms" && g.key === "peated",
  );
  assert.ok(peatedGroup && peatedGroup.kind === "terms");
  const metadata: FacetQueryMetadata[] = [
    {
      kind: "terms",
      key: peatedGroup!.key,
      query: peatedGroup!.query,
      selection_mode: peatedGroup!.selection_mode,
      options: peatedGroup!.options,
    },
  ];

  for (const choice of ["peated", "unpeated", "unknown"] as const) {
    const state = setFacetSelection(EMPTY_PRODUCT_QUERY_STATE, "peated", {
      kind: "terms",
      values: [choice],
    });
    const serialized = serializeProductQueryState(state, metadata);
    assert.equal(serialized.toString(), `peated_state=${choice}`);
    const roundTripped = parseProductQueryState(serialized, metadata);
    assert.deepEqual(roundTripped.facets.peated, { kind: "terms", values: [choice] });

    const view = buildFacetGroupViewModels(
      [peatedGroup!],
      EMPTY_FACET_VIEW_STATE,
      roundTripped.facets,
    );
    const rendered = termsGroup(view, "peated");
    for (const option of rendered.options) {
      assert.equal(option.selected, option.value === choice);
    }
  }
});

test("every edition_state option supplied by the fixture renders and round-trips", () => {
  const editionGroup = catalogFacetV2Fixture.groups.find(
    (g) => g.kind === "terms" && g.key === "limited",
  );
  assert.ok(editionGroup && editionGroup.kind === "terms");
  const metadata: FacetQueryMetadata[] = [
    {
      kind: "terms",
      key: editionGroup!.key,
      query: editionGroup!.query,
      selection_mode: editionGroup!.selection_mode,
      options: editionGroup!.options,
    },
  ];

  const editionValues = editionGroup!.options.map((option) => option.value);
  assert.deepEqual(editionValues, ["standard", "limited"]);

  for (const choice of editionValues) {
    const state = setFacetSelection(EMPTY_PRODUCT_QUERY_STATE, "limited", {
      kind: "terms",
      values: [choice],
    });
    const serialized = serializeProductQueryState(state, metadata);
    const roundTripped = parseProductQueryState(serialized, metadata);
    assert.deepEqual(roundTripped.facets.limited, { kind: "terms", values: [choice] });
  }
});
