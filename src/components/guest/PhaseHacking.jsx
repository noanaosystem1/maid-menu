// @ts-nocheck
import { useEffect, useState, useRef, useMemo } from "react";
import { HACKING_COUNTDOWN } from "@/lib/constants";

const GLITCH_CHARS = "!@#$%^&*<>?/\\|{}[]ｱｲｳｴｵｶｷｸｹｺﾃｽﾄ01死魂監視";

const FAKE_ALERTS = [
  "KERNEL PANIC — 0xDEADBEEF",
  "BIOMETRIC DATA UPLOADING…",
  "CAMERA: PERMISSION OVERRIDDEN",
  "GPS LOCK ACQUIRED",
  "MEMORY DUMP IN PROGRESS",
  "REMOTE SHELL ESTABLISHED",
  "あなたは見られています",
  "CONSCIOUSNESS SYNC: 94.7%",
];

const TERMINAL_LINES = [
  "> bypassing firewall... OK",
  "> injecting payload... OK",
  "> reading /dev/mem... DENIED → FORCED",
  "> extracting contacts.db... 847 entries",
  "> webcam stream: ACTIVE",
  "> keystroke logger: RUNNING",
  "> neural pattern match: CONFIRMED",
  "> subject emotional state: FEAR DETECTED",
  "> uploading to ████████... 67%",
  "> erasing access logs... OK",
  "> installing persistence module... OK",
];

function GlitchChar({ char }) {
  const [display, setDisplay] = useState(char);
  useEffect(() => {
    if (Math.random() > 0.65) return;
    let count = 0;
    const max = Math.floor(Math.random() * 6) + 2;
    const id = setInterval(() => {
      count++;
      if (count >= max) { setDisplay(char); clearInterval(id); }
      else setDisplay(GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]);
    }, 60);
    return () => clearInterval(id);
  }, [char]);
  return <span>{display}</span>;
}

function GlitchText({ text, className }) {
  return (
    <span className={className} data-text={text}>
      {text.split("").map((c, i) => <GlitchChar key={i} char={c} />)}
    </span>
  );
}

function MatrixRain() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    const cols = Math.floor(canvas.width / 14);
    const drops = Array(cols).fill(1);
    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = Math.random() > 0.95 ? "#FF0000" : "#00FF41";
      ctx.font = "13px Courier New";
      drops.forEach((y, i) => {
        ctx.fillText(String.fromCharCode(0x30A0 + Math.random() * 96), i * 14, y * 14);
        if (y * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
    };
    const id = setInterval(draw, 40);
    return () => { clearInterval(id); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 opacity-25 pointer-events-none z-0" />;
}

function StaticNoise() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const img = ctx.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255;
        img.data[i] = v;
        img.data[i + 1] = v;
        img.data[i + 2] = v;
        img.data[i + 3] = Math.random() > 0.92 ? 40 : 0;
      }
      ctx.putImageData(img, 0, 0);
    };
    const id = setInterval(draw, 50);
    return () => clearInterval(id);
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 opacity-30 pointer-events-none z-[5] mix-blend-overlay" />;
}

function TerminalLog() {
  const [lines, setLines] = useState([]);
  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      if (i < TERMINAL_LINES.length) {
        setLines((prev) => [...prev.slice(-8), TERMINAL_LINES[i]]);
        i++;
      }
    }, 400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fixed bottom-4 left-4 right-4 max-w-md z-[35] font-mono text-[9px] text-green-500/70 bg-black/80 border border-green-900/50 rounded p-2 max-h-24 overflow-hidden">
      {lines.map((line, i) => (
        <div key={i} className="truncate">{line}</div>
      ))}
      <span className="hack-cursor inline-block w-2 h-3 bg-green-500 ml-0.5" />
    </div>
  );
}

function FakePopup({ text, style }) {
  return (
    <div
      className="fixed z-[60] bg-gray-200 border-2 border-gray-400 shadow-2xl font-mono text-xs p-3 max-w-[200px] hack-popup"
      style={style}
    >
      <div className="flex items-center gap-2 mb-2 pb-1 border-b border-gray-400">
        <span className="text-red-600 font-bold">⚠</span>
        <span className="font-bold text-gray-800">System Alert</span>
      </div>
      <p className="text-gray-700 text-[10px] leading-tight">{text}</p>
      <button className="mt-2 px-2 py-0.5 bg-gray-300 border border-gray-500 text-[10px]">OK</button>
    </div>
  );
}

