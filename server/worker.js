// Cloudflare Worker for Maid Cafe Menu System with SQLite Durable Objects & WebSockets.
// 100% D1-Free Architecture. Persistently stores and broadcasts data entirely in the MaidCafeDO Durable Object.

// Helper to format JSON response
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password, Authorization",
      "Access-Control-Max-Age": "86400",
      "Content-Type": "application/json",
    },
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password, Authorization",
  "Access-Control-Max-Age": "86400",
};

function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// ==========================================
// 1. DURABLE OBJECT: MaidCafeDO
// ==========================================
export class MaidCafeDO {
  constructor(state, env) {
    this.ctx = state;
    this.env = env;
    this.sessions = []; // Active WebSocket clients: array of { ws, roomId, guestId }

    // Initialize SQLite tables inside Durable Object
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        phase TEXT NOT NULL DEFAULT 'WAITING',
        created_date TEXT NOT NULL
      );
    `);

    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS guest_users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        room_id TEXT NOT NULL,
        session_token TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_online INTEGER NOT NULL DEFAULT 0,
        last_seen TEXT,
        created_date TEXT NOT NULL
      );
    `);

    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        price REAL NOT NULL DEFAULT 0,
        category TEXT NOT NULL DEFAULT 'food',
        description TEXT,
        image_url TEXT,
        order_index INTEGER NOT NULL DEFAULT 0,
        created_date TEXT NOT NULL
      );
    `);
  }

  // SQLite helper
  query(sql, ...params) {
    const results = [];
    const cursor = this.ctx.storage.sql.exec(sql, ...params);
    for (const row of cursor) {
      results.push(row);
    }
    return results;
  }

  querySingle(sql, ...params) {
    const arr = this.query(sql, ...params);
    return arr.length > 0 ? arr[0] : null;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- WEBSOCKET UPGRADE ---
    if (path === "/connect-ws") {
      const roomId = url.searchParams.get("roomId");
      const guestId = url.searchParams.get("guestId");

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      await this.handleWebSocketSession(server, roomId, guestId);

      return new Response(null, { status: 101, webSocket: client });
    }

    // --- REST API ENDPOINTS PROXIED TO DO SQLITE ---

    // GET /api/health
    if (path === "/api/health") {
      return jsonResponse({ ok: true, database: "durable_objects_sqlite" });
    }

    // GET /api/rooms
    if (path === "/api/rooms" && request.method === "GET") {
      const rows = this.query("SELECT * FROM rooms ORDER BY created_date DESC");
      return jsonResponse(rows);
    }

    // GET /api/rooms/:id
    const roomDetailMatch = path.match(/^\/api\/rooms\/([a-zA-Z0-9-]+)$/);
    if (roomDetailMatch && request.method === "GET") {
      const roomId = roomDetailMatch[1];
      const row = this.querySingle("SELECT * FROM rooms WHERE id = ?", roomId);
      if (!row) return jsonResponse({ error: "Room not found" }, 404);
      return jsonResponse(row);
    }

    // POST /api/rooms
    if (path === "/api/rooms" && request.method === "POST") {
      const body = await request.json();
      const { id, name, phase } = body;
      const createdDate = new Date().toISOString();
      this.query("INSERT INTO rooms (id, name, phase, created_date) VALUES (?, ?, ?, ?)", id, name, phase, createdDate);
      return jsonResponse({ id, name, phase, created_date: createdDate }, 201);
    }

    // PATCH /api/rooms/:id
    if (roomDetailMatch && request.method === "PATCH") {
      const roomId = roomDetailMatch[1];
      const body = await request.json();
      const current = this.querySingle("SELECT * FROM rooms WHERE id = ?", roomId);
      if (!current) return jsonResponse({ error: "Room not found" }, 404);

      const newName = body.name !== undefined ? body.name : current.name;
      const newPhase = body.phase !== undefined ? body.phase : current.phase;

      this.query("UPDATE rooms SET name = ?, phase = ? WHERE id = ?", newName, newPhase, roomId);

      // Broadcast phase update via active WebSockets of this room session
      if (body.phase !== undefined) {
        this.broadcastToRoom(roomId, { type: "PHASE_UPDATE", phase: newPhase });
      }

      return jsonResponse({
        id: roomId,
        name: newName,
        phase: newPhase,
        created_date: current.created_date,
      });
    }

    // DELETE /api/rooms/:id
    if (roomDetailMatch && request.method === "DELETE") {
      const roomId = roomDetailMatch[1];
      this.query("DELETE FROM guest_users WHERE room_id = ?", roomId);
      this.query("DELETE FROM rooms WHERE id = ?", roomId);
      return new Response(null, { status: 204 });
    }

    // GET /api/guests
    if (path === "/api/guests" && request.method === "GET") {
      const sessionToken = url.searchParams.get("sessionToken");
      const roomId = url.searchParams.get("roomId");

      let rows;
      if (sessionToken) {
        rows = this.query("SELECT * FROM guest_users WHERE session_token = ? ORDER BY created_date DESC", sessionToken);
      } else if (roomId) {
        rows = this.query("SELECT * FROM guest_users WHERE room_id = ? ORDER BY created_date DESC", roomId);
      } else {
        rows = this.query("SELECT * FROM guest_users ORDER BY created_date DESC");
      }

      const enriched = rows.map(row => {
        const isOnline = row.is_online === 1;
        return {
          id: row.id,
          name: row.name,
          roomId: row.room_id,
          sessionToken: row.session_token,
          isActive: row.is_active === 1,
          isOnline: isOnline,
          lastSeen: row.last_seen,
          created_date: row.created_date,
        };
      });

      return jsonResponse(enriched);
    }

    // POST /api/guests
    if (path === "/api/guests" && request.method === "POST") {
      const body = await request.json();
      const { id, name, roomId, sessionToken, isActive, isOnline } = body;
      const createdDate = new Date().toISOString();
      const activeVal = isActive !== false ? 1 : 0;
      const onlineVal = isOnline ? 1 : 0;

      this.query("INSERT INTO guest_users (id, name, room_id, session_token, is_active, is_online, created_date) VALUES (?, ?, ?, ?, ?, ?, ?)",
        id, name, roomId, sessionToken, activeVal, onlineVal, createdDate);

      return jsonResponse({
        id,
        name,
        roomId,
        sessionToken,
        isActive: activeVal === 1,
        isOnline: onlineVal === 1,
        lastSeen: null,
        created_date: createdDate,
      }, 201);
    }

    // PATCH /api/guests/:id
    const guestDetailMatch = path.match(/^\/api\/guests\/([a-zA-Z0-9-]+)$/);
    if (guestDetailMatch && request.method === "PATCH") {
      const guestId = guestDetailMatch[1];
      const body = await request.json();
      const current = this.querySingle("SELECT * FROM guest_users WHERE id = ?", guestId);
      if (!current) return jsonResponse({ error: "Guest not found" }, 404);

      const newName = body.name !== undefined ? body.name : current.name;
      const newRoomId = body.roomId !== undefined ? body.roomId : current.room_id;
      const newSessionToken = body.sessionToken !== undefined ? body.sessionToken : current.session_token;
      const newIsActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : current.is_active;
      const newIsOnline = body.isOnline !== undefined ? (body.isOnline ? 1 : 0) : current.is_online;
      const newLastSeen = body.lastSeen !== undefined ? body.lastSeen : current.last_seen;

      this.query("UPDATE guest_users SET name = ?, room_id = ?, session_token = ?, is_active = ?, is_online = ?, last_seen = ? WHERE id = ?",
        newName, newRoomId, newSessionToken, newIsActive, newIsOnline, newLastSeen, guestId);

      // Inform active WebSockets of changes in this room if needed
      this.broadcastToRoom(newRoomId, { type: "GUEST_UPDATE", guestId, isOnline: newIsOnline === 1 });

      return jsonResponse({
        id: guestId,
        name: newName,
        roomId: newRoomId,
        sessionToken: newSessionToken,
        isActive: newIsActive === 1,
        isOnline: newIsOnline === 1,
        lastSeen: newLastSeen,
        created_date: current.created_date,
      });
    }

    // DELETE /api/guests/:id
    if (guestDetailMatch && request.method === "DELETE") {
      const guestId = guestDetailMatch[1];
      this.query("DELETE FROM guest_users WHERE id = ?", guestId);
      return new Response(null, { status: 204 });
    }

    // GET /api/menu-items
    if (path === "/api/menu-items" && request.method === "GET") {
      const limit = Number(url.searchParams.get("limit")) || 100;
      const rows = this.query("SELECT * FROM menu_items ORDER BY order_index ASC, created_date ASC LIMIT ?", limit);
      const mapped = rows.map(row => ({
        id: row.id,
        name: row.name,
        price: Number(row.price),
        category: row.category,
        description: row.description,
        imageUrl: row.image_url,
        order: row.order_index,
        created_date: row.created_date,
      }));
      return jsonResponse(mapped);
    }

    // POST /api/menu-items
    if (path === "/api/menu-items" && request.method === "POST") {
      const body = await request.json();
      const { id, name, price, category, description, imageUrl, order } = body;
      const createdDate = new Date().toISOString();
      this.query("INSERT INTO menu_items (id, name, price, category, description, image_url, order_index, created_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        id, name, price, category, description, imageUrl, order, createdDate);
      return jsonResponse({ id, name, price, category, description, imageUrl, order, created_date: createdDate }, 201);
    }

    // PATCH /api/menu-items/:id
    const menuDetailMatch = path.match(/^\/api\/menu-items\/([a-zA-Z0-9-]+)$/);
    if (menuDetailMatch && request.method === "PATCH") {
      const itemId = menuDetailMatch[1];
      const body = await request.json();
      const current = this.querySingle("SELECT * FROM menu_items WHERE id = ?", itemId);
      if (!current) return jsonResponse({ error: "Menu item not found" }, 404);

      const newName = body.name !== undefined ? body.name : current.name;
      const newPrice = body.price !== undefined ? body.price : current.price;
      const newCategory = body.category !== undefined ? body.category : current.category;
      const newDesc = body.description !== undefined ? body.description : current.description;
      const newImg = body.imageUrl !== undefined ? body.imageUrl : current.image_url;
      const newOrder = body.order !== undefined ? body.order : current.order_index;

      this.query("UPDATE menu_items SET name = ?, price = ?, category = ?, description = ?, image_url = ?, order_index = ? WHERE id = ?",
        newName, newPrice, newCategory, newDesc, newImg, newOrder, itemId);

      return jsonResponse({
        id: itemId,
        name: newName,
        price: Number(newPrice),
        category: newCategory,
        description: newDesc,
        imageUrl: newImg,
        order: newOrder,
        created_date: current.created_date,
      });
    }

    // DELETE /api/menu-items/:id
    if (menuDetailMatch && request.method === "DELETE") {
      const itemId = menuDetailMatch[1];
      this.query("DELETE FROM menu_items WHERE id = ?", itemId);
      return new Response(null, { status: 204 });
    }

    return new Response("Not Found", { status: 404 });
  }

  async handleWebSocketSession(ws, roomId, guestId) {
    ws.accept();
    const session = { ws, roomId, guestId };
    this.sessions.push(session);

    // Update guest user online status to online in database
    if (guestId) {
      this.query("UPDATE guest_users SET is_online = 1, last_seen = ? WHERE id = ?", new Date().toISOString(), guestId);
    }

    // Send the current phase on join
    const room = this.querySingle("SELECT * FROM rooms WHERE id = ?", roomId);
    if (room) {
      ws.send(JSON.stringify({ type: "PHASE_UPDATE", phase: room.phase }));
    }

    ws.addEventListener("message", async (msg) => {
      // Manage custom guest action messages if required
    });

    const cleanup = () => {
      this.sessions = this.sessions.filter(s => s.ws !== ws);
      if (guestId) {
        this.query("UPDATE guest_users SET is_online = 0, last_seen = ? WHERE id = ?", new Date().toISOString(), guestId);
      }
    };

    ws.addEventListener("close", cleanup);
    ws.addEventListener("error", cleanup);
  }

  broadcastToRoom(roomId, message) {
    const payload = JSON.stringify(message);
    const activeSessions = [];

    this.sessions.forEach(session => {
      if (session.roomId === roomId) {
        try {
          session.ws.send(payload);
          activeSessions.push(session);
        } catch {
          // Closed socket
        }
      } else {
        activeSessions.push(session);
      }
    });

    this.sessions = activeSessions;
  }
}

// ==========================================
// 2. MAIN WORKER PROXY ENTRYPOINT
// ==========================================
export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Helper to check if authorized
    const isAdmin = () => {
      const passwordHeader = request.headers.get("X-Admin-Password") || request.headers.get("Authorization");
      const expectedPassword = env.ADMIN_PASSWORD || "maid2024";
      return passwordHeader === expectedPassword;
    };

    const requireAdmin = () => {
      if (!isAdmin()) {
        throw new Error("UNAUTHORIZED");
      }
    };

    try {
      // --- PUBLIC / STATIC ASSETS ROUTING ---
      if (!path.startsWith("/api")) {
        if (env.ASSETS) {
          let response = await env.ASSETS.fetch(request);
          if (response.status === 404) {
            response = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url)));
          }
          return response;
        }
        return new Response("Not Found", { status: 404 });
      }

      // --- AUTHENTICATION & WEBSOCKET ROUTING PROXIED TO SINGLETON DO ---
      if (!env.MAID_CAFE_DO) {
        return jsonResponse({ error: "ROOM_SESSION Durable Object binding missing in wrangler.json" }, 500);
      }

      // We use a singleton namespace ID to manage our single-Durable-Object persistent SQLite store
      const doId = env.MAID_CAFE_DO.idFromName("global_store");
      const storeDo = env.MAID_CAFE_DO.get(doId);

      // A: WebSocket Connection endpoint
      if (path === "/api/ws" && request.method === "GET") {
        const roomId = url.searchParams.get("roomId");
        const guestId = url.searchParams.get("guestId");
        if (!roomId) {
          return jsonResponse({ error: "roomId is required" }, 400);
        }

        const upgradeHeader = request.headers.get("Upgrade");
        if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
          return new Response("Expected Upgrade: websocket", { status: 426 });
        }

        // Proxy WebSocket request directly to DO's /connect-ws endpoint
        const wsUrl = new URL(`/connect-ws?roomId=${roomId}&guestId=${guestId || ""}`, url.origin);
        return await storeDo.fetch(new Request(wsUrl, request));
      }

      // B: Check which REST API endpoints require Admin Auth
      const isMutation = ["POST", "PATCH", "DELETE"].includes(request.method);
      const isFullGuests = path === "/api/guests" && !url.searchParams.get("sessionToken") && !url.searchParams.get("roomId");

      if (isMutation || isFullGuests) {
        // Exempt public polling update (only guest PATCH to themselves for metadata, but we've transitioned to WebSockets so all guest updates are via WS or can be protected)
        const isGuestPollingUpdate = path.match(/^\/api\/guests\/([a-zA-Z0-9-]+)$/) && request.method === "PATCH" && !request.headers.get("X-Admin-Password");

        if (!isGuestPollingUpdate) {
          requireAdmin();
        }
      }

      // C: Inject UUID for POST requests to simplify backend D1->DO DB compliance
      let proxiedRequest = request;
      if (request.method === "POST" && ["/api/rooms", "/api/guests", "/api/menu-items"].includes(path)) {
        const body = await request.json();
        if (!body.id) {
          body.id = crypto.randomUUID();
        }
        proxiedRequest = new Request(request.url, {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(body)
        });
      }

      // D: Forward all other API requests directly to the MaidCafeDO database
      const targetUrl = new URL(path + url.search, url.origin);
      return await storeDo.fetch(new Request(targetUrl, proxiedRequest));

    } catch (err) {
      if (err.message === "UNAUTHORIZED") {
        return jsonResponse({ error: "Unauthorized access" }, 401);
      }
      console.error(err);
      return jsonResponse({ error: err.message || "Internal server error" }, 500);
    }
  }
};
