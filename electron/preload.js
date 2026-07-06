import { contextBridge, ipcRenderer } from "electron";

function invoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

contextBridge.exposeInMainWorld("geke", {
  bootstrap: () => invoke("geke:bootstrap"),
  createRecord: (payload) => invoke("geke:records:create", payload),
  updateRecord: (payload) => invoke("geke:records:update", payload),
  deleteRecord: (id) => invoke("geke:records:delete", id),
  toggleFavorite: (id) => invoke("geke:records:toggle-favorite", id),
  togglePinned: (id) => invoke("geke:records:toggle-pinned", id),
  captureClipboard: (force = false) => invoke("geke:clipboard:capture", { force }),
  writeClipboardText: (text) => invoke("geke:clipboard:write-text", text),
  updateSetting: (payload) => invoke("geke:settings:update", payload),
  toggleWorkspaceAlwaysOnTop: () => invoke("geke:window:toggle-workspace-on-top"),
  showWorkspace: () => invoke("geke:window:show-workspace"),
  showQuickPanel: () => invoke("geke:window:show-quick-panel"),
  hideQuickPanel: () => invoke("geke:window:hide-quick-panel"),
  navigate: (route) => invoke("geke:navigate", route),
  openExternal: (url) => invoke("geke:open-external", url),
  onStateChange(listener) {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on("geke:state-changed", wrapped);
    return () => ipcRenderer.removeListener("geke:state-changed", wrapped);
  },
});
