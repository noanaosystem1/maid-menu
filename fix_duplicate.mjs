import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const R = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const W = (f, c) => fs.writeFileSync(path.join(dir, f), c, "utf8");

const s = R("server/db.js");
const lines = s.split("\n");

// Count occurrences
let dgCount = 0;
let drCount = 0;
for (const line of lines) {
  if (line.includes("export async function deleteGuest")) dgCount++;
  if (line.includes("export async function deleteRoom")) drCount++;
}
console.log("deleteGuest count:", dgCount);
console.log("deleteRoom count:", drCount);

if (dgCount <= 1 && drCount <= 1) {
  console.log("No duplicates found.");
  process.exit(0);
}

// Remove ALL duplicate blocks, keeping only the LAST occurrence of each
const output = [];
const blockStartMarker = "export async function delete";
let currentBlockStart = -1;

for (let i = 0; i < lines.length; i++) {
  if (lines[i].startsWith("export async function delete")) {
    if (currentBlockStart >= 0) {
      // Skip previous block - it's a duplicate
    }
    currentBlockStart = output.length;
    output.push(lines[i]);
  } else if (currentBlockStart >= 0) {
    output.push(lines[i]);
  } else {
    output.push(lines[i]);
  }
}

// Now deduplicate: keep only last occurrence of deleteGuest and deleteRoom
const result = [];
let lastDGBlock = null;
let lastDRBlock = null;
let dgStart = -1;
let drStart = -1;

// Flatten output into sections
const sections = [];
let sectionStart = 0;
for (let i = 0; i < output.length; i++) {
  if (output[i].startsWith("export async function delete") && i > sectionStart) {
    sections.push(output.slice(sectionStart, i));
    sectionStart = i;
  }
}
sections.push(output.slice(sectionStart));

const filteredSections = [];
for (const sec of sections) {
  const header = sec[0] || "";
  if (header.includes("deleteGuest")) {
    lastDGBlock = sec;
  } else if (header.includes("deleteRoom")) {
    lastDRBlock = sec;
  } else {
    filteredSections.push(sec);
  }
}

if (lastDGBlock) filteredSections.push(lastDGBlock);
if (lastDRBlock) filteredSections.push(lastDRBlock);

const finalLines = filteredSections.flat();
W("server/db.js", finalLines.join("\n"));

// Verify
const verify = R("server/db.js");
let dg = 0;
let dr = 0;
for (const line of verify.split("\n")) {
  if (line.includes("export async function deleteGuest")) dg++;
  if (line.includes("export async function deleteRoom")) dr++;
}
console.log("Verify - deleteGuest:", dg, "deleteRoom:", dr);
console.log("Done! Lines:", verify.split("\n").length);
