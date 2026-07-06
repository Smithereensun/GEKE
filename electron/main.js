import { app, BrowserWindow, Menu, Tray, clipboard, globalShortcut, ipcMain, nativeImage, screen, shell } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticServer } from "./local-server.js";
import { JsonWorkspaceStore } from "./storage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_TITLE = "极刻 GEKE";
const DEV_SERVER_URL = "http://127.0.0.1:5173";
const REPO_URL = "https://github.com/Smithereensun/GEKE";
const QUICK_PANEL_SHORTCUT = "CommandOrControl+Shift+Space";
const QUICK_PANEL_QUERY = "?panel=quick";
const ALLOWED_ROUTES = new Set(["/", "/changelog/", "/prototype/", "/about/"]);

let mainWindow;
let quickPanelWindow;
let appBaseUrl;
let staticServer;
let tray;
let workspaceStore;
let clipboardPollTimer;
let lastClipboardText = "";
let isQuitting = false;

app.setName(APP_TITLE);

function buildAppUrl(route = "/", search = "") {
  const targetUrl = new URL(route, `${appBaseUrl}/`);
  targetUrl.search = search;
  return targetUrl.toString();
}

function getWindowRole(window) {
  if (!window || window.isDestroyed()) {
    return "unknown";
  }

  if (window === quickPanelWindow) {
    return "quick-panel";
  }

  if (window === mainWindow) {
    return "workspace";
  }

  return "secondary";
}

function showWindow(window) {
  if (!window || window.isDestroyed()) {
    return;
  }

  if (!window.isVisible()) {
    window.show();
  }

  window.focus();
}

function navigateTo(route = "/") {
  if (!mainWindow || mainWindow.isDestroyed() || !appBaseUrl) {
    return;
  }

  const targetRoute = ALLOWED_ROUTES.has(route) ? route : "/";
  void mainWindow.loadURL(buildAppUrl(targetRoute));
  showWindow(mainWindow);
}

function createAppMenu() {
  const template = [
    {
      label: app.getName(),
      submenu: [
        { role: "about" },
        { type: "separator" },
        { label: "工作台", click: () => navigateTo("/") },
        { label: "快速面板", accelerator: QUICK_PANEL_SHORTCUT, click: () => toggleQuickPanel() },
        { label: "更新日志", click: () => navigateTo("/changelog/") },
        { label: "原型图", click: () => navigateTo("/prototype/") },
        { label: "关于", click: () => navigateTo("/about/") },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "查看",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "togglefullscreen" },
        ...(!app.isPackaged ? [{ role: "toggleDevTools" }] : []),
      ],
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { role: "front" },
        {
          label: "切换工作台置顶",
          click: () => {
            void toggleWorkspaceAlwaysOnTop();
          },
        },
      ],
    },
    {
      label: "帮助",
      submenu: [
        { label: "打开 GitHub 仓库", click: () => shell.openExternal(REPO_URL) },
        { label: "更新日志", click: () => navigateTo("/changelog/") },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function resolveAppBaseUrl() {
  if (!app.isPackaged) {
    return process.env.VITE_DEV_SERVER_URL || DEV_SERVER_URL;
  }

  if (staticServer) {
    return staticServer.url;
  }

  const distPath = path.join(__dirname, "..", "dist");

  if (!existsSync(distPath)) {
    throw new Error(`Missing built app assets at ${distPath}. Run npm run build first.`);
  }

  staticServer = await createStaticServer(distPath);
  return staticServer.url;
}

function createSharedWindowOptions() {
  return {
    backgroundColor: "#efe5d4",
    show: false,
    title: APP_TITLE,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  };
}

function attachExternalNavigationGuards(window) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, targetUrl) => {
    if (!appBaseUrl) {
      return;
    }

    const allowedOrigin = new URL(appBaseUrl).origin;
    const nextOrigin = new URL(targetUrl).origin;

    if (nextOrigin !== allowedOrigin) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });
}

async function createMainWindow() {
  appBaseUrl = await resolveAppBaseUrl();

  mainWindow = new BrowserWindow({
    ...createSharedWindowOptions(),
    height: 960,
    minHeight: 760,
    minWidth: 1100,
    width: 1440,
  });

  mainWindow.setAlwaysOnTop(Boolean(workspaceStore.snapshot().settings.workspaceAlwaysOnTop));
  attachExternalNavigationGuards(mainWindow);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    mainWindow.hide();
  });

  createAppMenu();
  void mainWindow.loadURL(buildAppUrl("/"));
}

