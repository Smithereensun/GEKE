const appElement = document.querySelector("#screenshot-app");
const bridge = window.gekeScreenshot ?? createTauriBridge() ?? createFallbackBridge();

const MIN_SELECTION_SIZE = 24;
const MIN_ANNOTATION_SIZE = 8;
const DEFAULT_ANNOTATION_COLOR = "#ff453a";
const DEFAULT_SELECTION_RADIUS = 22;
const DEFAULT_WATERMARK_TEXT = "极刻 GEKE";
const WATERMARK_GAP_X = 180;
const WATERMARK_GAP_Y = 92;
const TOP_EDGE_SAFE_AREA = 72;
const SCREEN_EDGE_EPSILON = 1;
const RECENT_SELECTION_LIMIT = 5;
const TOOL_ITEMS = [
  { id: "move", key: "V", icon: "✥", label: "移动" },
  { id: "note", key: "1", icon: "▱", label: "备注" },
  { id: "step", key: "2", icon: "①", label: "步骤" },
  { id: "rectangle", key: "3", icon: "▭", label: "矩形" },
  { id: "circle", key: "4", icon: "○", label: "圆形" },
  { id: "arrow", key: "5", icon: "↗", label: "箭头" },
  { id: "text", key: "6", icon: "T", label: "文案" },
  { id: "highlight", key: "7", icon: "▰", label: "高亮" },
  { id: "mosaic", key: "8", icon: "▦", label: "马赛克" },
  { id: "brush", key: "9", icon: "✎", label: "画笔" },
  { id: "watermark", key: "0", icon: "≈", label: "水印" },
];
const ACTION_ITEMS = [
  { id: "delay", key: "D", icon: "◷", label: "延迟截图", className: "screenshot-action--secondary" },
  { id: "pin", key: "P", icon: "⌖", label: "钉图", className: "screenshot-action--secondary" },
  { id: "download", key: "CmdOrCtrl+S", icon: "⇩", label: "下载", className: "screenshot-action--save" },
  { id: "copy", key: "Return", icon: "✓", label: "复制", className: "screenshot-action--done" },
  { id: "cancel", key: "Escape", icon: "×", label: "退出", className: "screenshot-action--danger" },
];
const STYLE_COLORS = ["#ff453a", "#ff9f0a", "#30d158", "#0a84ff", "#bf5af2", "#ffffff", "#111827"];
const STROKE_SIZES = [
  { id: "small", label: "小", value: 2 },
  { id: "medium", label: "中", value: 3 },
  { id: "large", label: "大", value: 5 },
];
const DEFAULT_TOOL_STYLE = {
  annotationColor: DEFAULT_ANNOTATION_COLOR,
  strokeSize: "medium",
};
const NO_ACTIVE_TOOL = "";

const state = {
  session: null,
  selection: null,
  drag: null,
  activeTool: NO_ACTIVE_TOOL,
  style: {
    roundedSelection: true,
    exportShadow: true,
  },
  toolStyles: createDefaultToolStyles(),
  annotations: [],
  undoStack: [],
  redoStack: [],
  recentSelections: [],
  recentSelectionIndex: 0,
  annotationSequence: 1,
  editingAnnotationId: null,
  pointer: null,
  sampler: null,
  sessionUpdateUnlisten: null,
  status: "",
  busy: false,
  toastTimer: null,
};

void initialize();

function createTauriBridge() {
  const invoke = window.__TAURI__?.core?.invoke;
  if (typeof invoke !== "function") {
    return null;
  }
  return {
    getSession: () => invoke("get_screenshot_session"),
    ready: () => invoke("show_screenshot_window"),
    complete: (selection, action, compositedImageDataUrl = null) => invoke("complete_screenshot_capture", { selection, action, compositedImageDataUrl }),
    restartAfterDelay: (seconds = 3) => invoke("restart_screenshot_capture", { seconds }),
    cancel: () => invoke("cancel_screenshot_capture"),
  };
}

function createFallbackBridge() {
  return {
    async getSession() {
      return {
        imageDataUrl: "",
        imageWidth: window.innerWidth || 1440,
        imageHeight: window.innerHeight || 900,
        settings: {},
      };
    },
    async complete() {
      return { copied: true, savedPath: null };
    },
    async ready() {
      return true;
    },
    async restartAfterDelay() {
      return true;
    },
    async cancel() {
      return true;
    },
  };
}

async function initialize() {
  try {
    bindEvents();
    await loadScreenshotSession();
  } catch (error) {
    await showSessionError(error);
  }
}

async function loadScreenshotSession() {
  appElement.dataset.ready = "false";
  state.session = await bridge.getSession();
  resetCaptureState();
  applySessionSettings();
  state.activeTool = normalizeInitialTool();
  render();
  updateSelectionDom();
  prepareColorSampler();
  await waitForScreenshotImageReady();
  appElement.dataset.ready = "true";
  await nextFrame();
  await bridge.ready?.();
}

function resetCaptureState() {
  if (state.toastTimer) {
    window.clearTimeout(state.toastTimer);
    state.toastTimer = null;
  }
  state.selection = null;
  state.drag = null;
  state.annotations = [];
  state.undoStack = [];
  state.redoStack = [];
  state.annotationSequence = 1;
  state.editingAnnotationId = null;
  state.pointer = null;
  state.sampler = null;
  state.status = "";
  state.busy = false;
  state.toolStyles = createDefaultToolStyles();
  state.recentSelectionIndex = 0;
}

async function showSessionError(error) {
  appElement.dataset.ready = "true";
  appElement.innerHTML = `
    <div class="screenshot-error">
      <strong>无法启动截图</strong>
      <span>${escapeHtml(getErrorMessage(error, "截图会话加载失败。"))}</span>
    </div>
  `;
  await bridge.ready?.();
}

function bindEvents() {
  appElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  bindSessionUpdateEvents();
  appElement.addEventListener("input", onEditorInput);
  appElement.addEventListener("blur", onEditorBlur, true);
  appElement.addEventListener("keydown", onEditorKeyDown, true);
  appElement.addEventListener("click", (event) => {
    const action = event.target.closest("[data-screenshot-action]")?.dataset.screenshotAction;
    const tool = event.target.closest("[data-screenshot-tool]")?.dataset.screenshotTool;
    const styleAction = event.target.closest("[data-style-action]")?.dataset.styleAction;

    if (tool) {
      const item = TOOL_ITEMS.find((entry) => entry.id === tool);
      if (item && shortcutEnabled(item.id)) {
        activateTool(tool);
      }
      return;
    }

    if (styleAction) {
      handleStyleAction(styleAction, event.target.closest("[data-style-action]"));
      return;
    }

    if (action) {
      void handleScreenshotAction(action);
    }
  });
}

function bindSessionUpdateEvents() {
  const listen = window.__TAURI__?.event?.listen;
  if (typeof listen !== "function" || state.sessionUpdateUnlisten) {
    return;
  }
  void listen("screenshot:session-updated", () => {
    void loadScreenshotSession().catch(showSessionError);
  }).then((unlisten) => {
    state.sessionUpdateUnlisten = unlisten;
  }).catch(() => {});
}

