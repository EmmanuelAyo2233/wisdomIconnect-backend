const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
let checked = 0;
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "uploads"].includes(item.name)) continue;
    const file = path.join(dir, item.name);
    if (item.isDirectory()) walk(file);
    else if (file.endsWith(".js")) {
      const result = spawnSync(process.execPath, ["--check", file], {
        encoding: "utf8",
      });
      if (result.status !== 0) {
        process.stderr.write(result.stderr);
        process.exitCode = 1;
      }
      checked++;
    }
  }
}
walk(path.resolve(__dirname, ".."));
console.log(`Checked ${checked} JavaScript files`);
