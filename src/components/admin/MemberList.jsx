import { useState } from "react";
import { Trash2, Copy, Check } from "lucide-react";
import { api } from "@/api/client";

function MemberRow({ user, onDelete }) {
  const [copied, setCopied] = useState(false);
  const [kicking, setKicking] = useState(false);

  const isOnline = user.isOnline &&
    user.lastSeen &&
    (Date.now() - new Date(user.lastSeen).getTime()) < 10000;

  const handleCopy = () => {
    navigator.clipboard.writeText(user.sessionToken || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDelete = async () => {
    if (!confirm(user.name + 'さんを完全に削除しますか？この操作は取り消せません。')) return;
    setKicking(true);
    await api.guests.delete(user.id);
    onDelete(user.id);
    setKicking(false);
  };

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-800 last:border-0">
      <div className="flex-shrink-0">
        {user.isActive === false ? (
          <div className="w-2 h-2 rounded-full bg-gray-700" title="削除済み" />
        ) : isOnline ? (
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" title="オンライン" />
        ) : (
          <div className="w-2 h-2 rounded-full bg-red-500" title="オフライン" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={"font-medium text-sm truncate " + (user.isActive === false ? "text-gray-600 line-through" : "text-white")}>
          {user.name}
        </p>
        {user.lastSeen && (
          <p className="text-gray-600 text-xs">
            {isOnline ? "オンライン" : "最終: " + new Date(user.lastSeen).toLocaleTimeString("ja-JP")}
          </p>
        )}
      </div>

      <button onClick={handleCopy} className="p-1 text-gray-600 hover:text-gray-300 transition-colors" title="URLコピー">
        {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      </button>

      {user.isActive !== false && (
        <button
          onClick={handleDelete}
          disabled={kicking}
          className="p-1.5 text-gray-600 hover:text-red-400 transition-colors rounded"
          title="削除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function MemberList({ members, onRefresh, onDeleteMember }) {
  const onlineCount = members.filter((u) => {
    return u.isActive !== false && u.isOnline && u.lastSeen &&
      (Date.now() - new Date(u.lastSeen).getTime()) < 10000;
  }).length;

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-400 text-xs uppercase tracking-widest">メンバー</h3>
        <span className="text-gray-500 text-xs">
          <span className="text-green-400 font-semibold">{onlineCount}</span>
          /{members.length}名 オンライン
        </span>
      </div>

      {members.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-4">メンバーがいません</p>
      ) : (
        <div>
          {members.map((user) => (
            <MemberRow key={user.id} user={user} onDelete={onDeleteMember || onRefresh} />
          ))}
        </div>
      )}
    </div>
  );
}