function render() {
  appElement.innerHTML = `
    <div class="screenshot-stage">
      ${state.session.imageDataUrl
        ? `<img class="screenshot-image" src="${escapeHtml(state.session.imageDataUrl)}" alt="" draggable="false" />`
        : `<div class="screenshot-image screenshot-image--fallback"></div>`}
      <canvas class="screenshot-sampler" hidden></canvas>
      <div class="screenshot-shades" aria-hidden="true">
        <span data-shade="top"></span>
        <span data-shade="right"></span>
        <span data-shade="bottom"></span>
        <span data-shade="left"></span>
      </div>
      <div class="screenshot-selection" data-visible="false">
        <svg class="screenshot-annotation-layer" xmlns="http://www.w3.org/2000/svg"></svg>
        <div class="screenshot-editor-host"></div>
        ${["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((handle) => `<span class="screenshot-handle" data-handle="${handle}"></span>`).join("")}
      </div>
      <div class="screenshot-topbar" data-visible="false">
        <button class="screenshot-control screenshot-control--menu" type="button" data-style-action="size-menu">
          <span>自由尺寸</span><b>⌄</b>
        </button>
        <strong class="screenshot-size">0 x 0</strong>
        <button class="screenshot-control" type="button" data-style-action="reuse-selection">
          <span>最近选区</span><kbd>1/1</kbd>
        </button>
        <button class="screenshot-control" type="button" data-style-action="undo-annotation" data-disabled="true">
          <span>撤回</span><kbd>⌘Z</kbd>
        </button>
        <button class="screenshot-control" type="button" data-style-action="redo-annotation" data-disabled="true">
          <span>取消撤回</span><kbd>⇧⌘Z</kbd>
        </button>
        <button class="screenshot-control" type="button" data-style-action="toggle-rounded" data-active="${String(state.style.roundedSelection)}">
          <span>圆角</span><kbd>⌘R</kbd>
        </button>
        <button class="screenshot-control" type="button" data-style-action="toggle-shadow" data-active="${String(state.style.exportShadow)}">
          <span>阴影</span><kbd>⌘D</kbd>
        </button>
        <button class="screenshot-control screenshot-control--icon" type="button" data-style-action="show-settings" title="截图设置">
          <span>设置</span><kbd>⌘,</kbd>
        </button>
      </div>
      <div class="screenshot-toolbar" data-visible="false">
        <div class="screenshot-tools">
          ${visibleToolItems().map((item) => `
            <button
              class="screenshot-tool"
              type="button"
              data-screenshot-tool="${escapeHtml(item.id)}"
              data-active="${String(item.id === state.activeTool)}"
              data-enabled="true"
              title="${escapeHtml(item.label)}"
            >
              <small>${escapeHtml(shortcutLabel(configuredShortcut(item.id, item.key)))}</small>
              <span>${escapeHtml(item.icon)}</span>
            </button>
          `).join("")}
        </div>
        <div class="screenshot-actions">
          ${visibleActionItems().map((item) => `
            <button
              class="screenshot-action ${escapeHtml(item.className)}"
              type="button"
              data-screenshot-action="${escapeHtml(item.id)}"
              title="${escapeHtml(item.label)}"
            >
              <small>${escapeHtml(shortcutLabel(configuredShortcut(item.id, item.key)))}</small>
              <span>${escapeHtml(item.icon)}</span>
            </button>
          `).join("")}
        </div>
      </div>
      <div class="screenshot-stylebar" data-visible="false">
        <div class="screenshot-style-group">
          <button class="screenshot-style-pill" type="button" data-style-action="theme" data-active="true">主题</button>
        </div>
        <div class="screenshot-style-group screenshot-size-options">
          ${STROKE_SIZES.map((size) => `
            <button
              class="screenshot-style-pill"
              type="button"
              data-style-action="stroke-size"
              data-size-id="${escapeHtml(size.id)}"
              data-active="${String(size.id === currentToolStyle().strokeSize)}"
            >${escapeHtml(size.label)}</button>
          `).join("")}
        </div>
        <div class="screenshot-style-group">
          <button class="screenshot-style-pill screenshot-style-pill--ghost" type="button" data-style-action="text-mode">T</button>
          <button class="screenshot-style-pill screenshot-style-pill--ghost" type="button" data-style-action="outline-mode">底色</button>
        </div>
        <div class="screenshot-style-group screenshot-color-options">
          ${STYLE_COLORS.map((color) => `
            <button
              class="screenshot-color"
              type="button"
              data-style-action="color"
              data-color="${escapeHtml(color)}"
              data-active="${String(color === currentToolStyle().annotationColor)}"
              style="--swatch:${escapeHtml(color)}"
              aria-label="颜色 ${escapeHtml(color)}"
            ></button>
          `).join("")}
        </div>
      </div>
      <div class="screenshot-toast" data-visible="false"></div>
      <div class="screenshot-inspector" data-visible="false">
        <span class="screenshot-inspector-swatch"></span>
        <strong class="screenshot-inspector-coordinates">0, 0</strong>
        <span class="screenshot-inspector-color">#000000</span>
      </div>
    </div>
  `;
}

function createDefaultToolStyles() {
  return Object.fromEntries(TOOL_ITEMS.map((item) => [
    item.id,
    {
      ...DEFAULT_TOOL_STYLE,
      ...(item.id === "arrow" ? { strokeSize: "small" } : {}),
    },
  ]));
}

function currentToolStyle(tool = state.activeTool) {
  if (!state.toolStyles[tool]) {
    state.toolStyles[tool] = { ...DEFAULT_TOOL_STYLE };
  }
  return state.toolStyles[tool];
}

function applySessionSettings() {
  const settings = state.session?.settings || {};
  state.style.roundedSelection = settings.roundedCorners !== false;
  state.style.exportShadow = settings.shadow !== false;
}

function shortcutSetting(id) {
  return state.session?.settings?.toolShortcuts?.[id] || null;
}

function shortcutEnabled(id) {
  return shortcutSetting(id)?.enabled !== false;
}

function configuredShortcut(id, fallback) {
  const shortcut = shortcutSetting(id)?.shortcut;
  return typeof shortcut === "string" && shortcut.trim() ? shortcut.trim() : fallback;
}

function visibleToolItems() {
  return TOOL_ITEMS.filter((item) => shortcutEnabled(item.id));
}

function visibleActionItems() {
  return ACTION_ITEMS.filter((item) => shortcutEnabled(item.id));
}

function shortcutLabel(shortcut) {
  const labels = {
    CmdOrCtrl: "⌘",
    CommandOrControl: "⌘",
    Command: "⌘",
    Cmd: "⌘",
    Control: "⌃",
    Ctrl: "⌃",
    Alt: "⌥",
    Option: "⌥",
    Shift: "⇧",
    Space: "Space",
    Return: "Enter",
    Escape: "Esc",
    Up: "↑",
    Down: "↓",
    Left: "←",
    Right: "→",
  };
  return String(shortcut || "")
    .split("+")
    .filter(Boolean)
    .map((part) => labels[part] || part)
    .join("");
}

function normalizeShortcutValue(shortcut) {
  return String(shortcut || "")
    .replaceAll(" + ", "+")
    .split("+")
    .filter(Boolean)
    .map((part) => {
      if (["Command", "Cmd", "CommandOrControl"].includes(part)) {
        return "CmdOrCtrl";
      }
      if (part === "Option") {
        return "Alt";
      }
      if (part === "Ctrl") {
        return "Control";
      }
      if (part === "Enter") {
        return "Return";
      }
      if (part === "Esc") {
        return "Escape";
      }
      return part;
    })
    .join("+");
}

function getShortcutKey(event) {
  if (/^Key[A-Z]$/.test(event.code)) {
    return event.code.slice(3);
  }
  if (/^Digit[0-9]$/.test(event.code)) {
    return event.code.slice(5);
  }
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(event.code)) {
    return event.code;
  }
  const codeMap = {
    Space: "Space",
    Enter: "Return",
    Return: "Return",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Escape: "Escape",
  };
  if (codeMap[event.code]) {
    return codeMap[event.code];
  }
  const keyMap = {
    " ": "Space",
    Spacebar: "Space",
    Enter: "Return",
    Return: "Return",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Escape: "Escape",
  };
  if (keyMap[event.key]) {
    return keyMap[event.key];
  }
  if (event.key?.length === 1 && /[A-Za-z0-9]/.test(event.key)) {
    return event.key.toUpperCase();
  }
  return "";
}

function getShortcutModifiers(event) {
  const modifiers = [];
  if (event.altKey) {
    modifiers.push("Alt");
  }
  if (event.metaKey) {
    modifiers.push("CmdOrCtrl");
  }
  if (event.ctrlKey) {
    modifiers.push("Control");
  }
  if (event.shiftKey) {
    modifiers.push("Shift");
  }
  return modifiers;
}

function shortcutFromEvent(event) {
  const key = getShortcutKey(event);
  if (!key || ["Meta", "Control", "Alt", "Shift"].includes(event.key)) {
    return "";
  }
  return normalizeShortcutValue([...getShortcutModifiers(event), key].join("+"));
}

function eventMatchesShortcut(event, shortcut) {
  const normalized = normalizeShortcutValue(shortcut);
  return Boolean(normalized) && shortcutFromEvent(event) === normalized;
}

function eventMatchesConfiguredShortcut(event, id, fallback) {
  return shortcutEnabled(id) && eventMatchesShortcut(event, configuredShortcut(id, fallback));
}

function waitForScreenshotImageReady() {
  const image = document.querySelector(".screenshot-image");
  const waitForFrames = () => new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
  if (!(image instanceof HTMLImageElement) || image.complete) {
    return waitForFrames();
  }
  return new Promise((resolve) => {
    image.addEventListener("load", () => waitForFrames().then(resolve), { once: true });
    image.addEventListener("error", () => waitForFrames().then(resolve), { once: true });
  });
}

function prepareColorSampler() {
  const canvas = document.querySelector(".screenshot-sampler");
  if (!canvas || !state.session?.imageDataUrl) {
    return;
  }
  const viewport = viewportSize();
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext?.("2d", { willReadFrequently: true });
  if (!context) {
    return;
  }
  void loadImage(state.session.imageDataUrl)
    .then((image) => {
      context.drawImage(image, 0, 0, viewport.width, viewport.height);
      state.sampler = { canvas, context };
      if (state.pointer) {
        updateInspector(state.pointer);
      }
    })
    .catch(() => {
      state.sampler = null;
    });
}

function pointToImagePixels(point) {
  const viewport = viewportSize();
  return {
    x: Math.round(point.x * state.session.imageWidth / viewport.width),
    y: Math.round(point.y * state.session.imageHeight / viewport.height),
  };
}

