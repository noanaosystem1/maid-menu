import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import { STORAGE_KEYS } from "@/lib/constants";
import { api } from "@/api/client";

export default function AdminLogin({ onAuthenticated }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Temporarily store the entered password in sessionStorage so the api client uses it
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_AUTH_PASSWORD, password);

      // Attempt to retrieve the full guest list (which requires admin authorization)
      await api.guests.list();

      // If it succeeded, finalize authentication
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, "1");
      onAuthenticated();
    } catch (err) {
      console.error("Login verification failed:", err);
      // Clean up on failure
      sessionStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH_PASSWORD);
      setError("パスワードが正しくありません");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-800 rounded-2xl border border-gray-700 mb-4">
            <Lock className="w-8 h-8 text-pink-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Console</h1>
          <p className="text-gray-500 text-sm mt-1">狂気メイド喫茶 制御システム</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl border border-gray-800 p-6 space-y-4">
          <div>
            <label className="block text-gray-400 text-xs mb-2 uppercase tracking-widest">Password</label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-pink-500 transition-colors pr-12"
                placeholder="••••••••"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-red-400 text-xs text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-pink-600 hover:bg-pink-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-xl transition-all"
          >
            {loading ? "認証中…" : "ログイン"}
          </button>
        </form>
      </div>
    </div>
  );
}
