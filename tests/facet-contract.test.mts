import assert from "node:assert/strict";
import test from "node:test";

import {
  FACET_OPERATION_IDS,
  FACET_ROUTES,
} from "../app/lib/api/facet-contract.ts";
import {
  catalogFacetV2Fixture,
  legacyCatalogFacetFixture,
  marketFacetV2Fixture,
} from "./fixtures/facet-responses.ts";

test("the generated contract retains both v2 operations and legacy fallbacks", () => {
  assert.deepEqual(Object.values(FACET_ROUTES), [
    "/api/v2/products/facets",
    "/api/v2/markets/{market_code}/facets",
    "/api/products/facets",
    "/api/markets/{market_code}/facets",
  ]);
  assert.equal(FACET_OPERATION_IDS.length, 4);
  assert.equal(legacyCatalogFacetFixture.total, 2);
});

test("scope totals retain their distinct-product and per-market-offer meanings", () => {
  assert.equal(catalogFacetV2Fixture.count_unit, "product");
  assert.equal(marketFacetV2Fixture.count_unit, "offer");
  assert.equal(catalogFacetV2Fixture.count_mode, "disjunctive");
  assert.equal(marketFacetV2Fixture.count_mode, "disjunctive");
  assert.equal(catalogFacetV2Fixture.version, "2");
  assert.equal(marketFacetV2Fixture.version, "2");
});

test("structured groups carry renderer and serializer metadata", () => {
  const groups = [...catalogFacetV2Fixture.groups, ...marketFacetV2Fixture.groups];
  assert.deepEqual(new Set(groups.map((group) => group.kind)), new Set(["terms", "range"]));
  assert.deepEqual(
    new Set(groups.map((group) => group.selection_mode)),
    new Set(["single", "multiple", "range"]),
  );

  for (const group of groups) {
    assert.ok(group.label.length > 0);
    assert.equal(typeof group.relevant, "boolean");
    if (group.kind === "terms") {
      assert.ok(group.query.parameter.length > 0);
      assert.ok(["repeat", "single"].includes(group.query.encoding));
      for (const option of group.options) {
        assert.ok(option.label.length > 0);
        assert.equal(typeof option.selected, "boolean");
      }
    } else {
      assert.ok(group.query.min_parameter.length > 0);
      assert.ok(group.query.max_parameter.length > 0);
      assert.ok(["years", "percent"].includes(group.unit));
      assert.ok("min" in group.bounds && "max" in group.bounds);
    }
  }

  const peated = catalogFacetV2Fixture.groups.find(
    (group) => group.kind === "terms" && group.key === "peated",
  );
  assert.equal(peated?.query.parameter, "peated_state");
  assert.ok(peated?.options.some(
    (option) => option.value === "unknown" && option.selected && option.count === 0,
  ));

  const edition = catalogFacetV2Fixture.groups.find(
    (group) => group.kind === "terms" && group.key === "limited",
  );
  assert.equal(edition?.query.parameter, "edition_state");
  assert.ok(edition?.options.some((option) => option.selected && option.count === 0));

  const distillery = catalogFacetV2Fixture.groups.find(
    (group) => group.kind === "terms" && group.key === "distillery",
  );
  assert.deepEqual(
    distillery?.options[0]?.parents?.map((parent) => parent.key),
    ["country", "region"],
  );
});
