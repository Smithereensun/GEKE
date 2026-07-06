import { app, BrowserWindow, Menu, ipcMain, shell } from "electron";
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
const DEFAULT_RESULTS = 14;
const SEARCH_LIMIT = 40;
const APP_DIRECTORIES = [
  "/Applications",
  path.join(os.homedir(), "Applications"),
  "/System/Applications",
  "/System/Applications/Utilities",
];
const collator = new Intl.Collator("zh-Hans-CN", {
  sensitivity: "base",
  numeric: true,
});

let mainWindow = null;
let appIndex = [];
let lastScanAt = null;
let activeScanPromise = null;

app.setName(APP_NAME);
const rendererEntryUrl = process.env.GEKE_DEV_SERVER_URL || DEV_SERVER_URL;

function notifyRendererWindowVisible() {
  if (!mainWindow || mainWindow.webContents.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("launcher:window-visible");
}

function normalizeText(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/gu, "");
}

function scoreSubsequence(query, target) {
  if (!query || !target) {
    return 0;
  }

  let lastIndex = -1;
  let gapPenalty = 0;
  let firstIndex = -1;

  for (const character of query) {
    const nextIndex = target.indexOf(character, lastIndex + 1);
    if (nextIndex === -1) {
      return 0;
    }

    if (firstIndex === -1) {
      firstIndex = nextIndex;
    } else {
      gapPenalty += nextIndex - lastIndex - 1;
    }

    lastIndex = nextIndex;
  }

  return Math.max(0, query.length * 18 - gapPenalty * 3 + Math.max(0, 18 - firstIndex));
}

function buildPinyinIndex(value) {
  if (!/[\u3400-\u9fff]/u.test(value)) {
    return { full: "", initials: "" };
  }

  const parts = pinyin(value, {
    toneType: "none",
    type: "array",
    nonZh: "consecutive",
    v: false,
  })
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return {
    full: parts.join(""),
    initials: parts.map((item) => item[0] ?? "").join(""),
  };
}

function compareEntries(left, right) {
  if (left.directoryRank !== right.directoryRank) {
    return left.directoryRank - right.directoryRank;
  }

  return collator.compare(left.name, right.name);
}