function sampleColorAt(point) {
  const context = state.sampler?.context;
  if (!context || typeof context.getImageData !== "function") {
    return state.pointer?.color || "#000000";
  }
  try {
    const pixel = context.getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data;
    return rgbToHex(pixel[0], pixel[1], pixel[2]);
  } catch {
    return state.pointer?.color || "#000000";
  }
}

function rgbToHex(red, green, blue) {
  return `#${[red, green, blue]
    .map((value) => clamp(Math.round(value || 0), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function updateInspector(point) {
  state.pointer = {
    ...point,
    color: sampleColorAt(point),
  };
  updateInspectorDom();
}

function updateInspectorDom() {
  const inspector = document.querySelector(".screenshot-inspector");
  if (!inspector || !state.pointer) {
    return;
  }
  const viewport = viewportSize();
  const coordinates = pointToImagePixels(state.pointer);
  const left = state.pointer.x > viewport.width - 190 ? state.pointer.x - 166 : state.pointer.x + 18;
  const top = state.pointer.y > viewport.height - 58 ? state.pointer.y - 48 : state.pointer.y + 18;
  inspector.style.left = `${clamp(left, 12, viewport.width - 170)}px`;
  inspector.style.top = `${clamp(top, 12, viewport.height - 48)}px`;
  inspector.dataset.visible = "true";
  const swatch = inspector.querySelector(".screenshot-inspector-swatch");
  const coordinateLabel = inspector.querySelector(".screenshot-inspector-coordinates");
  const colorLabel = inspector.querySelector(".screenshot-inspector-color");
  if (swatch) {
    swatch.style.background = state.pointer.color;
  }
  if (coordinateLabel) {
    coordinateLabel.textContent = `${coordinates.x}, ${coordinates.y}`;
  }
  if (colorLabel) {
    colorLabel.textContent = state.pointer.color.toUpperCase();
  }
}

function hideInspector() {
  const inspector = document.querySelector(".screenshot-inspector");
  if (inspector) {
    inspector.dataset.visible = "false";
  }
}

function isFunctionalAreaTarget(target) {
  return Boolean(target?.closest?.(
    ".screenshot-toolbar, .screenshot-topbar, .screenshot-stylebar, .screenshot-actions, .screenshot-text-editor, .screenshot-toast",
  ));
}

function viewportSize() {
  return {
    width: Math.max(window.innerWidth || document.documentElement.clientWidth || 1, 1),
    height: Math.max(window.innerHeight || document.documentElement.clientHeight || 1, 1),
  };
}

function normalizeInitialTool() {
  return NO_ACTIVE_TOOL;
}

function activateTool(tool) {
  if (!shortcutEnabled(tool)) {
    return;
  }
  state.activeTool = tool;
  commitTextEditor();
  if (tool === "watermark" && state.selection) {
    applyWatermarkOverlay();
  }
  updateToolDom();
}

function isAnnotationTool(tool = state.activeTool) {
  return Boolean(tool) && tool !== "move" && visibleToolItems().some((item) => item.id === tool);
}

function toolUsesStyle(tool = state.activeTool) {
  return isAnnotationTool(tool);
}

function normalizeSelection(selection) {
  const viewport = viewportSize();
  const width = Math.max(MIN_SELECTION_SIZE, Math.min(selection.width, viewport.width));
  const height = Math.max(MIN_SELECTION_SIZE, Math.min(selection.height, viewport.height));
  return {
    x: clamp(selection.x, 0, viewport.width - width),
    y: clamp(selection.y, 0, viewport.height - height),
    width,
    height,
  };
}

function selectionSnapshot(selection = state.selection) {
  if (!selection) {
    return null;
  }
  const normalized = normalizeSelection(selection);
  return {
    x: Math.round(normalized.x),
    y: Math.round(normalized.y),
    width: Math.round(normalized.width),
    height: Math.round(normalized.height),
  };
}

function selectionsEqual(left, right) {
  return Boolean(left && right)
    && left.x === right.x
    && left.y === right.y
    && left.width === right.width
    && left.height === right.height;
}

function rememberRecentSelection(selection = state.selection) {
  const snapshot = selectionSnapshot(selection);
  if (!snapshot) {
    return false;
  }
  const existingIndex = state.recentSelections.findIndex((item) => selectionsEqual(item, snapshot));
  if (existingIndex >= 0) {
    state.recentSelections.splice(existingIndex, 1);
  }
  state.recentSelections.unshift(snapshot);
  state.recentSelections = state.recentSelections.slice(0, RECENT_SELECTION_LIMIT);
  state.recentSelectionIndex = 0;
  updateStyleDom();
  return true;
}

function activeRecentSelectionIndex() {
  const current = selectionSnapshot();
  const matchingIndex = current
    ? state.recentSelections.findIndex((item) => selectionsEqual(item, current))
    : -1;
  if (matchingIndex >= 0) {
    return matchingIndex;
  }
  return clamp(state.recentSelectionIndex, 0, Math.max(state.recentSelections.length - 1, 0));
}

function useNextRecentSelection() {
  const total = state.recentSelections.length;
  if (total === 0) {
    showToast("还没有最近选区。", true);
    return false;
  }

  const currentIndex = activeRecentSelectionIndex();
  const targetIndex = state.selection && total > 1 ? (currentIndex + 1) % total : currentIndex;
  const snapshot = state.recentSelections[targetIndex];
  if (!snapshot) {
    showToast("还没有最近选区。", true);
    return false;
  }

  state.recentSelectionIndex = targetIndex;
  const nextSelection = normalizeSelection(snapshot);
  if (selectionsEqual(selectionSnapshot(), selectionSnapshot(nextSelection))) {
    showToast(`当前是最近选区 ${targetIndex + 1}/${total}。`);
    updateStyleDom();
    return true;
  }

  commitTextEditor();
  pushUndoSnapshot();
  clearAnnotations({ recordHistory: false });
  state.selection = nextSelection;
  updateSelectionDom();
  showToast(`已切换到最近选区 ${targetIndex + 1}/${total}。`);
  return true;
}

function selectionFromPoints(startX, startY, currentX, currentY) {
  const left = Math.min(startX, currentX);
  const top = Math.min(startY, currentY);
  const right = Math.max(startX, currentX);
  const bottom = Math.max(startY, currentY);
  return normalizeSelection({
    x: left,
    y: top,
    width: Math.max(right - left, MIN_SELECTION_SIZE),
    height: Math.max(bottom - top, MIN_SELECTION_SIZE),
  });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pointerPosition(event) {
  const viewport = viewportSize();
  return {
    x: clamp(event.clientX, 0, viewport.width),
    y: clamp(event.clientY, 0, viewport.height),
  };
}

function pointInSelection(point) {
  if (!state.selection) {
    return false;
  }
  return point.x >= state.selection.x
    && point.y >= state.selection.y
    && point.x <= state.selection.x + state.selection.width
    && point.y <= state.selection.y + state.selection.height;
}

function pointToSelection(point) {
  if (!state.selection) {
    return { x: 0, y: 0 };
  }
  return {
    x: clamp(point.x - state.selection.x, 0, state.selection.width),
    y: clamp(point.y - state.selection.y, 0, state.selection.height),
  };
}

function captureHistorySnapshot() {
  return {
    selection: state.selection ? structuredCloneSafe(state.selection) : null,
    annotations: state.annotations.map((annotation) => structuredCloneSafe(annotation)),
    annotationSequence: state.annotationSequence,
    editingAnnotationId: state.editingAnnotationId,
  };
}

function restoreHistorySnapshot(snapshot) {
  state.selection = snapshot.selection ? structuredCloneSafe(snapshot.selection) : null;
  state.annotations = snapshot.annotations.map((annotation) => structuredCloneSafe(annotation));
  state.annotationSequence = snapshot.annotationSequence;
  state.editingAnnotationId = snapshot.editingAnnotationId;
  state.drag = null;
  updateSelectionDom();
  updateStyleDom();
}

function pushUndoSnapshot({ clearRedo = true } = {}) {
  state.undoStack.push(captureHistorySnapshot());
  if (state.undoStack.length > 80) {
    state.undoStack.shift();
  }
  if (clearRedo) {
    state.redoStack = [];
  }
  updateStyleDom();
}

function undoLastScreenshotChange() {
  if (state.undoStack.length === 0) {
    showToast("没有可撤回的操作。");
    return false;
  }
  state.redoStack.push(captureHistorySnapshot());
  const snapshot = state.undoStack.pop();
  restoreHistorySnapshot(snapshot);
  return true;
}

function redoLastScreenshotChange() {
  if (state.redoStack.length === 0) {
    showToast("没有可取消撤回的操作。");
    return false;
  }
  pushUndoSnapshot({ clearRedo: false });
  const snapshot = state.redoStack.pop();
  restoreHistorySnapshot(snapshot);
  return true;
}

function beginPointerInteraction(point, target) {
  if (state.busy || isFunctionalAreaTarget(target)) {
    hideInspector();
    return false;
  }
  updateInspector(point);
  const handle = target?.closest?.("[data-handle]")?.dataset.handle;
  const selectionElement = target?.closest?.(".screenshot-selection");

  commitTextEditor();

  if (state.selection && state.activeTool === "watermark" && selectionElement && !handle && pointInSelection(point)) {
    applyWatermarkOverlay();
    updateSelectionDom();
    return false;
  }

  if (state.selection && isAnnotationTool() && selectionElement && !handle && pointInSelection(point)) {
    beginAnnotation(point);
  } else if (handle) {
    pushUndoSnapshot();
    state.drag = {
      type: "resize",
      handle,
      start: point,
      origin: { ...state.selection },
    };
  } else if (selectionElement) {
    pushUndoSnapshot();
    state.drag = {
      type: "move",
      start: point,
      origin: { ...state.selection },
    };
  } else {
    pushUndoSnapshot();
    clearAnnotations({ recordHistory: false });
    state.drag = {
      type: "create",
      start: point,
    };
    state.selection = normalizeSelection({ x: point.x, y: point.y, width: MIN_SELECTION_SIZE, height: MIN_SELECTION_SIZE });
  }
  updateSelectionDom();
  return true;
}

function updatePointerInteraction(point, target = null) {
  if (!state.drag && isFunctionalAreaTarget(target)) {
    hideInspector();
    return false;
  }
  updateInspector(point);
  if (!state.drag) {
    return false;
  }

  if (state.drag.type === "create") {
    state.selection = selectionFromPoints(state.drag.start.x, state.drag.start.y, point.x, point.y);
  } else if (state.drag.type === "move") {
    state.selection = normalizeSelection({
      ...state.drag.origin,
      x: state.drag.origin.x + point.x - state.drag.start.x,
      y: state.drag.origin.y + point.y - state.drag.start.y,
    });
  } else if (state.drag.type === "resize") {
    state.selection = resizeSelection(state.drag.origin, state.drag.handle, point.x - state.drag.start.x, point.y - state.drag.start.y);
  } else if (state.drag.type === "annotation") {
    updateAnnotationDrag(point);
  }

  updateSelectionDom();
  return true;
}

function finishPointerInteraction() {
  const finishedDragType = state.drag?.type;
  if (state.drag?.type === "annotation") {
    finishAnnotationDrag();
  }
  state.drag = null;
  if (["create", "move", "resize"].includes(finishedDragType)) {
    rememberRecentSelection();
  }
}

function onPointerDown(event) {
  event.preventDefault();
  event.target.setPointerCapture?.(event.pointerId);
  beginPointerInteraction(pointerPosition(event), event.target);
}

function onPointerMove(event) {
  if (updatePointerInteraction(pointerPosition(event), event.target)) {
    event.preventDefault();
  }
}

function onPointerUp() {
  finishPointerInteraction();
}

function resizeSelection(origin, handle, deltaX, deltaY) {
  let left = origin.x;
  let top = origin.y;
  let right = origin.x + origin.width;
  let bottom = origin.y + origin.height;

  if (handle.includes("w")) {
    left += deltaX;
  }
  if (handle.includes("e")) {
    right += deltaX;
  }
  if (handle.includes("n")) {
    top += deltaY;
  }
  if (handle.includes("s")) {
    bottom += deltaY;
  }

  if (right - left < MIN_SELECTION_SIZE) {
    if (handle.includes("w")) {
      left = right - MIN_SELECTION_SIZE;
    } else {
      right = left + MIN_SELECTION_SIZE;
    }
  }
  if (bottom - top < MIN_SELECTION_SIZE) {
    if (handle.includes("n")) {
      top = bottom - MIN_SELECTION_SIZE;
    } else {
      bottom = top + MIN_SELECTION_SIZE;
    }
  }

  return normalizeSelection({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
}

function beginAnnotation(point) {
  pushUndoSnapshot();
  if (state.activeTool === "watermark") {
    applyWatermarkOverlay({ recordHistory: false });
    return;
  }
  const start = pointToSelection(point);
  const annotation = createAnnotation(state.activeTool, start);
  state.annotations.push(annotation);

  if (annotation.type === "step") {
    renderAnnotations();
    return;
  }

  state.drag = {
    type: "annotation",
    annotationId: annotation.id,
    tool: annotation.type,
    start,
  };
  renderAnnotations();
}

function createAnnotation(type, start) {
  const id = `annotation-${state.annotationSequence++}`;
  const style = createAnnotationStyle();
  if (type === "step") {
    const number = state.annotations.filter((annotation) => annotation.type === "step").length + 1;
    return {
      id,
      type,
      style,
      x: clamp(start.x - 12, 0, Math.max(state.selection.width - 24, 0)),
      y: clamp(start.y - 12, 0, Math.max(state.selection.height - 24, 0)),
      width: 24,
      height: 24,
      text: String(number),
    };
  }
  if (type === "arrow") {
    return { id, type, style, x1: start.x, y1: start.y, x2: start.x, y2: start.y };
  }
  if (type === "brush") {
    return { id, type, style, points: [start] };
  }
  if (type === "note") {
    return { id, type, style, x: start.x, y: start.y, width: 96, height: 34, text: "备注" };
  }
  if (type === "text") {
    return { id, type, style, x: start.x, y: start.y, width: 108, height: 30, text: "文本" };
  }
  if (type === "watermark") {
    return createWatermarkAnnotation(id, style);
  }
  return { id, type, style, x: start.x, y: start.y, width: MIN_ANNOTATION_SIZE, height: MIN_ANNOTATION_SIZE };
}

function createWatermarkAnnotation(id = `annotation-${state.annotationSequence++}`, style = createAnnotationStyle()) {
  return {
    id,
    type: "watermark",
    mode: "tiled",
    style,
    x: 0,
    y: 0,
    width: state.selection?.width || 0,
    height: state.selection?.height || 0,
    text: watermarkText(),
  };
}

function watermarkText() {
  const value = state.session?.settings?.watermarkText;
  return typeof value === "string" && value.trim() ? value.trim() : DEFAULT_WATERMARK_TEXT;
}

function applyWatermarkOverlay({ recordHistory = true } = {}) {
  if (!state.selection) {
    showToast("请先框选截图区域。", true);
    return;
  }
  const nextText = watermarkText();
  const existingWatermark = state.annotations.find((annotation) => annotation.type === "watermark");
  if (existingWatermark?.mode === "tiled" && existingWatermark.text === nextText) {
    return;
  }
  if (recordHistory) {
    pushUndoSnapshot();
  }
  state.annotations = state.annotations.filter((annotation) => annotation.type !== "watermark");
  state.annotations.push(createWatermarkAnnotation());
  state.editingAnnotationId = null;
  renderAnnotations();
  renderTextEditor();
}

function createAnnotationStyle() {
  const toolStyle = currentToolStyle(state.activeTool);
  return {
    color: toolStyle.annotationColor,
    strokeWidth: currentStrokeWidth(),
  };
}

function updateAnnotationDrag(point) {
  const annotation = findAnnotation(state.drag.annotationId);
  if (!annotation) {
    return;
  }
  const current = pointToSelection(point);

  if (annotation.type === "arrow") {
    annotation.x2 = current.x;
    annotation.y2 = current.y;
  } else if (annotation.type === "brush") {
    const previous = annotation.points.at(-1);
    if (!previous || Math.hypot(current.x - previous.x, current.y - previous.y) > 2) {
      annotation.points.push(current);
    }
  } else {
    const rect = annotationRectFromPoints(state.drag.start, current, defaultAnnotationSize(annotation.type));
    annotation.x = rect.x;
    annotation.y = rect.y;
    annotation.width = rect.width;
    annotation.height = rect.height;
  }
}

function finishAnnotationDrag() {
  const annotation = findAnnotation(state.drag.annotationId);
  if (!annotation) {
    return;
  }

  if (annotation.type === "arrow" && Math.hypot(annotation.x2 - annotation.x1, annotation.y2 - annotation.y1) < 10) {
    annotation.x2 = clamp(annotation.x1 + 48, 0, state.selection.width);
    annotation.y2 = clamp(annotation.y1 + 18, 0, state.selection.height);
  } else if (annotation.type === "brush" && annotation.points.length < 2) {
    annotation.points.push({ x: clamp(annotation.points[0].x + 36, 0, state.selection.width), y: annotation.points[0].y });
  }

  if (["note", "text"].includes(annotation.type)) {
    state.editingAnnotationId = annotation.id;
  }
  renderAnnotations();
  renderTextEditor();
}

function defaultAnnotationSize(type) {
  if (type === "note") {
    return { width: 96, height: 34 };
  }
  if (type === "text") {
    return { width: 108, height: 30 };
  }
  if (type === "watermark") {
    return { width: state.selection?.width || 132, height: state.selection?.height || 30 };
  }
  return { width: MIN_ANNOTATION_SIZE, height: MIN_ANNOTATION_SIZE };
}

function currentStrokeWidth() {
  return STROKE_SIZES.find((size) => size.id === currentToolStyle().strokeSize)?.value ?? 3;
}

function annotationColor(annotation) {
  return annotation.style?.color || DEFAULT_ANNOTATION_COLOR;
}

function annotationStrokeWidth(annotation) {
  return annotation.style?.strokeWidth || currentStrokeWidth();
}

function colorWithAlpha(color, alpha) {
  const normalized = String(color || "").trim();
  if (!/^#[0-9a-f]{6}$/i.test(normalized)) {
    return `rgba(255, 69, 58, ${alpha})`;
  }
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function annotationRectFromPoints(start, current, fallback) {
  const left = Math.min(start.x, current.x);
  const top = Math.min(start.y, current.y);
  const right = Math.max(start.x, current.x);
  const bottom = Math.max(start.y, current.y);
  const width = Math.max(right - left, fallback.width);
  const height = Math.max(bottom - top, fallback.height);
  return {
    x: clamp(left, 0, Math.max(state.selection.width - width, 0)),
    y: clamp(top, 0, Math.max(state.selection.height - height, 0)),
    width: Math.min(width, state.selection.width),
    height: Math.min(height, state.selection.height),
  };
}

function findAnnotation(id) {
  return state.annotations.find((annotation) => annotation.id === id);
}

function clearAnnotations({ recordHistory = true } = {}) {
  if (recordHistory && state.annotations.length > 0) {
    pushUndoSnapshot();
  }
  state.annotations = [];
  state.editingAnnotationId = null;
  renderAnnotations();
  renderTextEditor();
}

function renderAnnotations() {
  const layer = document.querySelector(".screenshot-annotation-layer");
  if (!layer || !state.selection) {
    if (layer) {
      layer.innerHTML = "";
    }
    return;
  }
  layer.setAttribute("viewBox", `0 0 ${state.selection.width} ${state.selection.height}`);
  layer.innerHTML = `
    <defs>
      <pattern id="screenshot-mosaic-pattern" width="10" height="10" patternUnits="userSpaceOnUse">
        <rect width="10" height="10" fill="rgba(255,255,255,0.26)"></rect>
        <rect width="5" height="5" fill="rgba(10,132,255,0.42)"></rect>
        <rect x="5" y="5" width="5" height="5" fill="rgba(10,132,255,0.28)"></rect>
      </pattern>
    </defs>
    ${state.annotations.filter((annotation) => annotation.type === "highlight").map(annotationToSvg).join("")}
    ${state.annotations.filter((annotation) => annotation.type !== "highlight").map(annotationToSvg).join("")}
  `;
}

function annotationToSvg(annotation) {
  const color = annotationColor(annotation);
  const strokeWidth = annotationStrokeWidth(annotation);
  const isEditing = annotation.id === state.editingAnnotationId;
  if (annotation.type === "rectangle") {
    return `<rect ${rectAttributes(annotation)} rx="6" fill="none" stroke="${escapeHtml(color)}" stroke-width="${formatNumber(strokeWidth)}"></rect>`;
  }
  if (annotation.type === "circle") {
    const cx = annotation.x + annotation.width / 2;
    const cy = annotation.y + annotation.height / 2;
    return `<ellipse cx="${formatNumber(cx)}" cy="${formatNumber(cy)}" rx="${formatNumber(annotation.width / 2)}" ry="${formatNumber(annotation.height / 2)}" fill="none" stroke="${escapeHtml(color)}" stroke-width="${formatNumber(strokeWidth)}"></ellipse>`;
  }
  if (annotation.type === "highlight") {
    const maskId = `screenshot-highlight-mask-${annotation.id}`;
    return `
      <defs>
        <mask id="${escapeHtml(maskId)}">
          <rect x="0" y="0" width="${formatNumber(state.selection.width)}" height="${formatNumber(state.selection.height)}" fill="white"></rect>
          <rect ${rectAttributes(annotation)} rx="7" fill="black"></rect>
        </mask>
      </defs>
      <rect x="0" y="0" width="${formatNumber(state.selection.width)}" height="${formatNumber(state.selection.height)}" fill="rgba(0,0,0,0.46)" mask="url(#${escapeHtml(maskId)})"></rect>
      <rect ${rectAttributes(annotation)} rx="7" fill="none" stroke="${escapeHtml(colorWithAlpha(color, 0.64))}" stroke-width="${formatNumber(Math.max(1.2, strokeWidth - 1))}"></rect>
    `;
  }
  if (annotation.type === "mosaic") {
    return `<rect ${rectAttributes(annotation)} rx="5" fill="url(#screenshot-mosaic-pattern)" stroke="${escapeHtml(colorWithAlpha(color, 0.55))}" stroke-width="1.5"></rect>`;
  }
  if (annotation.type === "arrow") {
    const markerId = `screenshot-arrowhead-${annotation.id}`;
    return `
      <defs>
        <marker id="${escapeHtml(markerId)}" markerWidth="9" markerHeight="9" refX="7.5" refY="4.5" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 9 4.5 L 0 9 z" fill="${escapeHtml(color)}"></path>
        </marker>
      </defs>
      <line x1="${formatNumber(annotation.x1)}" y1="${formatNumber(annotation.y1)}" x2="${formatNumber(annotation.x2)}" y2="${formatNumber(annotation.y2)}" stroke="${escapeHtml(color)}" stroke-width="${formatNumber(strokeWidth)}" stroke-linecap="round" marker-end="url(#${escapeHtml(markerId)})"></line>
    `;
  }
  if (annotation.type === "brush") {
    return `<path d="${brushPath(annotation.points)}" fill="none" stroke="${escapeHtml(color)}" stroke-width="${formatNumber(strokeWidth)}" stroke-linecap="round" stroke-linejoin="round"></path>`;
  }
  if (annotation.type === "note") {
    return `
      <g>
        <rect ${rectAttributes(annotation)} rx="8" fill="none" stroke="${escapeHtml(color)}" stroke-width="${formatNumber(Math.max(1.4, strokeWidth - 1))}"></rect>
        ${isEditing ? "" : `<text x="${formatNumber(annotation.x + 10)}" y="${formatNumber(annotation.y + annotation.height / 2 + 5)}" fill="#ffffff" font-size="14" font-weight="760">${escapeHtml(annotation.text || "备注")}</text>`}
      </g>
    `;
  }
  if (annotation.type === "step") {
    const cx = annotation.x + annotation.width / 2;
    const cy = annotation.y + annotation.height / 2;
    return `
      <g>
        <circle cx="${formatNumber(cx)}" cy="${formatNumber(cy)}" r="${formatNumber(Math.min(annotation.width, annotation.height) / 2)}" fill="${escapeHtml(color)}"></circle>
        <text x="${formatNumber(cx)}" y="${formatNumber(cy + 4.5)}" text-anchor="middle" fill="#ffffff" font-size="14" font-weight="860">${escapeHtml(annotation.text || "1")}</text>
      </g>
    `;
  }
  if (annotation.type === "watermark") {
    return watermarkTiles(annotation, state.selection.width, state.selection.height)
      .map((tile) => `<text x="${formatNumber(tile.x)}" y="${formatNumber(tile.y)}" text-anchor="middle" fill="${escapeHtml(color)}" opacity="0.18" font-size="18" font-weight="820" transform="rotate(-18 ${formatNumber(tile.x)} ${formatNumber(tile.y)})">${escapeHtml(tile.text)}</text>`)
      .join("");
  }
  if (annotation.type === "text") {
    if (isEditing) {
      return "";
    }
    return `<text x="${formatNumber(annotation.x)}" y="${formatNumber(annotation.y + 20)}" fill="${escapeHtml(color)}" stroke="rgba(0,0,0,0.58)" stroke-width="2" paint-order="stroke" font-size="18" font-weight="760">${escapeHtml(annotation.text || "文本")}</text>`;
  }
  return "";
}

function rectAttributes(annotation) {
  return `x="${formatNumber(annotation.x)}" y="${formatNumber(annotation.y)}" width="${formatNumber(annotation.width)}" height="${formatNumber(annotation.height)}"`;
}

function brushPath(points = []) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${formatNumber(point.x)} ${formatNumber(point.y)}`).join(" ");
}

