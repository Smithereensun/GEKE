import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { pinyin } from "pinyin-pro";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_NAME = "极刻 GEKE";
const DEV_SERVER_URL = "http://127.0.0.1:5173";
const DEFAULT_RESULT_LIMIT = 24;
const MAX_RESULT_LIMIT = 48;
const APP_DIRECTORIES = [
  "/Applications",
  path.join(os.homedir(), "Applications"),
  "/System/Applications",
  "/System/Applications/Utilities",
];
const collator = new Intl.Collator("zh-Hans-CN", {
  numeric: true,
  sensitivity: "base",
});

let mainWindow = null;
let scanPromise = null;
let appIndex = [];
let lastScanAt = null;

app.setName(APP_NAME);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 760,
    height: 560,
    minWidth: 680,
    minHeight: 480,
    center: true,
    show: false,
    title: APP_NAME,
    backgroundColor: "#f4efe6",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (app.isPackaged) {
    void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    void mainWindow.loadURL(DEV_SERVER_URL);
  }
}

function showLauncher() {
  if (!mainWindow) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  mainWindow.focus();
}

function createMenu() {
  const template = [
    {
      label: APP_NAME,
      submenu: [
        { role: "about" },
        { type: "separator" },
        {
          label: "显示启动器",
          click: () => showLauncher(),
        },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "窗口",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "front" }],
    },
    {
      label: "查看",
      submenu: [
        ...(!app.isPackaged ? [{ role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }] : []),
        { role: "togglefullscreen" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gu, "");
}

function isSubsequence(query, target) {
  if (!query || !target) {
    return null;
  }

  let lastIndex = -1;
  let gapPenalty = 0;
  let startIndex = -1;

  for (const char of query) {
    const nextIndex = target.indexOf(char, lastIndex + 1);
    if (nextIndex === -1) {
      return null;
    }

    if (startIndex === -1) {
      startIndex = nextIndex;
    } else {
      gapPenalty += nextIndex - lastIndex - 1;
    }

    lastIndex = nextIndex;
  }

  const densityBonus = Math.max(0, query.length * 14 - gapPenalty * 3);
  const startBonus = Math.max(0, 24 - startIndex);
  const lengthPenalty = Math.max(0, target.length - query.length) * 0.2;

  return densityBonus + startBonus - lengthPenalty;
}

function buildPinyinIndex(value) {
  if (!/[\u3400-\u9fff]/u.test(value)) {
    return { full: "", initials: "" };
  }

  const syllables = pinyin(value, {
    toneType: "none",
    type: "array",
    nonZh: "consecutive",
    v: false,
  })
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  return {
    full: syllables.join(""),
    initials: syllables.map((part) => part[0] ?? "").join(""),
  };
}

function viewModelForApp(appEntry, score) {
  return {
    id: appEntry.path,
    name: appEntry.name,
    path: appEntry.path,
    directory: appEntry.directory,
    score,
  };
}

function scoreApplication(appEntry, rawQuery, normalizedQuery) {
  const query = rawQuery.trim().toLowerCase();
  const compactQuery = normalizedQuery;

  if (!query) {
    return 0;
  }

  let bestScore = 0;

  const directComparisons = [
    { value: appEntry.nameLower, exact: 420, prefix: 360, includes: 280 },
    { value: appEntry.aliasLower, exact: 390, prefix: 330, includes: 250 },
    { value: appEntry.pathLower, exact: 210, prefix: 180, includes: 150 },
  ];

  for (const field of directComparisons) {
    if (field.value === query) {
      bestScore = Math.max(bestScore, field.exact);
    } else if (field.value.startsWith(query)) {
      bestScore = Math.max(bestScore, field.prefix - field.value.indexOf(query));
    } else if (field.value.includes(query)) {
      bestScore = Math.max(bestScore, field.includes - field.value.indexOf(query) * 0.5);
    }
  }

  const normalizedComparisons = [
    { value: appEntry.nameNormalized, base: 260 },
    { value: appEntry.aliasNormalized, base: 230 },
    { value: appEntry.pathNormalized, base: 150 },
    { value: appEntry.pinyinFull, base: 320 },
    { value: appEntry.pinyinInitials, base: 300 },
  ];

  for (const field of normalizedComparisons) {
    if (!field.value || !compactQuery) {
      continue;
    }

    if (field.value === compactQuery) {
      bestScore = Math.max(bestScore, field.base + 110);
      continue;
    }

    if (field.value.startsWith(compactQuery)) {
      bestScore = Math.max(bestScore, field.base + 70);
      continue;
    }

    if (field.value.includes(compactQuery)) {
      bestScore = Math.max(bestScore, field.base + 42 - field.value.indexOf(compactQuery) * 0.5);
      continue;
    }

    const subsequenceScore = isSubsequence(compactQuery, field.value);
    if (subsequenceScore !== null) {
      bestScore = Math.max(bestScore, field.base + subsequenceScore);
    }
  }

  if (bestScore === 0) {
    return 0;
  }

  const locationBoost = appEntry.directory.startsWith("/Applications") ? 18 : 8;
  const lengthPenalty = appEntry.name.length * 0.3;

  return bestScore + locationBoost - lengthPenalty;
}

function searchIndex(query) {
  const trimmed = query.trim();

  if (!trimmed) {
    return appIndex
      .slice()
      .sort((left, right) => collator.compare(left.name, right.name))
      .slice(0, DEFAULT_RESULT_LIMIT)
      .map((item) => viewModelForApp(item, 0));
  }

  const normalizedQuery = normalizeText(trimmed);

  return appIndex
    .map((item) => ({
      item,
      score: scoreApplication(item, trimmed, normalizedQuery),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return collator.compare(left.item.name, right.item.name);
    })
    .slice(0, MAX_RESULT_LIMIT)
    .map(({ item, score }) => viewModelForApp(item, score));
}

async function walkApplications(rootPath, collectedPaths) {
  let entries = [];

  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries.map(async (entry) => {
      if (!entry.isDirectory() || entry.name.startsWith(".")) {
        return;
      }

      const fullPath = path.join(rootPath, entry.name);

      if (entry.name.endsWith(".app")) {
        collectedPaths.add(fullPath);
        return;
      }

      await walkApplications(fullPath, collectedPaths);
    }),
  );
}

async function readInfoPlist(infoPlistPath) {
  try {
    const { stdout } = await execFileAsync("plutil", ["-convert", "json", "-o", "-", infoPlistPath]);
    return JSON.parse(stdout);
  } catch {
    return {};
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let currentIndex = 0;

  async function runWorker() {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

async function buildAppEntry(appPath) {
  const infoPlistPath = path.join(appPath, "Contents", "Info.plist");
  const plist = await readInfoPlist(infoPlistPath);
  const fileName = path.basename(appPath, ".app");
  const displayName =
    typeof plist.CFBundleDisplayName === "string" && plist.CFBundleDisplayName.trim()
      ? plist.CFBundleDisplayName.trim()
      : "";
  const bundleName =
    typeof plist.CFBundleName === "string" && plist.CFBundleName.trim() ? plist.CFBundleName.trim() : "";
  const name = displayName || bundleName || fileName;
  const alias = [displayName, bundleName, fileName]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(" ");
  const { full: pinyinFull, initials: pinyinInitials } = buildPinyinIndex(alias);

  return {
    name,
    path: appPath,
    directory: path.dirname(appPath),
    nameLower: name.toLowerCase(),
    aliasLower: alias.toLowerCase(),
    pathLower: appPath.toLowerCase(),
    nameNormalized: normalizeText(name),
    aliasNormalized: normalizeText(alias),
    pathNormalized: normalizeText(appPath),
    pinyinFull,
    pinyinInitials,
  };
}

async function scanApplications() {
  if (scanPromise) {
    return scanPromise;
  }

  scanPromise = (async () => {
    const collectedPaths = new Set();

    for (const appDirectory of APP_DIRECTORIES) {
      await walkApplications(appDirectory, collectedPaths);
    }

    const discovered = await mapWithConcurrency([...collectedPaths], 8, buildAppEntry);
    appIndex = discovered.sort((left, right) => collator.compare(left.name, right.name));
    lastScanAt = new Date().toISOString();

    return appIndex;
  })().finally(() => {
    scanPromise = null;
  });

  return scanPromise;
}

function buildSearchResponse(query) {
  return {
    query,
    results: searchIndex(query),
    totalCount: appIndex.length,
    scannedPaths: APP_DIRECTORIES,
    lastScanAt,
  };
}

async function launchApplication(appPath) {
  if (!appPath) {
    throw new Error("缺少应用路径。");
  }

  const errorMessage = await shell.openPath(appPath);

  if (errorMessage) {
    throw new Error(errorMessage);
  }

  return true;
}

ipcMain.handle("geke:search-applications", async (_event, query = "") => {
  if (appIndex.length === 0) {
    await scanApplications();
  }

  return buildSearchResponse(query);
});

ipcMain.handle("geke:rescan-applications", async () => {
  await scanApplications();
  return buildSearchResponse("");
});

ipcMain.handle("geke:launch-application", async (_event, appPath) => launchApplication(appPath));

ipcMain.handle("geke:hide-launcher", async () => {
  mainWindow?.hide();
  return true;
});

app.whenReady().then(() => {
  createMenu();
  createWindow();
  void scanApplications();
});

app.on("activate", () => {
  showLauncher();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
