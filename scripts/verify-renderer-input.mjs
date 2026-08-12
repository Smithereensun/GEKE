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
            iconDataUrl: "data:image/png;base64,fixture",
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

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

let resolveInitialApps;
const searchQueries = [];
const fileSearchQueries = [];
let launchCount = 0;
let openFileCount = 0;
let runScreenshotPluginCount = 0;
let restoreRecentPinnedImageCount = 0;
let hideCount = 0;
let scrollIntoViewCount = 0;
let selectSearchPathCount = 0;
let authorizeSearchPathCount = 0;
let openPriorityPermissionSettingsCount = 0;
let openScreenRecordingPermissionSettingsCount = 0;
let screenshotErrorCallback = null;
const settingsUpdates = [];

const dom = new JSDOM("<!doctype html><html><body><div id=\"app\"></div></body></html>", {
  url: "http://127.0.0.1:5173/",
  runScripts: "dangerously",
  pretendToBeVisual: true,
});

const { window } = dom;
window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
  scrollIntoViewCount += 1;
};
window.geke = {
  getInitialApps: () =>
    new Promise((resolve) => {
      resolveInitialApps = resolve;
    }),
  searchApplications: async (query = "") => {
    searchQueries.push(query);
    return createPayload(query);
  },
  searchFiles: async (query = "") => {
    fileSearchQueries.push(query);
    return query
      ? [
          {
            id: `file-${query}`,
            name: `${query}.txt`,
            path: `/Users/chen/${query}.txt`,
            kind: "txt",
          },
        ]
      : [];
  },
  launchApplication: async () => {
    launchCount += 1;
    return true;
  },
  rescanApplications: async () => createPayload(""),
  openFile: async () => {
    openFileCount += 1;
    return true;
  },
  runScreenshotPlugin: async () => {
    runScreenshotPluginCount += 1;
    return true;
  },
  restoreRecentPinnedImage: async () => {
    restoreRecentPinnedImageCount += 1;
    return true;
  },
  selectSearchPaths: async () => {
    selectSearchPathCount += 1;
    return ["/Users/chen/Desktop", "/Users/chen/Documents", "/Users/chen/Downloads", "/Users/chen/Pictures"];
  },
  authorizeCurrentSearchPaths: async (paths = []) => {
    authorizeSearchPathCount += 1;
    return paths.filter((path) => path.includes("missing"));
  },
  openPriorityPermissionSettings: async () => {
    openPriorityPermissionSettingsCount += 1;
    return true;
  },
  openScreenRecordingPermissionSettings: async () => {
    openScreenRecordingPermissionSettingsCount += 1;
    return true;
  },
  hideLauncher: async () => {
    hideCount += 1;
    return true;
  },
  getSettings: async () => ({
    toggleShortcut: "Alt+Space",
    multiWakeEnabled: true,
    singleWakeEnabled: false,
    singleWakeShortcut: "F18",
    searchAllShortcut: "F1",
    searchAppsShortcut: "F2",
    searchFilesShortcut: "F3",
    rescanShortcut: "CmdOrCtrl+R",
    doubleWakeEnabled: false,
    doubleWakeModifier: "Alt",
    longPressWakeEnabled: false,
    longPressWakeModifier: "Alt",
    mouseWakeEnabled: false,
    preferGekeShortcuts: true,
    operationSoundEnabled: false,
    menuIconVisible: true,
    launchAtLogin: false,
    appSearchPaths: ["/Applications"],
    invalidAppSearchPaths: [],
    fileSearchPaths: ["/Users/chen/Documents", "/Users/chen/Downloads"],
    invalidFileSearchPaths: [],
    language: "zh-CN",
    appearanceMode: "system",
    animationMode: "smooth",
    screenshotPlugin: undefined,
    shortcutStatus: {
      registered: true,
      shortcut: "Alt+Space",
      message: "Shortcut registered.",
    },
  }),
  updateSettings: async (settings) => {
    settingsUpdates.push(settings);
    if (settings.toggleShortcut === "Alt+CmdOrCtrl") {
      throw new Error("modifier-only shortcuts are unavailable");
    }
    return {
      ...settings,
      invalidAppSearchPaths: (settings.appSearchPaths || []).filter((path) => path.includes("missing")),
      invalidFileSearchPaths: (settings.fileSearchPaths || []).filter((path) => path.includes("missing")),
      shortcutStatus: {
        registered: true,
        shortcut: settings.toggleShortcut,
        message: "Shortcut registered.",
      },
    };
  },
  exportSettingsConfig: async () => true,
  importSettingsConfig: async () => null,
  onWindowVisible: () => {},
  onSettingsChanged: () => {},
  onOpenSettings: () => {},
  onScreenshotError: (callback) => {
    screenshotErrorCallback = callback;
  },
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
assert(input.placeholder.includes("应用") && input.placeholder.includes("文件"), "default placeholder should show mixed app and file search");
assert(typeof screenshotErrorCallback === "function", "renderer should subscribe to screenshot error events");
screenshotErrorCallback("截图需要屏幕录制权限。");
await nextFrame(window);
assert(window.document.querySelector(".result-error")?.textContent.includes("屏幕录制权限"), "global screenshot errors should be visible in the launcher");

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

await delay(190);
await Promise.resolve();
await nextFrame(window);
assert(searchQueries.includes("abc"), "input event should update query before searching");
assert(fileSearchQueries.includes("abc"), "default search mode should include file search");
assert(window.document.querySelector(".result-icon--image img"), "application results should render real icon images when available");

window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "F2",
    code: "F2",
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await nextFrame(window);
assert(!window.document.querySelector(".mode-pill"), "mode pill should not render on the main panel");
assert(input.placeholder.includes("应用") && !input.placeholder.includes("文件"), "F2 should switch the placeholder to app search");

window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "F3",
    code: "F3",
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await nextFrame(window);
assert(!window.document.querySelector(".status-pill"), "status pill should not render on the main panel");
assert(input.placeholder.includes("文件") && !input.placeholder.includes("应用"), "F3 should switch the placeholder to file search");

const fileEnter = new window.KeyboardEvent("keydown", {
  key: "Enter",
  code: "Enter",
  bubbles: true,
  cancelable: true,
});
window.dispatchEvent(fileEnter);
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);
assert(openFileCount === 1, "enter should open the selected file in file-only mode");