function formatNumber(value) {
  return Number(value || 0).toFixed(2).replace(/\.?0+$/, "");
}

function watermarkTiles(annotation, width, height) {
  const text = annotation.text || watermarkText();
  const horizontalCount = Math.max(2, Math.ceil(width / WATERMARK_GAP_X) + 2);
  const verticalCount = Math.max(2, Math.ceil(height / WATERMARK_GAP_Y) + 2);
  const tiles = [];
  for (let row = -1; row < verticalCount; row += 1) {
    for (let column = -1; column < horizontalCount; column += 1) {
      tiles.push({
        x: column * WATERMARK_GAP_X + (row % 2 ? WATERMARK_GAP_X * 0.42 : WATERMARK_GAP_X * 0.08),
        y: row * WATERMARK_GAP_Y + WATERMARK_GAP_Y * 0.72,
        text,
      });
    }
  }
  return tiles;
}

function renderTextEditor() {
  const host = document.querySelector(".screenshot-editor-host");
  if (!host) {
    return;
  }
  const annotation = state.editingAnnotationId ? findAnnotation(state.editingAnnotationId) : null;
  if (!annotation || !["note", "text"].includes(annotation.type)) {
    host.innerHTML = "";
    return;
  }
  const existing = host.querySelector(".screenshot-text-editor");
  const top = annotation.type === "text" ? annotation.y : annotation.y + 7;
  const height = annotation.type === "note" ? Math.max(annotation.height - 14, 28) : Math.max(annotation.height, 28);
  const left = annotation.type === "note" ? annotation.x + 8 : annotation.x;
  const width = annotation.type === "note" ? Math.max(annotation.width - 16, 48) : Math.max(annotation.width, 60);
  if (existing?.dataset.annotationId === annotation.id) {
    Object.assign(existing.style, editorStyle(left, top, width, height, annotation.type));
    return;
  }
  host.innerHTML = `
    <textarea
      class="screenshot-text-editor"
      data-annotation-id="${escapeHtml(annotation.id)}"
      data-annotation-type="${escapeHtml(annotation.type)}"
      spellcheck="false"
    >${escapeHtml(annotation.text || "")}</textarea>
  `;
  const editor = host.querySelector(".screenshot-text-editor");
  Object.assign(editor.style, editorStyle(left, top, width, height, annotation.type));
  window.requestAnimationFrame(() => {
    editor.focus();
    editor.select();
  });
}

