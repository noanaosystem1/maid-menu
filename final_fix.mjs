import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const R = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const W = (f, c) => fs.writeFileSync(path.join(dir, f), c, "utf8");

// Fix index.js - add deleteGuest import and remove double semicolon
let idx = R("server/index.js");
if (!idx.includes("  deleteGuest,")) {
  idx = idx.replace(
    "  deleteRoom,\n  listMenuItems,",
    "  deleteRoom,\n  deleteGuest,\n  listMenuItems,"
  );
  console.log("Added deleteGuest import");
}

// Fix double semicolon
idx = idx.replace("}));\n\n}", "}));\n}");
W("server/index.js", idx);
console.log("index.js double semicolon fixed:", idx.includes("}));\n\n}"));

// Fix db.js - remove blank line from rowToGuest
let db = R("server/db.js");
if (db.includes("\n    sessionToken:")) {
  db = db.replace("\n\n    sessionToken", "\n    sessionToken");
  W("server/db.js", db);
  console.log("db.js blank line removed");
} else {
  console.log("db.js no blank line issue");
}
