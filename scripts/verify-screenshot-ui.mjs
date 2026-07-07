import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(__dirname, "..");
const screenshotSource = await readFile(path.join(rootDirectory, "src", "screenshot.js"), "utf8");

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

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function settle(window) {
  await Promise.resolve();
  await nextFrame(window);
  await nextFrame(window);
}

const dom = new JSDOM("<!doctype html><html><body><div id=\"screenshot-app\"></div></body></html>", {
  url: "http://127.0.0.1:5173/screenshot.html",
  runScripts: "dangerously",
  pretendToBeVisual: true,
});

const { window } = dom;
Object.defineProperty(window, "innerWidth", { value: 1000, configurable: true });
Object.defineProperty(window, "innerHeight", { value: 500, configurable: true });
window.HTMLElement.prototype.setPointerCapture = function setPointerCapture() {};
window.HTMLCanvasElement.prototype.getContext = function getContext() {
  return {
    canvas: this,
    save() {},
    restore() {},
    drawImage() {},
    fillRect() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    clip() {},
    ellipse() {},
    arc() {},
    stroke() {},
    fill() {},
    closePath() {},
    fillText() {},
    strokeText() {},
    translate() {},
    rotate() {},
    getImageData() {
      return { data: [18, 52, 86, 255] };
    },
  };
};
window.HTMLCanvasElement.prototype.toDataURL = function toDataURL() {
  return "data:image/png;base64,verified";
};
window.HTMLCanvasElement.prototype.toBlob = undefined;

const completed = [];
let cancelCount = 0;
let readyCount = 0;
let restartCount = 0;
window.gekeScreenshot = {
  getSession: async () => ({
    imageDataUrl: "",
    imageWidth: 2000,
    imageHeight: 1000,
    settings: {
      watermarkText: "极刻测试水印",
      toolShortcuts: {
        delay: { shortcut: "D", enabled: false },
        pin: { shortcut: "P", enabled: false },
        copy: { shortcut: "Return", enabled: false },
      },
    },
  }),
  complete: async (selection, action, compositedImageDataUrl) => {
    completed.push({ selection, action, compositedImageDataUrl });
    return { copied: action === "copy", savedPath: action === "save" ? "/tmp/gege.png" : null };
  },
  cancel: async () => {
    cancelCount += 1;
    return true;
  },
  ready: async () => {
    readyCount += 1;
    return true;
  },
  restartAfterDelay: async () => {
    restartCount += 1;
    return true;
  },
};

const script = window.document.createElement("script");
script.textContent = screenshotSource;
window.document.body.append(script);
await settle(window);

const stage = window.document.querySelector(".screenshot-stage");
const selection = window.document.querySelector(".screenshot-selection");
assert(stage, "screenshot stage should render");
assert(selection, "selection rectangle should render");
assert(window.document.querySelector(".screenshot-topbar"), "top size bar should render");
assert(window.document.querySelector(".screenshot-toolbar"), "bottom toolbar should render");
assert(window.document.querySelector(".screenshot-stylebar"), "style toolbar should render");
assert(window.document.querySelector(".screenshot-shades"), "screen dimming shades should render");
assert(window.document.querySelector(".screenshot-inspector"), "pointer color inspector should render");
assert(readyCount === 1, "screenshot window should be shown only after the UI is ready");
assert(window.__screenshotTest.getState().selection === null, "screenshot should start without a default selection");
assert(selection.dataset.visible === "false", "selection should be hidden before the user drags");
assert(window.document.querySelector(".screenshot-topbar").dataset.visible === "false", "size bar should be hidden before selecting");
assert(window.document.querySelector(".screenshot-toolbar").dataset.visible === "false", "toolbar should be hidden before selecting");
assert(window.document.querySelector('[data-shade="top"]').style.width === "1000px", "the whole screen should be dimmed before selecting");

