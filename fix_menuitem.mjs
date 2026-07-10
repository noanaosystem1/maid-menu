import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const R = (f) => fs.readFileSync(path.join(dir, f), "utf8");
const W = (f, c) => fs.writeFileSync(path.join(dir, f), c, "utf8");

const s = R("server/db.js");
if (!s.includes("menu_items")) {
  const addon = `
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
`;
  W("server/db.js", s + addon);
  console.log("Added menu item functions + checkConnection");
} else {
  console.log("Menu item functions already present");
}
