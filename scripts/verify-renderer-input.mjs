import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(__dirname, "..");
const rendererSource = await readFile(path.join(rootDirectory, "src", "renderer.js"), "utf8");

function createPayload(query) {
  return {
    query,
    results: query
      ? [
          {
            id: "fixture-app",
            name: `Fixture ${query}`,
            path: `/Applications/Fixture ${query}.app`,
            directory: "/Applications",
          },
        ]
      : [],
    totalCount: 1,
    scannedPaths: ["/Applications"],
    lastScanAt: new Date("2026-07-06T00:00:00.000Z").toISOString(),
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function nextFrame(window) {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

let resolveInitialApps;
const searchQueries = [];

const dom = new JSDOM("<!doctype html><html><body><div id=\"app\"></div></body></html>", {
  url: "http://127.0.0.1:5173/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
});

const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
window.geke = {
  getInitialApps: () =>
    new Promise((resolve) => {
      resolveInitialApps = resolve;
    }),
  searchApplications: async (query = "") => {
    searchQueries.push(query);
    return createPayload(query);
  },
  launchApplication: async () => true,
  rescanApplications: async () => createPayload(""),
  hideLauncher: async () => true,
  onWindowVisible: () => {},
};

const script = window.document.createElement("script");
script.textContent = rendererSource;
window.document.body.append(script);

await nextFrame(window);
await nextFrame(window);

const input = window.document.querySelector(".search-input");
assert(input, "search input should render");
assert(input.disabled === false, "search input should not be disabled");
assert(input.readOnly === false, "search input should not be readOnly");

input.focus();
const keydown = new window.KeyboardEvent("keydown", {
  key: "a",
  code: "KeyA",
  bubbles: true,
  cancelable: true,
});
input.dispatchEvent(keydown);
assert(keydown.defaultPrevented === false, "plain character keydown should not be prevented");

input.value = "abc";
input.dispatchEvent(
  new window.InputEvent("input", {
    bubbles: true,
    inputType: "insertText",
    data: "c",
  }),
);

assert(searchQueries.includes("abc"), "input event should update query before searching");

resolveInitialApps(createPayload(""));
await nextFrame(window);
await Promise.resolve();
await nextFrame(window);

assert(input.value === "abc", "stale initial payload should not clear the active input value");

console.log("renderer input verification passed");
