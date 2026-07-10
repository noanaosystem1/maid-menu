import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/api/client";
import { GUEST_TEXT } from "@/lib/constants";

const CATEGORY_LABELS = GUEST_TEXT.MENU_OPEN.categoryLabels;
const CATEGORY_STYLES = {
  food: { icon: "🍳", gradient: "from-orange-200 to-amber-100", ring: "ring-orange-300", badge: "bg-orange-400" },
  drink: { icon: "☕", gradient: "from-sky-200 to-blue-100", ring: "ring-sky-300", badge: "bg-sky-400" },
  dessert: { icon: "🍰", gradient: "from-fuchsia-200 to-pink-100", ring: "ring-fuchsia-300", badge: "bg-fuchsia-400" },
  special: { icon: "✨", gradient: "from-violet-200 to-purple-100", ring: "ring-violet-300", badge: "bg-violet-400" },
};
const PLACEHOLDER_IMAGES = {
  food: "https://images.unsplash.com/photo-1582896911227-cdba54fbc5ef?w=400&h=300&fit=crop",
  drink: "https://images.unsplash.com/photo-1544145945-f90425340c7e?w=400&h=300&fit=crop",
  dessert: "https://images.unsplash.com/photo-1551024601-bec78aea704b?w=400&h=300&fit=crop",
  special: "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=400&h=300&fit=crop",
};

const FLOATING_EMOJIS = ["♡", "✧", "🎀", "⭐", "♡", "🌸", "✦", "💕"];

