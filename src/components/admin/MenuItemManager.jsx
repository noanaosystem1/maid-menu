import { useState, useEffect } from "react";
import { Plus, Trash2, Edit3, X, Check } from "lucide-react";
import { api } from "@/api/client";

const CATEGORIES = ["food", "drink", "dessert", "special"];
const CATEGORY_LABELS = { food: "フード", drink: "ドリンク", dessert: "デザート", special: "スペシャル" };

function ItemRow({ item, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(item);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await api.menuItems.update(item.id, form);
    onUpdate({ ...item, ...form });
    setEditing(false);
    setSaving(false);
  };

  if (editing) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <input
            className="col-span-2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
            placeholder="商品名"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            type="number"
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
            placeholder="価格"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
          />
          <select
            className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
          <input
            className="col-span-2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
            placeholder="説明"
            value={form.description || ""}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <input
            className="col-span-2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500"
            placeholder="画像URL (省略可)"
            value={form.imageUrl || ""}
            onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
          />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(false)} className="flex-1 py-2 rounded-lg bg-gray-700 text-gray-400 text-xs hover:bg-gray-600 transition-all">
            <X className="w-3 h-3 inline mr-1" />キャンセル
          </button>
          <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-lg bg-pink-600 text-white text-xs font-semibold hover:bg-pink-500 transition-all">
            <Check className="w-3 h-3 inline mr-1" />{saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-800 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-medium truncate">{item.name}</p>
        <p className="text-gray-500 text-xs">{CATEGORY_LABELS[item.category]} · ¥{item.price?.toLocaleString()}</p>
      </div>
      <button onClick={() => setEditing(true)} className="p-1.5 text-gray-600 hover:text-gray-300 transition-colors">
        <Edit3 className="w-4 h-4" />
      </button>
      <button onClick={() => onDelete(item.id)} className="p-1.5 text-gray-600 hover:text-red-400 transition-colors">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function MenuItemManager() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newItem, setNewItem] = useState({ name: "", price: 0, category: "food", description: "", imageUrl: "" });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.menuItems.list().then(setItems).finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;
    setAdding(true);
    const created = await api.menuItems.create({ ...newItem, order: items.length });
    setItems((prev) => [...prev, created]);
    setNewItem({ name: "", price: 0, category: "food", description: "", imageUrl: "" });
    setShowAdd(false);
    setAdding(false);
  };

  const handleDelete = async (id) => {
    if (!confirm("このメニューを削除しますか？")) return;
    await api.menuItems.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-400 text-xs uppercase tracking-widest">メニュー管理</h3>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1 text-xs text-pink-400 hover:text-pink-300 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />追加
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-gray-800 rounded-xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input required className="col-span-2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500" placeholder="商品名 *" value={newItem.name} onChange={(e) => setNewItem((f) => ({ ...f, name: e.target.value }))} />
            <input type="number" required className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500" placeholder="価格 *" value={newItem.price || ""} onChange={(e) => setNewItem((f) => ({ ...f, price: Number(e.target.value) }))} />
            <select className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500" value={newItem.category} onChange={(e) => setNewItem((f) => ({ ...f, category: e.target.value }))}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
            </select>
            <input className="col-span-2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500" placeholder="説明（省略可）" value={newItem.description} onChange={(e) => setNewItem((f) => ({ ...f, description: e.target.value }))} />
            <input className="col-span-2 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-pink-500" placeholder="画像URL（省略可）" value={newItem.imageUrl} onChange={(e) => setNewItem((f) => ({ ...f, imageUrl: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-lg bg-gray-700 text-gray-400 text-xs">キャンセル</button>
            <button type="submit" disabled={adding} className="flex-1 py-2 rounded-lg bg-pink-600 text-white text-xs font-semibold disabled:opacity-50">{adding ? "追加中…" : "追加"}</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-gray-600 text-sm text-center py-4">読み込み中…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-4">メニューがありません</p>
      ) : (
        items.map((item) => (
          <ItemRow key={item.id} item={item} onUpdate={(u) => setItems((prev) => prev.map((i) => i.id === u.id ? u : i))} onDelete={handleDelete} />
        ))
      )}
    </div>
  );
}