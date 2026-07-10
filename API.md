# 狂気メイド喫茶 — External API 仕様書

Express サーバー（`server/index.js`）が提供する REST API。
Supabase をバックエンドに使用。

## ベース URL

```
http://<host>:<PORT>/api
```

デフォルト PORT: `3000`（`.env` の `PORT` で変更可）

## 共通仕様

- リクエスト/レスポンス: `application/json`
- CORS: 全オリジン許可（`server/index.js` の `cors()` による）
- 認証: 不要（Supabase `service_role` キーでサーバーが直接操作）
- エラー時: `{ error: string }` を返す（`handle` ミドルウェアで 500 になる）

---

## Room API

### ルーム一覧取得

```
GET /api/rooms
```

**レスポンス 200:**
```json
[
  {
    "id": "uuid",
    "name": "テーブルA",
    "phase": "WAITING",
    "created_date": "2025-01-01T00:00:00Z"
  }
]
```

### ルーム詳細取得

```
GET /api/rooms/:id
```

**レスポンス 200:** ルーム1件
**レスポンス 404:** `{ "error": "Room not found" }`

### ルーム作成

```
POST /api/rooms
Content-Type: application/json
```

**リクエストボディ:**
```json
{
  "name": "テーブルA",
  "phase": "WAITING"
}
```

- `name` (string, required): ルーム名
- `phase` (string, optional): 初期フェーズ。デフォルト `"WAITING"`。有効値: `WAITING | MENU_OPEN | HACKING | BLACKOUT`

**レスポンス 201:** 作成されたルーム
**レスポンス 400:** `{ "error": "name is required" }`

### ルーム更新

```
PATCH /api/rooms/:id
Content-Type: application/json
```

**リクエストボディ（部分更新）:**
```json
{
  "name": "新しい名前",
  "phase": "HACKING"
}
```

**レスポンス 200:** 更新後のルーム
**レスポンス 404:** `{ "error": "Room not found" }`

### ルーム削除 ✨

```
DELETE /api/rooms/:id
```

**レスポンス 204:** 削除成功（ボディなし）
**レスポンス 404:** `{ "error": "Room not found" }`

> 注意: ルームに紐づく `guest_users` は DB の `ON DELETE CASCADE` で自動削除される。

---

## Guest / ユーザー API

### ユーザー一覧取得

```
GET /api/guests?roomId=<uuid>
GET /api/guests?sessionToken=<token>
```

- `roomId` (optional): 指定するとそのルームのユーザーのみ取得
- `sessionToken` (optional): 指定するとトークンで照合（1件 or 0件）

**レスポンス 200:**
```json
[
  {
    "id": "uuid",
    "name": "さくら",
    "roomId": "uuid",
    "sessionToken": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
    "isActive": true,
    "isOnline": true,
    "lastSeen": "2025-01-01T00:00:00Z",
    "created_date": "2025-01-01T00:00:00Z"
  }
]
```

### ユーザー詳細取得

```
GET /api/guests?sessionToken=<token>
```

トークンでユーザーを検索。見つかれば1件を返す。

### ユーザー作成

```
POST /api/guests
Content-Type: application/json
```

**リクエストボディ:**
```json
{
  "name": "さくら",
  "roomId": "room-uuid",
  "sessionToken": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
  "isActive": true,
  "isOnline": false
}
```

- `name` (string, required): ユーザー名
- `roomId` (string, required): 所属ルームの UUID
- `sessionToken` (string, required): UUIDv4 推奨。このトークンを含む URL が招待リンクになる
- `isActive` (boolean, optional): デフォルト `true`。`false` で強制キック相当
- `isOnline` (boolean, optional): デフォルト `false`

ゲスト画面の URL: `http://<host>/guest?token=<sessionToken>`

**レスポンス 201:** 作成されたユーザー
**レスポンス 400:** `{ "error": "name, roomId, sessionToken are required" }`

### ユーザー更新

```
PATCH /api/guests/:id
Content-Type: application/json
```

**リクエストボディ（部分更新）:**
```json
{
  "isOnline": true,
  "lastSeen": "2025-01-01T00:00:00Z"
}
```

更新可能フィールド: `name`, `roomId`, `sessionToken`, `isActive`, `isOnline`, `lastSeen`

**レスポンス 200:** 更新後のユーザー
**レスポンス 404:** `{ "error": "Guest not found" }`

### ユーザー完全削除 ✨

```
DELETE /api/guests/:id
```

