// Cloudflare Worker for Maid Cafe Menu System
// Backed by Cloudflare D1 (SQLite) and using in-memory caching & throttling to minimize D1 read/write operations.

// In-memory caches (per V8 isolate / Worker instance) with TTL to support global multi-isolate synchronization
let menuItemsCache = null;
let menuItemsCacheTime = 0;
const MENU_ITEMS_CACHE_TTL = 5000; // 5 seconds cache for menu items

let roomsCache = null;
let roomsCacheTime = 0;
const ROOMS_CACHE_TTL = 1000; // 1 second cache for rooms (aligns with 1s polling for near-instant updates)

// Guest online status cache to provide fast isolate-level overrides
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
      if (!path.startsWith("/api")) {
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
        const now = Date.now();
        // Read from cache only if it's within 1 second (guarantees cross-isolate phase change sync inside 1 second)
        if (!roomsCache || (now - roomsCacheTime > ROOMS_CACHE_TTL)) {
          const { results } = await env.DB.prepare("SELECT * FROM rooms ORDER BY created_date DESC").all();
          roomsCache = results.map(row => ({
            id: row.id,
            name: row.name,
            phase: row.phase,
            created_date: row.created_date,
          }));
          roomsCacheTime = now;
        }
        return jsonResponse(roomsCache);
      }

      // GET /api/rooms/:id
      const roomDetailMatch = path.match(/^\/api\/rooms\/([a-zA-Z0-9-]+)$/);
      if (roomDetailMatch && request.method === "GET") {
        const roomId = roomDetailMatch[1];

        // Return from roomsCache if present and fresh
        const now = Date.now();
        if (roomsCache && (now - roomsCacheTime <= ROOMS_CACHE_TTL)) {
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

        // Invalidate rooms cache immediately so this isolate responds with fresh data on the next microsecond
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

        await env.DB.prepare("DELETE FROM guest_users WHERE room_id = ?").bind(roomId).run();
        await env.DB.prepare("DELETE FROM rooms WHERE id = ?").bind(roomId).run();

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
          // Retrieve online status from our local isolate memory state first
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
          // --- LOW COST D1 WRITE THROTTLING FOR HIGH FREQUENCY POLLING ---
          const current = await env.DB.prepare("SELECT * FROM guest_users WHERE id = ?").bind(guestId).first();
          if (!current) {
            return jsonResponse({ error: "Guest not found" }, 404);
          }

          const isOnline = body.isOnline !== undefined ? Boolean(body.isOnline) : true;
          const lastSeen = body.lastSeen !== undefined ? body.lastSeen : new Date().toISOString();

          // Save to this isolate's local memory immediately
          onlineGuests.set(guestId, { isOnline, lastSeen });

          // Determine if we need to write to D1.
          // To synchronize across global isolates and data centers perfectly while saving massive D1 Write queries:
          // We write to D1 ONLY if:
          // 1. The guest is changing offline -> online status in D1, OR
          // 2. The guest's D1 last_seen timestamp is older than 15 seconds (15x D1 Write reduction for 1s polling!).
          const dbIsOnline = current.is_online === 1;
          const dbLastSeen = current.last_seen;

          let shouldWriteToDb = false;

          if (isOnline && !dbIsOnline) {
            shouldWriteToDb = true; // State change offline -> online: Write immediately!
          } else if (isOnline && dbIsOnline) {
            if (!dbLastSeen) {
              shouldWriteToDb = true;
            } else {
              const diff = Date.now() - new Date(dbLastSeen).getTime();
              if (diff > 15000) {
                shouldWriteToDb = true; // Throttle: write at most once every 15 seconds!
              }
            }
          } else if (!isOnline && dbIsOnline) {
            shouldWriteToDb = true; // State change online -> offline: Write immediately!
          }

          if (shouldWriteToDb) {
            await env.DB.prepare("UPDATE guest_users SET is_online = ?, last_seen = ? WHERE id = ?")
              .bind(isOnline ? 1 : 0, lastSeen, guestId)
              .run();
          }

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

        // Set offline in local memory
        onlineGuests.set(guestId, {
          isOnline: false,
          lastSeen: new Date().toISOString(),
        });

        // Write immediately to D1 to update other isolates
        await env.DB.prepare("UPDATE guest_users SET is_online = 0, last_seen = ? WHERE id = ?")
          .bind(new Date().toISOString(), guestId)
          .run();

        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // DELETE /api/guests/:id (ADMIN)
      if (guestDetailMatch && request.method === "DELETE") {
        requireAdmin();
        const guestId = guestDetailMatch[1];
        await env.DB.prepare("DELETE FROM guest_users WHERE id = ?").bind(guestId).run();
        onlineGuests.delete(guestId);
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // --- MENU ITEMS API ---

      // GET /api/menu-items
      if (path === "/api/menu-items" && request.method === "GET") {
        const limit = Number(url.searchParams.get("limit")) || 100;
        const now = Date.now();

        // Read from cache only if it's within 5 seconds (menu items change very rarely)
        if (!menuItemsCache || (now - menuItemsCacheTime > MENU_ITEMS_CACHE_TTL)) {
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
          menuItemsCacheTime = now;
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

        // Invalidate menu items cache
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

        // Invalidate menu cache
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

        // Invalidate menu cache
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
