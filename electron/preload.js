import { contextBridge, ipcRenderer } from "electron";

function invoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld("geke", {
  searchApplications: (query = "") => invoke("geke:search-applications", query),
  launchApplication: (appPath) => invoke("geke:launch-application", appPath),
  rescanApplications: () => invoke("geke:rescan-applications"),
  hideLauncher: () => invoke("geke:hide-launcher"),
});
