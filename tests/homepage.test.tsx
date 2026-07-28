import "./setup-jsdom.mjs";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";

import Home from "../app/(home)/page";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("lang");
});

test("homepage keeps exactly one named image for each frog and omits the retired marketing copy", () => {
  render(<Home />);

  const images = screen.getAllByRole("img");
  assert.equal(images.length, 3);
  for (const name of ["Bramble", "Cooper", "Pip"]) {
    assert.equal(screen.getAllByRole("img", { name }).length, 1);
    assert.equal(screen.queryByText(name), null);
  }

  const retiredCopy = [
    "Whisky Kingdom",
    "Good whisky, good friends, good time.",
    "A cozy whisky kingdom for finding your next dram.",
    "Good Whisky",
    "Good Friends",
    "Good Time",
    "Royal Tavern",
    "오늘의 한 잔을 찾는 세 친구",
    "Enjoy Whisky",
    "Know Whisky",
    "Welcome Guests",
    "취향을 존중하는 왕",
    "향과 캐스크를 기억하는 바텐더",
    "처음 온 손님에게 가장 먼저 인사하는 집사",
  ];
  for (const text of retiredCopy) {
    assert.equal(screen.queryByText(new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))), null);
  }
});

test("homepage has one concisely named main landmark and decorative layers stay out of the accessibility tree", () => {
  const { container } = render(<Home />);

  assert.equal(screen.getAllByRole("main").length, 1);
  assert.ok(screen.getByRole("main", { name: "Whisky Frog" }));
  assert.ok(screen.getByRole("heading", { level: 1, name: "Whisky Frog" }));
  assert.equal(screen.getAllByRole("img").length, 3);

  const decorativeLayers = container.querySelectorAll('[aria-hidden="true"]');
  assert.ok(decorativeLayers.length > 0);
  for (const layer of decorativeLayers) {
    assert.equal(layer.querySelectorAll("img, a, button, [tabindex]").length, 0);
  }
});

test("primary links expose their destinations and activate in source order using only the keyboard", async () => {
  render(<Home />);
  const marketLink = screen.getByRole("link", { name: "마켓 둘러보기" });
  const directPriceLink = screen.getByRole("link", { name: "직구가 계산하기" });

  assert.equal(marketLink.getAttribute("href"), "/markets/muk");
  assert.equal(directPriceLink.getAttribute("href"), "/direct-price");

  const activations: string[] = [];
  const recordActivation = (event: MouseEvent) => {
    const target = (event.target as Element).closest("a");
    if (target === marketLink || target === directPriceLink) {
      event.preventDefault();
      activations.push(target.getAttribute("href") ?? "");
    }
  };
  document.addEventListener("click", recordActivation);

  try {
    const user = userEvent.setup();
    await user.tab();
    assert.equal(document.activeElement, marketLink);
    await user.keyboard("{Enter}");

    await user.tab();
    assert.equal(document.activeElement, directPriceLink);
    await user.keyboard("{Enter}");

    assert.deepEqual(activations, ["/markets/muk", "/direct-price"]);
  } finally {
    document.removeEventListener("click", recordActivation);
  }
});

test("rendered homepage reports no serious or critical automated accessibility violations", async () => {
  document.documentElement.lang = "ko";
  render(<Home />);

  const results = await axe.run(document.body, {
    rules: {
      // jsdom has no layout engine, so contrast is asserted from real computed
      // browser styles in the focused Playwright coverage.
      "color-contrast": { enabled: false },
    },
  });
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );

  assert.deepEqual(
    serious.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => node.target),
    })),
    [],
  );
});
