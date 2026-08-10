const { app, BrowserWindow, ipcMain, shell } = require("electron");
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


const COURSE_SCHEMA_VERSION = 1;

function safePathPart(value) {
  return String(value || "unknown").replace(/[^A-Za-z0-9._-]/g, "_");
}

function courseDirectory() {
  return path.join(__dirname, "courses");
}

function diagnosticsDirectory() {
  const dir = path.join(app.getPath("userData"), "diagnostics");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writeDiagnostic(message, details = "") {
  try {
    const line = `[${new Date().toISOString()}] ${message}${details ? ` | ${details}` : ""}\n`;
    fs.appendFileSync(path.join(diagnosticsDirectory(), "learning-academy.log"), line, "utf8");
  } catch (_) {}
}

function validateCoursePackage(course, sourceName = "course") {
  if (!course || typeof course !== "object") throw new Error(`${sourceName}: course package must be an object.`);
  if (Number(course.schemaVersion) !== COURSE_SCHEMA_VERSION) throw new Error(`${sourceName}: unsupported schemaVersion ${course.schemaVersion}.`);
  if (!course.id || !/^[a-z0-9][a-z0-9-]*$/i.test(course.id)) throw new Error(`${sourceName}: invalid course id.`);
  if (!course.name || !course.shortName || !course.description) throw new Error(`${sourceName}: missing required course metadata.`);
  if (!course.curriculum || !Array.isArray(course.curriculum.days) || course.curriculum.days.length === 0) throw new Error(`${sourceName}: curriculum.days is missing or empty.`);
  for (let i = 0; i < course.curriculum.days.length; i++) {
    const day = course.curriculum.days[i];
    if (Number(day.day) !== i + 1) throw new Error(`${sourceName}: curriculum day numbering must be sequential starting at 1.`);
    if (!Array.isArray(day.tasks) || day.tasks.length === 0) throw new Error(`${sourceName}: Day ${day.day} has no tasks.`);
  }
  if (course.lessons && typeof course.lessons !== "object") throw new Error(`${sourceName}: lessons must be an object.`);
  if (course.achievements && !Array.isArray(course.achievements)) throw new Error(`${sourceName}: achievements must be an array.`);
  return course;
}

function readCoursePackages() {
  const dir = courseDirectory();
  if (!fs.existsSync(dir)) throw new Error("The built-in courses directory is missing.");
  const files = fs.readdirSync(dir).filter(name => name.toLowerCase().endsWith(".json")).sort();
  if (!files.length) throw new Error("No built-in course packages were found.");
  const courses = files.map(name => {
    const full = path.join(dir, name);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(full, "utf8"));
      return validateCoursePackage(parsed, name);
    } catch (error) {
      writeDiagnostic("Course package validation failed", `${name}: ${error.message}`);
      throw error;
    }
  });
  const ids = new Set();
  for (const course of courses) {
    if (ids.has(course.id)) throw new Error(`Duplicate course id: ${course.id}`);
    ids.add(course.id);
  }
  return courses;
}

function courseCatalogEntry(course) {
  return {
    id: course.id,
    version: course.version || "1.0.0",
    schemaVersion: course.schemaVersion,
    name: course.name,
    shortName: course.shortName,
    description: course.description,
    category: course.category || "General",
    difficulty: course.difficulty || "All Levels",
    duration: course.duration || `${course.curriculum.days.length} days`,
    estimatedHours: Number(course.estimatedHours) || 0,
    status: course.status || "Available",
    provider: course.provider || "Learning Academy",
    price: course.price ?? null,
    features: course.features || {},
    totalDays: course.curriculum.days.length,
    achievementTotal: Array.isArray(course.achievements) ? course.achievements.length : 0,
    achievements: course.achievements || []
  };
}

function backupDirectory(learnerId, courseId) {
  return path.join(app.getPath("userData"), "progress-backups", safePathPart(learnerId), safePathPart(courseId));
}

function writeProgressBackup(payload) {
  if (!payload || !payload.learnerId || !payload.courseId || !payload.progress) throw new Error("Backup payload is incomplete.");
  const dir = backupDirectory(payload.learnerId, payload.courseId);
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `${stamp}.json`);
  const data = {
    backupSchemaVersion: 1,
    learnerId: payload.learnerId,
    courseId: payload.courseId,
    savedAt: new Date().toISOString(),
    progress: payload.progress,
    lessonState: payload.lessonState || {}
  };
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
  const files = fs.readdirSync(dir).filter(x => x.endsWith(".json")).sort().reverse();
  files.slice(5).forEach(name => {
    try { fs.unlinkSync(path.join(dir, name)); } catch (_) {}
  });
  return file;
}

function readLatestProgressBackup(learnerId, courseId) {
  const dir = backupDirectory(learnerId, courseId);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter(x => x.endsWith(".json")).sort().reverse();
  for (const name of files) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      if (parsed && parsed.courseId === courseId && parsed.progress) return parsed;
    } catch (_) {}
  }
  return null;
}

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
  writeDiagnostic("Updater error", `${updaterStage}: ${message}`);
  sendUpdaterStatus("error", {
    message,
    stage: updaterStage
  });
  updaterStage = "idle";
});


ipcMain.handle("courses:list", () => {
  try {
    const courses = readCoursePackages().map(courseCatalogEntry);
    writeDiagnostic("Course catalog loaded", `${courses.length} course(s)`);
    return { ok: true, courses };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
});

ipcMain.handle("courses:load", (_event, id) => {
  try {
    const course = readCoursePackages().find(item => item.id === id);
    if (!course) return { ok: false, error: `Course not found: ${id}` };
    writeDiagnostic("Course package loaded", `${course.id} v${course.version || "1.0.0"}`);
    return { ok: true, course };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
});

ipcMain.handle("academy:backupProgress", (_event, payload) => {
  try {
    writeProgressBackup(payload);
    return { ok: true };
  } catch (error) {
    writeDiagnostic("Progress backup failed", error.message || String(error));
    return { ok: false, error: error.message || String(error) };
  }
});

ipcMain.handle("academy:restoreLatestBackup", (_event, payload) => {
  try {
    const backup = readLatestProgressBackup(payload?.learnerId, payload?.courseId);
    if (!backup) return { ok: false, error: "No local progress backup was found for this course yet." };
    return { ok: true, backup };
  } catch (error) {
    writeDiagnostic("Progress restore failed", error.message || String(error));
    return { ok: false, error: error.message || String(error) };
  }
});

ipcMain.handle("academy:openDiagnostics", async () => {
  try {
    const error = await shell.openPath(diagnosticsDirectory());
    return error ? { ok: false, error } : { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
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
