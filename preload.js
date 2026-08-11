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
contextBridge.exposeInMainWorld("academySystem", {
  openExternal: (url) => ipcRenderer.invoke("academy:openExternal", url)
});


contextBridge.exposeInMainWorld("academyAuth", {
  getState: () => ipcRenderer.invoke("auth:getState"),
  signIn: (payload) => ipcRenderer.invoke("auth:signIn", payload),
  signUp: (payload) => ipcRenderer.invoke("auth:signUp", payload),
  social: (payload) => ipcRenderer.invoke("auth:social", payload),
  resetPassword: (payload) => ipcRenderer.invoke("auth:resetPassword", payload),
  updatePassword: (payload) => ipcRenderer.invoke("auth:updatePassword", payload),
  logout: () => ipcRenderer.invoke("auth:logout"),
  onState: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("auth:state", handler);
    return () => ipcRenderer.removeListener("auth:state", handler);
  }
});
