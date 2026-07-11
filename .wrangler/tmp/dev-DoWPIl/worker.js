var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-bA1XIP/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// server/worker.js
var menuItemsCache = null;
var roomsCache = null;
var onlineGuests = /* @__PURE__ */ new Map();
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password, Authorization",
  "Access-Control-Max-Age": "86400"
};
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
__name(jsonResponse, "jsonResponse");
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}
__name(handleOptions, "handleOptions");
var worker_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }
    const url = new URL(request.url);
    const path = url.pathname;
    const isAdmin = /* @__PURE__ */ __name(() => {
      const passwordHeader = request.headers.get("X-Admin-Password") || request.headers.get("Authorization");
      const expectedPassword = env.ADMIN_PASSWORD || "maid2024";
      return passwordHeader === expectedPassword;
    }, "isAdmin");
    const requireAdmin = /* @__PURE__ */ __name(() => {
      if (!isAdmin()) {
        throw new Error("UNAUTHORIZED");
      }
    }, "requireAdmin");
    try {
      if (!path.startsWith("/api")) {
        if (env.ASSETS) {
          return await env.ASSETS.fetch(request);
        }
        return new Response("Not Found", { status: 404 });
      }
      if (path === "/api/health" && request.method === "GET") {
        try {
          await env.DB.prepare("SELECT 1").first();
          return jsonResponse({ ok: true, database: "d1" });
        } catch (err) {
          return jsonResponse({ ok: false, error: "D1 connection failed: " + err.message }, 503);
        }
      }
      if (path === "/api/rooms" && request.method === "GET") {
        if (!roomsCache) {
          const { results } = await env.DB.prepare("SELECT * FROM rooms ORDER BY created_date DESC").all();
          roomsCache = results.map((row) => ({
            id: row.id,
            name: row.name,
            phase: row.phase,
            created_date: row.created_date
          }));
        }
        return jsonResponse(roomsCache);
      }
      const roomDetailMatch = path.match(/^\/api\/rooms\/([a-zA-Z0-9-]+)$/);
      if (roomDetailMatch && request.method === "GET") {
        const roomId = roomDetailMatch[1];
        if (roomsCache) {
          const cachedRoom = roomsCache.find((r) => r.id === roomId);
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
          created_date: room.created_date
        });
      }
      if (path === "/api/rooms" && request.method === "POST") {
        requireAdmin();
        const body = await request.json();
        const { name, phase } = body ?? {};
        if (!name?.trim()) {
          return jsonResponse({ error: "name is required" }, 400);
        }
        const id = crypto.randomUUID();
        const roomPhase = phase || "WAITING";
        const createdDate = (/* @__PURE__ */ new Date()).toISOString();
        await env.DB.prepare("INSERT INTO rooms (id, name, phase, created_date) VALUES (?, ?, ?, ?)").bind(id, name.trim(), roomPhase, createdDate).run();
        roomsCache = null;
        return jsonResponse({ id, name: name.trim(), phase: roomPhase, created_date: createdDate }, 201);
      }
      if (roomDetailMatch && request.method === "PATCH") {
        requireAdmin();
        const roomId = roomDetailMatch[1];
        const body = await request.json();
        const { name, phase } = body ?? {};
        const current = await env.DB.prepare("SELECT * FROM rooms WHERE id = ?").bind(roomId).first();
        if (!current) {
          return jsonResponse({ error: "Room not found" }, 404);
        }
        const newName = name !== void 0 ? name.trim() : current.name;
        const newPhase = phase !== void 0 ? phase : current.phase;
        await env.DB.prepare("UPDATE rooms SET name = ?, phase = ? WHERE id = ?").bind(newName, newPhase, roomId).run();
        roomsCache = null;
        return jsonResponse({
          id: roomId,
          name: newName,
          phase: newPhase,
          created_date: current.created_date
        });
      }
      if (roomDetailMatch && request.method === "DELETE") {
        requireAdmin();
        const roomId = roomDetailMatch[1];
        await env.DB.prepare("DELETE FROM guest_users WHERE room_id = ?").bind(roomId).run();
        const result = await env.DB.prepare("DELETE FROM rooms WHERE id = ?").bind(roomId).run();
        roomsCache = null;
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      if (path === "/api/guests" && request.method === "GET") {
        const sessionToken = url.searchParams.get("sessionToken");
        const roomId = url.searchParams.get("roomId");
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
        const enriched = results.map((row) => {
          const cached = onlineGuests.get(row.id);
          const now = Date.now();
          let isOnline = row.is_online === 1;
          let lastSeen = row.last_seen;
          if (cached) {
            isOnline = cached.isOnline;
            lastSeen = cached.lastSeen;
          }
          if (isOnline && lastSeen) {
            const diff = now - new Date(lastSeen).getTime();
            if (diff > 15e3) {
              isOnline = false;
            }
          }
          return {
            id: row.id,
            name: row.name,
            roomId: row.room_id,
            sessionToken: row.session_token,
            isActive: row.is_active === 1,
            isOnline,
            lastSeen,
            created_date: row.created_date
          };
        });
        return jsonResponse(enriched);
      }
      if (path === "/api/guests" && request.method === "POST") {
        requireAdmin();
        const body = await request.json();
        const { name, roomId, sessionToken, isActive, isOnline } = body ?? {};
        if (!name?.trim() || !roomId || !sessionToken) {
          return jsonResponse({ error: "name, roomId, sessionToken are required" }, 400);
        }
        const id = crypto.randomUUID();
        const createdDate = (/* @__PURE__ */ new Date()).toISOString();
        const activeVal = isActive !== false ? 1 : 0;
        const onlineVal = isOnline ? 1 : 0;
        await env.DB.prepare("INSERT INTO guest_users (id, name, room_id, session_token, is_active, is_online, created_date) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, name.trim(), roomId, sessionToken, activeVal, onlineVal, createdDate).run();
        onlineGuests.set(id, {
          isOnline: Boolean(isOnline),
          lastSeen: isOnline ? createdDate : null
        });
        return jsonResponse({
          id,
          name: name.trim(),
          roomId,
          sessionToken,
          isActive: activeVal === 1,
          isOnline: Boolean(isOnline),
          lastSeen: isOnline ? createdDate : null,
          created_date: createdDate
        }, 201);
      }
      const guestDetailMatch = path.match(/^\/api\/guests\/([a-zA-Z0-9-]+)$/);
      if (guestDetailMatch && request.method === "PATCH") {
        const guestId = guestDetailMatch[1];
        const body = await request.json();
        const hasDbFields = body.name !== void 0 || body.roomId !== void 0 || body.sessionToken !== void 0 || body.isActive !== void 0;
        if (hasDbFields) {
          requireAdmin();
          const current = await env.DB.prepare("SELECT * FROM guest_users WHERE id = ?").bind(guestId).first();
          if (!current) {
            return jsonResponse({ error: "Guest not found" }, 404);
          }
          const newName = body.name !== void 0 ? body.name.trim() : current.name;
          const newRoomId = body.roomId !== void 0 ? body.roomId : current.room_id;
          const newSessionToken = body.sessionToken !== void 0 ? body.sessionToken : current.session_token;
          const newIsActive = body.isActive !== void 0 ? body.isActive ? 1 : 0 : current.is_active;
          await env.DB.prepare("UPDATE guest_users SET name = ?, room_id = ?, session_token = ?, is_active = ? WHERE id = ?").bind(newName, newRoomId, newSessionToken, newIsActive, guestId).run();
          const cached = onlineGuests.get(guestId);
          return jsonResponse({
            id: guestId,
            name: newName,
            roomId: newRoomId,
            sessionToken: newSessionToken,
            isActive: newIsActive === 1,
            isOnline: cached ? cached.isOnline : current.is_online === 1,
            lastSeen: cached ? cached.lastSeen : current.last_seen,
            created_date: current.created_date
          });
        } else {
          const current = await env.DB.prepare("SELECT * FROM guest_users WHERE id = ?").bind(guestId).first();
          if (!current) {
            return jsonResponse({ error: "Guest not found" }, 404);
          }
          const isOnline = body.isOnline !== void 0 ? Boolean(body.isOnline) : true;
          const lastSeen = body.lastSeen !== void 0 ? body.lastSeen : (/* @__PURE__ */ new Date()).toISOString();
          onlineGuests.set(guestId, { isOnline, lastSeen });
          return jsonResponse({
            id: guestId,
            name: current.name,
            roomId: current.room_id,
            sessionToken: current.session_token,
            isActive: current.is_active === 1,
            isOnline,
            lastSeen,
            created_date: current.created_date
          });
        }
      }
      const guestOfflineMatch = path.match(/^\/api\/guests\/([a-zA-Z0-9-]+)\/offline$/);
      if (guestOfflineMatch && request.method === "POST") {
        const guestId = guestOfflineMatch[1];
        onlineGuests.set(guestId, {
          isOnline: false,
          lastSeen: (/* @__PURE__ */ new Date()).toISOString()
        });
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      if (guestDetailMatch && request.method === "DELETE") {
        requireAdmin();
        const guestId = guestDetailMatch[1];
        await env.DB.prepare("DELETE FROM guest_users WHERE id = ?").bind(guestId).run();
        onlineGuests.delete(guestId);
        return new Response(null, { status: 204, headers: corsHeaders });
      }
      if (path === "/api/menu-items" && request.method === "GET") {
        const limit = Number(url.searchParams.get("limit")) || 100;
        if (!menuItemsCache) {
          const { results } = await env.DB.prepare("SELECT * FROM menu_items ORDER BY order_index ASC, created_date ASC").all();
          menuItemsCache = results.map((row) => ({
            id: row.id,
            name: row.name,
            price: Number(row.price),
            category: row.category,
            description: row.description,
            imageUrl: row.image_url,
            order: row.order_index,
            created_date: row.created_date
          }));
        }
        const sliced = menuItemsCache.slice(0, limit);
        return jsonResponse(sliced);
      }
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
        const createdDate = (/* @__PURE__ */ new Date()).toISOString();
        await env.DB.prepare("INSERT INTO menu_items (id, name, price, category, description, image_url, order_index, created_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(id, name.trim(), itemPrice, itemCategory, itemDesc, itemImg, itemOrder, createdDate).run();
        menuItemsCache = null;
        return jsonResponse({
          id,
          name: name.trim(),
          price: Number(itemPrice),
          category: itemCategory,
          description: itemDesc,
          imageUrl: itemImg,
          order: itemOrder,
          created_date: createdDate
        }, 201);
      }
      const menuDetailMatch = path.match(/^\/api\/menu-items\/([a-zA-Z0-9-]+)$/);
      if (menuDetailMatch && request.method === "PATCH") {
        requireAdmin();
        const itemId = menuDetailMatch[1];
        const body = await request.json();
        const current = await env.DB.prepare("SELECT * FROM menu_items WHERE id = ?").bind(itemId).first();
        if (!current) {
          return jsonResponse({ error: "Menu item not found" }, 404);
        }
        const newName = body.name !== void 0 ? body.name.trim() : current.name;
        const newPrice = body.price !== void 0 ? body.price : current.price;
        const newCategory = body.category !== void 0 ? body.category : current.category;
        const newDesc = body.description !== void 0 ? body.description : current.description;
        const newImg = body.imageUrl !== void 0 ? body.imageUrl : current.image_url;
        const newOrder = body.order !== void 0 ? body.order : current.order_index;
        await env.DB.prepare("UPDATE menu_items SET name = ?, price = ?, category = ?, description = ?, image_url = ?, order_index = ? WHERE id = ?").bind(newName, newPrice, newCategory, newDesc, newImg, newOrder, itemId).run();
        menuItemsCache = null;
        return jsonResponse({
          id: itemId,
          name: newName,
          price: Number(newPrice),
          category: newCategory,
          description: newDesc,
          imageUrl: newImg,
          order: newOrder,
          created_date: current.created_date
        });
      }
      if (menuDetailMatch && request.method === "DELETE") {
        requireAdmin();
        const itemId = menuDetailMatch[1];
        await env.DB.prepare("DELETE FROM menu_items WHERE id = ?").bind(itemId).run();
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

// ../home/jules/.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../home/jules/.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-bA1XIP/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../home/jules/.npm/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-bA1XIP/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
