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
if (pkg.version !== "1.2.11") fail(`package.json version must be 1.2.11, found ${pkg.version}.`);
else ok("Application version is 1.2.11");
if (!pkg.build?.files?.some(entry => String(entry).startsWith("courses/"))) fail("package.json build.files must include courses/**/*.");
else ok("Built-in course packages included in Windows build");
if (!pkg.build?.files?.some(entry => String(entry).startsWith("assets/"))) fail("package.json build.files must include assets/**/*.");
else ok("Branding assets included in Windows build");
if (pkg.build?.win?.icon !== "assets/learning-academy.ico") fail("package.json build.win.icon must use assets/learning-academy.ico.");
else ok("Windows application icon configured");
for (const asset of ["assets/learning-academy.ico", "assets/learning-academy.png", "assets/learning-academy-banner.png"]) {
  if (!fs.existsSync(asset)) fail(`Missing branding asset: ${asset}`);
  else ok(`${asset} present`);
}

const indexHtml = fs.readFileSync("index.html", "utf8");
if (!indexHtml.includes('class="brand-banner"') || !indexHtml.includes('assets/learning-academy-banner.png')) fail("index.html must use the full Learning Academy banner in the header.");
else ok("Full Learning Academy banner configured in app header");


if (!indexHtml.includes('id="profile"') || !indexHtml.includes('id="leaderboard"')) fail("index.html must include Profile and Leaderboard pages.");
else ok("Profile and Leaderboard pages configured");
if (!indexHtml.includes('id="profileRoleLabel"') || !indexHtml.includes('id="profileCountry"') || !indexHtml.includes("countryFlagHtml")) fail("Role-aware profile country/flag UI is missing.");
else ok("Role-aware profile and country flag UI configured");
if (!indexHtml.includes('src.role==="owner"') || !indexHtml.includes('defaultRole="learner"') || !indexHtml.includes('hasLegacyLocalProfile?"owner":"learner"')) fail("Per-profile Owner/Learner role migration is missing.");
else ok("Per-profile Owner/Learner roles configured");
if (!indexHtml.includes('if(academyProfile.role==="owner")return [me,...others].slice(0,20)')) fail("Only the Owner profile should be pinned to preview leaderboard rank #1.");
else ok("Only Owner is pinned to preview leaderboard rank #1");
if (!indexHtml.includes('openWebsite()') || !fs.readFileSync("preload.js", "utf8").includes("academySystem")) fail("Website external-link bridge is missing.");
else ok("Website external-link bridge configured");

if (!pkg.dependencies?.["adm-zip"]) fail("package.json dependencies must include adm-zip for .lacourse support.");
else ok(".lacourse archive dependency declared");
if (!fs.readFileSync("preload.js", "utf8").includes("installPackage")) fail("preload.js is missing the course-package install bridge.");
else ok("Course package bridge present");
if (!fs.readFileSync("main.js", "utf8").includes("learning-academy-course")) fail("main.js is missing the .lacourse package-format validator.");
else ok("Course package validator present");

if (failed) process.exit(1);
console.log("✓ Learning Academy validation passed.");
