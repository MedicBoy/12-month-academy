const fs = require("fs");
const path = require("path");

let failed = false;

function fail(message) {
  failed = true;
  console.error(`✗ ${message}`);
}

function ok(message) {
  console.log(`✓ ${message}`);
}

function validateJavaScript(label, code) {
  try {
    new Function(code);
    ok(`${label} syntax OK`);
  } catch (error) {
    fail(`${label} syntax error: ${error.message}`);
  }
}

const html = fs.readFileSync("index.html", "utf8");
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
if (!scripts.length) fail("Validation failed: no inline <script> block found in index.html.");
scripts.forEach((match, index) => validateJavaScript(`Inline script ${index + 1}`, match[1]));

for (const file of ["main.js", "preload.js"]) {
  if (!fs.existsSync(file)) {
    fail(`Missing required file: ${file}`);
    continue;
  }
  validateJavaScript(file, fs.readFileSync(file, "utf8"));
}

function validateCoursePackage(course, file) {
  if (!course || typeof course !== "object") return fail(`${file}: package must be an object.`);
  if (course.schemaVersion !== 1) fail(`${file}: schemaVersion must be 1.`);
  if (!course.id || !/^[a-z0-9][a-z0-9-]*$/i.test(course.id)) fail(`${file}: invalid id.`);
  for (const field of ["name", "shortName", "description", "duration"]) {
    if (!course[field] || typeof course[field] !== "string") fail(`${file}: missing ${field}.`);
  }
  if (!course.curriculum || !Array.isArray(course.curriculum.days) || !course.curriculum.days.length) {
    fail(`${file}: curriculum.days must be a non-empty array.`);
    return;
  }
  course.curriculum.days.forEach((day, index) => {
    if (day.day !== index + 1) fail(`${file}: expected sequential Day ${index + 1}.`);
    if (!Array.isArray(day.tasks) || !day.tasks.length) fail(`${file}: Day ${day.day} has no tasks.`);
    else day.tasks.forEach((task, taskIndex) => {
      if (!Array.isArray(task) || task.length < 3) fail(`${file}: Day ${day.day} task ${taskIndex + 1} is invalid.`);
    });
  });
  if (course.lessons && typeof course.lessons !== "object") fail(`${file}: lessons must be an object.`);
  if (course.achievements && !Array.isArray(course.achievements)) fail(`${file}: achievements must be an array.`);
  ok(`${file} course package valid (${course.curriculum.days.length} days)`);
}

const courseDir = path.join(process.cwd(), "courses");
if (!fs.existsSync(courseDir)) {
  fail("Missing courses directory.");
} else {
  const courseFiles = fs.readdirSync(courseDir).filter(name => name.toLowerCase().endsWith(".json"));
  if (!courseFiles.length) fail("No course JSON packages found in courses directory.");
  const ids = new Set();
  for (const file of courseFiles) {
    try {
      const course = JSON.parse(fs.readFileSync(path.join(courseDir, file), "utf8"));
      validateCoursePackage(course, file);
      if (course.id) {
        if (ids.has(course.id)) fail(`${file}: duplicate course id ${course.id}.`);
        ids.add(course.id);
      }
    } catch (error) {
      fail(`${file}: invalid JSON: ${error.message}`);
    }
  }
}

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
if (pkg.version !== "1.2.3") fail(`package.json version must be 1.2.3, found ${pkg.version}.`);
else ok("Application version is 1.2.3");
if (!pkg.build?.files?.some(entry => String(entry).startsWith("courses/"))) fail("package.json build.files must include courses/**/*.");
else ok("Built-in course packages included in Windows build");
if (!pkg.dependencies?.["adm-zip"]) fail("package.json dependencies must include adm-zip for .lacourse support.");
else ok(".lacourse archive dependency declared");
if (!fs.readFileSync("preload.js", "utf8").includes("installPackage")) fail("preload.js is missing the course-package install bridge.");
else ok("Course package bridge present");
if (!fs.readFileSync("main.js", "utf8").includes("learning-academy-course")) fail("main.js is missing the .lacourse package-format validator.");
else ok("Course package validator present");

if (failed) process.exit(1);
console.log("✓ Learning Academy validation passed.");
