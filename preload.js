const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("academyUpdater", {
  getVersion: () => ipcRenderer.invoke("updater:getVersion"),
  getState: () => ipcRenderer.invoke("updater:getState"),
  consumeInstallResult: () => ipcRenderer.invoke("updater:consumeInstallResult"),
  check: () => ipcRenderer.invoke("updater:check"),
  download: () => ipcRenderer.invoke("updater:download"),
  install: () => ipcRenderer.invoke("updater:install"),
  onStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("updater:status", handler);
    return () => ipcRenderer.removeListener("updater:status", handler);
  }
});

contextBridge.exposeInMainWorld("academyCourses", {
  list: () => ipcRenderer.invoke("courses:list"),
  load: (id) => ipcRenderer.invoke("courses:load", id),
  installPackage: () => ipcRenderer.invoke("courses:installPackage"),
  uninstallPackage: (id) => ipcRenderer.invoke("courses:uninstallPackage", id),
  openInstalledFolder: () => ipcRenderer.invoke("courses:openInstalledFolder")
});

contextBridge.exposeInMainWorld("academyData", {
  backupProgress: (payload) => ipcRenderer.invoke("academy:backupProgress", payload),
  restoreLatestBackup: (payload) => ipcRenderer.invoke("academy:restoreLatestBackup", payload),
  openDiagnostics: () => ipcRenderer.invoke("academy:openDiagnostics")
});