window.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: 50, clientY: 10 }));
await settle(window);
assert(window.document.querySelector(".screenshot-inspector").dataset.visible === "false", "menu bar area should not show the color inspector");

window.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: 50, clientY: 60 }));
await settle(window);
assert(window.document.querySelector(".screenshot-inspector").dataset.visible === "false", "menu bar safe area should keep the color inspector hidden");

window.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: 50, clientY: 90 }));
await settle(window);
assert(window.document.querySelector(".screenshot-inspector").dataset.visible === "true", "moving the pointer should show the color and coordinate inspector");
assert(window.document.querySelector(".screenshot-inspector-coordinates").textContent.trim() === "100, 180", "inspector should show image pixel coordinates");

window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
await settle(window);
assert(completed.length === 0, "enter should not complete before a selection exists");

stage.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX: 20, clientY: 0 }));
window.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: 180, clientY: 48 }));
window.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true, clientX: 180, clientY: 48 }));
await settle(window);
const topSelectionState = window.__screenshotTest.getState().selection;
const topbarTop = Number.parseFloat(window.document.querySelector(".screenshot-topbar").style.top || "0");
const topEdgeEffects = window.__screenshotTest.exportEffectsForPixels();
assert(topSelectionState.y <= 72, "test selection should touch the menu bar safe area");
assert(topbarTop >= topSelectionState.y + topSelectionState.height, "top-edge screenshots should place controls below the selected menu bar area");
assert(topEdgeEffects.touchesScreenEdge, "top-edge screenshots should be treated as screen-edge captures");
assert(!topEdgeEffects.rounded && !topEdgeEffects.shadow, "screen-edge captures should export without rounded corners or shadows");

stage.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 90 }));
window.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: 420, clientY: 260 }));
window.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true, clientX: 420, clientY: 260 }));
await settle(window);

let state = window.__screenshotTest.getState();
assert(state.activeTool === "", "screenshot should start without a default tool");
assert(
  [...window.document.querySelectorAll("[data-screenshot-tool]")].every((button) => button.dataset.active === "false"),
  "screenshot toolbar should not highlight a tool by default",
);
assert(state.selection.x === 100 && state.selection.y === 90, "dragging on stage should create selection at drag origin");
assert(state.selection.width === 320 && state.selection.height === 170, "dragging on stage should size the selection");
assert(state.recentSelections.length === 2, "screenshot should remember recent selections");
assert(state.recentSelections[0].x === 100 && state.recentSelections[0].y === 90, "latest selection should be the first recent selection");
assert(window.document.querySelector('[data-style-action="reuse-selection"] kbd').textContent.trim() === "1/5", "recent selection control should show one of five slots");
assert(selection.dataset.visible === "true", "selection should be visible after dragging");
assert(window.document.querySelector(".screenshot-toolbar").dataset.visible === "true", "toolbar should appear after selecting");
assert(window.document.querySelector(".screenshot-stylebar").dataset.visible === "false", "move tool should not show the style toolbar");
assert(!window.document.querySelector('[data-screenshot-action="delay"]'), "disabled delay action should not render");
assert(!window.document.querySelector('[data-screenshot-action="pin"]'), "disabled pin action should not render");
assert(!window.document.querySelector('[data-screenshot-action="copy"]'), "disabled copy action should not render");
assert(window.document.querySelector('[data-screenshot-action="download"]'), "enabled download action should render");
assert(selection.dataset.rounded === "true", "selection should use rounded corners by default");
assert(window.document.querySelector(".screenshot-size").textContent.trim() === "640 x 340", "size bar should show pixel dimensions");
assert(window.document.querySelector('[data-shade="left"]').style.width === "100px", "selection should cut a bright hole out of the dimming overlay");

window.document.querySelector('[data-style-action="reuse-selection"]').click();
await settle(window);
state = window.__screenshotTest.getState();
assert(state.selection.x === topSelectionState.x && state.selection.y === topSelectionState.y, "recent selection control should switch to the previous area");
window.document.querySelector('[data-style-action="reuse-selection"]').click();
await settle(window);
state = window.__screenshotTest.getState();
assert(state.selection.x === 100 && state.selection.y === 90, "recent selection control should cycle back to the latest area");

