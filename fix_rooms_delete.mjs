import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const R = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const W = (f, c) => fs.writeFileSync(path.join(dir, f), c, "utf8");

const s = R("src/api/client.js");
if (!s.includes('delete: (id) => request(`/rooms/${id}`)) {
  const fixed = s.replace(
    '    update: (id, data) => request(`/rooms/${id}`, { method: "PATCH", body: data }),',
    '    update: (id, data) => request(`/rooms/${id}`, { method: "PATCH", body: data }),\n    delete: (id) => request(`/rooms/${id}`, { method: "DELETE" }),'
  );
  W("src/api/client.js", fixed);
  console.log("rooms.delete added");
} else {
  console.log("rooms.delete already present");
}
