import { useEffect, useState, useCallback } from "react";
import { api } from "@/api/client";
import { POLLING_INTERVAL, STORAGE_KEYS } from "@/lib/constants";
import PhaseWaiting from "@/components/guest/PhaseWaiting";
import PhaseMenu from "@/components/guest/PhaseMenu";
import PhaseHacking from "@/components/guest/PhaseHacking";
import PhaseBlackout from "@/components/guest/PhaseBlackout";
import GuestError from "@/components/guest/GuestError";

export default function Guest() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [guestUser, setGuestUser] = useState(null);
  const [room, setRoom] = useState(null);
  const [token, setToken] = useState(null);

  const checkBlackoutLock = useCallback((tok) => {
    if (!tok) return false;
    return localStorage.getItem(STORAGE_KEYS.BLACKOUT_LOCK(tok)) === "true";
  }, []);

  const loadRoomPhase = useCallback((roomId) => {
    api.rooms.get(roomId)
      .then((r) => {
        if (!r) { setError("Roomが見つかりません。"); setLoading(false); return; }
        setRoom(r);
        setLoading(false);
      })
      .catch(() => { setError("通信エラーが発生しました。"); setLoading(false); });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get("token");
    if (!tok) { setError("招待リンクが無効です。"); setLoading(false); return; }
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
          setError("このリンクは無効または期限切れです。");
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
        api.guests.update(user.id, {
          isOnline: true,
          lastSeen: new Date().toISOString(),
        }).catch(() => {});
        loadRoomPhase(user.roomId);
      })
      .catch(() => {
        setError("通信エラーが発生しました。");
        setLoading(false);
      });
  }, [checkBlackoutLock, loadRoomPhase]);

  useEffect(() => {
    if (!guestUser?.roomId || !room || room.phase === "BLACKOUT") return;
    const id = setInterval(() => {
      api.rooms.get(guestUser.roomId)
        .then((r) => {
          if (r) {
            setRoom((prev) => (prev?.phase !== r.phase ? r : prev));
          }
        })
        .catch(() => {});

      if (guestUser?.id) {
        api.guests.update(guestUser.id, {
          isOnline: true,
          lastSeen: new Date().toISOString(),
        }).catch(() => {});
      }
    }, POLLING_INTERVAL);
    return () => clearInterval(id);
  }, [guestUser, room?.phase]);

  useEffect(() => {
    const handleUnload = () => {
      if (guestUser?.id) {
        navigator.sendBeacon(`/api/guests/${guestUser.id}/offline`);
      }
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [guestUser]);

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

  if (error) return <GuestError message={error} />;

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

  return <PhaseWaiting guestName={guestUser?.name} />;
}