window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "F1",
    code: "F1",
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await nextFrame(window);
assert(searchQueries.at(-1) === "abc" && fileSearchQueries.at(-1) === "abc", "F1 should switch to mixed search");
assert(input.placeholder.includes("应用") && input.placeholder.includes("文件"), "F1 should switch the placeholder to mixed search");

window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "F2",
    code: "F2",
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await nextFrame(window);

const arrowDown = new window.KeyboardEvent("keydown", {
  key: "ArrowDown",
  code: "ArrowDown",
  bubbles: true,
  cancelable: true,
});
window.dispatchEvent(arrowDown);
await nextFrame(window);

assert(scrollIntoViewCount === 1, "keyboard navigation should keep the selected result visible");

const selectedRow = window.document.querySelector(".result-row");
selectedRow.dispatchEvent(
  new window.MouseEvent("pointermove", {
    bubbles: true,
    clientX: 20,
    clientY: 20,
  }),
);
await nextFrame(window);

assert(scrollIntoViewCount === 1, "pointer hover should not force list scrolling");

const enter = new window.KeyboardEvent("keydown", {
  key: "Enter",
  code: "Enter",
  bubbles: true,
  cancelable: true,
});
window.dispatchEvent(enter);
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(launchCount === 1, "enter should launch the selected application");
assert(hideCount === 2, "successful file open and app launch should hide the launcher");

window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: ",",
    code: "Comma",
    metaKey: true,
    bubbles: true,
    cancelable: true,
  }),
);
await nextFrame(window);

window.document.querySelector('[data-action="set-settings-section"][data-settings-section-target="paths"]').click();
await nextFrame(window);

