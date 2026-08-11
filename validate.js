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
if (pkg.version !== "1.3.2") fail(`package.json version must be 1.3.2, found ${pkg.version}.`);
else ok("Application version is 1.3.2");
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
if (!indexHtml.includes('id="profileLevel"') || !indexHtml.includes('academyLevelInfo()') || !indexHtml.includes('id="profileLevelFill"')) fail("Profile Academy Level UI is missing.");
else ok("Profile Academy Level UI configured");
if (!indexHtml.includes('id="leaderboardPodium"') || !indexHtml.includes('podium-card') || !indexHtml.includes('leader-role')) fail("Polished leaderboard podium/role UI is missing.");
else ok("Leaderboard podium and Owner badge UI configured");
if (!indexHtml.includes('data-page="dash"') || !indexHtml.includes('nav-active') || !indexHtml.includes('nav-external')) fail("Polished active navigation UI is missing.");
else ok("Active navigation and external Website styling configured");
if (!indexHtml.includes('grid-template-areas:"challenge recent" "challenge stats" "updates goal" "updates top"')) fail("Requested dashboard card layout has changed unexpectedly.");
else ok("Requested dashboard card layout preserved");
if (!indexHtml.includes('id="onboarding"') || !indexHtml.includes('startOnboardingIfNeeded()') || !indexHtml.includes('finishOnboarding()')) fail("First-run onboarding flow is missing.");
else ok("First-run onboarding flow configured");
if (!indexHtml.includes('LEARNING_GOALS_KEY') || !indexHtml.includes('DAILY_GOAL_TARGET_KEY') || !indexHtml.includes('selectOnboardingDailyGoal')) fail("Onboarding goals or Daily Goal persistence is missing.");
else ok("Onboarding learning goals and Daily Goal persistence configured");
if (!indexHtml.includes('Run Setup Again') || !indexHtml.includes('replayOnboarding()')) fail("Settings must allow onboarding to be replayed safely.");
else ok("Onboarding replay control configured in Settings");
if (!indexHtml.includes('academyProfile.role') || !indexHtml.includes('academyProfile.picture=onboardingDraft.picture')) fail("Onboarding must update profile identity without replacing the saved role.");
else ok("Onboarding preserves per-profile role while updating identity");

if (!pkg.dependencies?.["@supabase/supabase-js"]) fail("package.json dependencies must include @supabase/supabase-js for account authentication.");
else ok("Supabase authentication dependency declared");
if (!pkg.learningAcademyBackend || pkg.learningAcademyBackend.provider !== "supabase" || !String(pkg.learningAcademyBackend.authRedirect || "").startsWith("learning-academy://")) fail("Learning Academy backend/auth redirect configuration is missing.");
else ok("Backend authentication configuration scaffold present");
if (!Array.isArray(pkg.build?.protocols) || !pkg.build.protocols.some(p => Array.isArray(p.schemes) && p.schemes.includes("learning-academy"))) fail("electron-builder must register the learning-academy deep-link protocol.");
else ok("Authentication deep-link protocol configured");
const preloadText = fs.readFileSync("preload.js", "utf8");
const mainText = fs.readFileSync("main.js", "utf8");
if (!preloadText.includes("academyAuth") || !preloadText.includes("auth:signIn") || !preloadText.includes("auth:social") || !preloadText.includes("auth:logout")) fail("preload.js authentication bridge is incomplete.");
else ok("Authentication IPC bridge configured");
if (!mainText.includes("safeStorage") || !mainText.includes("secure-auth-session.bin") || !mainText.includes("signInWithPassword") || !mainText.includes("signInWithOAuth") || !mainText.includes("exchangeCodeForSession")) fail("main.js secure authentication/session implementation is incomplete.");
else ok("Secure main-process authentication and Remember me storage configured");
if (!indexHtml.includes('id="authGate"') || !indexHtml.includes("initAuthentication()") || !indexHtml.includes("submitAuthForm()") || !indexHtml.includes("startSocialLogin('google')") || !indexHtml.includes('id="logoutNavBtn"')) fail("Login/signup/social/logout UI is incomplete.");
else ok("Login, signup, social sign-in and logout UI configured");
if (!indexHtml.includes("enterDevelopmentMode()") || !indexHtml.includes('id="authDevNotice"')) fail("Unconfigured-backend development access is missing.");
else ok("Safe development access is available until production backend credentials are connected");

if (!pkg.dependencies?.["adm-zip"]) fail("package.json dependencies must include adm-zip for .lacourse support.");
else ok(".lacourse archive dependency declared");
if (!fs.readFileSync("preload.js", "utf8").includes("installPackage")) fail("preload.js is missing the course-package install bridge.");
else ok("Course package bridge present");
if (!fs.readFileSync("main.js", "utf8").includes("learning-academy-course")) fail("main.js is missing the .lacourse package-format validator.");
else ok("Course package validator present");

if (failed) process.exit(1);
console.log("✓ Learning Academy validation passed.");
