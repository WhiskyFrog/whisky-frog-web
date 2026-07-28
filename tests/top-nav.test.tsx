import "./setup-jsdom.mjs";

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TopNav } from "../app/components/TopNav";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  window.localStorage.clear();
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify([
        {
          id: 1,
          code: "muk",
          name: "머크",
          currency: "GBP",
          country: "GB",
        },
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  globalThis.fetch = originalFetch;
});

test("TopNav owns one native link for each public destination", async () => {
  render(<TopNav />);

  const navigation = screen.getByRole("navigation");
  const scoped = within(navigation);
  const priceLinks = scoped.getAllByRole("link", {
    name: "가격 비교",
  });
  const directPriceLinks = scoped.getAllByRole("link", {
    name: "직구가 계산",
  });

  assert.equal(priceLinks.length, 1);
  assert.equal(directPriceLinks.length, 1);
  assert.equal(priceLinks[0]?.tagName, "A");
  assert.equal(directPriceLinks[0]?.tagName, "A");
  assert.equal(priceLinks[0]?.getAttribute("href"), "/products");
  assert.equal(directPriceLinks[0]?.getAttribute("href"), "/direct-price");

  assert.ok(
    await scoped.findByRole("link", {
      name: /머크.*GBP/,
    }),
  );
});

test("TopNav keeps the unauthenticated administrator action connected to its login modal", async () => {
  render(<TopNav />);
  const navigation = screen.getByRole("navigation");
  const user = userEvent.setup();

  await user.click(
    within(navigation).getByRole("button", {
      name: "관리자",
    }),
  );

  assert.ok(
    screen.getByRole("heading", {
      name: "관리자 로그인",
    }),
  );
});