assert(!window.document.querySelector('[data-path-input="apps"]'), "path settings should use permission-style path rows instead of textareas");
assert(window.document.querySelector('[data-permission-path-kind="apps"] .permission-path-row'), "app search paths should render as removable rows");
assert(window.document.querySelector('[data-permission-path-kind="files"] .permission-path-row'), "file search paths should render as removable rows");
assert(window.document.querySelector('[data-permission-path-kind="files"] [data-action="authorize-search-paths"]'), "path settings should show an authorize action");
assert(window.document.querySelector('[data-permission-path-kind="files"] [data-action="select-search-paths"]'), "path settings should show a select action");

window.document.querySelector('[data-action="authorize-search-paths"][data-path-kind="files"]').click();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(authorizeSearchPathCount === 1, "authorize search paths should check configured paths");
assert(selectSearchPathCount === 0, "authorize search paths should not open the folder picker");

window.document.querySelector('[data-action="select-search-paths"][data-path-kind="files"]').click();
await Promise.resolve();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(selectSearchPathCount === 1, "select search paths should open the folder picker");
assert(settingsUpdates.at(-1)?.fileSearchPaths?.includes("/Users/chen/Desktop"), "selected paths should be saved to file search paths");
assert(settingsUpdates.at(-1)?.fileSearchPaths?.includes("/Users/chen/Documents"), "selected paths should preserve existing file search paths");

window.document.querySelector('[data-action="set-settings-section"][data-settings-section-target="shortcuts"]').click();
await nextFrame(window);

assert(!window.document.querySelector('[data-wake-target="mouse"]'), "mouse wake card should be removed");
assert(window.document.querySelector(".shortcut-guide .wake-card-grid"), "wake cards should render inside the shortcut guide");
assert(!window.document.querySelector(".settings-section > .wake-panel-settings"), "wake cards should not render above the shortcut guide");

const settingsPanel = window.document.querySelector(".settings-panel");
settingsPanel.scrollTop = 180;
window.document.querySelector('[data-action="toggle-wake"][data-wake-target="double"]').click();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);
await nextFrame(window);

assert(settingsUpdates.at(-1)?.doubleWakeEnabled === true, "double wake card should save its enabled state");
assert(window.document.querySelector(".settings-panel").scrollTop === 180, "settings panel should keep its scroll position after toggling");

window.document.querySelector('[data-action="toggle-wake"][data-wake-target="long"]').click();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.at(-1)?.longPressWakeEnabled === true, "long-press wake card should save its enabled state");
assert(settingsUpdates.at(-1)?.doubleWakeEnabled === true, "long-press wake should not overwrite double wake");
assert(!window.document.querySelector('[data-wake-target="single"]'), "single wake card should be removed");

window.document.querySelector('[data-action="toggle-wake"][data-wake-target="multi"]').click();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.at(-1)?.multiWakeEnabled === false, "multi wake should be toggleable off");
assert(window.document.querySelector('[data-wake-target="multi"]').dataset.active === "false", "disabled multi wake should not be highlighted");

window.document.querySelector('[data-action="toggle-wake"][data-wake-target="double"]').click();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.at(-1)?.doubleWakeEnabled === false, "double wake should be toggleable off");
assert(window.document.querySelector('[data-wake-target="double"]').dataset.active === "false", "disabled double wake should not be highlighted");

const updateCountBeforeLastWakeToggle = settingsUpdates.length;
window.document.querySelector('[data-action="toggle-wake"][data-wake-target="long"]').click();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.length === updateCountBeforeLastWakeToggle, "last wake shortcut should not be turned off");
assert(window.document.querySelector('[data-wake-target="long"]').dataset.active === "true", "last wake shortcut should stay highlighted");
assert(window.document.querySelector(".settings-message").dataset.tone === "error", "last wake shortcut warning should be an error");

let multiWakeCard = window.document.querySelector('[data-wake-target="multi"]');
window.document.querySelector('[data-action="record-shortcut"][data-wake-target="multi"]').click();
await nextFrame(window);

