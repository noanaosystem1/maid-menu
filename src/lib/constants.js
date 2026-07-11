// ===== 管理者認証 =====
export const ADMIN_PASSWORD = "maid2024";

// ===== Phase定義 =====
export const PHASES = ["WAITING", "MENU_OPEN", "HACKING", "BLACKOUT"];

export const PHASE_LABELS = {
  WAITING: "待機中",
  MENU_OPEN: "メニュー表示",
  HACKING: "ハッキング",
  BLACKOUT: "暗転",
};

export const PHASE_COLORS = {
  WAITING: "bg-blue-500",
  MENU_OPEN: "bg-pink-400",
  HACKING: "bg-red-600",
  BLACKOUT: "bg-gray-900 border border-gray-600",
};

export const PHASE_TEXT_COLORS = {
  WAITING: "text-blue-400",
  MENU_OPEN: "text-pink-400",
  HACKING: "text-red-500",
  BLACKOUT: "text-gray-500",
};

// ===== ゲスト画面テキスト =====
export const GUEST_TEXT = {
  WAITING: {
    title: "System Connecting...",
    subtitle: "システム接続をお待ちください…♡",
    dots: ["接続中", "認証中", "同期中"],
  },
  MENU_OPEN: {
    greeting: (name) => `${name}様、ご注文をお選びください♡`,
    subtitle: "当店自慢のメニューをお楽しみください",
    brainwaveLabel: "脳波同調率",
    orderButton: "ご注文する",
    categoryLabels: {
      food: "フード",
      drink: "ドリンク",
      dessert: "デザート",
      special: "スペシャル",
    },
  },
  HACKING: {
    warning1: "WARNING",
    warning2: "SYSTEM FAILURE",
    warning3: "UNAUTHORIZED ACCESS DETECTED",
    targetLabel: "ターゲット特定：",
    message2: "進行データは即時に消去されます",
    countdownLabel: "システム終了まで",
    countdownUnit: "秒",
    message: "あなたのデバイスは監視下に置かれています",
  },
  BLACKOUT: {},
};

// ===== ポーリング間隔 (ms) =====
export const POLLING_INTERVAL = 1000;

// ===== ハッキング カウントダウン秒数 =====
export const HACKING_COUNTDOWN = 15;

// ===== LocalStorage / SessionStorage キー =====
export const STORAGE_KEYS = {
  GUEST_TOKEN: "maid_guest_token",
  GUEST_DATA: "maid_guest_data",
  BLACKOUT_LOCK: (token) => `blackout_${token}`,
  ADMIN_AUTH: "maid_admin_auth",
  ADMIN_AUTH_PASSWORD: "maid_admin_auth_password",
};
