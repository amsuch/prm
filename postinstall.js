const fs = require("fs");
const path = require("path");

// Recursively find react-native-css-interop/babel.js
function findFiles(dir, name, results = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== ".pnpm-store" && entry.name !== ".git") {
        findFiles(full, name, results);
      } else if (entry.name === name && full.includes("react-native-css-interop")) {
        results.push(full);
      }
    }
  } catch {}
  return results;
}

const files = findFiles(path.join(__dirname, "node_modules"), "babel.js");
let patched = 0;
for (const file of files) {
  try {
    let content = fs.readFileSync(file, "utf8");
    if (content.includes("react-native-worklets/plugin")) {
      content = content.replace(/\s*\/\/.*worklets.*\n/gi, "\n");
      content = content.replace(/\s*["']react-native-worklets\/plugin["'],?\n?/g, "\n");
      fs.writeFileSync(file, content);
      patched++;
      console.log("Patched:", file);
    }
  } catch {}
}
console.log("Patched", patched, "files");
