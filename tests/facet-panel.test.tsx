import "./setup-jsdom.mjs";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";

import { ProductFacetPanel } from "../app/components/ProductFacetPanel";
import type { FacetGroupV2, FacetResponseV2 } from "../app/lib/api/facet-contract";
import type { ProductQueryState } from "../app/lib/api/product-query";
import { catalogFacetV2Fixture, marketFacetV2Fixture } from "./fixtures/facet-responses";

afterEach(() => {
  cleanup();
});

/**
 * A real caller's `selection` prop always agrees with whatever produced the
 * response (it's the same normalized query state that was serialized into the
 * request). Deriving it from the fixture's own `selected` fields keeps these
 * harnesses realistic instead of asserting against an artificially empty prop.
 */
function selectionFromGroups(groups: readonly FacetGroupV2[]): ProductQueryState["facets"] {
  const selection: Record<string, ProductQueryState["facets"][string]> = {};
  for (const group of groups) {
    if (group.kind === "terms" && group.selected.length > 0) {
      selection[group.key] = { kind: "terms", values: [...group.selected] };
    } else if (
      group.kind === "range" &&
      (group.selected.min !== null || group.selected.max !== null)
    ) {
      selection[group.key] = { kind: "range", min: group.selected.min, max: group.selected.max };
    }
  }
  return selection;
}

function Harness({
  response,
  initialSelection,
}: {
  response: FacetResponseV2 | null;
  initialSelection?: ProductQueryState["facets"];
}) {
  const [selection, setSelection] = useState<ProductQueryState["facets"]>(
    () => initialSelection ?? (response ? selectionFromGroups(response.groups) : {}),
  );
  return (
    <div>
      <button type="button">outside sentinel</button>
      <ProductFacetPanel
        response={response}
        selection={selection}
        onSelectionChange={(key, next) =>
          setSelection((prev) => {
            const copy = { ...prev };
            if (next === null) delete copy[key];
            else copy[key] = next;
            return copy;
          })
        }
        onReset={() => setSelection({})}
        resultSummary="2개 상품"
      />
    </div>
  );
}

async function openDrawer() {
  const user = userEvent.setup();
  const trigger = screen.getByRole("button", { name: /필터/ });
  await user.click(trigger);
  return { user, trigger };
}

test("multi-select terms: option selection and deselection toggle independently", async () => {
  render(<Harness response={catalogFacetV2Fixture} />);
  await openDrawer();

  const marketB = screen.getByRole("checkbox", { name: "보조 마켓" }) as HTMLInputElement;
  assert.equal(marketB.checked, false);
  const user = userEvent.setup();
  await user.click(marketB);
  assert.equal(marketB.checked, true);
  await user.click(marketB);
  assert.equal(marketB.checked, false);

  // Unrelated already-selected market option is untouched by toggling the sibling.
  const marketA = screen.getByRole("checkbox", { name: "예시 마켓" }) as HTMLInputElement;
  assert.equal(marketA.checked, true);
});

test("single-select terms replace the prior choice via radio semantics", async () => {
  render(<Harness response={catalogFacetV2Fixture} />);
  await openDrawer();

  const user = userEvent.setup();
  const standard = screen.getByRole("radio", { name: "일반" }) as HTMLInputElement;
  const limited = screen.getByRole("radio", { name: "한정판" }) as HTMLInputElement;
  assert.equal(limited.checked, true);
  assert.equal(standard.checked, false);

  await user.click(standard);
  assert.equal(standard.checked, true);
  assert.equal(limited.checked, false);
});

test("range edits update the bound without clamping to bounds", async () => {
  render(<Harness response={marketFacetV2Fixture} />);
  await openDrawer();

  const user = userEvent.setup();
  const max = screen.getByRole("textbox", { name: /도수 최대/ }) as HTMLInputElement;
  assert.equal(max.value, "");
  await user.type(max, "99.9");
  assert.equal(max.value, "99.9");

  const min = screen.getByRole("textbox", { name: /도수 최소/ }) as HTMLInputElement;
  assert.equal(min.value, "46.0");
});

test("an individual clear removes only that facet's selection", async () => {
  render(<Harness response={catalogFacetV2Fixture} />);
  await openDrawer();

  const user = userEvent.setup();
  const limitedClear = within(
    screen.getByRole("radio", { name: "한정판" }).closest('[role="group"]')! as HTMLElement,
  ).getByRole("button", { name: /선택 해제/ });
  await user.click(limitedClear);

  assert.equal((screen.getByRole("radio", { name: "한정판" }) as HTMLInputElement).checked, false);
  // Untouched sibling facet keeps its selection.
  assert.equal((screen.getByRole("checkbox", { name: "예시 마켓" }) as HTMLInputElement).checked, true);
});