function editorStyle(left, top, width, height, type) {
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    textAlign: type === "watermark" ? "center" : "left",
  };
}

function onEditorInput(event) {
  const editor = event.target.closest?.(".screenshot-text-editor");
  if (!editor) {
    return;
  }
  const annotation = findAnnotation(editor.dataset.annotationId);
  if (annotation) {
    annotation.text = editor.value;
    renderAnnotations();
  }
}

function onEditorBlur(event) {
  if (event.target.closest?.(".screenshot-text-editor")) {
    commitTextEditor();
  }
}

function onEditorKeyDown(event) {
  const editor = event.target.closest?.(".screenshot-text-editor");
  if (!editor) {
    return;
  }
  event.stopPropagation();
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    commitTextEditor();
  } else if (event.key === "Escape") {
    event.preventDefault();
    commitTextEditor(true);
  }
}

function commitTextEditor(removeWhenEmpty = false) {
  if (!state.editingAnnotationId) {
    return;
  }
  const editor = document.querySelector(".screenshot-text-editor");
  const annotation = findAnnotation(state.editingAnnotationId);
  if (annotation && editor) {
    annotation.text = editor.value.trim();
  }
  if (annotation && (!annotation.text || removeWhenEmpty)) {
    state.annotations = state.annotations.filter((item) => item.id !== annotation.id);
  }
  state.editingAnnotationId = null;
  renderAnnotations();
  renderTextEditor();
}