function WebcamOverlay() {
  const [blink, setBlink] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 800);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="fixed top-4 right-4 z-[45] w-24 h-20 border-2 border-red-600 bg-black/90 rounded overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-2 border-red-500/50 flex items-center justify-center">
          <span className="text-2xl opacity-60">👁</span>
        </div>
      </div>
      <div className={`absolute top-1 left-1 flex items-center gap-1 ${blink ? "opacity-100" : "opacity-30"}`}>
        <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
        <span className="text-red-500 text-[8px] font-mono">REC</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-red-900/80 text-red-300 text-[7px] text-center py-0.5 font-mono">
        LIVE FEED
      </div>
    </div>
  );
}

export default function PhaseHacking({ guestName, onCountdownEnd }) {
  const [countdown, setCountdown] = useState(HACKING_COUNTDOWN);
  const [phase2, setPhase2] = useState(false);
  const [shown, setShown] = useState(false);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState(false);
  const [popups, setPopups] = useState([]);
  const [extractProgress, setExtractProgress] = useState(0);
  const fakeIp = useMemo(() => `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`, []);

  useEffect(() => {
    const showTimer = setTimeout(() => setShown(true), 1200);
    return () => clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!shown) return;
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          onCountdownEnd?.();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [shown, onCountdownEnd]);

  useEffect(() => {
    if (countdown <= 8) setPhase2(true);
    if (countdown <= 5) {
      setShake(true);
      setFlash(true);
    }
  }, [countdown]);

  useEffect(() => {
    if (!shown) return;
    let i = 0;
    const id = setInterval(() => {
      if (i < FAKE_ALERTS.length) {
        setPopups((prev) => [
          ...prev.slice(-3),
          {
            id: Date.now(),
            text: FAKE_ALERTS[i],
            style: {
              top: `${10 + Math.random() * 40}%`,
              left: `${5 + Math.random() * 50}%`,
            },
          },
        ]);
        i++;
      }
    }, 1800);
    return () => clearInterval(id);
  }, [shown]);

  useEffect(() => {
    if (!shown) return;
    const id = setInterval(() => {
      setExtractProgress((p) => Math.min(100, p + Math.random() * 8));
    }, 500);
    return () => clearInterval(id);
  }, [shown]);

  useEffect(() => {
    const id = setInterval(() => setFlash((f) => !f), countdown <= 5 ? 200 : 2000);
    return () => clearInterval(id);
  }, [countdown]);

  return (
    <div className={`hacking-bg min-h-screen flex flex-col items-center justify-center relative overflow-hidden scanlines font-mono-hack ${shake ? "hack-screen-shake" : ""}`}>
      <MatrixRain />
      <StaticNoise />

      {/* Red flash overlay */}
      <div
        className={`fixed inset-0 pointer-events-none z-[15] transition-opacity duration-100 ${flash && countdown <= 5 ? "opacity-30" : "opacity-0"}`}
        style={{ background: "radial-gradient(circle, #FF0000 0%, transparent 70%)" }}
      />

      {/* Vignette */}
      <div className="fixed inset-0 pointer-events-none z-[12] hack-vignette" />

      <div className="fixed inset-0 pointer-events-none z-10" style={{ animation: "glitch-main 2s infinite" }} />

      <div
        className="fixed inset-0 pointer-events-none z-20"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.04) 2px, rgba(0,255,65,0.04) 4px)",
        }}
      />

      <WebcamOverlay />
      <TerminalLog />

      {popups.map((p) => (
        <FakePopup key={p.id} text={p.text} style={p.style} />
      ))}

      <div className="relative z-30 w-full max-w-lg mx-auto px-4 text-center pt-16 pb-32">
        {/* Skull + WARNING */}
        <div style={{ animation: "glitch-skew 1.5s infinite" }}>
          <div className="text-4xl mb-2 opacity-80">💀</div>
          <div
            className="text-6xl font-bold mb-1 glitch-text rgb-shift hack-text-bleed"
            data-text="WARNING"
            style={{ color: "#FF0000", fontFamily: "Courier New", letterSpacing: "0.25em" }}
          >
            WARNING
          </div>
          <div className="text-3xl font-bold mb-1 hack-text-bleed" style={{ color: "#FF0000", letterSpacing: "0.1em" }}>
            SYSTEM FAILURE
          </div>
          <div className="text-sm mb-1" style={{ color: "#FF4444" }}>
            UNAUTHORIZED ACCESS DETECTED
          </div>
          <div className="text-[10px] mb-4 opacity-60" style={{ color: "#FF6666" }}>
            IP: {fakeIp} | DEVICE FINGERPRINT CAPTURED
          </div>
        </div>

        {/* Data extraction bar */}
        {shown && (
          <div className="mb-6 px-4">
            <p className="text-[9px] text-red-700 mb-1 font-mono">DATA EXTRACTION PROGRESS</p>
            <div className="h-2 bg-red-950 border border-red-800 rounded overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-800 via-red-500 to-red-300 transition-all duration-300"
                style={{ width: `${extractProgress}%` }}
              />
            </div>
            <p className="text-[9px] text-red-600 mt-1 font-mono">{extractProgress.toFixed(1)}% — DO NOT POWER OFF</p>
          </div>
        )}

        <div className="w-full h-px my-4" style={{ background: "linear-gradient(to right, transparent, #FF0000, transparent)" }} />

        {shown && (
          <div
            className="my-6 p-6 border-2 rounded hack-border-flicker"
            style={{
              borderColor: "#FF0000",
              background: "rgba(255,0,0,0.08)",
              animation: "flicker 2s infinite",
              boxShadow: "0 0 30px rgba(255,0,0,0.3), inset 0 0 20px rgba(255,0,0,0.1)",
            }}
          >
            <p className="text-[10px] mb-4 tracking-widest" style={{ color: "#888" }}>
              [ ⚠ PERSONNEL FILE ACCESSED — TOP SECRET ⚠ ]
            </p>

            <div className="text-left space-y-5">
              <div>
                <span className="text-[10px]" style={{ color: "#555" }}>SUBJECT_ID://</span>
                <div className="text-2xl sm:text-3xl font-bold mt-1 hack-text-bleed" style={{ color: "#FF0000", textShadow: "0 0 15px #FF0000" }}>
                  ターゲット特定：
                  <GlitchText text={guestName || "UNKNOWN"} className="inline-block" />
                </div>
              </div>

              <div className="w-full h-px bg-red-900/50" />

              <div>
                <span className="text-[10px]" style={{ color: "#555" }}>WARNING://</span>
                <div
                  className="text-lg sm:text-xl font-bold mt-1 tracking-widest hack-text-bleed"
                  style={{
                    color: "#FF4444",
                    textShadow: "0 0 15px #FF0000",
                  }}
                >
                  進行データは即時に消去されます
                </div>
              </div>

              <div className="bg-black/50 border border-red-900 rounded p-2 text-[9px] text-red-400 font-mono space-y-0.5">
                <p>▸ 位置情報: 取得済み</p>
                <p>▸ 連絡先: 847件スキャン完了</p>
                <p>▸ カメラ/マイク: リモートアクセス中</p>
                <p>▸ 感情分析: 恐怖 ↑↑↑</p>
              </div>
            </div>
          </div>
        )}

        {shown && (
          <div className="mt-4">
            <p className="text-[10px] mb-2 tracking-widest" style={{ color: "#666" }}>
              ▼ システム終了まで ▼
            </p>
            <div
              className="text-9xl font-bold tabular-nums hack-countdown"
              style={{
                color: countdown <= 5 ? "#FF0000" : "#FF4444",
                textShadow: `0 0 ${40 - countdown * 2}px #FF0000, 0 0 80px #FF000066`,
                animation: countdown <= 5 ? "countdown-pulse 0.5s infinite, rgb-shift 0.3s infinite" : "rgb-shift 1s infinite",
              }}
            >
              {countdown.toString().padStart(2, "0")}
            </div>
            <p className="text-xs mt-3 hack-text-bleed" style={{ color: "#AA0000" }}>
              あなたのデバイスは監視下に置かれています
            </p>
            <p className="text-[10px] mt-1 opacity-50" style={{ color: "#660000" }}>
              この画面を閉じても意味がありません
            </p>
          </div>
        )}

        <div className="mt-8 text-[10px] opacity-30 font-mono leading-relaxed">
          {Array(4).fill(0).map((_, i) => (
            <p key={i}>
              {Array(45).fill(0).map((_, j) => (
                <GlitchChar key={j} char={GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)]} />
              ))}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