assert(window.document.querySelector('[data-action="record-shortcut"][data-wake-target="multi"]').dataset.recording === "true", "multi wake recorder should show recording state");
assert(window.document.querySelector('[data-action="record-shortcut"][data-wake-target="multi"]').textContent.includes("取消"), "active wake recorder should offer cancel");
assert(window.document.querySelector('[data-action="record-shortcut"][data-wake-target="searchAllShortcut"]').disabled === true, "other shortcut recorders should be disabled while wake recording");

window.document.querySelector('[data-action="record-shortcut"][data-wake-target="multi"]').click();
await nextFrame(window);

assert(!window.document.querySelector('[data-action="record-shortcut"][data-wake-target="multi"]').textContent.includes("取消"), "clicking the active wake recorder should cancel recording");
assert(window.document.querySelector('[data-action="record-shortcut"][data-wake-target="searchAllShortcut"]').disabled === false, "other shortcut recorders should unlock after cancel");

window.document.querySelector('[data-action="record-shortcut"][data-wake-target="multi"]').click();
await nextFrame(window);

window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "k",
    code: "KeyK",
    altKey: true,
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.at(-1)?.toggleShortcut === "Alt+K", "recorded shortcut should save automatically");
assert(settingsUpdates.at(-1)?.multiWakeEnabled === true, "recording multi wake should enable multi wake");
assert(settingsUpdates.at(-1)?.doubleWakeEnabled === false, "multi wake should not overwrite double wake");
assert(settingsUpdates.at(-1)?.longPressWakeEnabled === true, "multi wake should not overwrite long-press wake");
multiWakeCard = window.document.querySelector('[data-wake-target="multi"]');
assert(multiWakeCard.querySelector(".shortcut-recorder span").textContent.trim() === "Option + K", "recorder should show the saved shortcut");

window.document.querySelector('[data-action="record-shortcut"][data-wake-target="multi"]').click();
await nextFrame(window);

window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "\u00A0",
    code: "Space",
    altKey: true,
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.at(-1)?.toggleShortcut === "Alt+Space", "multi wake should record Option+Space from the physical Space key");
multiWakeCard = window.document.querySelector('[data-wake-target="multi"]');
assert(multiWakeCard.querySelector(".shortcut-recorder span").textContent.trim() === "Option + Space", "recorder should show Option+Space");
assert(window.document.querySelector(".settings-message").dataset.tone === "success", "Option+Space should save successfully");

assert(!window.document.querySelector('[data-action="toggle-prefer-geke-shortcuts"]'), "GEKE shortcut priority should not render in shortcut settings");
window.document.querySelector('[data-action="set-settings-section"][data-settings-section-target="permissions"]').click();
await nextFrame(window);

const preferShortcutToggle = window.document.querySelector('[data-action="toggle-prefer-geke-shortcuts"]');
assert(window.document.querySelectorAll('[data-action="toggle-prefer-geke-shortcuts"]').length === 1, "GEKE shortcut priority should only render once in permissions");
assert(preferShortcutToggle?.dataset.active === "true", "GEKE shortcut priority should default to enabled");
preferShortcutToggle.click();
await Promise.resolve();
await Promise.resolve();
await delay(260);
await nextFrame(window);

assert(settingsUpdates.at(-1)?.preferGekeShortcuts === false, "GEKE shortcut priority toggle should save disabled state");
assert(window.document.querySelector('[data-action="toggle-prefer-geke-shortcuts"]').dataset.active === "false", "GEKE shortcut priority toggle should update after saving");
assert(window.document.querySelector(".settings-message")?.textContent.includes("保存"), "saved settings message should appear briefly");
await delay(2300);
await nextFrame(window);
assert(window.document.querySelector(".settings-message")?.textContent.trim() === "", "saved settings message should auto-dismiss");

window.document.querySelector('[data-action="open-priority-permission-settings"]').click();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);
assert(openPriorityPermissionSettingsCount === 1, "priority permission action should open macOS settings");