function handleStyleAction(action, element) {
  if (action === "color" && element?.dataset.color) {
    currentToolStyle().annotationColor = element.dataset.color;
    updateStyleDom();
    return;
  }
  if (action === "stroke-size" && element?.dataset.sizeId) {
    currentToolStyle().strokeSize = element.dataset.sizeId;
    updateStyleDom();
    return;
  }
  if (action === "toggle-rounded") {
    state.style.roundedSelection = !state.style.roundedSelection;
    updateSelectionDom();
    return;
  }
  if (action === "toggle-shadow") {
    state.style.exportShadow = !state.style.exportShadow;
    updateStyleDom();
    return;
  }
  if (action === "undo-annotation") {
    undoLastScreenshotChange();
    return;
  }
  if (action === "redo-annotation") {
    redoLastScreenshotChange();
    return;
  }
  if (action === "show-settings") {
    showToast("截图设置可在极刻设置里修改。");
    return;
  }
  if (action === "reuse-selection") {
    useNextRecentSelection();
    return;
  }
}

function updateSelectionDom() {
  const selection = document.querySelector(".screenshot-selection");
  const topbar = document.querySelector(".screenshot-topbar");
  const toolbar = document.querySelector(".screenshot-toolbar");
  const stylebar = document.querySelector(".screenshot-stylebar");
  const size = document.querySelector(".screenshot-size");
  if (!selection) {
    return;
  }

  updateShadeDom();
  updateStyleDom();

  if (!state.selection) {
    selection.dataset.visible = "false";
    selection.style.left = "0px";
    selection.style.top = "0px";
    selection.style.width = "0px";
    selection.style.height = "0px";
    selection.dataset.tool = state.activeTool || "none";
    selection.dataset.rounded = String(state.style.roundedSelection);
    if (topbar) {
      topbar.dataset.visible = "false";
    }
    if (toolbar) {
      toolbar.dataset.visible = "false";
    }
    if (stylebar) {
      stylebar.dataset.visible = "false";
    }
    if (size) {
      size.textContent = "0 x 0";
    }
    renderAnnotations();
    renderTextEditor();
    return;
  }

  const { x, y, width, height } = state.selection;
  selection.style.left = `${x}px`;
  selection.style.top = `${y}px`;
  selection.style.width = `${width}px`;
  selection.style.height = `${height}px`;
  selection.dataset.visible = "true";
  selection.dataset.tool = state.activeTool || "none";
  selection.dataset.rounded = String(state.style.roundedSelection);
  if (size) {
    const pixels = selectionToPixels();
    size.textContent = `${pixels.width} x ${pixels.height}`;
  }

  const viewport = viewportSize();
  const centerX = x + width / 2;
  const touchesTopSafeArea = y <= TOP_EDGE_SAFE_AREA;
  const belowSelectionTop = y + height + 12;
  const toolbarGap = toolUsesStyle() ? 58 : 52;
  if (topbar) {
    topbar.dataset.visible = "true";
    const topbarTop = touchesTopSafeArea ? belowSelectionTop : y - 44;
    placeFloatingElement(topbar, centerX, topbarTop, viewport);
  }
  if (toolbar) {
    toolbar.dataset.visible = "true";
    const toolbarTop = Math.min(
      touchesTopSafeArea ? belowSelectionTop + toolbarGap : y + height + 16,
      viewport.height - 118,
    );
    placeFloatingElement(toolbar, centerX, Math.max(16, toolbarTop), viewport);
  }
  if (stylebar) {
    if (toolUsesStyle()) {
      stylebar.dataset.visible = "true";
      const stylebarTop = Math.min(
        touchesTopSafeArea ? belowSelectionTop + toolbarGap + 58 : y + height + 74,
        viewport.height - 58,
      );
      placeFloatingElement(stylebar, centerX, Math.max(16, stylebarTop), viewport);
    } else {
      stylebar.dataset.visible = "false";
    }
  }
  renderAnnotations();
  renderTextEditor();
}

function placeFloatingElement(element, centerX, top, viewport = viewportSize()) {
  const halfWidth = element.offsetWidth ? element.offsetWidth / 2 : 18;
  element.style.left = `${clamp(centerX, 12 + halfWidth, viewport.width - 12 - halfWidth)}px`;
  element.style.top = `${top}px`;
}

function updateToolDom() {
  document.querySelectorAll("[data-screenshot-tool]").forEach((button) => {
    button.dataset.active = String(button.dataset.screenshotTool === state.activeTool);
  });
  updateStyleDom();
  updateSelectionDom();
}

function updateStyleDom() {
  const toolStyle = currentToolStyle();
  document.querySelectorAll('[data-style-action="stroke-size"]').forEach((button) => {
    button.dataset.active = String(button.dataset.sizeId === toolStyle.strokeSize);
  });
  document.querySelectorAll('[data-style-action="color"]').forEach((button) => {
    button.dataset.active = String(button.dataset.color === toolStyle.annotationColor);
  });
  document.querySelectorAll('[data-style-action="toggle-rounded"]').forEach((button) => {
    button.dataset.active = String(state.style.roundedSelection);
  });
  document.querySelectorAll('[data-style-action="toggle-shadow"]').forEach((button) => {
    button.dataset.active = String(state.style.exportShadow);
  });
  document.querySelectorAll('[data-style-action="undo-annotation"]').forEach((button) => {
    button.dataset.disabled = String(state.undoStack.length === 0);
  });
  document.querySelectorAll('[data-style-action="redo-annotation"]').forEach((button) => {
    button.dataset.disabled = String(state.redoStack.length === 0);
  });
  document.querySelectorAll('[data-style-action="reuse-selection"]').forEach((button) => {
    const total = state.recentSelections.length;
    const index = total > 0 ? activeRecentSelectionIndex() + 1 : 0;
    button.dataset.disabled = String(total === 0);
    const kbd = button.querySelector("kbd");
    if (kbd) {
      kbd.textContent = `${index}/${RECENT_SELECTION_LIMIT}`;
    }
  });
}

