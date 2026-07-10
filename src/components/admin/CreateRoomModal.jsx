import { useState } from "react";
import { X, Plus } from "lucide-react";
import { api } from "@/api/client";

export default function CreateRoomModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const room = await api.rooms.create({
        name: name.trim(),
        phase: "WAITING",
      });
      onCreated(room);
      onClose();
    } catch (err) {
      console.error("Failed to create room:", err);
      alert("Roomの作成に失敗しました。バックエンド接続を確認してください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold">新しいRoom作成</h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-gray-400 text-xs mb-2 uppercase tracking-widest">Room名</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: テーブルA / Room 1"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-pink-500 transition-colors"
              autoFocus
              required
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 text-sm transition-all">
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {loading ? "作成中…" : "作成する"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}