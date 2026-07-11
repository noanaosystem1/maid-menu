# 狂気メイド喫茶 — Cloudflare Worker API 仕様書

Cloudflare Workers + D1 (SQLite) 構成で動作する REST API 仕様です。
外部サービスや別システムから、本システムを簡単に組み込み・連携できるよう、すべての API のリクエスト形式と返答形式（成功・エラー両方）を具体例を交えて記述しています。

---

## 1. 共通仕様

- **ベース URL**: `http://localhost:8787/api` (ローカル開発時) / `https://<your-subdomain>.workers.dev/api` (本番時)
- **Content-Type**: `application/json`
- **CORS**: すべてのオリジンに対して CORS が許可されています。
- **管理者認証**:
  - メニュー作成、ルーム操作、ゲスト登録など、データを更新・削除する操作、およびゲスト全件取得には管理者認証が必要です。
  - リクエストヘッダーに `X-Admin-Password` もしくは `Authorization` ヘッダーを付与し、正しいパスワードを設定してください。
  - パスワードが不正な場合、一律で以下のステータスとレスポンスを返します。
    - **ステータス**: `401 Unauthorized`
    - **レスポンス**:
      ```json
      { "error": "Unauthorized access" }
      ```

---

## 2. Rooms API (ルーム・テーブル管理)

### 2.1 ルーム一覧取得
ルームの一覧情報を降順（作成日順）で全件取得します。

- **メソッド / パス**: `GET /api/rooms`
- **認証**: 不要（一般公開）
- **最適化**: Cloudflare Worker 側のグローバルメモリキャッシュから超高速返却されるため、D1 へのクエリ負荷は一切かかりません。
- **リクエスト**: なし（Body空）
- **レスポンス 200 (OK)**:
  ```json
  [
    {
      "id": "96ca036a-222c-4396-b0bd-2050fd8c1987",
      "name": "テーブルA",
      "phase": "WAITING",
      "created_date": "2026-07-10T14:56:02.130Z"
    }
  ]
  ```

### 2.2 ルーム詳細取得
指定した ID のルーム詳細情報を取得します。

- **メソッド / パス**: `GET /api/rooms/:id` (例: `/api/rooms/96ca036a-222c-4396-b0bd-2050fd8c1987`)
- **認証**: 不要（一般公開）
- **リクエスト**: なし（Body空）
- **レスポンス 200 (OK)**:
  ```json
  {
    "id": "96ca036a-222c-4396-b0bd-2050fd8c1987",
    "name": "テーブルA",
    "phase": "WAITING",
    "created_date": "2026-07-10T14:56:02.130Z"
  }
  ```
- **レスポンス 404 (Not Found)**:
  ```json
  { "error": "Room not found" }
  ```

### 2.3 ルーム新規作成
新しくルーム（座席・テーブル）を登録します。

- **メソッド / パス**: `POST /api/rooms`
- **認証**: 必要 (`X-Admin-Password: <password>`)
- **リクエスト Body (JSON)**:
  ```json
  {
    "name": "テーブルB",
    "phase": "WAITING"
  }
  ```
  - `name` (string, 必須): ルーム名
  - `phase` (string, 任意): 初期フェーズ。デフォルトは `"WAITING"`。有効な値: `WAITING` / `MENU_OPEN` / `HACKING` / `BLACKOUT`
- **レスポンス 201 (Created)**:
  ```json
  {
    "id": "12af4a6b-c3bc-42b3-95ad-2940fdac3912",
    "name": "テーブルB",
    "phase": "WAITING",
    "created_date": "2026-07-10T15:10:00.000Z"
  }
  ```
- **レスポンス 400 (Bad Request)**:
  ```json
  { "error": "name is required" }
  ```

### 2.4 ルーム情報の更新（フェーズ切り替え等）
ルーム名、または現在の進行フェーズを更新します。

- **メソッド / パス**: `PATCH /api/rooms/:id`
- **認証**: 必要 (`X-Admin-Password: <password>`)
- **リクエスト Body (JSON)**:
  ```json
  {
    "phase": "MENU_OPEN"
  }
  ```
- **レスポンス 200 (OK)**:
  ```json
  {
    "id": "12af4a6b-c3bc-42b3-95ad-2940fdac3912",
    "name": "テーブルB",
    "phase": "MENU_OPEN",
    "created_date": "2026-07-10T15:10:00.000Z"
  }
  ```
- **レスポンス 404 (Not Found)**:
  ```json
  { "error": "Room not found" }
  ```

### 2.5 ルーム削除
指定したルームを削除します。ルームに紐づくすべての `guest_users` はカスケードにより自動的に完全削除されます。

- **メソッド / パス**: `DELETE /api/rooms/:id`
- **認証**: 必要 (`X-Admin-Password: <password>`)
- **レスポンス 204 (No Content)**: ボディなし