function updateShadeDom() {
  const shades = document.querySelector(".screenshot-shades");
  if (!shades) {
    return;
  }
  const viewport = viewportSize();
  const topShade = shades.querySelector('[data-shade="top"]');
  const rightShade = shades.querySelector('[data-shade="right"]');
  const bottomShade = shades.querySelector('[data-shade="bottom"]');
  const leftShade = shades.querySelector('[data-shade="left"]');

  if (!state.selection) {
    setShadeRect(topShade, 0, 0, viewport.width, viewport.height);
    setShadeRect(rightShade, 0, 0, 0, 0);
    setShadeRect(bottomShade, 0, 0, 0, 0);
    setShadeRect(leftShade, 0, 0, 0, 0);
    return;
  }

  const { x, y, width, height } = state.selection;
  setShadeRect(topShade, 0, 0, viewport.width, y);
  setShadeRect(rightShade, x + width, y, viewport.width - x - width, height);
  setShadeRect(bottomShade, 0, y + height, viewport.width, viewport.height - y - height);
  setShadeRect(leftShade, 0, y, x, height);
}

function setShadeRect(element, x, y, width, height) {
  if (!element) {
    return;
  }
  element.style.left = `${Math.max(0, x)}px`;
  element.style.top = `${Math.max(0, y)}px`;
  element.style.width = `${Math.max(0, width)}px`;
  element.style.height = `${Math.max(0, height)}px`;
}

function selectionToPixels() {
  const viewport = viewportSize();
  const scaleX = state.session.imageWidth / viewport.width;
  const scaleY = state.session.imageHeight / viewport.height;
  const x = Math.round(state.selection.x * scaleX);
  const y = Math.round(state.selection.y * scaleY);
  return {
    x,
    y,
    width: Math.max(1, Math.round(state.selection.width * scaleX)),
    height: Math.max(1, Math.round(state.selection.height * scaleY)),
  };
}

function selectionTouchesCapturedScreenEdge(pixels = selectionToPixels()) {
  const imageWidth = state.session?.imageWidth ?? 0;
  const imageHeight = state.session?.imageHeight ?? 0;
  return (
    pixels.x <= SCREEN_EDGE_EPSILON
    || pixels.y <= SCREEN_EDGE_EPSILON
    || pixels.x + pixels.width >= imageWidth - SCREEN_EDGE_EPSILON
    || pixels.y + pixels.height >= imageHeight - SCREEN_EDGE_EPSILON
  );
}

function exportEffectsForPixels(pixels = selectionToPixels()) {
  const touchesScreenEdge = selectionTouchesCapturedScreenEdge(pixels);
  return {
    rounded: state.style.roundedSelection && !touchesScreenEdge,
    shadow: state.style.exportShadow && !touchesScreenEdge,
    touchesScreenEdge,
  };
}

async function composeSelectionImageDataUrl(pixels = selectionToPixels(), effects = exportEffectsForPixels(pixels)) {
  const canvas = document.createElement("canvas");
  const padding = effects.shadow ? Math.max(18, Math.round(Math.min(pixels.width, pixels.height) * 0.04)) : 0;
  canvas.width = pixels.width + padding * 2;
  canvas.height = pixels.height + padding * 2;
  const context = canvas.getContext?.("2d");
  if (!context || typeof canvas.toDataURL !== "function") {
    throw new Error("当前环境不支持标注合成。");
  }

  const outputRadius = effects.rounded ? Math.round(DEFAULT_SELECTION_RADIUS * pixels.width / state.selection.width) : 0;
  if (effects.shadow) {
    context.save();
    context.shadowColor = "rgba(0, 0, 0, 0.34)";
    context.shadowBlur = Math.max(18, padding * 0.8);
    context.shadowOffsetY = Math.max(6, padding * 0.28);
    context.fillStyle = "rgba(0, 0, 0, 0.18)";
    drawRoundedRect(context, padding, padding, pixels.width, pixels.height, outputRadius);
    context.fill();
    context.restore();
  }

  context.save();
  drawRoundedRect(context, padding, padding, pixels.width, pixels.height, outputRadius);
  context.clip?.();
  context.translate?.(padding, padding);

  if (state.session.imageDataUrl) {
    const image = await loadImage(state.session.imageDataUrl);
    context.drawImage(image, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, pixels.width, pixels.height);
  } else {
    context.fillStyle = "#07111f";
    context.fillRect(0, 0, pixels.width, pixels.height);
  }

  const scale = {
    x: pixels.width / state.selection.width,
    y: pixels.height / state.selection.height,
  };

  for (const annotation of state.annotations) {
    if (annotation.type === "mosaic") {
      drawMosaicAnnotation(context, annotation, scale);
    }
  }
  for (const annotation of state.annotations) {
    if (annotation.type !== "mosaic") {
      drawAnnotationOnCanvas(context, annotation, scale);
    }
  }
  context.restore();

  return canvasToPngDataUrl(canvas);
}

function canvasToPngDataUrl(canvas) {
  const fallback = () => {
    if (typeof canvas.toDataURL === "function") {
      return canvas.toDataURL("image/png");
    }
    throw new Error("当前环境不支持标注合成。");
  };
  if (typeof canvas.toBlob === "function" && typeof FileReader === "function") {
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout?.(fallbackTimer);
        callback(value);
      };
      const fallbackTimer = window.setTimeout?.(() => {
        try {
          settle(resolve, fallback());
        } catch (error) {
          settle(reject, error);
        }
      }, 120);

      try {
        canvas.toBlob((blob) => {
          if (!blob) {
            try {
              settle(resolve, fallback());
            } catch (error) {
              settle(reject, error);
            }
            return;
          }
          const reader = new FileReader();
          reader.onload = () => settle(resolve, String(reader.result || ""));
          reader.onerror = () => settle(reject, new Error("截图合成数据读取失败。"));
          reader.readAsDataURL(blob);
        }, "image/png");
      } catch {
        try {
          settle(resolve, fallback());
        } catch (error) {
          settle(reject, error);
        }
      }
    });
  }
  return Promise.resolve(fallback());
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("截图底图加载失败。"));
    image.src = source;
  });
}

function drawAnnotationOnCanvas(context, annotation, scale) {
  const color = annotationColor(annotation);
  const strokeWidth = annotationStrokeWidth(annotation);
  if (annotation.type === "rectangle") {
    const rect = scaleRect(annotation, scale);
    context.lineWidth = scaledStroke(scale, strokeWidth);
    context.strokeStyle = color;
    drawRoundedRect(context, rect.x, rect.y, rect.width, rect.height, 6 * scale.x);
    context.stroke();
  } else if (annotation.type === "circle") {
    const rect = scaleRect(annotation, scale);
    context.lineWidth = scaledStroke(scale, strokeWidth);
    context.strokeStyle = color;
    context.beginPath();
    context.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2, rect.height / 2, 0, 0, Math.PI * 2);
    context.stroke();
  } else if (annotation.type === "highlight") {
    drawHighlightAnnotation(context, annotation, scale);
  } else if (annotation.type === "arrow") {
    drawArrowAnnotation(context, annotation, scale);
  } else if (annotation.type === "brush") {
    drawBrushAnnotation(context, annotation, scale);
  } else if (annotation.type === "note") {
    drawNoteAnnotation(context, annotation, scale);
  } else if (annotation.type === "step") {
    drawStepAnnotation(context, annotation, scale);
  } else if (annotation.type === "text") {
    drawTextAnnotation(context, annotation, scale);
  } else if (annotation.type === "watermark") {
    drawWatermarkAnnotation(context, annotation, scale);
  }
}

function drawMosaicAnnotation(context, annotation, scale) {
  const rect = scaleRect(annotation, scale);
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const smallCanvas = document.createElement("canvas");
  const block = Math.max(7, Math.round(12 * Math.max(scale.x, scale.y)));
  smallCanvas.width = Math.max(1, Math.ceil(width / block));
  smallCanvas.height = Math.max(1, Math.ceil(height / block));
  const smallContext = smallCanvas.getContext("2d");
  if (!smallContext) {
    return;
  }
  smallContext.drawImage(context.canvas, rect.x, rect.y, width, height, 0, 0, smallCanvas.width, smallCanvas.height);
  context.save();
  context.imageSmoothingEnabled = false;
  context.drawImage(smallCanvas, 0, 0, smallCanvas.width, smallCanvas.height, rect.x, rect.y, width, height);
  context.restore();
}

function drawHighlightAnnotation(context, annotation, scale) {
  const rect = scaleRect(annotation, scale);
  context.save();
  context.fillStyle = "rgba(0, 0, 0, 0.46)";
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  context.globalCompositeOperation = "destination-out";
  drawRoundedRect(context, rect.x, rect.y, rect.width, rect.height, 7 * Math.max(scale.x, scale.y));
  context.fillStyle = "#000000";
  context.fill();
  context.globalCompositeOperation = "source-over";
  context.lineWidth = scaledStroke(scale, Math.max(1.2, annotationStrokeWidth(annotation) - 1));
  context.strokeStyle = colorWithAlpha(annotationColor(annotation), 0.64);
  drawRoundedRect(context, rect.x, rect.y, rect.width, rect.height, 7 * Math.max(scale.x, scale.y));
  context.stroke();
  context.restore();
}