test("reset clears every selection including currently irrelevant ones", async () => {
  render(<Harness response={catalogFacetV2Fixture} />);
  const { user } = await openDrawer();

  const resetButton = screen.getByRole("button", { name: "초기화" });
  await user.click(resetButton);

  for (const role of ["checkbox", "radio"] as const) {
    for (const input of screen.queryAllByRole(role) as HTMLInputElement[]) {
      assert.equal(input.checked, false, `${role} should be cleared by reset`);
    }
  }
});

test("a selected option with count 0 remains visible and selected (peated unknown)", () => {
  render(
    <Harness
      response={catalogFacetV2Fixture}
      initialSelection={{ peated: { kind: "terms", values: ["unknown"] } }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /필터/ }));

  const unknown = screen.getByRole("radio", { name: /^미상/ }) as HTMLInputElement;
  assert.equal(unknown.checked, true);
});

test("peated_state renders and distinguishes peated / unpeated / unknown", () => {
  render(<Harness response={catalogFacetV2Fixture} />);
  fireEvent.click(screen.getByRole("button", { name: /필터/ }));

  assert.ok(screen.getByRole("radio", { name: "피트" }));
  assert.ok(screen.getByRole("radio", { name: "논피트" }));
  assert.ok(screen.getByRole("radio", { name: /^미상/ }));
});

test("every edition_state option supplied by the fixture renders", () => {
  render(<Harness response={catalogFacetV2Fixture} />);
  fireEvent.click(screen.getByRole("button", { name: /필터/ }));

  for (const option of catalogFacetV2Fixture.groups.find(
    (g) => g.kind === "terms" && g.key === "limited",
  )!.options as { label: string }[]) {
    assert.ok(screen.getByRole("radio", { name: option.label }), option.label);
  }
});

test("a selected facet marked relevant:false stays represented and clearable", () => {
  render(
    <Harness
      response={catalogFacetV2Fixture}
      initialSelection={{ abv: { kind: "range", min: "45", max: null } }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /필터/ }));

  const min = screen.getByRole("textbox", { name: /도수 최소/ }) as HTMLInputElement;
  assert.equal(min.value, "45");
  const group = min.closest('[role="group"]')! as HTMLElement;
  assert.ok(within(group).getByRole("button", { name: /선택 해제/ }));
  assert.ok(within(group).getByText("현재 선택과 맞지 않는 항목입니다"));
});

test("server labels render generically for an unfamiliar fixture without a code change", () => {
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
        selected: [],
        options: [{ value: "glorp", label: "Glorpwood 캐스크", count: 4, selected: false }],
      },
    ],
  } as const satisfies FacetResponseV2;

  render(<Harness response={exotic} />);
  fireEvent.click(screen.getByRole("button", { name: /필터/ }));

  assert.ok(screen.getByText("Zzyzx Vessel Class"));
  assert.ok(screen.getByRole("checkbox", { name: "Glorpwood 캐스크" }));
});

test("dependency parents render as a breadcrumb associated with their child option", () => {
  render(<Harness response={catalogFacetV2Fixture} />);
  fireEvent.click(screen.getByRole("button", { name: /필터/ }));

  const distillery = screen.getByRole("checkbox", { name: "예시 증류소" });
  const section = distillery.closest('[role="group"]')! as HTMLElement;
  assert.ok(within(section).getByText("예시 국가 › 예시 지역"));
});

test("a facet dropped entirely from a refreshed response is reconstructed as retained and stays clearable", async () => {
  const { rerender } = render(
    <Harness
      response={catalogFacetV2Fixture}
      initialSelection={{ peated: { kind: "terms", values: ["unknown"] } }}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /필터/ }));
  assert.ok(screen.getByRole("radio", { name: /^미상/ }));

  const prunedFixture = {
    ...catalogFacetV2Fixture,
    groups: catalogFacetV2Fixture.groups.filter((g) => g.key !== "peated"),
  } as FacetResponseV2;
  rerender(
    <Harness
      response={prunedFixture}
      initialSelection={{ peated: { kind: "terms", values: ["unknown"] } }}
    />,
  );

  const retainedOption = screen.getByRole("radio", { name: /^미상/ }) as HTMLInputElement;
  assert.equal(retainedOption.checked, true);
  assert.ok(screen.getByText("현재 결과에 없음"));

  const user = userEvent.setup();
  const clearButton = screen.getByRole("button", { name: "미상 선택 해제" });
  await user.click(clearButton);
  assert.equal(screen.queryByRole("radio", { name: /^미상/ }), null);
});

