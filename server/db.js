import { requireSupabase } from "./supabase.js";

function rowToRoom(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    phase: row.phase,
    created_date: row.created_date,
  };
}

function rowToGuest(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    roomId: row.room_id,

    sessionToken: row.session_token,
    isActive: row.is_active,
    isOnline: row.is_online,
    lastSeen: row.last_seen,
    created_date: row.created_date,
  };
}

function rowToMenuItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    category: row.category,
    description: row.description,
    imageUrl: row.image_url,
    order: row.order_index,
    created_date: row.created_date,
  };
}

function throwIfError(error) {
  if (error) throw error;
}

export async function listRooms() {
  const { data, error } = await requireSupabase()
    .from("rooms")
    .select("*")
    .order("created_date", { ascending: false });
  throwIfError(error);
  return (data ?? []).map(rowToRoom);
}

export async function getRoom(id) {
  const { data, error } = await requireSupabase()
    .from("rooms")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  throwIfError(error);
  return rowToRoom(data);
}

export async function createRoom({ name, phase = "WAITING" }) {
  const { data, error } = await requireSupabase()
    .from("rooms")
    .insert({ name, phase })
    .select()
    .single();
  throwIfError(error);
  return rowToRoom(data);
}

export async function updateRoom(id, fields) {
  const patch = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.phase !== undefined) patch.phase = fields.phase;
  if (Object.keys(patch).length === 0) return getRoom(id);

  const { data, error } = await requireSupabase()
    .from("rooms")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  throwIfError(error);
  return rowToRoom(data);
}

export async function listGuests({ roomId, sessionToken } = {}) {
  let query = requireSupabase().from("guest_users").select("*");
  if (sessionToken) query = query.eq("session_token", sessionToken);
  else if (roomId) query = query.eq("room_id", roomId);
  query = query.order("created_date", { ascending: false });

  const { data, error } = await query;
  throwIfError(error);
  return (data ?? []).map(rowToGuest);
}

export async function createGuest(data) {
  const { data: row, error } = await requireSupabase()
    .from("guest_users")
    .insert({
      name: data.name,
      room_id: data.roomId,

      session_token: data.sessionToken,
      is_active: data.isActive !== false,
      is_online: Boolean(data.isOnline),
    })
    .select()
    .single();
  throwIfError(error);
  return rowToGuest(row);
}

export async function updateGuest(id, fields) {
  const patch = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.roomId !== undefined) patch.room_id = fields.roomId;
  
  if (fields.sessionToken !== undefined) patch.session_token = fields.sessionToken;
  if (fields.isActive !== undefined) patch.is_active = fields.isActive;
  if (fields.isOnline !== undefined) patch.is_online = fields.isOnline;
  if (fields.lastSeen !== undefined) patch.last_seen = fields.lastSeen;
  if (Object.keys(patch).length === 0) {
    const { data } = await requireSupabase().from("guest_users").select("*").eq("id", id).maybeSingle();
    return rowToGuest(data);
  }

  const { data, error } = await requireSupabase()
    .from("guest_users")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  throwIfError(error);
  return rowToGuest(data);
}

export async function deleteGuest(id) {
  const { error } = await requireSupabase().from("guest_users").delete().eq("id", id);
  throwIfError(error);
}

export async function deleteRoom(id) {
  const { error } = await requireSupabase().from("rooms").delete().eq("id", id);
  throwIfError(error);
}

export async function listMenuItems(limit = 100) {
  const { data, error } = await requireSupabase()
    .from("menu_items")
    .select("*")
    .order("order_index", { ascending: true })
    .order("created_date", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(rowToMenuItem);
}

export async function createMenuItem(data) {
  const { data: row, error } = await requireSupabase()
    .from("menu_items")
    .insert({
      name: data.name,
      price: data.price ?? 0,
      category: data.category ?? "food",
      description: data.description ?? null,
      image_url: data.imageUrl ?? null,
      order_index: data.order ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToMenuItem(row);
}

export async function updateMenuItem(id, fields) {
  const patch = {};
  if (fields.name !== undefined) patch.name = fields.name;
  if (fields.price !== undefined) patch.price = fields.price;
  if (fields.category !== undefined) patch.category = fields.category;
  if (fields.description !== undefined) patch.description = fields.description;
  if (fields.imageUrl !== undefined) patch.image_url = fields.imageUrl;
  if (fields.order !== undefined) patch.order_index = fields.order;
  if (Object.keys(patch).length === 0) {
    const { data } = await requireSupabase().from("menu_items").select("*").eq("id", id).maybeSingle();
    return rowToMenuItem(data);
  }
  const { data, error } = await requireSupabase()
    .from("menu_items")
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return rowToMenuItem(data);
}

export async function deleteMenuItem(id) {
  const { error } = await requireSupabase().from("menu_items").delete().eq("id", id);
  if (error) throw error;
}

export async function checkConnection() {
  const { error } = await requireSupabase().from("rooms").select("id").limit(1);
  if (error) throw error;
  return true;
}
