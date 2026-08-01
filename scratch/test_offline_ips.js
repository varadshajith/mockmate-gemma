"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const IP_LITERAL = /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g;
const violations = [];

function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("//") || trimmed.startsWith("#") ||
    trimmed.startsWith("/*") || trimmed.startsWith("*") || trimmed.startsWith("*/");
}

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "vendor") continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      visit(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".py"))) {
      const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
      lines.forEach((line, index) => {
        if (isCommentLine(line)) return;
        for (const ip of line.matchAll(IP_LITERAL)) {
          const allowedLoopback = ip[0] === "127.0.0.1";
          const prohibitedAnyAddress = ip[0] === "0.0.0.0" && /(?:!==|!=|\bnot\b|\bnever\b)/i.test(line);
          if (!allowedLoopback && !prohibitedAnyAddress) {
            violations.push(`${path.relative(ROOT, fullPath)}:${index + 1}: ${ip[0]}`);
          }
        }
      });
    }
  }
}

visit(ROOT);
if (violations.length) {
  console.error("Offline IP check failed:\n" + violations.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Offline IP check passed");
}