assert(window.document.querySelector('[data-action="open-screen-recording-permission-settings"]'), "screen recording permission action should render in permissions");
window.document.querySelector('[data-action="open-screen-recording-permission-settings"]').click();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);
assert(openScreenRecordingPermissionSettingsCount === 1, "screen recording permission action should open macOS settings");

window.document.querySelector('[data-action="set-settings-section"][data-settings-section-target="animation"]').click();
await nextFrame(window);

assert(window.document.documentElement.dataset.animationMode === "smooth", "animation mode should default to smooth");
assert(window.document.querySelector('[data-action="set-animation"][data-animation="none"]'), "animation settings should include an off option");
window.document.querySelector('[data-action="set-animation"][data-animation="none"]').click();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.at(-1)?.animationMode === "none", "animation mode should save the off option");
assert(window.document.documentElement.dataset.animationMode === "none", "animation mode should update the root dataset");

window.document.querySelector('[data-action="set-settings-section"][data-settings-section-target="tray-icon"]').click();
await nextFrame(window);
window.document.querySelector('[data-action="toggle-boolean-setting"][data-setting="menuIconVisible"]').click();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.at(-1)?.menuIconVisible === false, "menu icon visibility should save disabled state");
assert(window.document.querySelector(".settings-message")?.textContent.includes("菜单图标"), "menu icon toggle should use a menu-icon-specific saved message");
assert(!window.document.querySelector(".settings-message")?.textContent.includes("快捷键"), "menu icon toggle should not show shortcut saved text");

window.document.querySelector('[data-action="set-settings-section"][data-settings-section-target="permissions"]').click();
await nextFrame(window);

const authorizeCountBeforePermissionClick = authorizeSearchPathCount;
window.document.querySelector('[data-action="authorize-search-paths"][data-path-kind="files"]').click();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(authorizeSearchPathCount === authorizeCountBeforePermissionClick + 1, "file folder authorize action should check current paths");

const selectCountBeforePermissionClick = selectSearchPathCount;
window.document.querySelector('[data-action="select-search-paths"][data-path-kind="files"]').click();
await Promise.resolve();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(selectSearchPathCount === selectCountBeforePermissionClick + 1, "file folder select action should open folder picker");
assert(settingsUpdates.at(-1)?.fileSearchPaths?.includes("/Users/chen/Desktop"), "file folder select action should save authorized paths");
assert(window.document.querySelectorAll('[data-permission-path-kind="files"] [data-action="toggle-permission-path-group"]').length === 1, "permission path list should show an expand control when it has many paths");
assert(window.document.querySelectorAll('[data-permission-path-kind="files"] .permission-path-row').length === 3, "permission paths should render collapsed rows");

window.document.querySelector('[data-permission-path-kind="files"] [data-action="toggle-permission-path-group"]').click();
await nextFrame(window);
assert(window.document.querySelectorAll('[data-permission-path-kind="files"] .permission-path-row').length >= 5, "permission path expand action should render all rows");

window.document.querySelector('[data-permission-path-kind="files"] [data-action="toggle-permission-path-group"]').click();
await nextFrame(window);
assert(window.document.querySelectorAll('[data-permission-path-kind="files"] .permission-path-row').length === 3, "permission path collapse action should hide extra rows");

const removedFilePath = window.document.querySelector('[data-action="remove-search-path"][data-path-kind="files"]').dataset.pathValue;
window.document.querySelector('[data-action="remove-search-path"][data-path-kind="files"]').click();
await Promise.resolve();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(!settingsUpdates.at(-1)?.fileSearchPaths?.includes(removedFilePath), "permission path remove action should save without the removed path");

window.document.querySelector('[data-action="set-settings-section"][data-settings-section-target="shortcuts"]').click();
await nextFrame(window);

window.document.querySelector('[data-action="record-shortcut"][data-wake-target="searchAllShortcut"]').click();
await nextFrame(window);

assert(window.document.querySelector('[data-action="record-shortcut"][data-wake-target="multi"]').disabled === true, "wake recorders should be disabled while an app shortcut is recording");

