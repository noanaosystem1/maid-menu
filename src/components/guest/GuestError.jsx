export default function GuestError({ message }) {
  return (
    <div className="min-h-screen cute-gradient flex items-center justify-center px-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl shadow-xl border border-pink-100 p-10 text-center max-w-sm w-full">
        <div className="text-5xl mb-4">💔</div>
        <h2 className="text-xl font-bold text-pink-500 mb-2" style={{ fontFamily: "var(--font-heading)" }}>
          接続エラー
        </h2>
        <p className="text-gray-400 text-sm">
          {message || "このリンクは無効です。スタッフにお声がけください。"}
        </p>
      </div>
    </div>
  );
}