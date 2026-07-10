import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { buildGuestUrl } from "@/lib/utils/token.js";

export default function UrlExportPanel({ members }) {
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (user) => {
    navigator.clipboard.writeText(buildGuestUrl(user.sessionToken));
    setCopiedId(user.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCopyAll = () => {
    const text = members
      .map((u) => `${u.name}: ${buildGuestUrl(u.sessionToken)}`)
      .join("\n");
    navigator.clipboard.writeText(text);
  };

  if (members.length === 0) return null;

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-gray-400 text-xs uppercase tracking-widest">招待URL一覧</h3>
        <button
          onClick={handleCopyAll}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
        >
          <Copy className="w-3 h-3" />
          全URLコピー
        </button>
      </div>
      <div className="space-y-2">
        {members.filter((u) => u.isActive !== false).map((user) => (
          <div key={user.id} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-gray-300 text-xs font-semibold mb-0.5">{user.name}</p>
              <p className="text-gray-600 text-xs font-mono truncate">
                {buildGuestUrl(user.sessionToken)}
              </p>
            </div>
            <button
              onClick={() => handleCopy(user)}
              className={`flex-shrink-0 p-1.5 rounded-lg transition-all ${
                copiedId === user.id ? "bg-green-900/50 text-green-400" : "bg-gray-800 text-gray-500 hover:text-gray-300"
              }`}
            >
              {copiedId === user.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <a
              href={buildGuestUrl(user.sessionToken)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 p-1.5 rounded-lg bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}