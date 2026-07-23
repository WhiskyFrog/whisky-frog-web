import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

test("the baseline compiles TSX and renders a pure React component without a DOM", () => {
  const Badge = ({ count }: { count: number }) => (
    <span data-count={count}>Count: {count}</span>
  );

  assert.equal(
    renderToStaticMarkup(<Badge count={2} />),
    '<span data-count="2">Count: 2</span>',
  );
});
