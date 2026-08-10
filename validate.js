const fs = require("fs");

let failed = false;

function validateJavaScript(label, code) {
  try {
    new Function(code);
    console.log(`✓ ${label} syntax OK`);
  } catch (error) {
    failed = true;
    console.error(`✗ ${label} syntax error:`);
    console.error(error.message);
  }
}

const html = fs.readFileSync("index.html", "utf8");
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];

if (!scripts.length) {
  console.error("Validation failed: no inline <script> block found in index.html.");
  process.exit(1);
}

scripts.forEach((match, index) => {
  validateJavaScript(`Inline script ${index + 1}`, match[1]);
});

for (const file of ["main.js", "preload.js"]) {
  if (!fs.existsSync(file)) {
    failed = true;
    console.error(`✗ Missing required file: ${file}`);
    continue;
  }
  validateJavaScript(file, fs.readFileSync(file, "utf8"));
}

if (failed) process.exit(1);
console.log("✓ Learning Academy JavaScript validation passed.");