function drawArrowAnnotation(context, annotation, scale) {
  const color = annotationColor(annotation);
  const strokeWidth = annotationStrokeWidth(annotation);
  const x1 = annotation.x1 * scale.x;
  const y1 = annotation.y1 * scale.y;
  const x2 = annotation.x2 * scale.x;
  const y2 = annotation.y2 * scale.y;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const size = 7.5 * Math.max(scale.x, scale.y);
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = scaledStroke(scale, strokeWidth);
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
  context.beginPath();
  context.moveTo(x2, y2);
  context.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
  context.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
  context.restore();
}

function drawBrushAnnotation(context, annotation, scale) {
  if (!annotation.points?.length) {
    return;
  }
  context.save();
  context.strokeStyle = annotationColor(annotation);
  context.lineWidth = scaledStroke(scale, annotationStrokeWidth(annotation));
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  annotation.points.forEach((point, index) => {
    const x = point.x * scale.x;
    const y = point.y * scale.y;
    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });
  context.stroke();
  context.restore();
}

function drawNoteAnnotation(context, annotation, scale) {
  const rect = scaleRect(annotation, scale);
  context.save();
  context.lineWidth = scaledStroke(scale, Math.max(1.4, annotationStrokeWidth(annotation) - 1));
  context.strokeStyle = annotationColor(annotation);
  drawRoundedRect(context, rect.x, rect.y, rect.width, rect.height, 8 * scale.x);
  context.stroke();
  context.fillStyle = "#ffffff";
  context.font = `760 ${Math.max(12, 14 * scale.y)}px -apple-system, BlinkMacSystemFont, sans-serif`;
  context.textBaseline = "middle";
  context.fillText(annotation.text || "备注", rect.x + 10 * scale.x, rect.y + rect.height / 2, Math.max(24, rect.width - 18 * scale.x));
  context.restore();
}

function drawStepAnnotation(context, annotation, scale) {
  const rect = scaleRect(annotation, scale);
  const radius = Math.min(rect.width, rect.height) / 2;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  context.save();
  context.fillStyle = annotationColor(annotation);
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = `860 ${Math.max(12, 14 * scale.y)}px -apple-system, BlinkMacSystemFont, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(annotation.text || "1", cx, cy + 1 * scale.y);
  context.restore();
}

function drawTextAnnotation(context, annotation, scale) {
  const rect = scaleRect(annotation, scale);
  context.save();
  context.font = `760 ${Math.max(14, 18 * scale.y)}px -apple-system, BlinkMacSystemFont, sans-serif`;
  context.textBaseline = "top";
  context.lineWidth = scaledStroke(scale, 2);
  context.strokeStyle = "rgba(0,0,0,0.58)";
  context.fillStyle = annotationColor(annotation);
  context.strokeText(annotation.text || "文本", rect.x, rect.y, Math.max(24, rect.width));
  context.fillText(annotation.text || "文本", rect.x, rect.y, Math.max(24, rect.width));
  context.restore();
}

function drawWatermarkAnnotation(context, annotation, scale) {
  context.save();
  context.globalAlpha = 0.18;
  context.fillStyle = annotationColor(annotation);
  context.font = `820 ${Math.max(16, 18 * scale.y)}px -apple-system, BlinkMacSystemFont, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const tile of watermarkTiles(annotation, state.selection.width, state.selection.height)) {
    context.save();
    context.translate(tile.x * scale.x, tile.y * scale.y);
    context.rotate(-Math.PI / 10);
    context.fillText(tile.text, 0, 0, WATERMARK_GAP_X * 0.78 * scale.x);
    context.restore();
  }
  context.restore();
}

function scaleRect(annotation, scale) {
  return {
    x: annotation.x * scale.x,
    y: annotation.y * scale.y,
    width: annotation.width * scale.x,
    height: annotation.height * scale.y,
  };
}

function scaledStroke(scale, width) {
  return Math.max(1, width * Math.max(scale.x, scale.y));
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
}

async function completeCapture(action) {
  if (state.busy) {
    return;
  }
  if (!state.selection) {
    showToast("请先框选截图区域。", true);
    return;
  }
  commitTextEditor();
  state.busy = true;
  showToast(action === "save" ? "正在保存截图..." : "正在复制截图...");
  try {
    appElement.dataset.finishing = "true";
    await nextFrame();
    const pixels = selectionToPixels();
    const effects = exportEffectsForPixels(pixels);
    const shouldComposite = state.annotations.length > 0 || effects.rounded || effects.shadow;
    const compositedImageDataUrl = shouldComposite ? await composeSelectionImageDataUrl(pixels, effects) : null;
    await bridge.complete(pixels, action, compositedImageDataUrl);
  } catch (error) {
    state.busy = false;
    appElement.dataset.finishing = "false";
    showToast(getErrorMessage(error, action === "save" ? "保存截图失败。" : "复制截图失败。"), true);
  }
}

async function handleScreenshotAction(action) {
  if (!shortcutEnabled(action)) {
    return;
  }
  if (action === "cancel") {
    await cancelCapture();
    return;
  }
  if (action === "copy") {
    await completeCapture("copy");
    return;
  }
  if (action === "download") {
    await completeCapture("save");
    return;
  }
  if (action === "delay") {
    await restartCaptureAfterDelay();
    return;
  }
  if (action === "pin") {
    showToast("请先复制或下载后固定图片。", true);
  }
}

async function restartCaptureAfterDelay() {
  if (state.busy) {
    return;
  }
  state.busy = true;
  showToast("3 秒后重新截图...");
  try {
    await bridge.restartAfterDelay?.(3);
  } catch (error) {
    state.busy = false;
    showToast(getErrorMessage(error, "延迟截图启动失败。"), true);
  }
}

function nextFrame() {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

async function cancelCapture() {
  if (state.busy) {
    return;
  }
  state.busy = true;
  try {
    await bridge.cancel();
  } catch {
    window.close();
  }
}

function onKeyDown(event) {
  if (eventMatchesShortcut(event, "CmdOrCtrl+Shift+Z")) {
    event.preventDefault();
    redoLastScreenshotChange();
    return;
  }
  if (eventMatchesShortcut(event, "CmdOrCtrl+Z")) {
    event.preventDefault();
    undoLastScreenshotChange();
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    void cancelCapture();
    return;
  }
  if (eventMatchesConfiguredShortcut(event, "cancel", "Escape")) {
    event.preventDefault();
    void handleScreenshotAction("cancel");
    return;
  }
  if (eventMatchesConfiguredShortcut(event, "copy", "Return")) {
    event.preventDefault();
    void handleScreenshotAction("copy");
    return;
  }
  if (eventMatchesConfiguredShortcut(event, "download", "CmdOrCtrl+S")) {
    event.preventDefault();
    void handleScreenshotAction("download");
    return;
  }
  if (eventMatchesConfiguredShortcut(event, "delay", "D")) {
    event.preventDefault();
    void handleScreenshotAction("delay");
    return;
  }
  if (eventMatchesConfiguredShortcut(event, "pin", "P")) {
    event.preventDefault();
    void handleScreenshotAction("pin");
    return;
  }
  const tool = visibleToolItems().find((item) => eventMatchesConfiguredShortcut(event, item.id, item.key));
  if (tool) {
    event.preventDefault();
    activateTool(tool.id);
  }
}

function showToast(message, isError = false) {
  const toast = document.querySelector(".screenshot-toast");
  if (!toast) {
    return;
  }
  if (state.toastTimer) {
    window.clearTimeout(state.toastTimer);
  }
  toast.textContent = message;
  toast.dataset.visible = "true";
  toast.dataset.error = String(isError);
  state.toastTimer = window.setTimeout(() => {
    toast.dataset.visible = "false";
    state.toastTimer = null;
  }, isError ? 4200 : 1900);
}

function getErrorMessage(error, fallbackMessage) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "string" && error) {
    return error;
  }
  return fallbackMessage;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

window.__screenshotTest = {
  getState: () => ({
    selection: state.selection ? { ...state.selection } : null,
    activeTool: state.activeTool,
    style: structuredCloneSafe(state.style),
    toolStyles: structuredCloneSafe(state.toolStyles),
    pointer: state.pointer ? { ...state.pointer } : null,
    annotations: state.annotations.map((annotation) => structuredCloneSafe(annotation)),
    undoCount: state.undoStack.length,
    redoCount: state.redoStack.length,
    recentSelections: state.recentSelections.map((selection) => ({ ...selection })),
    recentSelectionIndex: state.recentSelectionIndex,
    busy: state.busy,
  }),
  selectionToPixels,
  exportEffectsForPixels,
  composeSelectionImageDataUrl,
};

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}
