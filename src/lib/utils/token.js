// UUIDv4生成
export function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ゲストURL生成
export function buildGuestUrl(token) {
  const base = window.location.origin;
  return `${base}/guest?token=${token}`;
}
