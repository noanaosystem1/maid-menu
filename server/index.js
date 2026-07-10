import "./load-env.js";
import express from "express";
import cors from "cors";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { supabase } from "./supabase.js";
import {
  listRooms,
  getRoom,
  createRoom,
  updateRoom,
  listGuests,
  createGuest,
  updateGuest,
  deleteRoom,
  deleteGuest,
  listMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  checkConnection,
} from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
const distPath = join(__dirname, "..", "dist");

const app = express();
app.use(cors());
app.use(express.json());

function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message || "Internal server error" });
    }
  };
}

app.get("/api/health", handle(async (_req, res) => {
  if (!supabase) {
    return res.status(503).json({ ok: false, error: "Supabase not configured" });
  }
  await checkConnection();
  res.json({ ok: true, database: "supabase" });
}));

app.get("/api/rooms", handle(async (_req, res) => {
  res.json(await listRooms());
}));

app.get("/api/rooms/:id", handle(async (req, res) => {
  const room = await getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json(room);
}));

app.post("/api/rooms", handle(async (req, res) => {
  const { name, phase } = req.body ?? {};
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  res.status(201).json(await createRoom({ name: name.trim(), phase }));
}));

app.patch("/api/rooms/:id", handle(async (req, res) => {
  const room = await updateRoom(req.params.id, req.body ?? {});
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json(room);
}));

app.get("/api/guests", handle(async (req, res) => {
  const { roomId, sessionToken } = req.query;
  res.json(await listGuests({ roomId, sessionToken }));
}));

app.post("/api/guests", handle(async (req, res) => {
  const body = req.body ?? {};
  if (!body.name?.trim() || !body.roomId || !body.sessionToken) {
    return res.status(400).json({ error: "name, roomId, sessionToken are required" });
  }
  res.status(201).json(await createGuest(body));
}));

app.patch("/api/guests/:id", handle(async (req, res) => {
  const guest = await updateGuest(req.params.id, req.body ?? {});
  if (!guest) return res.status(404).json({ error: "Guest not found" });
  res.json(guest);
}));

app.delete("/api/rooms/:id", handle(async (req, res) => {
  await deleteRoom(req.params.id);
  res.status(204).end();
}));

app.delete("/api/guests/:id", handle(async (req, res) => {
  await deleteGuest(req.params.id);
  res.status(204).end();
}));

app.get("/api/menu-items", handle(async (req, res) => {
  const limit = Number(req.query.limit) || 100;
  res.json(await listMenuItems(limit));
}));

app.post("/api/menu-items", handle(async (req, res) => {
  const body = req.body ?? {};
  if (!body.name?.trim()) return res.status(400).json({ error: "name is required" });
  res.status(201).json(await createMenuItem(body));
}));

app.patch("/api/menu-items/:id", handle(async (req, res) => {
  const item = await updateMenuItem(req.params.id, req.body ?? {});
  if (!item) return res.status(404).json({ error: "Menu item not found" });
  res.json(item);
}));

app.delete("/api/menu-items/:id", handle(async (req, res) => {
  await deleteMenuItem(req.params.id);
  res.status(204).end();
}));

if (isProd && existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(join(distPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT} (${isProd ? "production" : "development"})`);
  if (supabase) console.log("[server] database: Supabase");
  else console.warn("[server] Supabase 未設定 — .env を確認してください");
});
