import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});

const { window } = dom;

function defineGlobal(key, value) {
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
    enumerable: true,
  });
}

for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "KeyboardEvent", "MouseEvent", "CustomEvent", "DocumentFragment", "getComputedStyle"]) {
  defineGlobal(key, window[key]);
}
defineGlobal("requestAnimationFrame", window.requestAnimationFrame ?? ((cb) => setTimeout(() => cb(Date.now()), 0)));
defineGlobal("cancelAnimationFrame", window.cancelAnimationFrame ?? ((id) => clearTimeout(id)));

// React DOM's test environment check.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