window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "1",
    code: "Digit1",
    altKey: true,
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.at(-1)?.searchAllShortcut === "Alt+1", "editable app shortcut should save");

const updatesBeforeMultiConflict = settingsUpdates.length;
window.document.querySelector('[data-action="record-shortcut"][data-wake-target="multi"]').click();
await nextFrame(window);
window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "1",
    code: "Digit1",
    altKey: true,
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.length === updatesBeforeMultiConflict, "multi wake shortcut should not save when it conflicts with app shortcuts");
assert(window.document.querySelector('[data-wake-target="multi"][data-conflict="true"]'), "conflicting multi wake card should be highlighted");
assert(window.document.querySelector('[data-wake-target="multi"] .shortcut-row-error')?.textContent.includes("冲突"), "multi wake conflict should be shown near the wake card");

window.document.querySelector('[data-action="record-shortcut"][data-wake-target="multi"]').click();
await nextFrame(window);

const updatesBeforeConflictShortcut = settingsUpdates.length;
window.document.querySelector('[data-action="record-shortcut"][data-wake-target="searchAppsShortcut"]').click();
await nextFrame(window);
window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.length === updatesBeforeConflictShortcut, "conflicting fixed shortcut should not save");
assert(window.document.querySelector('[data-conflict="true"] .shortcut-recorder')?.textContent.includes("Enter"), "conflicting shortcut should be highlighted");
assert(window.document.querySelector(".shortcut-row-error")?.textContent.includes("冲突"), "conflicting shortcut warning should be shown inline");

window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "a",
    code: "KeyA",
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.length === updatesBeforeConflictShortcut, "single letter shortcut should not save");
assert(window.document.querySelector(".shortcut-row-error")?.textContent.includes("单个"), "single letter shortcut warning should be shown inline");

window.document.querySelector('[data-action="toggle-shortcut-group"][data-shortcut-group="search"]').click();
await nextFrame(window);
assert(!window.document.querySelector('[data-wake-target="searchAppsShortcut"]'), "shortcut groups should collapse");
assert(window.document.querySelector('[data-shortcut-group="screenshot"]'), "screenshot shortcut group should always appear in the shortcut guide");
assert(window.document.querySelector('[data-action="record-shortcut"][data-wake-target="screenshotPluginShortcut"]'), "screenshot shortcut should be editable in the shortcut guide");
assert(window.document.querySelector('[data-action="record-shortcut"][data-wake-target="screenshotPinRestoreShortcut"]'), "restore pinned image shortcut should be editable in the shortcut guide");

window.document.querySelector('[data-action="set-settings-section"][data-settings-section-target="plugins"]').click();
await nextFrame(window);

assert(window.document.querySelectorAll(".plugin-card").length === 1, "more plugins should only list the screenshot plugin");
assert(window.document.querySelector('[data-plugin-id="screenshot"][data-plugin-action="install"]'), "screenshot plugin should default to not downloaded");

window.document.querySelector('[data-plugin-id="screenshot"][data-plugin-action="install"]').click();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.at(-1)?.screenshotPlugin?.installed === true, "installing the screenshot plugin should save installed state");
assert(settingsUpdates.at(-1)?.screenshotPlugin?.enabled === true, "installing the screenshot plugin should enable it");
assert(window.document.querySelector('[data-screenshot-input="fileNameFormat"]')?.value.startsWith("极刻截图_"), "screenshot file name should default to GEKE");
assert(window.document.querySelector('[data-screenshot-input="watermarkText"]')?.value === "极刻 GEKE", "screenshot watermark text should use the GEKE default");

window.document.querySelector('[data-action="toggle-screenshot-tool"][data-tool-id="copy"]').click();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.at(-1)?.screenshotPlugin?.toolShortcuts?.copy?.enabled === false, "screenshot action switches should save enabled state");
assert(window.document.querySelector('[data-action="toggle-screenshot-tool"][data-tool-id="copy"]')?.dataset.active === "false", "screenshot action switch should update after saving");

