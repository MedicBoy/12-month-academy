const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("academyUpdater", {
  getVersion: () => ipcRenderer.invoke("updater:getVersion"),
  check: () => ipcRenderer.invoke("updater:check"),
  download: () => ipcRenderer.invoke("updater:download"),
  install: () => ipcRenderer.invoke("updater:install"),
  onStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("updater:status", handler);
    return () => ipcRenderer.removeListener("updater:status", handler);
  }
});
