import { contextBridge, ipcRenderer } from "electron";

function invoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld("geke", {
  getInitialApps: () => invoke("launcher:get-initial-apps"),
  searchApplications: (query = "") => invoke("launcher:search-applications", query),
  launchApplication: (appPath) => invoke("launcher:launch-application", appPath),
  rescanApplications: () => invoke("launcher:rescan-applications"),
  hideLauncher: () => invoke("launcher:hide-launcher"),
  onWindowVisible: (callback) => {
    if (typeof callback !== "function") {
      return;
    }

    ipcRenderer.on("launcher:window-visible", () => callback());
  },
});