test("drawer: backdrop click, Escape, inert/aria-hidden, and body scroll lock/restore", async () => {
  render(<Harness response={catalogFacetV2Fixture} />);
  assert.equal(document.body.style.overflow, "");

  const { user } = await openDrawer();
  const dialog = screen.getByRole("dialog");
  assert.equal(dialog.getAttribute("aria-hidden"), "false");
  assert.equal(dialog.hasAttribute("inert"), false);
  assert.equal(document.body.style.overflow, "hidden");

  await user.keyboard("{Escape}");
  assert.equal(document.body.style.overflow, "");
  assert.equal(screen.getByRole("dialog", { hidden: true }).getAttribute("aria-hidden"), "true");
  assert.equal(screen.getByRole("dialog", { hidden: true }).hasAttribute("inert"), true);
});

test("drawer: backdrop click closes without changing selection", async () => {
  render(<Harness response={catalogFacetV2Fixture} />);
  const { user } = await openDrawer();

  const backdrop = document.querySelector('[aria-hidden="true"].fixed.inset-0.z-40') as HTMLElement;
  assert.ok(backdrop);
  await user.click(backdrop);

  assert.equal(screen.getByRole("dialog", { hidden: true }).getAttribute("aria-hidden"), "true");
});

test("drawer: focus enters the dialog, is contained by Tab, and returns to the trigger on close", async () => {
  render(<Harness response={catalogFacetV2Fixture} />);
  const { user, trigger } = await openDrawer();

  const dialog = screen.getByRole("dialog");
  assert.ok(dialog.contains(document.activeElement));

  for (let i = 0; i < 40; i++) {
    await user.tab();
    assert.ok(
      dialog.contains(document.activeElement),
      `focus escaped the dialog on tab press ${i}`,
    );
  }

  await user.keyboard("{Escape}");
  assert.equal(document.activeElement, trigger);
});

test("dialog has an accessible name via aria-labelledby", async () => {
  render(<Harness response={catalogFacetV2Fixture} />);
  await openDrawer();
  const dialog = screen.getByRole("dialog", { name: "필터" });
  assert.ok(dialog);
});

for (const width of [375, 1280]) {
  test(`keyboard-only open, change, clear, and close work at viewport width ${width}`, async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
    window.dispatchEvent(new window.Event("resize"));

    render(<Harness response={catalogFacetV2Fixture} />);
    const user = userEvent.setup();
    const trigger = screen.getByRole("button", { name: /필터/ });
    trigger.focus();
    await user.keyboard("{Enter}");

    const dialog = screen.getByRole("dialog");
    assert.equal(dialog.getAttribute("aria-hidden"), "false");

    const marketB = screen.getByRole("checkbox", { name: "보조 마켓" }) as HTMLInputElement;
    marketB.focus();
    await user.keyboard(" ");
    assert.equal(marketB.checked, true);

    await user.keyboard("{Escape}");
    assert.equal(screen.getByRole("dialog", { hidden: true }).getAttribute("aria-hidden"), "true");
    assert.equal(document.activeElement, trigger);
  });
}

test("an unhandled discriminator variant renders a safe error state instead of crashing", () => {
  const malformed = {
    ...catalogFacetV2Fixture,
    groups: [...catalogFacetV2Fixture.groups, { kind: "unknown-future-kind", key: "x" } as never],
  } as FacetResponseV2;

  render(<Harness response={malformed} />);
  fireEvent.click(screen.getByRole("button", { name: /필터/ }));
  assert.ok(screen.getByRole("alert"));
});

test("accessibility: representative fixtures report no serious/critical violations", async () => {
  render(<Harness response={catalogFacetV2Fixture} />);
  await openDrawer();

  const results = await axe.run(document.body, {
    rules: {
      "color-contrast": { enabled: false },
      region: { enabled: false },
      "landmark-one-main": { enabled: false },
      "page-has-heading-one": { enabled: false },
    },
  });

  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  assert.deepEqual(
    serious.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    [],
  );
});