function FloatingDecor() {
  const [particles] = useState(() =>
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      emoji: FLOATING_EMOJIS[i % FLOATING_EMOJIS.length],
      left: `${(i * 17 + 5) % 95}%`,
      delay: i * 0.4,
      duration: 6 + (i % 4),
      size: 12 + (i % 3) * 6,
    }))
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <span
          key={p.id}
          className="menu-float-particle absolute opacity-40"
          style={{
            left: p.left,
            fontSize: p.size,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

function SparkleBurst({ show }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 2.5, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
        >
          <span className="text-4xl">✨💖✨</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function BrainwaveMeter() {
  const [value, setValue] = useState(12);
  useEffect(() => {
    const i = setInterval(
      () => setValue((v) => Math.max(8, Math.min(22, v + (Math.random() - 0.5) * 3))),
      2000
    );
    return () => clearInterval(i);
  }, []);
  return (
    <div className="flex items-center gap-1 opacity-40">
      <span className="text-pink-400 text-[9px]">脳波同調率</span>
      <div className="w-14 h-1.5 bg-pink-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-pink-400 to-rose-400 rounded-full transition-all duration-1000"
          style={{ width: `${value * 3}%` }}
        />
      </div>
      <span className="text-pink-400 text-[9px]">{value.toFixed(1)}%</span>
    </div>
  );
}

function MenuCard({ item, onAdd }) {
  const [added, setAdded] = useState(false);
  const [burst, setBurst] = useState(false);
  const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES.food;
  const imgSrc = item.imageUrl || PLACEHOLDER_IMAGES[item.category] || PLACEHOLDER_IMAGES.food;

  const handleAdd = () => {
    setAdded(true);
    setBurst(true);
    onAdd(item);
    setTimeout(() => setAdded(false), 1200);
    setTimeout(() => setBurst(false), 600);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -6, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`relative menu-card-lace bg-gradient-to-br ${style.gradient} rounded-3xl overflow-hidden shadow-lg shadow-pink-200/50 ring-2 ${style.ring} ring-offset-2 ring-offset-pink-50`}
    >
      <SparkleBurst show={burst} />
      <div className="absolute top-0 left-0 right-0 h-3 menu-lace-strip opacity-80" />

      <div className="relative mx-2 mt-3 rounded-2xl overflow-hidden border-2 border-white/80 shadow-inner">
        <img
          src={imgSrc}
          alt={item.name}
          className="w-full h-32 object-cover"
          onError={(e) => { e.target.src = PLACEHOLDER_IMAGES.food; }}
        />
        <div className={`absolute top-2 right-2 ${style.badge} text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-md`}>
          ¥{item.price.toLocaleString()}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-pink-900/20 to-transparent" />
      </div>

      <div className="p-3 pt-2">
        <div className="flex items-start gap-1.5">
          <span className="text-lg leading-none">{style.icon}</span>
          <h3 className="font-bold text-pink-900 text-sm leading-tight flex-1">{item.name}</h3>
        </div>
        {item.description && (
          <p className="text-pink-700/70 text-[11px] mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
        )}
        <motion.button
          onClick={handleAdd}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          className={`w-full mt-3 py-2.5 rounded-2xl text-xs font-bold transition-all relative overflow-hidden ${
            added
              ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-300"
              : "bg-white/90 text-pink-600 border-2 border-pink-200 hover:border-pink-400 hover:bg-pink-50"
          }`}
        >
          {added ? "♡ 追加しました！" : "♡ カートに入れる"}
        </motion.button>
      </div>
    </motion.div>
  );
}

export default function PhaseMenu({ guestName }) {
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);

  useEffect(() => {
    api.menuItems.list(50).then(setItems).catch(() => {});
  }, []);

  const addToCart = useCallback((item) => {
    setCart((prev) => [...prev, item]);
  }, []);

  const categories = ["all", ...new Set(items.map((i) => i.category))];
  const filtered = activeCategory === "all" ? items : items.filter((i) => i.category === activeCategory);
  const greeting = guestName
    ? `${guestName}様、ご注文をお選びください♡`
    : GUEST_TEXT.MENU_OPEN.greeting("お客");

  return (
    <div className="min-h-screen menu-dream-bg relative overflow-x-hidden pb-24">
      <FloatingDecor />

      {/* Ribbon header */}
      <div className="sticky top-0 z-30 menu-header-glass border-b-2 border-pink-200/60 px-4 pt-3 pb-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center mb-2">
            <div className="menu-ribbon px-6 py-1 text-white text-[10px] font-bold tracking-widest uppercase">
              Maid Café Système
            </div>
          </div>

          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
              className="text-4xl drop-shadow-md"
            >
              🎀
            </motion.div>
            <div className="flex-1 min-w-0">
              <h1
                className="text-lg font-bold bg-gradient-to-r from-pink-600 via-rose-500 to-fuchsia-600 bg-clip-text text-transparent"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {greeting}
              </h1>
              <p className="text-xs text-pink-400 mt-0.5 flex items-center gap-1">
                <span className="animate-pulse">♡</span>
                {GUEST_TEXT.MENU_OPEN.subtitle}
                <span className="animate-pulse">♡</span>
              </p>
            </div>
          </div>

          {/* Today's special banner */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mt-3 bg-gradient-to-r from-pink-400 via-rose-400 to-pink-400 rounded-2xl px-4 py-2 text-white text-center text-xs font-semibold shadow-md shadow-pink-300/40"
          >
            ✨ 本日のスペシャル — お好みのメニューをタップしてね ♡ ✨
          </motion.div>

          {categories.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
              {categories.map((cat) => {
                const active = activeCategory === cat;
                const catStyle = cat !== "all" ? CATEGORY_STYLES[cat] : null;
                return (
                  <motion.button
                    key={cat}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all ${
                      active
                        ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-300/50 scale-105"
                        : "bg-white/80 text-pink-500 border-2 border-pink-200 hover:border-pink-300"
                    }`}
                  >
                    {cat !== "all" && <span>{catStyle?.icon || "🍽"}</span>}
                    {cat === "all" ? "♡ すべて" : CATEGORY_LABELS[cat] || cat}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Menu grid */}
      <div className="max-w-2xl mx-auto px-4 py-6 relative z-10">
        {filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-6xl mb-4"
            >
              🍽♡
            </motion.div>
            <p className="text-pink-400 font-medium">メニューを準備中です…♡</p>
            <p className="text-pink-300 text-xs mt-2">しばらくお待ちくださいね</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((item, i) => (
              <MenuCard key={item.id} item={item} onAdd={addToCart} />
            ))}
          </div>
        )}
      </div>

      {/* Cart FAB */}
      <motion.button
        onClick={() => setShowCart((v) => !v)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-white shadow-xl shadow-pink-400/50 flex items-center justify-center text-xl border-2 border-white"
      >
        🛒
        {cart.length > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-6 h-6 bg-white text-pink-600 text-xs font-bold rounded-full flex items-center justify-center border-2 border-pink-400"
          >
            {cart.length}
          </motion.span>
        )}
      </motion.button>

      {/* Cart drawer */}
      <AnimatePresence>
        {showCart && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t-2 border-pink-200 rounded-t-3xl p-5 max-h-[50vh] overflow-y-auto shadow-2xl"
          >
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-pink-600 flex items-center gap-2">
                  ♡ ご注文リスト
                  <span className="text-xs bg-pink-100 text-pink-500 px-2 py-0.5 rounded-full">{cart.length}点</span>
                </h3>
                <button onClick={() => setShowCart(false)} className="text-pink-300 hover:text-pink-500 text-sm">閉じる</button>
              </div>
              {cart.length === 0 ? (
                <p className="text-pink-300 text-sm text-center py-6">まだ何も選ばれていません♡</p>
              ) : (
                <ul className="space-y-2">
                  {cart.map((item, i) => (
                    <li key={`${item.id}-${i}`} className="flex items-center gap-2 text-sm text-pink-800 bg-pink-50 rounded-xl px-3 py-2">
                      <span>{CATEGORY_STYLES[item.category]?.icon || "🍽"}</span>
                      <span className="flex-1 font-medium">{item.name}</span>
                      <span className="text-pink-500 font-bold">¥{item.price.toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              )}
              {cart.length > 0 && (
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  className="w-full mt-4 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-sm shadow-lg shadow-pink-300/40"
                >
                  ♡ ご注文する（デモ）
                </motion.button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 menu-footer-glass border-t border-pink-100 px-4 py-2 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <p className="text-pink-300 text-[10px] font-medium tracking-wide">Café Système Digital Menu ♡</p>
          <BrainwaveMeter />
        </div>
      </div>

      <div className="fixed top-0 left-0 w-full h-1.5 bg-gradient-to-r from-pink-300 via-rose-400 to-fuchsia-300 z-40 pointer-events-none" />
      <div className="fixed bottom-16 left-0 w-full h-px bg-gradient-to-r from-transparent via-pink-300 to-transparent z-10 pointer-events-none" />
    </div>
  );
}