window.document.querySelector('[data-action="set-screenshot-setting"][data-screenshot-setting="saveBehavior"][data-value="defaultFolder"]').click();
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.at(-1)?.screenshotPlugin?.saveBehavior === "defaultFolder", "screenshot save behavior should save selected mode");
assert(window.document.querySelector('[data-screenshot-setting="saveBehavior"][data-value="defaultFolder"]')?.dataset.active === "true", "selected screenshot save behavior should stay highlighted");

const watermarkInput = window.document.querySelector('[data-screenshot-input="watermarkText"]');
watermarkInput.value = "我的水印";
watermarkInput.dispatchEvent(new window.Event("change", { bubbles: true }));
await Promise.resolve();
await nextFrame(window);
assert(settingsUpdates.at(-1)?.screenshotPlugin?.watermarkText === "我的水印", "watermark text should be configurable from screenshot plugin settings");

window.document.querySelector('[data-action="set-settings-section"][data-settings-section-target="shortcuts"]').click();
await nextFrame(window);

assert(window.document.querySelector('[data-shortcut-group="screenshot"]'), "installed screenshot shortcuts should appear in the shortcut guide");
assert(window.document.querySelector('[data-wake-target="screenshotPinRestoreShortcut"]')?.textContent.includes("Command + Shift + P"), "restore pinned image shortcut should show the default shortcut");

window.document.querySelector('[data-action="record-shortcut"][data-wake-target="screenshotPluginShortcut"]').click();
await nextFrame(window);
window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "8",
    code: "Digit8",
    altKey: true,
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.at(-1)?.screenshotPlugin?.shortcut === "Alt+8", "screenshot shortcut should be editable from the shortcut guide");

window.document.querySelector('[data-action="record-shortcut"][data-wake-target="screenshotPinRestoreShortcut"]').click();
await nextFrame(window);
window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "9",
    code: "Digit9",
    altKey: true,
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.at(-1)?.screenshotPlugin?.pinRestoreShortcut === "Alt+9", "restore pinned image shortcut should be editable from the shortcut guide");

const updatesBeforePluginConflict = settingsUpdates.length;
window.document.querySelector('[data-action="record-shortcut"][data-wake-target="screenshotPluginShortcut"]').click();
await nextFrame(window);
window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "1",
    code: "Digit1",
    altKey: true,
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await nextFrame(window);

assert(settingsUpdates.length === updatesBeforePluginConflict, "screenshot shortcut should not save when it duplicates app shortcuts");
assert(window.document.querySelector('[data-conflict="true"] .shortcut-recorder')?.textContent.includes("Option + 1"), "conflicting screenshot shortcut should be highlighted");

window.document.querySelector('[data-action="record-shortcut"][data-wake-target="screenshotPluginShortcut"]').click();
await nextFrame(window);
window.document.querySelector('[data-action="close-settings"]').click();
await nextFrame(window);

window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "1",
    code: "Digit1",
    altKey: true,
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await nextFrame(window);

input.value = "截图";
input.dispatchEvent(
  new window.InputEvent("input", {
    bubbles: true,
    inputType: "insertText",
    data: "图",
  }),
);
await delay(190);
await Promise.resolve();
await nextFrame(window);

assert(window.document.querySelector('.result-icon[data-type="screenshot"]'), "installed screenshot command should appear in search");
window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "Enter",
    code: "Enter",
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await Promise.resolve();
await nextFrame(window);

assert(runScreenshotPluginCount === 1, "enter should run the selected screenshot command");
assert(hideCount === 2, "running the screenshot command should keep the launcher visible");

window.dispatchEvent(
  new window.KeyboardEvent("keydown", {
    key: "9",
    code: "Digit9",
    altKey: true,
    bubbles: true,
    cancelable: true,
  }),
);
await Promise.resolve();
await nextFrame(window);

assert(restoreRecentPinnedImageCount === 1, "restore pinned image shortcut should call the restore command");

resolveInitialApps(createPayload(""));
await nextFrame(window);
await Promise.resolve();
await nextFrame(window);

assert(input.value === "截图", "stale initial payload should not clear the active input value");

console.log("renderer input verification passed");
