import { useState } from "react";
import { X, Plus, Copy, Check } from "lucide-react";
import { api } from "@/api/client";
import { generateUUID, buildGuestUrl } from "@/lib/utils/token.js";

export default function AddMemberModal({ room, onClose, onAdded }) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    const token = generateUUID();
    const user = await api.guests.create({
      name: name.trim(),
      roomId: room.id,
      sessionToken: token,
      isActive: true,
      isOnline: false,
    });
    setCreatedUser(user);
    setLoading(false);
    onAdded();
  };

  const handleCopy = () => {
    if (!createdUser) return;
    navigator.clipboard.writeText(buildGuestUrl(createdUser.sessionToken));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-white font-semibold">メンバー追加</h2>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdUser ? (
          <div className="p-5 space-y-4">
            <div className="bg-green-900/30 border border-green-800 rounded-xl p-4 text-center">
              <p className="text-green-400 text-sm font-semibold mb-1">✓ 登録完了</p>
              <p className="text-gray-300 text-sm">{createdUser.name}様のURLを発行しました</p>
            </div>
            <div>
              <label className="block text-gray-500 text-xs mb-2">招待URL（コピーして配布）</label>
              <div className="flex gap-2">
                <div className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 font-mono text-xs text-gray-300 overflow-hidden text-ellipsis whitespace-nowrap">
                  {buildGuestUrl(createdUser.sessionToken)}
                </div>
                <button
                  onClick={handleCopy}
                  className={`flex-shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    copied ? "bg-green-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "コピー済" : "コピー"}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setCreatedUser(null); setName(""); }}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 text-sm transition-all"
              >
                次のメンバーを追加
              </button>
              <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-pink-600 text-white text-sm font-semibold hover:bg-pink-500 transition-all">
                完了
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <div>
              <label className="block text-gray-400 text-xs mb-2 uppercase tracking-widest">名前</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: さくら"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-pink-500 transition-colors"
                autoFocus
                required
              />
              </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 hover:bg-gray-700 text-sm transition-all">
                キャンセル
              </button>
              <button type="submit" disabled={loading || !name.trim()} className="flex-1 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                {loading ? "登録中…" : "登録してURL発行"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}