window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "d", code: "KeyD", bubbles: true, cancelable: true }));
window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "p", code: "KeyP", bubbles: true, cancelable: true }));
await settle(window);
assert(completed.length === 0, "disabled copy shortcut should not complete the capture");
assert(restartCount === 0, "disabled delay shortcut should not restart capture");
assert(window.__screenshotTest.getState().busy === false, "disabled screenshot shortcuts should not leave the UI busy");

window.document.querySelector('[data-screenshot-tool="rectangle"]').click();
await settle(window);
assert(window.document.querySelector(".screenshot-stylebar").dataset.visible === "true", "annotation tools should show their style toolbar");

const toolbar = window.document.querySelector(".screenshot-toolbar");
toolbar.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: 220, clientY: 310 }));
await settle(window);
assert(window.document.querySelector(".screenshot-inspector").dataset.visible === "false", "function toolbar should hide the color inspector");

window.document.querySelector('[data-screenshot-tool="move"]').click();
await settle(window);
assert(window.document.querySelector(".screenshot-stylebar").dataset.visible === "false", "moving mode should hide the style toolbar before moving the selection");

const handle = window.document.querySelector('[data-handle="se"]');
handle.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX: 420, clientY: 260 }));
window.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: 470, clientY: 300 }));
window.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true, clientX: 470, clientY: 300 }));
await settle(window);

state = window.__screenshotTest.getState();
assert(state.selection.width === 370 && state.selection.height === 210, "corner handle should resize the selection");

selection.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientX: 160, clientY: 120 }));
window.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientX: 190, clientY: 150 }));
window.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true, clientX: 190, clientY: 150 }));
await settle(window);

state = window.__screenshotTest.getState();
assert(state.selection.x === 130 && state.selection.y === 120, "dragging inside selection should move it");

for (const tool of ["note", "step", "rectangle", "circle", "arrow", "text", "highlight", "mosaic", "brush", "watermark"]) {
  const button = window.document.querySelector(`[data-screenshot-tool="${tool}"]`);
  assert(button?.dataset.enabled === "true", `${tool} tool should be enabled`);
}

window.document.querySelector('[data-screenshot-tool="rectangle"]').click();
await settle(window);
window.document.querySelector('[data-style-action="color"][data-color="#0a84ff"]').click();
window.document.querySelector('[data-style-action="stroke-size"][data-size-id="large"]').click();
await settle(window);
state = window.__screenshotTest.getState();
assert(state.toolStyles.rectangle.annotationColor === "#0a84ff", "rectangle color selection should be stored separately");
assert(state.toolStyles.rectangle.strokeSize === "large", "rectangle stroke size selection should be stored separately");

window.document.querySelector('[data-screenshot-tool="arrow"]').click();
await settle(window);
state = window.__screenshotTest.getState();
assert(state.toolStyles.arrow.annotationColor === "#ff453a", "switching tools should keep a separate default color");
assert(state.toolStyles.arrow.strokeSize === "small", "arrow should default to the smaller stroke size");
assert(window.document.querySelector('[data-style-action="color"][data-color="#ff453a"]').dataset.active === "true", "style bar should reflect the active tool style");

window.document.querySelector('[data-screenshot-tool="move"]').click();
await settle(window);
assert(window.document.querySelector(".screenshot-stylebar").dataset.visible === "false", "moving mode should hide the style toolbar after switching back");
window.document.querySelector('[data-screenshot-tool="rectangle"]').click();
await settle(window);