async function directoryExists(directory) {
  try {
    const stats = await fs.stat(directory);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function collectAppBundles(rootDirectory, sourceDirectory) {
  if (!(await directoryExists(rootDirectory))) {
    return [];
  }

  const bundles = [];
  const queue = [rootDirectory];

  while (queue.length) {
    const currentDirectory = queue.shift();
    let entries;

    try {
      entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    } catch {
      continue;
    }

    entries.sort((left, right) => collator.compare(left.name, right.name));

    for (const entry of entries) {
      if (entry.name.startsWith(".") || !entry.isDirectory()) {
        continue;
      }

      const fullPath = path.join(currentDirectory, entry.name);
      if (entry.name.toLowerCase().endsWith(".app")) {
        bundles.push({ path: fullPath, directory: sourceDirectory });
        continue;
      }

      queue.push(fullPath);
    }
  }

  return bundles;
}

async function readApplicationName(appPath) {
  const fallbackName = path.basename(appPath, ".app");
  const plistPath = path.join(appPath, "Contents", "Info.plist");

  try {
    const { stdout } = await execFileAsync("/usr/bin/plutil", ["-convert", "json", "-o", "-", plistPath], {
      maxBuffer: 4 * 1024 * 1024,
    });
    const plist = JSON.parse(stdout);
    return String(plist.CFBundleDisplayName || plist.CFBundleName || fallbackName).trim() || fallbackName;
  } catch {
    return fallbackName;
  }
}

function buildIndexEntry(appPath, directory, name) {
  const bundleName = path.basename(appPath, ".app");
  const alias = bundleName === name ? "" : bundleName;
  const pinyinIndex = buildPinyinIndex([name, alias].filter(Boolean).join(" "));

  return {
    id: appPath,
    name,
    path: appPath,
    directory,
    alias,
    directoryRank: Math.max(APP_DIRECTORIES.indexOf(directory), 0),
    nameLower: name.toLowerCase(),
    aliasLower: alias.toLowerCase(),
    pathLower: appPath.toLowerCase(),
    nameNormalized: normalizeText(name),
    aliasNormalized: normalizeText(alias),
    pathNormalized: normalizeText(appPath),
    pinyinFull: pinyinIndex.full,
    pinyinInitials: pinyinIndex.initials,
  };
}

function fieldScore(query, target, weights) {
  if (!query || !target) {
    return 0;
  }

  if (target === query) {
    return weights.exact;
  }

  if (target.startsWith(query)) {
    return weights.prefix - Math.max(0, target.length - query.length) * 0.2;
  }

  const includeIndex = target.indexOf(query);
  if (includeIndex !== -1) {
    return weights.includes - includeIndex * 2;
  }

  const subsequenceScore = scoreSubsequence(query, target);
  if (subsequenceScore > 0) {
    return weights.subsequence + subsequenceScore;
  }

  return 0;
}

function scoreApplication(entry, rawQuery) {
  const lowerQuery = rawQuery.trim().toLowerCase();
  if (!lowerQuery) {
    return 0;
  }

  const normalizedQuery = normalizeText(lowerQuery);

  return Math.max(
    fieldScore(lowerQuery, entry.nameLower, { exact: 1200, prefix: 980, includes: 760, subsequence: 540 }),
    fieldScore(lowerQuery, entry.aliasLower, { exact: 1080, prefix: 900, includes: 720, subsequence: 500 }),
    fieldScore(lowerQuery, entry.pathLower, { exact: 480, prefix: 420, includes: 320, subsequence: 180 }),
    fieldScore(normalizedQuery, entry.nameNormalized, { exact: 1160, prefix: 940, includes: 740, subsequence: 520 }),
    fieldScore(normalizedQuery, entry.aliasNormalized, { exact: 1040, prefix: 860, includes: 700, subsequence: 480 }),
    fieldScore(normalizedQuery, entry.pathNormalized, { exact: 420, prefix: 360, includes: 300, subsequence: 160 }),
    fieldScore(normalizedQuery, entry.pinyinFull, { exact: 1120, prefix: 920, includes: 760, subsequence: 540 }),
    fieldScore(normalizedQuery, entry.pinyinInitials, { exact: 1100, prefix: 960, includes: 820, subsequence: 620 }),
  );
}

function createResponseItem(entry) {
  return {
    id: entry.id,
    name: entry.name,
    path: entry.path,
    directory: entry.directory,
  };
}

function createPayload(query, results) {
  return {
    query,
    results: results.map(createResponseItem),
    totalCount: appIndex.length,
    scannedPaths: [...APP_DIRECTORIES],
    lastScanAt,
  };
}

function searchIndex(query = "") {
  const trimmedQuery = String(query).trim();

  if (!trimmedQuery) {
    return createPayload("", appIndex.slice(0, DEFAULT_RESULTS));
  }

  const scoredResults = appIndex
    .map((entry) => ({ entry, score: scoreApplication(entry, trimmedQuery) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return compareEntries(left.entry, right.entry);
    })
    .slice(0, SEARCH_LIMIT)
    .map((item) => item.entry);

  return createPayload(trimmedQuery, scoredResults);
}

async function scanApplications() {
  const discoveredBundles = [];

  for (const directory of APP_DIRECTORIES) {
    const bundles = await collectAppBundles(directory, directory);
    discoveredBundles.push(...bundles);
  }

  const uniqueBundles = new Map();
  for (const bundle of discoveredBundles) {
    uniqueBundles.set(bundle.path, bundle);
  }

  const indexEntries = await Promise.all(
    [...uniqueBundles.values()].map(async ({ path: appPath, directory }) => {
      const name = await readApplicationName(appPath);
      return buildIndexEntry(appPath, directory, name);
    }),
  );

  indexEntries.sort(compareEntries);
  appIndex = indexEntries;
  lastScanAt = new Date().toISOString();

  return appIndex;
}

async function ensureApplicationIndex(force = false) {
  if (!force && appIndex.length) {
    return appIndex;
  }

  if (activeScanPromise) {
    return activeScanPromise;
  }

  activeScanPromise = scanApplications()
    .catch((error) => {
      console.error("Application scan failed", error);
      if (!appIndex.length) {
        throw error;
      }
      return appIndex;
    })
    .finally(() => {
      activeScanPromise = null;
    });

  return activeScanPromise;
}

async function launchApplication(appPath) {
  const normalizedPath = String(appPath || "");
  const target = appIndex.find((entry) => entry.path === normalizedPath);

  if (!target) {
    throw new Error("The selected application is no longer available. Try rescanning.");
  }

  const shellError = await shell.openPath(target.path);
  if (!shellError) {
    return true;
  }

  try {
    await execFileAsync("/usr/bin/open", [target.path]);
    return true;
  } catch (error) {
    throw new Error(shellError || error.message || `Failed to launch ${target.name}.`);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 620,
    minWidth: 720,
    minHeight: 520,
    center: true,
    show: false,
    title: APP_NAME,
    backgroundColor: "#090c12",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.focus();
    notifyRendererWindowVisible();
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("Renderer failed to load", { errorCode, errorDescription, validatedURL });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  if (app.isPackaged) {
    void mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    return;
  }

  void mainWindow.loadURL(rendererEntryUrl);
}

function showLauncher() {
  if (!mainWindow) {
    createWindow();
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
  notifyRendererWindowVisible();
}

function hideLauncher() {
  mainWindow?.hide();
}

function createMenu() {
  const template = [
    {
      label: APP_NAME,
      submenu: [
        {
          label: "Show Launcher",
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
      label: "Edit",
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
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "front" }],
    },
    {
      label: "View",
      submenu: [
        ...(!app.isPackaged ? [{ role: "reload" }, { role: "forceReload" }, { role: "toggleDevTools" }] : []),
        { role: "togglefullscreen" },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpc() {
  ipcMain.handle("launcher:get-initial-apps", async () => {
    await ensureApplicationIndex(false);
    return searchIndex("");
  });

  ipcMain.handle("launcher:search-applications", async (_event, query) => {
    await ensureApplicationIndex(false);
    return searchIndex(query);
  });

  ipcMain.handle("launcher:rescan-applications", async () => {
    await ensureApplicationIndex(true);
    return searchIndex("");
  });

  ipcMain.handle("launcher:launch-application", async (_event, appPath) => launchApplication(appPath));
  ipcMain.handle("launcher:hide-launcher", async () => {
    hideLauncher();
    return true;
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

app.on("second-instance", () => {
  showLauncher();
});

app.whenReady().then(async () => {
  createMenu();
  registerIpc();
  createWindow();

  try {
    await ensureApplicationIndex(true);
  } catch (error) {
    console.error("Initial application scan failed", error);
  }

  app.on("activate", () => {
    showLauncher();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
