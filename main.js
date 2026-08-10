const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");
const AdmZip = require("adm-zip");

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
const COURSE_PACKAGE_FORMAT = "learning-academy-course";
const COURSE_PACKAGE_VERSION = 1;
const MAX_PACKAGE_BYTES = 50 * 1024 * 1024;
const MAX_UNCOMPRESSED_PACKAGE_BYTES = 100 * 1024 * 1024;

function safePathPart(value) {
  return String(value || "unknown").replace(/[^A-Za-z0-9._-]/g, "_");
}

function courseDirectory() {
  return path.join(__dirname, "courses");
}

function installedCourseDirectory() {
  const dir = path.join(app.getPath("userData"), "installed-courses");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
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

function assertPlainText(value, label, maxLength = 5000) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string.`);
  if (value.length > maxLength) throw new Error(`${label} is too long.`);
  if (/<\s*\/?\s*[A-Za-z][^>]*>/i.test(value)) throw new Error(`${label} must be plain text and cannot contain HTML tags.`);
}

function validateCoursePackage(course, sourceName = "course") {
  if (!course || typeof course !== "object" || Array.isArray(course)) throw new Error(`${sourceName}: course package must be an object.`);
  if (Number(course.schemaVersion) !== COURSE_SCHEMA_VERSION) throw new Error(`${sourceName}: unsupported schemaVersion ${course.schemaVersion}.`);
  if (!course.id || !/^[a-z0-9][a-z0-9-]*$/i.test(course.id)) throw new Error(`${sourceName}: invalid course id.`);
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(course.version || ""))) throw new Error(`${sourceName}: version must use semantic versioning such as 1.0.0.`);
  assertPlainText(course.name, `${sourceName}: name`, 160);
  assertPlainText(course.shortName, `${sourceName}: shortName`, 80);
  assertPlainText(course.description, `${sourceName}: description`, 1200);
  for (const field of ["category", "difficulty", "duration", "status", "provider"]) {
    if (course[field] != null && course[field] !== "") assertPlainText(String(course[field]), `${sourceName}: ${field}`, 160);
  }
  if (!course.curriculum || !Array.isArray(course.curriculum.days) || course.curriculum.days.length === 0) throw new Error(`${sourceName}: curriculum.days is missing or empty.`);
  if (course.curriculum.days.length > 1000) throw new Error(`${sourceName}: curriculum contains too many days.`);
  for (let i = 0; i < course.curriculum.days.length; i++) {
    const day = course.curriculum.days[i];
    if (Number(day.day) !== i + 1) throw new Error(`${sourceName}: curriculum day numbering must be sequential starting at 1.`);
    for (const field of ["title", "focus", "scope", "type"]) {
      if (day[field] != null && day[field] !== "") assertPlainText(String(day[field]), `${sourceName}: Day ${day.day} ${field}`, 1200);
    }
    if (!Array.isArray(day.tasks) || day.tasks.length === 0) throw new Error(`${sourceName}: Day ${day.day} has no tasks.`);
    if (day.tasks.length > 30) throw new Error(`${sourceName}: Day ${day.day} has too many tasks.`);
    day.tasks.forEach((task, taskIndex) => {
      if (!Array.isArray(task) || task.length < 3) throw new Error(`${sourceName}: Day ${day.day} task ${taskIndex + 1} is invalid.`);
      assertPlainText(String(task[0]), `${sourceName}: Day ${day.day} task ${taskIndex + 1} title`, 300);
      assertPlainText(String(task[1]), `${sourceName}: Day ${day.day} task ${taskIndex + 1} objective`, 1200);
    });
  }
  if (course.lessons && typeof course.lessons !== "object") throw new Error(`${sourceName}: lessons must be an object.`);
  for (const [dayKey, lessons] of Object.entries(course.lessons || {})) {
    if (!Array.isArray(lessons)) throw new Error(`${sourceName}: lessons for Day ${dayKey} must be an array.`);
    if (lessons.length > 40) throw new Error(`${sourceName}: Day ${dayKey} contains too many lesson steps.`);
    lessons.forEach((lesson, index) => {
      if (!lesson || typeof lesson !== "object") throw new Error(`${sourceName}: Day ${dayKey} lesson ${index + 1} is invalid.`);
      for (const field of ["title", "objective", "q", "hint", "explain"]) {
        assertPlainText(String(lesson[field] || ""), `${sourceName}: Day ${dayKey} lesson ${index + 1} ${field}`, field === "explain" ? 5000 : 2000);
      }
      if (typeof lesson.content !== "string" || lesson.content.length > 100000) throw new Error(`${sourceName}: Day ${dayKey} lesson ${index + 1} content is invalid.`);
      if (!Array.isArray(lesson.answers) || !lesson.answers.length || lesson.answers.length > 30) throw new Error(`${sourceName}: Day ${dayKey} lesson ${index + 1} answers are invalid.`);
      lesson.answers.forEach((answer, answerIndex) => assertPlainText(String(answer), `${sourceName}: Day ${dayKey} lesson ${index + 1} answer ${answerIndex + 1}`, 500));
    });
  }
  if (course.achievements && !Array.isArray(course.achievements)) throw new Error(`${sourceName}: achievements must be an array.`);
  (course.achievements || []).forEach((achievement, index) => {
    if (!Array.isArray(achievement) || achievement.length < 3) throw new Error(`${sourceName}: achievement ${index + 1} is invalid.`);
    assertPlainText(String(achievement[0]), `${sourceName}: achievement ${index + 1} name`, 120);
    assertPlainText(String(achievement[1]), `${sourceName}: achievement ${index + 1} description`, 500);
    if (!Number.isFinite(Number(achievement[2])) || Number(achievement[2]) < 0) throw new Error(`${sourceName}: achievement ${index + 1} AP must be a non-negative number.`);
  });
  return course;
}

function validateArchiveEntryName(name) {
  const normalized = String(name || "").replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || /^[A-Za-z]:/.test(normalized) || normalized.split("/").includes("..")) {
    throw new Error(`Unsafe file path inside course package: ${name}`);
  }
  return normalized;
}

function readCourseArchive(filePath) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error("The selected course package is not a file.");
  if (stat.size <= 0 || stat.size > MAX_PACKAGE_BYTES) throw new Error("The course package is empty or exceeds the 50 MB package limit.");
  if (path.extname(filePath).toLowerCase() !== ".lacourse") throw new Error("Learning Academy course packages must use the .lacourse extension.");

  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  if (!entries.length || entries.length > 500) throw new Error("The course package contains an invalid number of files.");
  let totalUncompressed = 0;
  for (const entry of entries) {
    validateArchiveEntryName(entry.entryName);
    totalUncompressed += Number(entry.header?.size || 0);
    if (totalUncompressed > MAX_UNCOMPRESSED_PACKAGE_BYTES) throw new Error("The course package expands beyond the 100 MB safety limit.");
  }

  const manifestEntry = zip.getEntry("manifest.json");
  if (!manifestEntry) throw new Error("The course package is missing manifest.json.");
  let manifest;
  try { manifest = JSON.parse(manifestEntry.getData().toString("utf8")); }
  catch (error) { throw new Error(`manifest.json is invalid: ${error.message}`); }
  if (!manifest || manifest.packageFormat !== COURSE_PACKAGE_FORMAT) throw new Error("This file is not a Learning Academy course package.");
  if (Number(manifest.packageVersion) !== COURSE_PACKAGE_VERSION) throw new Error(`Unsupported .lacourse package version: ${manifest.packageVersion}`);
  if (manifest.entry !== "course.json") throw new Error("Package manifest entry must be course.json in package format v1.");

  const courseEntry = zip.getEntry("course.json");
  if (!courseEntry) throw new Error("The course package is missing course.json.");
  let course;
  try { course = JSON.parse(courseEntry.getData().toString("utf8")); }
  catch (error) { throw new Error(`course.json is invalid: ${error.message}`); }
  validateCoursePackage(course, path.basename(filePath));
  if (manifest.courseId !== course.id) throw new Error("manifest.json courseId does not match course.json.");
  if (manifest.courseVersion !== course.version) throw new Error("manifest.json courseVersion does not match course.json.");
  assertPlainText(String(manifest.name || course.name), "manifest name", 160);
  return { manifest, course };
}

function readBuiltInCourseRecords() {
  const dir = courseDirectory();
  if (!fs.existsSync(dir)) throw new Error("The built-in courses directory is missing.");
  const files = fs.readdirSync(dir).filter(name => name.toLowerCase().endsWith(".json")).sort();
  if (!files.length) throw new Error("No built-in course packages were found.");
  return files.map(name => {
    const full = path.join(dir, name);
    let course;
    try {
      course = JSON.parse(fs.readFileSync(full, "utf8"));
      validateCoursePackage(course, name);
    } catch (error) {
      writeDiagnostic("Built-in course validation failed", `${name}: ${error.message}`);
      throw error;
    }
    return { course, source: "built-in", packagePath: full, packageName: name };
  });
}

function readInstalledCourseRecords() {
  const dir = installedCourseDirectory();
  const files = fs.readdirSync(dir).filter(name => name.toLowerCase().endsWith(".lacourse")).sort();
  const records = [];
  const warnings = [];
  for (const name of files) {
    const full = path.join(dir, name);
    try {
      const parsed = readCourseArchive(full);
      records.push({ course: parsed.course, manifest: parsed.manifest, source: "installed", packagePath: full, packageName: name });
    } catch (error) {
      const warning = `${name}: ${error.message}`;
      warnings.push(warning);
      writeDiagnostic("Installed course package skipped", warning);
    }
  }
  return { records, warnings };
}

function readCourseRecords() {
  const builtIn = readBuiltInCourseRecords();
  const installedResult = readInstalledCourseRecords();
  const records = [...builtIn];
  const ids = new Set(builtIn.map(record => record.course.id));
  for (const record of installedResult.records) {
    if (ids.has(record.course.id)) {
      const warning = `${record.packageName}: course id ${record.course.id} conflicts with a built-in course and was ignored.`;
      installedResult.warnings.push(warning);
      writeDiagnostic("Installed course package skipped", warning);
      continue;
    }
    ids.add(record.course.id);
    records.push(record);
  }
  return { records, warnings: installedResult.warnings };
}

function courseCatalogEntry(record) {
  const course = record.course;
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
    achievements: course.achievements || [],
    source: record.source,
    installedPackage: record.source === "installed",
    canUninstall: record.source === "installed",
    packageFormatVersion: record.manifest?.packageVersion || null
  };
}

function compareVersions(a, b) {
  const pa = String(a || "0.0.0").split(/[+-]/)[0].split(".").map(x => Number(x) || 0);
  const pb = String(b || "0.0.0").split(/[+-]/)[0].split(".").map(x => Number(x) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function installCourseArchive(sourcePath) {
  const parsed = readCourseArchive(sourcePath);
  const course = parsed.course;
  const builtIn = readBuiltInCourseRecords();
  if (builtIn.some(record => record.course.id === course.id)) {
    throw new Error(`A built-in course already uses the id ${course.id}. Built-in courses cannot be replaced by local packages.`);
  }

  const installed = readInstalledCourseRecords().records.find(record => record.course.id === course.id) || null;
  if (installed && compareVersions(course.version, installed.course.version) < 0) {
    throw new Error(`Downgrade blocked. Installed ${course.name} is v${installed.course.version}, but the selected package is v${course.version}.`);
  }

  const destination = path.join(installedCourseDirectory(), `${safePathPart(course.id)}.lacourse`);
  const temporary = `${destination}.tmp-${process.pid}-${Date.now()}`;
  fs.copyFileSync(sourcePath, temporary);
  if (fs.statSync(temporary).size !== fs.statSync(sourcePath).size) {
    try { fs.unlinkSync(temporary); } catch (_) {}
    throw new Error("The course package copy could not be verified.");
  }
  return { parsed, destination, temporary, installed };
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
    icon: path.join(__dirname, "assets", "learning-academy.ico"),
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
    const result = readCourseRecords();
    const courses = result.records.map(courseCatalogEntry);
    writeDiagnostic("Course catalog loaded", `${courses.length} course(s); ${result.warnings.length} warning(s)`);
    return { ok: true, courses, warnings: result.warnings };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
});

ipcMain.handle("courses:load", (_event, id) => {
  try {
    const result = readCourseRecords();
    const record = result.records.find(item => item.course.id === id);
    if (!record) return { ok: false, error: `Course not found: ${id}` };
    writeDiagnostic("Course package loaded", `${record.course.id} v${record.course.version || "1.0.0"} (${record.source})`);
    return { ok: true, course: record.course, source: record.source };
  } catch (error) {
    return { ok: false, error: error.message || String(error) };
  }
});

ipcMain.handle("courses:installPackage", async () => {
  try {
    const chosen = await dialog.showOpenDialog(mainWindow, {
      title: "Install Learning Academy Course",
      properties: ["openFile"],
      filters: [
        { name: "Learning Academy Course", extensions: ["lacourse"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (chosen.canceled || !chosen.filePaths?.length) return { ok: true, canceled: true };

    const sourcePath = chosen.filePaths[0];
    const prepared = installCourseArchive(sourcePath);
    const course = prepared.parsed.course;
    const previousVersion = prepared.installed?.course?.version || "";
    const action = prepared.installed ? (compareVersions(course.version, previousVersion) > 0 ? "updated" : "reinstalled") : "installed";

    const destination = prepared.destination;
    const temporary = prepared.temporary;
    const oldPath = `${destination}.previous`;
    try {
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      if (fs.existsSync(destination)) fs.renameSync(destination, oldPath);
      fs.renameSync(temporary, destination);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    } catch (error) {
      try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch (_) {}
      try {
        if (!fs.existsSync(destination) && fs.existsSync(oldPath)) fs.renameSync(oldPath, destination);
      } catch (_) {}
      throw error;
    }

    writeDiagnostic("Course package installed", `${course.id} v${course.version} (${action})`);
    return {
      ok: true,
      action,
      previousVersion,
      course: courseCatalogEntry({ course, manifest: prepared.parsed.manifest, source: "installed" })
    };
  } catch (error) {
    writeDiagnostic("Course package installation failed", error.message || String(error));
    return { ok: false, error: error.message || String(error) };
  }
});

ipcMain.handle("courses:uninstallPackage", (_event, id) => {
  try {
    const installed = readInstalledCourseRecords().records.find(record => record.course.id === id);
    if (!installed) return { ok: false, error: "That course is not an installed .lacourse package." };
    fs.unlinkSync(installed.packagePath);
    writeDiagnostic("Course package uninstalled", `${installed.course.id} v${installed.course.version}; learner progress preserved`);
    return { ok: true, courseId: installed.course.id, name: installed.course.name, version: installed.course.version, progressPreserved: true };
  } catch (error) {
    writeDiagnostic("Course package uninstall failed", error.message || String(error));
    return { ok: false, error: error.message || String(error) };
  }
});

ipcMain.handle("courses:openInstalledFolder", async () => {
  try {
    const error = await shell.openPath(installedCourseDirectory());
    return error ? { ok: false, error } : { ok: true };
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

ipcMain.handle("academy:openExternal", async (_event, rawUrl) => {
  try {
    const url = new URL(String(rawUrl || ""));
    if (!(["https:", "http:"].includes(url.protocol))) throw new Error("Only web links can be opened externally.");
    await shell.openExternal(url.toString());
    return { ok: true };
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
