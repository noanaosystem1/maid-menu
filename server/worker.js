// Cloudflare Worker for Maid Cafe Menu System
// Backed by Cloudflare D1 (SQLite) and using in-memory caching to minimize D1 read/write operations.

// In-memory caches (per V8 isolate / Worker instance)
let menuItemsCache = null;
let roomsCache = null;

// Guest online status: guestId -> { isOnline: boolean, lastSeen: string }
const onlineGuests = new Map();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password, Authorization",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Helper to check if user is authorized as admin
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
      // Cloudflare Worker Assets automatically serves static files if configured,
      // but we still want to let API request pass.
      if (!path.startsWith("/api")) {
        // If Wrangler ASSETS binding is present, serve static asset
        if (env.ASSETS) {
          return await env.ASSETS.fetch(request);
        }
        return new Response("Not Found", { status: 404 });
      }

      // --- API ROUTING ---

      // GET /api/health
      if (path === "/api/health" && request.method === "GET") {
        try {
          await env.DB.prepare("SELECT 1").first();
          return jsonResponse({ ok: true, database: "d1" });
        } catch (err) {
          return jsonResponse({ ok: false, error: "D1 connection failed: " + err.message }, 503);
        }
      }

      // --- ROOMS API ---

      // GET /api/rooms
      if (path === "/api/rooms" && request.method === "GET") {
        if (!roomsCache) {
          const { results } = await env.DB.prepare("SELECT * FROM rooms ORDER BY created_date DESC").all();
          roomsCache = results.map(row => ({
            id: row.id,
            name: row.name,
            phase: row.phase,
            created_date: row.created_date,
          }));
        }
        return jsonResponse(roomsCache);
      }

      // GET /api/rooms/:id
      const roomDetailMatch = path.match(/^\/api\/rooms\/([a-zA-Z0-9-]+)$/);
      if (roomDetailMatch && request.method === "GET") {
        const roomId = roomDetailMatch[1];
        // Check cache first
        if (roomsCache) {
          const cachedRoom = roomsCache.find(r => r.id === roomId);
          if (cachedRoom) {
            return jsonResponse(cachedRoom);
          }
        }
        const room = await env.DB.prepare("SELECT * FROM rooms WHERE id = ?").bind(roomId).first();
        if (!room) {
          return jsonResponse({ error: "Room not found" }, 404);
        }
        return jsonResponse({
          id: room.id,
          name: room.name,
          phase: room.phase,
          created_date: room.created_date,
        });
      }

      // POST /api/rooms (ADMIN)
      if (path === "/api/rooms" && request.method === "POST") {
        requireAdmin();
        const body = await request.json();
        const { name, phase } = body ?? {};
        if (!name?.trim()) {
          return jsonResponse({ error: "name is required" }, 400);
        }
        const id = crypto.randomUUID();
        const roomPhase = phase || "WAITING";
        const createdDate = new Date().toISOString();

        await env.DB.prepare("INSERT INTO rooms (id, name, phase, created_date) VALUES (?, ?, ?, ?)")
          .bind(id, name.trim(), roomPhase, createdDate)
          .run();

        // Invalidate rooms cache
        roomsCache = null;

        return jsonResponse({ id, name: name.trim(), phase: roomPhase, created_date: createdDate }, 201);
      }

      // PATCH /api/rooms/:id (ADMIN)
      if (roomDetailMatch && request.method === "PATCH") {
        requireAdmin();
        const roomId = roomDetailMatch[1];
        const body = await request.json();
        const { name, phase } = body ?? {};

        // Fetch current room first
        const current = await env.DB.prepare("SELECT * FROM rooms WHERE id = ?").bind(roomId).first();
        if (!current) {
          return jsonResponse({ error: "Room not found" }, 404);
        }

        const newName = name !== undefined ? name.trim() : current.name;
        const newPhase = phase !== undefined ? phase : current.phase;

        await env.DB.prepare("UPDATE rooms SET name = ?, phase = ? WHERE id = ?")
          .bind(newName, newPhase, roomId)
          .run();

        // Invalidate rooms cache
        roomsCache = null;

        return jsonResponse({
          id: roomId,
          name: newName,
          phase: newPhase,
          created_date: current.created_date,
        });
      }

      // DELETE /api/rooms/:id (ADMIN)
      if (roomDetailMatch && request.method === "DELETE") {
        requireAdmin();
        const roomId = roomDetailMatch[1];

        // Delete cascading room users from D1 (SQLite doesn't always automatically enforce foreign keys unless configured, so let's delete them explicitly)
        await env.DB.prepare("DELETE FROM guest_users WHERE room_id = ?").bind(roomId).run();

        const result = await env.DB.prepare("DELETE FROM rooms WHERE id = ?").bind(roomId).run();

        // Invalidate rooms cache
        roomsCache = null;

        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // --- GUESTS API ---

      // GET /api/guests
      if (path === "/api/guests" && request.method === "GET") {
        const sessionToken = url.searchParams.get("sessionToken");
        const roomId = url.searchParams.get("roomId");

        // If neither sessionToken nor roomId is passed, this is an administrative full-list request
        if (!sessionToken && !roomId) {
          requireAdmin();
        }

        let query = "SELECT * FROM guest_users";
        let params = [];
        if (sessionToken) {
          query += " WHERE session_token = ?";
          params.push(sessionToken);
        } else if (roomId) {
          query += " WHERE room_id = ?";
          params.push(roomId);
        }
        query += " ORDER BY created_date DESC";

        const { results } = await env.DB.prepare(query).bind(...params).all();

        const enriched = results.map(row => {
          // Retrieve online status from our high-performance in-memory state
          const cached = onlineGuests.get(row.id);
          const now = Date.now();

          let isOnline = row.is_online === 1;
          let lastSeen = row.last_seen;

          if (cached) {
            isOnline = cached.isOnline;
            lastSeen = cached.lastSeen;
          }

          // Double check online state freshness (e.g., within 15 seconds)
          if (isOnline && lastSeen) {
            const diff = now - new Date(lastSeen).getTime();
            if (diff > 15000) {
              isOnline = false;
            }
          }

          return {
            id: row.id,
            name: row.name,
            roomId: row.room_id,
            sessionToken: row.session_token,
            isActive: row.is_active === 1,
            isOnline: isOnline,
            lastSeen: lastSeen,
            created_date: row.created_date,
          };
        });

        return jsonResponse(enriched);
      }

      // POST /api/guests (ADMIN)
      if (path === "/api/guests" && request.method === "POST") {
        requireAdmin();
        const body = await request.json();
        const { name, roomId, sessionToken, isActive, isOnline } = body ?? {};

        if (!name?.trim() || !roomId || !sessionToken) {
          return jsonResponse({ error: "name, roomId, sessionToken are required" }, 400);
        }

        const id = crypto.randomUUID();
        const createdDate = new Date().toISOString();
        const activeVal = isActive !== false ? 1 : 0;
        const onlineVal = isOnline ? 1 : 0;

        await env.DB.prepare("INSERT INTO guest_users (id, name, room_id, session_token, is_active, is_online, created_date) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(id, name.trim(), roomId, sessionToken, activeVal, onlineVal, createdDate)
          .run();

        // Also save to our in-memory status
        onlineGuests.set(id, {
          isOnline: Boolean(isOnline),
          lastSeen: isOnline ? createdDate : null,
        });

        return jsonResponse({
          id,
          name: name.trim(),
          roomId,
          sessionToken,
          isActive: activeVal === 1,
          isOnline: Boolean(isOnline),
          lastSeen: isOnline ? createdDate : null,
          created_date: createdDate,
        }, 201);
      }

      // PATCH /api/guests/:id (PUBLIC - for guest polling updates)
      const guestDetailMatch = path.match(/^\/api\/guests\/([a-zA-Z0-9-]+)$/);
      if (guestDetailMatch && request.method === "PATCH") {
        const guestId = guestDetailMatch[1];
        const body = await request.json();

        // Check if DB edit is required (e.g., changing name or room) or only polling update (isOnline, lastSeen)
        const hasDbFields = body.name !== undefined || body.roomId !== undefined || body.sessionToken !== undefined || body.isActive !== undefined;

        if (hasDbFields) {
          // If editing room/name, require Admin authentication
          requireAdmin();

          const current = await env.DB.prepare("SELECT * FROM guest_users WHERE id = ?").bind(guestId).first();
          if (!current) {
            return jsonResponse({ error: "Guest not found" }, 404);
          }

          const newName = body.name !== undefined ? body.name.trim() : current.name;
          const newRoomId = body.roomId !== undefined ? body.roomId : current.room_id;
          const newSessionToken = body.sessionToken !== undefined ? body.sessionToken : current.session_token;
          const newIsActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : current.is_active;

          await env.DB.prepare("UPDATE guest_users SET name = ?, room_id = ?, session_token = ?, is_active = ? WHERE id = ?")
            .bind(newName, newRoomId, newSessionToken, newIsActive, guestId)
            .run();

          // Respond with updated D1 + cached online stats
          const cached = onlineGuests.get(guestId);
          return jsonResponse({
            id: guestId,
            name: newName,
            roomId: newRoomId,
            sessionToken: newSessionToken,
            isActive: newIsActive === 1,
            isOnline: cached ? cached.isOnline : (current.is_online === 1),
            lastSeen: cached ? cached.lastSeen : current.last_seen,
            created_date: current.created_date,
          });
        } else {
          // --- LOW COST IN-MEMORY POLISHING ---
          // Since it only updates isOnline/lastSeen, do NOT write to D1! Just save to memory!
          const current = await env.DB.prepare("SELECT * FROM guest_users WHERE id = ?").bind(guestId).first();
          if (!current) {
            return jsonResponse({ error: "Guest not found" }, 404);
          }

          const isOnline = body.isOnline !== undefined ? Boolean(body.isOnline) : true;
          const lastSeen = body.lastSeen !== undefined ? body.lastSeen : new Date().toISOString();

          onlineGuests.set(guestId, { isOnline, lastSeen });

          return jsonResponse({
            id: guestId,
            name: current.name,
            roomId: current.room_id,
            sessionToken: current.session_token,
            isActive: current.is_active === 1,
            isOnline: isOnline,
            lastSeen: lastSeen,
            created_date: current.created_date,
          });
        }
      }

      // POST /api/guests/:id/offline (PUBLIC - guest closed tab)
      const guestOfflineMatch = path.match(/^\/api\/guests\/([a-zA-Z0-9-]+)\/offline$/);
      if (guestOfflineMatch && request.method === "POST") {
        const guestId = guestOfflineMatch[1];
        // Set to offline inside high performance memory cache
        onlineGuests.set(guestId, {
          isOnline: false,
          lastSeen: new Date().toISOString(),
        });
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // DELETE /api/guests/:id (ADMIN)
      if (guestDetailMatch && request.method === "DELETE") {
        requireAdmin();
        const guestId = guestDetailMatch[1];
        await env.DB.prepare("DELETE FROM guest_users WHERE id = ?").bind(guestId).run();

        // Remove from memory
        onlineGuests.delete(guestId);

        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // --- MENU ITEMS API ---

      // GET /api/menu-items
      if (path === "/api/menu-items" && request.method === "GET") {
        const limit = Number(url.searchParams.get("limit")) || 100;

        if (!menuItemsCache) {
          const { results } = await env.DB.prepare("SELECT * FROM menu_items ORDER BY order_index ASC, created_date ASC").all();
          menuItemsCache = results.map(row => ({
            id: row.id,
            name: row.name,
            price: Number(row.price),
            category: row.category,
            description: row.description,
            imageUrl: row.image_url,
            order: row.order_index,
            created_date: row.created_date,
          }));
        }

        const sliced = menuItemsCache.slice(0, limit);
        return jsonResponse(sliced);
      }

      // POST /api/menu-items (ADMIN)
      if (path === "/api/menu-items" && request.method === "POST") {
        requireAdmin();
        const body = await request.json();
        const { name, price, category, description, imageUrl, order } = body ?? {};

        if (!name?.trim()) {
          return jsonResponse({ error: "name is required" }, 400);
        }

        const id = crypto.randomUUID();
        const itemPrice = price ?? 0;
        const itemCategory = category ?? "food";
        const itemDesc = description ?? null;
        const itemImg = imageUrl ?? null;
        const itemOrder = order ?? 0;
        const createdDate = new Date().toISOString();

        await env.DB.prepare("INSERT INTO menu_items (id, name, price, category, description, image_url, order_index, created_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(id, name.trim(), itemPrice, itemCategory, itemDesc, itemImg, itemOrder, createdDate)
          .run();

        // Clear menu items cache
        menuItemsCache = null;

        return jsonResponse({
          id,
          name: name.trim(),
          price: Number(itemPrice),
          category: itemCategory,
          description: itemDesc,
          imageUrl: itemImg,
          order: itemOrder,
          created_date: createdDate,
        }, 201);
      }

      // PATCH /api/menu-items/:id (ADMIN)
      const menuDetailMatch = path.match(/^\/api\/menu-items\/([a-zA-Z0-9-]+)$/);
      if (menuDetailMatch && request.method === "PATCH") {
        requireAdmin();
        const itemId = menuDetailMatch[1];
        const body = await request.json();

        const current = await env.DB.prepare("SELECT * FROM menu_items WHERE id = ?").bind(itemId).first();
        if (!current) {
          return jsonResponse({ error: "Menu item not found" }, 404);
        }

        const newName = body.name !== undefined ? body.name.trim() : current.name;
        const newPrice = body.price !== undefined ? body.price : current.price;
        const newCategory = body.category !== undefined ? body.category : current.category;
        const newDesc = body.description !== undefined ? body.description : current.description;
        const newImg = body.imageUrl !== undefined ? body.imageUrl : current.image_url;
        const newOrder = body.order !== undefined ? body.order : current.order_index;

        await env.DB.prepare("UPDATE menu_items SET name = ?, price = ?, category = ?, description = ?, image_url = ?, order_index = ? WHERE id = ?")
          .bind(newName, newPrice, newCategory, newDesc, newImg, newOrder, itemId)
          .run();

        // Clear menu cache
        menuItemsCache = null;

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

      // DELETE /api/menu-items/:id (ADMIN)
      if (menuDetailMatch && request.method === "DELETE") {
        requireAdmin();
        const itemId = menuDetailMatch[1];
        await env.DB.prepare("DELETE FROM menu_items WHERE id = ?").bind(itemId).run();

        // Clear menu cache
        menuItemsCache = null;

        return new Response(null, { status: 204, headers: corsHeaders });
      }

      return jsonResponse({ error: "Endpoint not found" }, 404);

    } catch (err) {
      if (err.message === "UNAUTHORIZED") {
        return jsonResponse({ error: "Unauthorized access" }, 401);
      }
      console.error(err);
      return jsonResponse({ error: err.message || "Internal server error" }, 500);
    }
  }
};
