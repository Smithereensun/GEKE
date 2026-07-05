import { app, BrowserWindow, Menu, shell } from "electron";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStaticServer } from "./local-server.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_TITLE = "极刻 / GEKE";
const DEV_SERVER_URL = "http://127.0.0.1:5173";
const REPO_URL = "https://github.com/Smithereensun/GEKE";

let mainWindow;
let appBaseUrl;
let staticServer;

app.setName(APP_TITLE);

function navigateTo(route = "/") {
  if (!mainWindow || mainWindow.isDestroyed() || !appBaseUrl) {
    return;
  }

  const targetUrl = new URL(route, `${appBaseUrl}/`).toString();
  void mainWindow.loadURL(targetUrl);
}

function createAppMenu() {
  const template = [
    {
      label: app.getName(),
      submenu: [
        { role: "about" },
        { type: "separator" },
        { label: "首页", click: () => navigateTo("/") },
        { label: "更新日志", click: () => navigateTo("/changelog/") },
        { label: "原型图", click: () => navigateTo("/prototype/") },
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
      submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "front" }],
    },
    {
      label: "帮助",
      submenu: [{ label: "打开 GitHub 仓库", click: () => shell.openExternal(REPO_URL) }],
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

async function createMainWindow() {
  appBaseUrl = await resolveAppBaseUrl();

  mainWindow = new BrowserWindow({
    backgroundColor: "#f4efe7",
    height: 960,
    minHeight: 760,
    minWidth: 1100,
    show: false,
    title: APP_TITLE,
    width: 1440,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
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

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  createAppMenu();
  navigateTo("/");
}

app.whenReady().then(() => {
  void createMainWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createMainWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