window.document.querySelector('[data-style-action="toggle-rounded"]').click();
window.document.querySelector('[data-style-action="toggle-shadow"]').click();
await settle(window);
state = window.__screenshotTest.getState();
assert(state.style.roundedSelection === false && state.style.exportShadow === false, "rounded and shadow controls should toggle off");
assert(selection.dataset.rounded === "false", "rounded toggle should update the selection shape");
window.document.querySelector('[data-style-action="toggle-rounded"]').click();
window.document.querySelector('[data-style-action="toggle-shadow"]').click();
await settle(window);

async function drawTool(tool, start, end = start, text = "") {
  window.document.querySelector(`[data-screenshot-tool="${tool}"]`).click();
  await settle(window);
  const currentSelection = window.__screenshotTest.getState().selection;
  selection.dispatchEvent(new window.MouseEvent("pointerdown", {
    bubbles: true,
    clientX: currentSelection.x + start.x,
    clientY: currentSelection.y + start.y,
  }));
  window.dispatchEvent(new window.MouseEvent("pointermove", {
    bubbles: true,
    clientX: currentSelection.x + end.x,
    clientY: currentSelection.y + end.y,
  }));
  window.dispatchEvent(new window.MouseEvent("pointerup", {
    bubbles: true,
    clientX: currentSelection.x + end.x,
    clientY: currentSelection.y + end.y,
  }));
  await settle(window);
  const editor = window.document.querySelector(".screenshot-text-editor");
  if (editor) {
    if (tool === "text") {
      assert(!window.document.querySelector(".screenshot-annotation-layer").textContent.includes("文本"), "text editor should not duplicate the underlying SVG text");
    }
    editor.value = text || `${tool} text`;
    editor.dispatchEvent(new window.Event("input", { bubbles: true }));
    editor.dispatchEvent(new window.FocusEvent("blur", { bubbles: true }));
    await settle(window);
  }
}

await drawTool("note", { x: 20, y: 28 }, { x: 150, y: 74 }, "备注内容");
await drawTool("step", { x: 210, y: 42 });
await drawTool("rectangle", { x: 34, y: 96 }, { x: 170, y: 166 });
await drawTool("circle", { x: 190, y: 96 }, { x: 318, y: 182 });
await drawTool("arrow", { x: 22, y: 192 }, { x: 180, y: 192 });
await drawTool("text", { x: 230, y: 20 }, { x: 354, y: 56 }, "文本内容");
await drawTool("highlight", { x: 212, y: 70 }, { x: 350, y: 105 });
await drawTool("mosaic", { x: 214, y: 122 }, { x: 350, y: 170 });
await drawTool("brush", { x: 26, y: 174 }, { x: 160, y: 202 });
await drawTool("watermark", { x: 20, y: 12 }, { x: 188, y: 52 });

state = window.__screenshotTest.getState();
const annotationTypes = new Set(state.annotations.map((annotation) => annotation.type));
for (const tool of ["note", "step", "rectangle", "circle", "arrow", "text", "highlight", "mosaic", "brush", "watermark"]) {
  assert(annotationTypes.has(tool), `${tool} annotation should be created`);
}
const rectangleAnnotation = state.annotations.find((annotation) => annotation.type === "rectangle");
assert(rectangleAnnotation?.style?.color === "#0a84ff", "new annotations should use the selected color");
assert(rectangleAnnotation?.style?.strokeWidth === 5, "new annotations should use the selected stroke width");
const layerMarkup = window.document.querySelector(".screenshot-annotation-layer").innerHTML;
assert(layerMarkup.includes("screenshot-highlight-mask"), "highlight should use a mask that keeps the selected area bright");
assert(layerMarkup.includes('fill="none"') && layerMarkup.includes(">备注内容<"), "note should render with a transparent background");
assert(layerMarkup.includes('markerWidth="9"'), "arrow marker should be smaller than the previous large arrowhead");
assert(layerMarkup.includes("极刻测试水印"), "watermark should use the plugin setting text");
assert((layerMarkup.match(/极刻测试水印/g) || []).length > 4, "watermark should tile across the selected screenshot area");

