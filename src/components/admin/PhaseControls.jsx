import { ArrowRight, RotateCcw } from "lucide-react";
import { PHASES, PHASE_LABELS, PHASE_COLORS } from "@/lib/constants";

export default function PhaseControls({ room, onAdvance, onReset, loading }) {
  const currentIndex = PHASES.indexOf(room.phase);
  const nextPhase = currentIndex < PHASES.length - 1 ? PHASES[currentIndex + 1] : null;
  const isLast = currentIndex === PHASES.length - 1;

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
      <h3 className="text-gray-400 text-xs uppercase tracking-widest mb-4">Phase コントロール</h3>

      {/* Phase pipeline */}
      <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
        {PHASES.map((p, i) => (
          <div key={p} className="flex items-center gap-1 flex-shrink-0">
            <div className={`flex flex-col items-center gap-1`}>
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < currentIndex
                    ? "bg-gray-700 text-gray-500"
                    : i === currentIndex
                    ? `${PHASE_COLORS[p]} text-white ring-2 ring-offset-2 ring-offset-gray-900 ring-current`
                    : "bg-gray-800 text-gray-600"
                }`}
              >
                {i + 1}
              </div>
              <span className={`text-xs whitespace-nowrap ${i === currentIndex ? "text-white font-semibold" : "text-gray-600"}`}>
                {PHASE_LABELS[p]}
              </span>
            </div>
            {i < PHASES.length - 1 && (
              <div className={`w-6 h-px mb-5 ${i < currentIndex ? "bg-gray-700" : "bg-gray-800"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Advance button */}
      <div className="space-y-3">
        {nextPhase ? (
          <button
            onClick={onAdvance}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold text-white transition-all disabled:opacity-50 ${
              nextPhase === "HACKING"
                ? "bg-red-600 hover:bg-red-500"
                : nextPhase === "BLACKOUT"
                ? "bg-gray-700 hover:bg-gray-600"
                : nextPhase === "MENU_OPEN"
                ? "bg-pink-600 hover:bg-pink-500"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            <ArrowRight className="w-5 h-5" />
            <span>次へ進む → {PHASE_LABELS[nextPhase]}</span>
          </button>
        ) : (
          <div className="w-full py-4 rounded-xl bg-gray-800 text-gray-500 text-center text-sm">
            最終フェーズに達しています
          </div>
        )}

        {/* Reset button */}
        <button
          onClick={onReset}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 transition-all disabled:opacity-50 text-sm"
        >
          <RotateCcw className="w-4 h-4" />
          <span>強制リセット（WAITINGへ戻す）</span>
        </button>
      </div>
    </div>
  );
}