const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");

let mainWindow;
let updaterStage = "idle";
let downloadedVersion = "";
let installResult = null;
let updaterState = {
  type: "idle",
  currentVersion: "",
  availableVersion: "",
  percent: 0,
  message: ""
};

function pendingUpdatePath() {
  return path.join(app.getPath("userData"), "pending-learning-academy-update.json");
}

function inspectPreviousInstallAttempt() {
  const file = pendingUpdatePath();
  if (!fs.existsSync(file)) return null;

  try {
    const pending = JSON.parse(fs.readFileSync(file, "utf8"));
    const currentVersion = app.getVersion();
    const result = currentVersion === pending.targetVersion
      ? {
          type: "success",
          version: currentVersion,
          message: `Learning Academy updated successfully to v${currentVersion}.`
        }
      : {
          type: "failed",
          version: currentVersion,
          targetVersion: pending.targetVersion || "",
          message: `The update to v${pending.targetVersion || "the new version"} did not complete. Learning Academy is still on v${currentVersion}.`
        };
    fs.unlinkSync(file);
    return result;
  } catch (error) {
    try { fs.unlinkSync(file); } catch (_) {}
    return null;
  }
}

function sendUpdaterStatus(type, payload = {}) {
  updaterState = {
    ...updaterState,
    type,
    currentVersion: app.getVersion(),
    ...payload
  };

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("updater:status", updaterState);
  }
}

async function checkForUpdates(source = "manual") {
  if (!app.isPackaged) {
    sendUpdaterStatus("dev", {
      message: "Update checks work in the installed app, not npm start.",
      source
    });
    return { ok: true, dev: true };
  }

  updaterStage = source === "startup" ? "check-startup" : "check";
  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (error) {
    const message = error?.message || String(error);
    sendUpdaterStatus("error", { message, stage: updaterStage, source });
    updaterStage = "idle";
    return { ok: false, error: message };
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
  mainWindow.webContents.once("did-finish-load", () => {
    setTimeout(() => checkForUpdates("startup"), 1200);
  });
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.autoRunAppAfterInstall = true;

autoUpdater.on("checking-for-update", () => sendUpdaterStatus("checking", {
  source: updaterStage === "check-startup" ? "startup" : "manual"
}));

autoUpdater.on("update-available", info => {
  updaterStage = "idle";
  sendUpdaterStatus("available", {
    version: info.version,
    availableVersion: info.version,
    releaseName: info.releaseName || ""
  });
});

autoUpdater.on("update-not-available", info => {
  updaterStage = "idle";
  downloadedVersion = "";
  sendUpdaterStatus("not-available", {
    version: info?.version || app.getVersion(),
    availableVersion: "",
    percent: 0
  });
});

autoUpdater.on("download-progress", progress => sendUpdaterStatus("progress", {
  percent: Math.max(0, Math.min(100, Math.round(progress.percent || 0))),
  transferred: progress.transferred || 0,
  total: progress.total || 0,
  bytesPerSecond: progress.bytesPerSecond || 0,
  version: downloadedVersion || updaterState.availableVersion || ""
}));

autoUpdater.on("update-downloaded", info => {
  updaterStage = "downloaded";
  downloadedVersion = info.version;
  sendUpdaterStatus("downloaded", {
    version: info.version,
    availableVersion: info.version,
    percent: 100
  });
});

autoUpdater.on("error", error => {
  const message = error?.message || String(error);
  sendUpdaterStatus("error", {
    message,
    stage: updaterStage
  });
  updaterStage = "idle";
});

ipcMain.handle("updater:getVersion", () => app.getVersion());
ipcMain.handle("updater:getState", () => ({ ...updaterState }));
ipcMain.handle("updater:consumeInstallResult", () => {
  const result = installResult;
  installResult = null;
  return result;
});
ipcMain.handle("updater:check", () => checkForUpdates("manual"));

ipcMain.handle("updater:download", async () => {
  if (!app.isPackaged) {
    return { ok: false, error: "Updates can only be downloaded from the installed app." };
  }

  updaterStage = "download";
  try {
    await autoUpdater.downloadUpdate();
    return { ok: true };
  } catch (error) {
    const message = error?.message || String(error);
    sendUpdaterStatus("error", { message, stage: "download" });
    updaterStage = "idle";
    return { ok: false, error: message };
  }
});

ipcMain.handle("updater:install", () => {
  if (!downloadedVersion) {
    const message = "The update has not finished downloading yet.";
    sendUpdaterStatus("error", { message, stage: "install" });
    return { ok: false, error: message };
  }

  updaterStage = "install";
  const targetVersion = downloadedVersion;
  sendUpdaterStatus("installing", { version: targetVersion, percent: 100 });

  try {
    fs.writeFileSync(pendingUpdatePath(), JSON.stringify({
      fromVersion: app.getVersion(),
      targetVersion,
      startedAt: new Date().toISOString()
    }, null, 2));
  } catch (error) {
    const message = `Could not prepare the update restart: ${error?.message || String(error)}`;
    sendUpdaterStatus("error", { message, stage: "install" });
    updaterStage = "idle";
    return { ok: false, error: message };
  }

  setTimeout(() => {
    try {
      // Windows NSIS must restart the app to replace its installed files.
      // Silent mode plus force-run makes the process feel like an automatic reload.
      autoUpdater.quitAndInstall(true, true);
    } catch (error) {
      try { fs.unlinkSync(pendingUpdatePath()); } catch (_) {}
      sendUpdaterStatus("error", {
        message: error?.message || String(error),
        stage: "install"
      });
      updaterStage = "idle";
    }
  }, 650);

  return { ok: true };
});

app.whenReady().then(() => {
  updaterState.currentVersion = app.getVersion();
  installResult = inspectPreviousInstallAttempt();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