const undoButton = window.document.querySelector('[data-style-action="undo-annotation"]');
const redoButton = window.document.querySelector('[data-style-action="redo-annotation"]');
assert(undoButton?.dataset.disabled === "false", "undo should become available after adding annotations");
assert(redoButton?.dataset.disabled === "true", "redo should be unavailable before undo");
undoButton.click();
await settle(window);
state = window.__screenshotTest.getState();
assert(!state.annotations.some((annotation) => annotation.type === "watermark"), "undo should remove the latest annotation operation");
assert(redoButton.dataset.disabled === "false", "redo should become available after undo");
redoButton.click();
await settle(window);
state = window.__screenshotTest.getState();
assert(state.annotations.some((annotation) => annotation.type === "watermark"), "redo should restore the undone annotation operation");

window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "z", code: "KeyZ", metaKey: true, bubbles: true, cancelable: true }));
await settle(window);
state = window.__screenshotTest.getState();
assert(!state.annotations.some((annotation) => annotation.type === "watermark"), "Command+Z should undo the latest annotation operation");
window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "z", code: "KeyZ", metaKey: true, shiftKey: true, bubbles: true, cancelable: true }));
await settle(window);
state = window.__screenshotTest.getState();
assert(state.annotations.some((annotation) => annotation.type === "watermark"), "Shift+Command+Z should redo the latest annotation operation");

window.document.querySelector('[data-screenshot-action="download"]').click();
await delay(160);
await settle(window);

assert(completed.length === 1, "save action should complete one capture");
assert(completed[0].action === "save", "save action should be sent to backend");
assert(completed[0].compositedImageDataUrl === "data:image/png;base64,verified", "annotated captures should send a composited png to backend");
assert(completed[0].selection.x === 260 && completed[0].selection.y === 240, "selection should be converted to image pixels");
assert(completed[0].selection.width === 740 && completed[0].selection.height === 420, "selection dimensions should be converted to image pixels");

window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
await settle(window);
assert(cancelCount === 0, "escape should not cancel while completion is busy");

const escapeDom = new JSDOM("<!doctype html><html><body><div id=\"screenshot-app\"></div></body></html>", {
  url: "http://127.0.0.1:5173/screenshot.html",
  runScripts: "dangerously",
  pretendToBeVisual: true,
});
const { window: escapeWindow } = escapeDom;
Object.defineProperty(escapeWindow, "innerWidth", { value: 1000, configurable: true });
Object.defineProperty(escapeWindow, "innerHeight", { value: 500, configurable: true });
escapeWindow.HTMLElement.prototype.setPointerCapture = function setPointerCapture() {};
escapeWindow.HTMLCanvasElement.prototype.getContext = window.HTMLCanvasElement.prototype.getContext;
escapeWindow.HTMLCanvasElement.prototype.toDataURL = window.HTMLCanvasElement.prototype.toDataURL;
escapeWindow.HTMLCanvasElement.prototype.toBlob = undefined;

let escapeCancelCount = 0;
escapeWindow.gekeScreenshot = {
  getSession: async () => ({
    imageDataUrl: "",
    imageWidth: 2000,
    imageHeight: 1000,
    settings: {
      toolShortcuts: {
        cancel: { shortcut: "Escape", enabled: false },
      },
    },
  }),
  complete: async () => true,
  cancel: async () => {
    escapeCancelCount += 1;
    return true;
  },
  ready: async () => true,
  restartAfterDelay: async () => true,
};
const escapeScript = escapeWindow.document.createElement("script");
escapeScript.textContent = screenshotSource;
escapeWindow.document.body.append(escapeScript);
await settle(escapeWindow);
escapeWindow.dispatchEvent(new escapeWindow.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
await settle(escapeWindow);
assert(escapeCancelCount === 1, "escape should cancel screenshots even when the configurable cancel action is disabled");

console.log("screenshot UI verification passed");
