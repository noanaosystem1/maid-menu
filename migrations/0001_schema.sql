-- Cloudflare D1 Migration File for SQLite

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'WAITING',
  created_date TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS guest_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1, -- SQLite handles boolean as 0/1
  is_online INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT,
  created_date TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0, -- NUMERIC / REAL
  category TEXT NOT NULL DEFAULT 'food',
  description TEXT,
  image_url TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_date TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guest_users_room_id ON guest_users(room_id);
CREATE INDEX IF NOT EXISTS idx_guest_users_session_token ON guest_users(session_token);
CREATE INDEX IF NOT EXISTS idx_menu_items_order ON menu_items(order_index);
