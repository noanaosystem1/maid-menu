import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/api/client";
import { STORAGE_KEYS } from "@/lib/constants";
import PhaseWaiting from "@/components/guest/PhaseWaiting";
import PhaseMenu from "@/components/guest/PhaseMenu";
import PhaseHacking from "@/components/guest/PhaseHacking";
import PhaseBlackout from "@/components/guest/PhaseBlackout";

export default function Guest() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [guestUser, setGuestUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [token, setToken] = useState(null);

  const socketRef = useRef(null);

  const checkBlackoutLock = useCallback((tok) => {
    if (!tok) return false;
    return localStorage.getItem(STORAGE_KEYS.BLACKOUT_LOCK(tok)) === "true";
  }, []);

  const loadRoomPhase = useCallback((roomId) => {
    api.rooms.get(roomId)
      .then((r) => {
        if (!r) {
          setError("招待リンクが無効か、部屋が見つかりません。画面を更新してください。");
          setLoading(false);
          return;
        }
        setRoom(r);
        setLoading(false);
      })
      .catch(() => {
        setError("通信エラーが発生しました。画面を更新して再接続してください。");
        setLoading(false);
      });
  }, []);

  // Initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get("token");
    if (!tok) {
      setError("招待リンクが無効です。正しいURLをお使いください。");
      setLoading(false);
      return;
    }
    setToken(tok);

    if (checkBlackoutLock(tok)) {
      setRoom({ phase: "BLACKOUT" });
      setGuestUser({ sessionToken: tok });
      setLoading(false);
      return;
    }

    const cached = sessionStorage.getItem(STORAGE_KEYS.GUEST_DATA);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.sessionToken === tok) {
          setGuestUser(parsed);
          loadRoomPhase(parsed.roomId);
          return;
        }
      } catch {}
    }

    api.guests.list({ sessionToken: tok })
      .then((users) => {
        if (!users || users.length === 0) {
          setError("招待リンクが無効か、お部屋が見つかりません。画面を更新してください。");
          setLoading(false);
          return;
        }
        const user = users[0];
        if (!user.isActive) {
          setError("あなたのセッションは終了しました。");
          setLoading(false);
          return;
        }
        sessionStorage.setItem(STORAGE_KEYS.GUEST_DATA, JSON.stringify(user));
        setGuestUser(user);
        loadRoomPhase(user.roomId);
      })
      .catch(() => {
        setError("通信エラーが発生しました。画面を更新して再接続してください。");
        setLoading(false);
      });
  }, [checkBlackoutLock, loadRoomPhase]);

  // WebSocket connection & lifecycle management
  useEffect(() => {
    if (!guestUser?.roomId || !room) return;

    const currentPhase = room.phase || "WAITING";
    const isInteractive = currentPhase === "MENU_OPEN" || currentPhase === "HACKING";

    // PRINCIPLE: If in static phase (WAITING or BLACKOUT), do NOT establish or keep any WebSocket/polling connections.
    if (!isInteractive) {
      if (socketRef.current) {
        console.log("[WebSocket] Phase is static. Closing active connection to minimize Worker load.");
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    // Connect to WebSocket Durable Object if interactive and not already connected
    if (!socketRef.current) {
      console.log(`[WebSocket] Entering interactive phase: ${currentPhase}. Connecting to RoomSession DO.`);
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/api/ws?roomId=${guestUser.roomId}&guestId=${guestUser.id}`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "PHASE_UPDATE") {
            console.log(`[WebSocket] Real-time Phase Broadcast: ${data.phase}`);
            setRoom(prev => {
              if (prev && prev.phase !== data.phase) {
                return { ...prev, phase: data.phase };
              }
              return prev;
            });
          }
        } catch (e) {
          console.error("[WebSocket] Failed to parse broadcast message:", e);
        }
      };

      ws.onclose = () => {
        console.log("[WebSocket] Connection closed.");
        socketRef.current = null;
      };

      ws.onerror = (e) => {
        console.error("[WebSocket] Error occurred:", e);
        socketRef.current = null;
      };
    }

    return () => {
      // Cleanup on unmount
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [guestUser, room?.phase]);

  const handleCountdownEnd = useCallback(() => {
    if (token) localStorage.setItem(STORAGE_KEYS.BLACKOUT_LOCK(token), "true");
    setRoom((r) => ({ ...r, phase: "BLACKOUT" }));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen cute-gradient flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-pink-300 border-t-pink-500 rounded-full animate-spin" />
          <p className="text-pink-400 text-sm" style={{ fontFamily: "var(--font-heading)" }}>
            接続中…♡
          </p>
        </div>
      </div>
    );
  }

  // Beautiful Reload Prompt Screen if Room/Guest are not found or communication fails (Saves Worker Execution load)
  if (error) {
    return (
      <div className="min-h-screen cute-gradient flex items-center justify-center p-6 text-center">
        <div className="bg-white/90 backdrop-blur-md border-2 border-pink-200 rounded-3xl p-8 max-w-sm shadow-xl">
          <span className="text-5xl">🥺</span>
          <h2 className="text-xl font-bold text-pink-900 mt-4 leading-tight">接続エラー</h2>
          <p className="text-pink-700/80 text-xs mt-3 leading-relaxed">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full mt-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm shadow-md"
          >
            画面を更新する (リロード)
          </button>
        </div>
      </div>
    );
  }

  const phase = room?.phase || "WAITING";

  if (phase === "BLACKOUT") {
    return <PhaseBlackout token={token} />;
  }

  if (phase === "HACKING") {
    return (
      <PhaseHacking
        guestName={guestUser?.name}
        onCountdownEnd={handleCountdownEnd}
      />
    );
  }

  if (phase === "MENU_OPEN") {
    return <PhaseMenu guestName={guestUser?.name} />;
  }

  // WAITING phase UI with friendly manual reload button (Minimizes server/Worker calls completely)
  return (
    <PhaseWaiting
      guestName={guestUser?.name}
      onReload={() => window.location.reload()}
    />
  );
}
