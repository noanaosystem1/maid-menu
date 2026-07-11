import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Plus, RefreshCw } from "lucide-react";
import { api } from "@/api/client";
import { PHASES, PHASE_LABELS, PHASE_COLORS } from "@/lib/constants";
import PhaseControls from "@/components/admin/PhaseControls";
import MemberList from "@/components/admin/MemberList";
import AddMemberModal from "@/components/admin/AddMemberModal";
import UrlExportPanel from "@/components/admin/UrlExportPanel";

export default function AdminRoomDetail({ roomId, onBack }) {
  const [room, setRoom] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [room, users] = await Promise.all([
        api.rooms.get(roomId),
        api.guests.list({ roomId }),
      ]);
      if (room) setRoom(room);
      setMembers(users);
    } catch (err) {
      console.error("Failed to load room detail:", err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleAdvance = async () => {
    if (!room) return;
    const currentIndex = PHASES.indexOf(room.phase);
    if (currentIndex >= PHASES.length - 1) return;
    const nextPhase = PHASES[currentIndex + 1];
    setAdvancing(true);
    const updated = await api.rooms.update(room.id, { phase: nextPhase });
    setRoom(updated);
    setAdvancing(false);
  };

  const handleReset = async () => {
    if (!confirm("このRoomをWAITINGにリセットしますか？")) return;
    setAdvancing(true);
    const updated = await api.rooms.update(room.id, { phase: "WAITING" });
    setRoom(updated);
    setAdvancing(false);
  };

  const handleDeleteMember = async (memberId) => {
    try {
      await api.guests.delete(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    } catch (err) {
      console.error("Failed to delete member:", err);
      alert("メンバー削除に失敗しました。");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-gray-800 border-t-pink-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">Roomが見つかりません</p>
        <button onClick={onBack} className="text-pink-400 hover:text-pink-300 text-sm">← 戻る</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-md border-b border-gray-900 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-lg truncate">{room.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white ${PHASE_COLORS[room.phase]}`}>
                {PHASE_LABELS[room.phase]}
              </span>
              <span className="text-gray-600 text-xs">{members.length}名</span>
            </div>
          </div>
          <button onClick={loadData} className="p-2 text-gray-500 hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-900">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Phase controls */}
        <PhaseControls
          room={room}
          onAdvance={handleAdvance}
          onReset={handleReset}
          loading={advancing}
        />

        {/* Members */}
        <div className="flex items-center justify-between">
          <div />
          <button
            onClick={() => setShowAddMember(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-sm font-semibold transition-all"
          >
            <Plus className="w-4 h-4" />
            メンバー追加
          </button>
        </div>

        <MemberList members={members} onRefresh={loadData} onDeleteMember={handleDeleteMember} />

        {/* URL export */}
        {members.length > 0 && (
          <UrlExportPanel members={members} />
        )}
      </div>

      {/* Add member modal */}
      {showAddMember && (
        <AddMemberModal
          room={room}
          onClose={() => setShowAddMember(false)}
          onAdded={loadData}
        />
      )}
    </div>
  );
}