ユーザーを DB から完全に削除する。

**レスポンス 204:** 削除成功（ボディなし）
**レスポンス 404:** `{ "error": "Guest not found" }`

> 旧「キック（`isActive: false`）」に相当する操作は存在しない。完全に削除する API のみを提供する。

---

## Menu Item API

### メニュー一覧取得

```
GET /api/menu-items?limit=<number>
```

- `limit` (optional): デフォルト `100`

**レスポンス 200:**
```json
[
  {
    "id": "uuid",
    "name": "オムライス♡",
    "price": 980,
    "category": "food",
    "description": "ふわとろ卵の王道メニュー",
    "imageUrl": null,
    "order": 0,
    "created_date": "2025-01-01T00:00:00Z"
  }
]
```

### メニュー作成

```
POST /api/menu-items
Content-Type: application/json
```

**リクエストボディ:**
```json
{
  "name": "オムライス♡",
  "price": 980,
  "category": "food",
  "description": "ふわとろ卵の王道メニュー",
  "order": 0
}
```

- `name` (string, required)
- `price` (number, optional): デフォルト `0`
- `category` (string, optional): `food | drink | dessert | special` など。デフォルト `"food"`
- `description` (string, optional)
- `imageUrl` (string, optional): 画像 URL
- `order` (number, optional): 表示順。デフォルト `0`

**レスポンス 201:** 作成されたメニューアイテム
**レスポンス 400:** `{ "error": "name is required" }`

### メニュー更新

```
PATCH /api/menu-items/:id
Content-Type: application/json
```

**リクエストボディ（部分更新）:**
```json
{
  "price": 1080,
  "order": 1
}
```

**レスポンス 200:** 更新後のメニューアイテム
**レスポンス 404:** `{ "error": "Menu item not found" }`

### メニュー削除

```
DELETE /api/menu-items/:id
```

**レスポンス 204:** 削除成功
**レスポンス 404:** `{ "error": "Menu item not found" }`

---

## ヘルスチェック

```
GET /api/health
```

**レスポンス 200:**
```json
{ "ok": true, "database": "supabase" }
```

**レスポンス 503:**
```json
{ "ok": false, "error": "Supabase not configured" }
```

---

## 外部サービスからの利用例

### ルーム作成 + ユーザー登録の例

```bash
# 1. ルーム作成
curl -X POST http://localhost:3000/api/rooms \
  -H "Content-Type: application/json" \
  -d '{"name": "テーブルA"}'

# レスポンス: {"id": "room-uuid", "name": "テーブルA", "phase": "WAITING", ...}

# 2. ユーザー登録（招待リンク発行）
curl -X POST http://localhost:3000/api/guests \
  -H "Content-Type: application/json" \
  -d '{
    "name": "さくら",
    "roomId": "room-uuid",
    "sessionToken": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
    "isActive": true,
    "isOnline": false
  }'

# レスポンス: {"id": "user-uuid", "name": "さくら", "roomId": "room-uuid", ...}
```

### 招待 URL

```
http://<host>:<PORT>/guest?token=<sessionToken>
```

この URL にアクセスすると Phase が `WAITING` → `MENU_OPEN` → `HACKING` → `BLACKOUT` の流れで進行する。

---

## セットアップ方法

### 1. Supabase プロジェクト作成

1. [Supabase](https://supabase.com) で新規プロジェクトを作成
2. **SQL Editor** を開く
3. `supabase/schema.sql` の内容を実行してテーブルを作成
4. （任意）`supabase/seed.sql` でデモ用メニューデータを投入

### 2. 環境変数設定

プロジェクトルートに `.env` ファイルを作成：

```env
PORT=3000
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
```

値は Supabase Dashboard → **Project Settings → API** から取得：
- `Project URL` → `SUPABASE_URL`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`（サーバー専用・秘密）

### 3. ローカル起動

```bash
npm install
npm run dev
```

- フロントエンド: http://localhost:5173
- API: http://localhost:3000/api
- 管理画面パスワード: `maid2024`

### 4. ビルド & 本番起動

```bash
npm run build
NODE_ENV=production npm start
```

### 5. Render デプロイ

1. GitHub に push
2. Render → **New → Blueprint** → `render.yaml` を選択
3. 環境変数 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を設定
4. デプロイ

## 変更履歴

- 2025-06-27: アクセスキー機能を完全削除、ルーム削除 (`DELETE /api/rooms/:id`) とユーザー完全削除 (`DELETE /api/guests/:id`) を追加
