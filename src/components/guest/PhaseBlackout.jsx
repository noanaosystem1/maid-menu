// @ts-nocheck
import { useEffect } from "react";
import { STORAGE_KEYS } from "@/lib/constants";

export default function PhaseBlackout({ token }) {
  useEffect(() => {
    if (token) {
      localStorage.setItem(STORAGE_KEYS.BLACKOUT_LOCK(token), "true");
    }

    // Block all navigation attempts
    const blockNav = (e) => {
      e.preventDefault();
      e.returnValue = "";
      // Force black screen
      document.body.style.background = "#000";
      document.body.style.overflow = "hidden";
      return "";
    };

    const blockPopState = () => {
      // Push a new state to prevent going back
      window.history.pushState(null, "", window.location.href);
      document.body.style.background = "#000";
    };

    window.addEventListener("beforeunload", blockNav);
    window.addEventListener("popstate", blockPopState);

    // Push state to trap the user
    window.history.pushState(null, "", window.location.href);
    window.history.pushState(null, "", window.location.href);

    // Force body black
    document.body.style.background = "#000";
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("beforeunload", blockNav);
      window.removeEventListener("popstate", blockPopState);
      document.body.style.background = "";
      document.body.style.overflow = "";
    };
  }, [token]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#000000",
        zIndex: 99999,
        userSelect: "none",
        WebkitUserSelect: "none",
        pointerEvents: "all",
      }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}