---

## 3. Guests API (ゲスト管理・リアルタイムオンライン)

### 3.1 ゲスト一覧取得
登録されているゲスト情報を取得します。

- **メソッド / パス**: `GET /api/guests`
- **クエリパラメータ (任意)**:
  - `roomId=<id>`: 特定のルームに所属しているゲストのみを抽出します。(**認証不要**)
  - `sessionToken=<token>`: 招待リンクのトークンに紐づく特定の1名を抽出します。(**認証不要**)
- **認証仕様**:
  - `roomId` または `sessionToken` が**指定されている場合**: **認証不要（一般公開）**
  - パラメータなしで**全件リストを取得する場合**: **管理者認証が必要** (`X-Admin-Password`)
- **最適化**: `isOnline` および `lastSeen` 状態は、Worker のグローバルインメモリ Map からロード・マージされます。
- **レスポンス 200 (OK)**:
  ```json
  [
    {
      "id": "b8f8e6f1-33f6-4fe0-bdbe-f9d9bf2a396c",
      "name": "さくら",
      "roomId": "96ca036a-222c-4396-b0bd-2050fd8c1987",
      "sessionToken": "token-abc-123",
      "isActive": true,
      "isOnline": true,
      "lastSeen": "2026-07-10T14:57:37.592Z",
      "created_date": "2026-07-10T14:56:36.728Z"
    }
  ]
  ```

### 3.2 ゲスト登録（招待リンク発行）
管理サイト上でルームに新しいお客様を登録（招待リンク発行）します。

- **メソッド / パス**: `POST /api/guests`
- **認証**: 必要 (`X-Admin-Password: <password>`)
- **リクエスト Body (JSON)**:
  ```json
  {
    "name": "さくら",
    "roomId": "96ca036a-222c-4396-b0bd-2050fd8c1987",
    "sessionToken": "token-abc-123",
    "isActive": true,
    "isOnline": false
  }
  ```
  - `name` (string, 必須)
  - `roomId` (string, 必須)
  - `sessionToken` (string, 必須): ユニークな文字列
- **レスポンス 201 (Created)**:
  ```json
  {
    "id": "b8f8e6f1-33f6-4fe0-bdbe-f9d9bf2a396c",
    "name": "さくら",
    "roomId": "96ca036a-222c-4396-b0bd-2050fd8c1987",
    "sessionToken": "token-abc-123",
    "isActive": true,
    "isOnline": false,
    "lastSeen": null,
    "created_date": "2026-07-10T14:56:36.728Z"
  }
  ```
- **レスポンス 400 (Bad Request)**:
  ```json
  { "error": "name, roomId, sessionToken are required" }
  ```

### 3.3 ゲストオンライン状態の更新（ポーリング用超軽量 API）
ゲスト（お客様）の画面が1秒ごとに自身の生存（オンライン）を通知するポーリング用 API です。

- **メソッド / パス**: `PATCH /api/guests/:id`
- **認証**: **不要（公開）**（ゲストのデバイスから安全に通知するため）
- **リクエスト Body (JSON)**:
  ```json
  {
    "isOnline": true,
    "lastSeen": "2026-07-10T15:20:00.000Z"
  }
  ```
- **超重要最適化（D1 Write 0回）**:
  - `isOnline` および `lastSeen` **のみ**を更新する場合、本システムは **SQLite データベース (D1) への書き込みを行いません。**
  - Worker のグローバルインメモリ上で即時に状態変更が保持されます。これにより、多数の顧客端末が毎秒ポーリングを送信しても、データベース上限に達することなく安定動作します。
  - ※注意: `name` や `roomId` の変更を伴うリクエストの場合は、管理者認証が必要となり、D1 への書き込みが発生します。
- **レスポンス 200 (OK)**:
  ```json
  {
    "id": "b8f8e6f1-33f6-4fe0-bdbe-f9d9bf2a396c",
    "name": "さくら",
    "roomId": "96ca036a-222c-4396-b0bd-2050fd8c1987",
    "sessionToken": "token-abc-123",
    "isActive": true,
    "isOnline": true,
    "lastSeen": "2026-07-10T15:20:00.000Z",
    "created_date": "2026-07-10T14:56:36.728Z"
  }
  ```

### 3.4 ゲストオフラインイベント通知 (タブ閉鎖検知)
お客様がブラウザタブを閉じた瞬間に、`navigator.sendBeacon` などから明示的にオフラインステータスを登録します。

- **メソッド / パス**: `POST /api/guests/:id/offline`
- **認証**: 不要（公開）
- **レスポンス 204 (No Content)**: ボディなし

### 3.5 ゲスト削除
ゲスト情報を完全にデータベースから抹消します。

- **メソッド / パス**: `DELETE /api/guests/:id`
- **認証**: 必要 (`X-Admin-Password: <password>`)
- **レスポンス 204 (No Content)**: ボディなし

