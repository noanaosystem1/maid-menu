import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const R = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const W = (f, c) => fs.writeFileSync(path.join(dir, f), c, "utf8");

const s = R("server/db.js");
const marker = "export async function checkConnection()";

// Find all occurrences
let start = 0;
const positions = [];
while (true) {
  const i = s.indexOf(marker, start);
  if (i === -1) break;
  positions.push(i);
  start = i + 1;
}

console.log("checkConnection at:", positions.map(p => p + 1));

if (positions.length <= 1) {
  console.log("No duplicates.");
  process.exit(0);
}

// Keep only the LAST occurrence, remove all previous ones
let result = s;
for (let i = 0; i < positions.length - 1; i++) {
  const pos = positions[i];
  const end = s.indexOf(marker, pos + 1);
  const blockEnd = end === -1 ? s.length : end;
  
  // Find the actual end of this function (next export or end of file)
  let funcEnd = blockEnd;
  const nextExport = s.indexOf("\nexport async function", pos + 1);
  if (nextExport === -1) {
    funcEnd = s.length;
  } else {
    funcEnd = nextExport + 1;
  }
  
  console.log(`Removing duplicate at line ${pos + 1}, length ${funcEnd - pos}`);
  result = result.substring(0, pos) + result.substring(funcEnd);
  break; // Remove only the first occurrence
}

W("server/db.js", result);

// Verify
const verify = R("server/db.js");
let count = 0;
let st = 0;
while (true) {
  const i = verify.indexOf(marker, st);
  if (i === -1) break;
  count++;
  st = i + 1;
}
console.log("Final checkConnection count:", count);
