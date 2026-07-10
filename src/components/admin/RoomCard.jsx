import { Users, ChevronRight, Trash2 } from "lucide-react";
import { PHASE_LABELS, PHASE_COLORS } from "@/lib/constants";

export default function RoomCard({ room, memberCount, onlineCount, onClick, onDelete }) {
  const phase = room.phase || "WAITING";

  return (
    <div className="flex gap-3">
      <button
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className="flex-1 text-left bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-2xl p-5 transition-all group"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3">
              <span className={"inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white " + PHASE_COLORS[phase]}>
                {PHASE_LABELS[phase]}
              </span>
            </div>
            <h3 className="text-white font-semibold text-lg truncate">{room.name}</h3>
            <p className="text-gray-600 text-xs mt-1 font-mono">{room.id?.slice(0, 8)}...</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-400 transition-colors flex-shrink-0 mt-1" />
        </div>

        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-800">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-gray-400 text-xs">{memberCount}名</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className={"w-2 h-2 rounded-full " + (onlineCount > 0 ? "bg-green-400 animate-pulse" : "bg-gray-600")} />
            <span className="text-gray-400 text-xs">{onlineCount}名オンライン</span>
          </div>
        </div>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm('「' + room.name + '」を削除しますか？この操作は取り消せません。')) {
            onDelete(room.id);
          }
        }}
        className="self-center p-3 text-gray-600 hover:text-red-400 transition-colors rounded-xl hover:bg-gray-800"
        title="Room削除"
      >
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}