---

## 4. Menu Items API (メニュー管理)

### 4.1 メニュー一覧取得
登録されているメニューアイテムの一覧を取得します。

- **メソッド / パス**: `GET /api/menu-items?limit=100`
- **認証**: 不要（公開）
- **最適化**: Worker のインメモリ上にキャッシュされるため、何回呼び出しても D1 クエリは走りません（D1 Read 0回）。メニュー追加・削除時に自動でクリアされます。
- **レスポンス 200 (OK)**:
  ```json
  [
    {
      "id": "1",
      "name": "オムライス♡",
      "price": 980,
      "category": "food",
      "description": "ふわとろ卵の王道メニュー",
      "imageUrl": null,
      "order": 0,
      "created_date": "2026-07-10T14:53:31.000Z"
    }
  ]
  ```

### 4.2 メニュー項目追加
- **メソッド / パス**: `POST /api/menu-items`
- **認証**: 必要 (`X-Admin-Password: <password>`)
- **リクエスト Body (JSON)**:
  ```json
  {
    "name": "萌え萌えハンバーグ",
    "price": 1280,
    "category": "food",
    "description": "デミグラスたっぷり",
    "imageUrl": null,
    "order": 1
  }
  ```
- **レスポンス 201 (Created)**: 追加後のオブジェクト

### 4.3 メニュー項目更新
- **メソッド / パス**: `PATCH /api/menu-items/:id`
- **認証**: 必要 (`X-Admin-Password: <password>`)
- **レスポンス 200 (OK)**: 更新後のオブジェクト

### 4.4 メニュー項目削除
- **メソッド / パス**: `DELETE /api/menu-items/:id`
- **認証**: 必要 (`X-Admin-Password: <password>`)
- **レスポンス 204 (No Content)**: ボディなし

---

## 5. 外部サービスからの組み込み・連携ステップ例

別システムや外部プログラムから、本システムのルーム状況や顧客を同期・制御するための標準フローです。

### 連携ステップ 1: 新しい座席（Room）を作成する
他システム（POSレジや案内端末など）から、新規にテーブルのセッションを作成します。

**リクエスト例**:
```bash
curl -s -X POST https://your-app.workers.dev/api/rooms \
  -H "X-Admin-Password: maid2024" \
  -H "Content-Type: application/json" \
  -d '{"name": "VIP席A"}'
```

**レスポンス例 (201 Created)**:
```json
{
  "id": "77af4a6b-c3bc-42b3-95ad-2940fdac8888",
  "name": "VIP席A",
  "phase": "WAITING",
  "created_date": "2026-07-10T15:40:00.000Z"
}
```

---

### 連携ステップ 2: 作成したルームに顧客（ゲスト）を紐づけて招待リンクを発行する
登録したいお客様の名前と、ユニークなトークン（ランダムな一意文字列、UUIDなど）を送信して、デジタルメニューのログインURL（招待リンク）を生成します。

**リクエスト例**:
```bash
curl -s -X POST https://your-app.workers.dev/api/guests \
  -H "X-Admin-Password: maid2024" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "さくら様",
    "roomId": "77af4a6b-c3bc-42b3-95ad-2940fdac8888",
    "sessionToken": "unique-session-token-999"
  }'
```

**レスポンス例 (201 Created)**:
```json
{
  "id": "99999999-33f6-4fe0-bdbe-f9d9bf2a9999",
  "name": "さくら様",
  "roomId": "77af4a6b-c3bc-42b3-95ad-2940fdac8888",
  "sessionToken": "unique-session-token-999",
  "isActive": true,
  "isOnline": false,
  "lastSeen": null,
  "created_date": "2026-07-10T15:42:00.000Z"
}
```

お客様向けログインURLは以下の形式になります：
`https://your-app.workers.dev/guest?token=unique-session-token-999`

---

### 連携ステップ 3: テーブルの演出（フェーズ）を切り替える
演出のフェーズ（待機中 -> メニュー表示 -> ハッキング開始 -> 画面暗転）を外部から一括で切り替えます。切り替え後、1秒以内にお客様の全端末に同期して演出が連動します。

**メニューをオープンさせる場合**:
```bash
curl -s -X PATCH https://your-app.workers.dev/api/rooms/77af4a6b-c3bc-42b3-95ad-2940fdac8888 \
  -H "X-Admin-Password: maid2024" \
  -H "Content-Type: application/json" \
  -d '{"phase": "MENU_OPEN"}'
```

**ハッキング演出を起動する場合**:
```bash
curl -s -X PATCH https://your-app.workers.dev/api/rooms/77af4a6b-c3bc-42b3-95ad-2940fdac8888 \
  -H "X-Admin-Password: maid2024" \
  -H "Content-Type: application/json" \
  -d '{"phase": "HACKING"}'
```
