const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

let mainWindow;

function sendUpdaterStatus(type, payload = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("updater:status", { type, ...payload });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: "#090e1d",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.on("checking-for-update", () => sendUpdaterStatus("checking"));
autoUpdater.on("update-available", info => sendUpdaterStatus("available", {
  version: info.version,
  releaseName: info.releaseName || ""
}));
autoUpdater.on("update-not-available", info => sendUpdaterStatus("not-available", {
  version: info?.version || app.getVersion()
}));
autoUpdater.on("download-progress", p => sendUpdaterStatus("progress", {
  percent: Math.round(p.percent || 0),
  transferred: p.transferred || 0,
  total: p.total || 0,
  bytesPerSecond: p.bytesPerSecond || 0
}));
autoUpdater.on("update-downloaded", info => sendUpdaterStatus("downloaded", {
  version: info.version
}));
autoUpdater.on("error", err => sendUpdaterStatus("error", {
  message: err?.message || String(err)
}));

ipcMain.handle("updater:getVersion", () => app.getVersion());

ipcMain.handle("updater:check", async () => {
  if (!app.isPackaged) {
    const result = { type: "dev", message: "Update checks work in the installed app, not npm start." };
    sendUpdaterStatus(result.type, { message: result.message });
    return result;
  }
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    sendUpdaterStatus("error", { message: err?.message || String(err) });
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle("updater:download", async () => {
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (err) {
    sendUpdaterStatus("error", { message: err?.message || String(err) });
    return { ok: false, error: err?.message || String(err) };
  }
});

ipcMain.handle("updater:install", () => {
  autoUpdater.quitAndInstall(false, true);
  return { ok: true };
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