function positionQuickPanel() {
  if (!quickPanelWindow || quickPanelWindow.isDestroyed()) {
    return;
  }

  const display = screen.getPrimaryDisplay();
  const { width, x, y } = display.workArea;
  const bounds = quickPanelWindow.getBounds();

  quickPanelWindow.setPosition(x + width - bounds.width - 28, y + 28);
}

async function createQuickPanelWindow() {
  if (!appBaseUrl) {
    appBaseUrl = await resolveAppBaseUrl();
  }

  if (quickPanelWindow && !quickPanelWindow.isDestroyed()) {
    return quickPanelWindow;
  }

  quickPanelWindow = new BrowserWindow({
    ...createSharedWindowOptions(),
    alwaysOnTop: Boolean(workspaceStore.snapshot().settings.quickPanelAlwaysOnTop),
    fullscreenable: false,
    height: 620,
    maximizable: false,
    minimizable: false,
    resizable: false,
    skipTaskbar: true,
    title: `${APP_TITLE} 快速面板`,
    titleBarStyle: "hiddenInset",
    width: 420,
  });

  attachExternalNavigationGuards(quickPanelWindow);
  positionQuickPanel();

  quickPanelWindow.on("blur", () => {
    if (!app.isPackaged) {
      return;
    }

    quickPanelWindow.hide();
  });

  quickPanelWindow.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    quickPanelWindow.hide();
  });

  quickPanelWindow.on("closed", () => {
    quickPanelWindow = null;
  });

  await quickPanelWindow.loadURL(buildAppUrl("/", QUICK_PANEL_QUERY));
  return quickPanelWindow;
}

function buildTrayIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
      <rect x="1.5" y="1.5" width="15" height="15" rx="4" fill="black" />
      <path d="M6 5.2h6.5v1.8H7.95v2.25h3.7V11h-3.7v2.1h4.8v1.8H6z" fill="white" />
    </svg>
  `;
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

  if (process.platform === "darwin") {
    image.setTemplateImage(true);
  }

  return image;
}

function createTray() {
  tray = new Tray(buildTrayIcon());
  tray.setToolTip(APP_TITLE);
  tray.on("click", () => {
    void toggleQuickPanel();
  });
  refreshTrayMenu();
}

function refreshTrayMenu() {
  if (!tray) {
    return;
  }

  const { settings, records } = workspaceStore.snapshot();
  const clipboardCount = records.filter((record) => record.category === "clipboard").length;

  const menu = Menu.buildFromTemplate([
    { label: "打开工作台", click: () => navigateTo("/") },
    { label: "快速面板", accelerator: QUICK_PANEL_SHORTCUT, click: () => toggleQuickPanel() },
    {
      label: settings.workspaceAlwaysOnTop ? "取消工作台置顶" : "置顶工作台",
      click: () => {
        void toggleWorkspaceAlwaysOnTop();
      },
    },
    { type: "separator" },
    { label: `剪贴板历史 ${clipboardCount} 条`, enabled: false },
    { label: "更新日志", click: () => navigateTo("/changelog/") },
    { label: "原型图", click: () => navigateTo("/prototype/") },
    { label: "关于", click: () => navigateTo("/about/") },
    { type: "separator" },
    { label: "退出", click: () => app.quit() },
  ]);

  tray.setContextMenu(menu);
}

function buildMetaForWindow(window) {
  return {
    isElectron: true,
    platform: process.platform,
    role: getWindowRole(window),
    shortcut: QUICK_PANEL_SHORTCUT,
    userDataPath: app.getPath("userData"),
  };
}

function broadcastState() {
  const payload = {
    meta: buildMetaForWindow(mainWindow),
    state: workspaceStore.snapshot(),
  };

  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue;
    }

    window.webContents.send("geke:state-changed", {
      ...payload,
      meta: buildMetaForWindow(window),
    });
  }

  refreshTrayMenu();
}

async function mutateAndBroadcast(mutator) {
  const snapshot = await mutator();
  broadcastState();
  return snapshot;
}

async function toggleWorkspaceAlwaysOnTop() {
  const nextValue = !workspaceStore.snapshot().settings.workspaceAlwaysOnTop;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(nextValue);
  }

  return mutateAndBroadcast(() => workspaceStore.updateSetting("workspaceAlwaysOnTop", nextValue));
}

async function showQuickPanel() {
  const window = await createQuickPanelWindow();
  positionQuickPanel();
  showWindow(window);
}

async function toggleQuickPanel() {
  const window = await createQuickPanelWindow();

  if (window.isVisible()) {
    window.hide();
    return;
  }

  positionQuickPanel();
  showWindow(window);
}

function registerShortcuts() {
  globalShortcut.unregisterAll();
  globalShortcut.register(QUICK_PANEL_SHORTCUT, () => {
    void toggleQuickPanel();
  });
}

function startClipboardMonitor() {
  lastClipboardText = clipboard.readText();

  clipboardPollTimer = setInterval(() => {
    const settings = workspaceStore.snapshot().settings;

    if (!settings.clipboardMonitoring) {
      return;
    }

    const text = clipboard.readText();

    if (!text || text === lastClipboardText) {
      return;
    }

    lastClipboardText = text;
    void mutateAndBroadcast(() => workspaceStore.captureClipboard(text));
  }, 1400);
}

function stopClipboardMonitor() {
  if (!clipboardPollTimer) {
    return;
  }

  clearInterval(clipboardPollTimer);
  clipboardPollTimer = null;
}

function setupIpc() {
  ipcMain.handle("geke:bootstrap", (event) => ({
    meta: buildMetaForWindow(BrowserWindow.fromWebContents(event.sender)),
    state: workspaceStore.snapshot(),
  }));

  ipcMain.handle("geke:records:create", (_event, payload) => mutateAndBroadcast(() => workspaceStore.addRecord(payload)));
  ipcMain.handle("geke:records:update", (_event, payload) =>
    mutateAndBroadcast(() => workspaceStore.updateRecord(payload.id, payload)),
  );
  ipcMain.handle("geke:records:delete", (_event, id) => mutateAndBroadcast(() => workspaceStore.removeRecord(id)));
  ipcMain.handle("geke:records:toggle-favorite", (_event, id) =>
    mutateAndBroadcast(() => workspaceStore.toggleRecordFlag(id, "favorite")),
  );
  ipcMain.handle("geke:records:toggle-pinned", (_event, id) =>
    mutateAndBroadcast(() => workspaceStore.toggleRecordFlag(id, "pinned")),
  );
  ipcMain.handle("geke:clipboard:capture", (_event, payload) => {
    const text = clipboard.readText();
    lastClipboardText = text || lastClipboardText;
    return mutateAndBroadcast(() => workspaceStore.captureClipboard(text, Boolean(payload?.force)));
  });
  ipcMain.handle("geke:clipboard:write-text", (_event, text) => {
    clipboard.writeText(String(text ?? ""));
    return true;
  });
  ipcMain.handle("geke:settings:update", (_event, payload) =>
    mutateAndBroadcast(async () => {
      const snapshot = await workspaceStore.updateSetting(payload.key, payload.value);

      if (payload.key === "workspaceAlwaysOnTop" && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(Boolean(payload.value));
      }

      if (payload.key === "quickPanelAlwaysOnTop" && quickPanelWindow && !quickPanelWindow.isDestroyed()) {
        quickPanelWindow.setAlwaysOnTop(Boolean(payload.value));
      }

      return snapshot;
    }),
  );
  ipcMain.handle("geke:window:toggle-workspace-on-top", () => toggleWorkspaceAlwaysOnTop());
  ipcMain.handle("geke:window:show-workspace", () => {
    navigateTo("/");
    return true;
  });
  ipcMain.handle("geke:window:show-quick-panel", async () => {
    await showQuickPanel();
    return true;
  });
  ipcMain.handle("geke:window:hide-quick-panel", () => {
    if (quickPanelWindow && !quickPanelWindow.isDestroyed()) {
      quickPanelWindow.hide();
    }

    return true;
  });
  ipcMain.handle("geke:navigate", (_event, route) => {
    navigateTo(ALLOWED_ROUTES.has(route) ? route : "/");
    return true;
  });
  ipcMain.handle("geke:open-external", (_event, url) => shell.openExternal(url));
}

app.whenReady().then(() => {
  workspaceStore = new JsonWorkspaceStore(path.join(app.getPath("userData"), "workspace-data.json"));

  void workspaceStore.load().then(async () => {
    setupIpc();
    registerShortcuts();
    startClipboardMonitor();
    createTray();
    await createMainWindow();
    broadcastState();
  });
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
    return;
  }

  if (mainWindow) {
    showWindow(mainWindow);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  stopClipboardMonitor();
  globalShortcut.unregisterAll();
});

app.on("will-quit", () => {
  if (staticServer) {
    void staticServer.close();
  }
});
