import { useEffect, useState } from "react";
import { GUEST_TEXT } from "@/lib/constants";

export default function PhaseWaiting({ guestName }) {
  const [dotIndex, setDotIndex] = useState(0);
  const dots = GUEST_TEXT.WAITING.dots;

  useEffect(() => {
    const id = setInterval(() => {
      setDotIndex((i) => (i + 1) % dots.length);
    }, 2000);
    return () => clearInterval(id);
  }, [dots.length]);

  return (
    <div className="min-h-screen cute-gradient flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-6 animate-pulse">♡</div>
        <h1
          className="text-2xl font-bold text-pink-600 mb-2"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {GUEST_TEXT.WAITING.title}
        </h1>
        <p className="text-pink-400 text-sm mb-8">
          {guestName
            ? `${guestName}様、${GUEST_TEXT.WAITING.subtitle}`
            : GUEST_TEXT.WAITING.subtitle}
        </p>

        <div className="flex items-center justify-center gap-2 mb-8">
          {dots.map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                  i === dotIndex ? "bg-pink-500 scale-125" : "bg-pink-200"
                }`}
                style={i === dotIndex ? { animation: "pulse-dot 1s infinite" } : {}}
              />
              <span
                className={`text-xs transition-colors ${
                  i === dotIndex ? "text-pink-500 font-semibold" : "text-pink-200"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="w-full h-1 bg-pink-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-pink-400 rounded-full"
            style={{ animation: "progress-bar 3s ease-in-out infinite alternate" }}
          />
        </div>
      </div>
    </div>
  );
}
