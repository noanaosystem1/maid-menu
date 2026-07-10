/**
 * API Server Test Script
 * 使い方: node test-api.mjs [baseUrl]
 * 例: node test-api.mjs http://localhost:3000/api
 */

const BASE = process.argv[2] || "http://localhost:3000/api";

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.log(`  ❌ ${msg}`);
    failed++;
  }
}

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text };
  } catch (err) {
    return { status: 0, error: err.message };
  }
}

async function run() {
  console.log(`\n🧪 API Test: ${BASE}\n`);
  console.log("1. Health Check");
  {
    const r = await request("GET", "/health");
    assert(r.status === 200, `GET /health → 200 (db=${r.json?.database})`);
  }

  console.log("\n2. Rooms - List (empty OK)");
  {
    const r = await request("GET", "/rooms");
    assert(r.status === 200 && Array.isArray(r.json), "GET /rooms → array");
  }

  console.log("\n3. Rooms - Create");
  let roomId = null;
  {
    const r = await request("POST", "/rooms", { name: "Test Room A" });
    assert(r.status === 201, `POST /rooms → 201`);
    assert(r.json && r.json.id, "response has id");
    assert(r.json && r.json.name === "Test Room A", "name is correct");
    assert(r.json && r.json.phase === "WAITING", "phase is WAITING");
    roomId = r.json?.id;
  }

  console.log("\n4. Rooms - Get");
  {
    const r = await request("GET", `/rooms/${roomId}`);
    assert(r.status === 200, `GET /rooms/:id → 200`);
    assert(r.json && r.json.id === roomId, "id matches");
  }

  console.log("\n5. Rooms - Update");
  {
    const r = await request("PATCH", `/rooms/${roomId}`, { phase: "HACKING" });
    assert(r.status === 200, `PATCH /rooms/:id → 200`);
    assert(r.json && r.json.phase === "HACKING", "phase updated to HACKING");
  }

  console.log("\n6. Guests - Create (with sessionToken)");
  let guestId = null;
  const sessionToken = "test-token-" + Date.now();
  {
    const r = await request("POST", "/guests", {
      name: "Test User",
      roomId: roomId,
      sessionToken,
      isActive: true,
      isOnline: false,
    });
    assert(r.status === 201, `POST /guests → 201`);
    assert(r.json && r.json.name === "Test User", "name is correct");
    assert(r.json && r.json.roomId === roomId, "roomId matches");
    assert(r.json && r.json.sessionToken === sessionToken, "sessionToken matches");
    guestId = r.json?.id;
  }

  console.log("\n7. Guests - List by roomId");
  {
    const r = await request("GET", `/guests?roomId=${roomId}`);
    assert(r.status === 200 && Array.isArray(r.json), "GET /guests?roomId → array");
    assert(r.json && r.json.length >= 1, "at least 1 guest found");
    assert(r.json && r.json[0].name === "Test User", "guest name matches");
  }

  console.log("\n8. Guests - List by sessionToken");
  {
    const r = await request("GET", `/guests?sessionToken=${sessionToken}`);
    assert(r.status === 200 && Array.isArray(r.json), "GET /guests?sessionToken → array");
    assert(r.json && r.json.length === 1, "exactly 1 guest");
  }

  console.log("\n9. Guests - Update");
  {
    const r = await request("PATCH", `/guests/${guestId}`, { isOnline: true });
    assert(r.status === 200, `PATCH /guests/:id → 200`);
    assert(r.json && r.json.isOnline === true, "isOnline updated");
  }

  console.log("\n10. Rooms - Delete (cascade deletes guest)");
  {
    const r = await request("DELETE", `/rooms/${roomId}`);
    assert(r.status === 204, `DELETE /rooms/:id → 204`);
  }

  console.log("\n11. Verify guest deleted by cascade");
  {
    const r = await request("GET", `/guests?sessionToken=${sessionToken}`);
    assert(r.status === 200, "GET /guests still 200");
    assert(r.json && r.json.length === 0, "guest list is empty after room delete");
  }

  console.log("\n12. Guests - Delete (standalone)");
  let roomId2 = null;
  let guestId2 = null;
  {
    const room = await request("POST", "/rooms", { name: "Temp Room" });
    roomId2 = room.json?.id;
    const guest = await request("POST", "/guests", {
      name: "Temp User",
      roomId: roomId2,
      sessionToken: "temp-token-" + Date.now(),
    });
    guestId2 = guest.json?.id;
    const del = await request("DELETE", `/guests/${guestId2}`);
    assert(del.status === 204, `DELETE /guests/:id → 204`);
    const list = await request("GET", `/guests?roomId=${roomId2}`);
    assert(list.json && list.json.length === 0, "guest removed from room");
  }

  console.log("\n13. Menu Items - CRUD");
  let menuId = null;
  {
    const r = await request("POST", "/menu-items", {
      name: "Test Curry",
      price: 1200,
      category: "food",
      order: 99,
    });
    assert(r.status === 201, `POST /menu-items → 201`);
    assert(r.json && r.json.name === "Test Curry", "menu name correct");
    menuId = r.json?.id;
  }
  {
    const r = await request("PATCH", `/menu-items/${menuId}`, { price: 1500 });
    assert(r.status === 200, `PATCH /menu-items/:id → 200`);
    assert(r.json && r.json.price === 1500, "price updated");
  }
  {
    const r = await request("DELETE", `/menu-items/${menuId}`);
    assert(r.status === 204, `DELETE /menu-items/:id → 204`);
  }

  // Cleanup temp room
  if (roomId2) {
    await request("DELETE", `/rooms/${roomId2}`);
  }

  console.log("\n" + "=".repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(50) + "\n");

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
