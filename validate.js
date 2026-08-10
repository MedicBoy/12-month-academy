const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];

if (!scripts.length) {
  console.error("Validation failed: no inline <script> block found in index.html.");
  process.exit(1);
}

let failed = false;

scripts.forEach((match, index) => {
  const code = match[1];
  try {
    new Function(code);
    console.log(`✓ Inline script ${index + 1} syntax OK`);
  } catch (error) {
    failed = true;
    console.error(`✗ Inline script ${index + 1} syntax error:`);
    console.error(error.message);
  }
});

if (failed) {
  process.exit(1);
}

console.log("✓ Learning Academy JavaScript validation passed.");
