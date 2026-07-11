# 狂気メイド喫茶 — Cloudflare Worker API 仕様書

Cloudflare Workers + D1 構成で動作する REST API 仕様です。

## ベース URL
```
http://<host>:<PORT>/api
```
ローカルでのデフォルト PORT: `8787`

---

## 共通仕様
- リクエスト/レスポンス: `application/json`
- CORS: 全オリジン許可
- 認証:
  - **一般ユーザー用 API**: 認証不要。
  - **管理者用 API (Mutation & 顧客一覧)**: リクエストヘッダーに `X-Admin-Password` もしくは `Authorization` を付与し、正しい管理者パスワードを送信する必要があります。不一致の場合は `401 Unauthorized` を返却します。

---

## 1. Rooms API (ルーム管理)

### ルーム一覧取得
```
GET /api/rooms
```
- **認証**: 不要（公開）
- **最適化**: Worker のグローバルインメモリキャッシュから高速返却されます（D1 アクセス 0 回）。
- **レスポンス 200**:
  ```json
  [
    {
      "id": "uuid",
      "name": "テーブルA",
      "phase": "WAITING",
      "created_date": "2026-07-10T14:56:02.130Z"
    }
  ]
  ```

### ルーム詳細取得
```
GET /api/rooms/:id
```
- **認証**: 不要（公開）
- **レスポンス 200**: ルーム1件

### ルーム作成
```
POST /api/rooms
Content-Type: application/json
X-Admin-Password: <password>
```
- **認証**: 管理者パスワードが必要
- **リクエストボディ**:
  ```json
  {
    "name": "テーブルA",
    "phase": "WAITING"
  }
  ```
- **レスポンス 201**: 作成されたルーム

### ルーム更新
```
PATCH /api/rooms/:id
Content-Type: application/json
X-Admin-Password: <password>
```
- **認証**: 管理者パスワードが必要
- **リクエストボディ (部分更新)**:
  ```json
  {
    "phase": "HACKING"
  }
  ```
- **レスポンス 200**: 更新されたルーム

### ルーム削除
```
DELETE /api/rooms/:id
X-Admin-Password: <password>
```
- **認証**: 管理者パスワードが必要
- **レスポンス 204**: ボディなし（削除成功）

---

## 2. Guests API (ゲスト管理・リアルタイムオンライン状態)

### ゲスト一覧取得
```
GET /api/guests?roomId=<id>
GET /api/guests?sessionToken=<token>
GET /api/guests
```
- **認証**:
  - `roomId` または `sessionToken` パラメータ付きリクエスト: **認証不要**
  - パラメータなしの全件リスト取得 (`GET /api/guests`): **管理者パスワードが必要**
- **最適化**: 各ゲストの `isOnline` と `lastSeen` は、Worker の超高速インメモリ Map からロード・同期され、D1 への不要な Read クエリが削減されます。

### ゲスト登録
```
POST /api/guests
Content-Type: application/json
X-Admin-Password: <password>
```
- **認証**: 管理者パスワードが必要
- **レスポンス 201**: 登録されたゲスト情報

### ゲストオンライン状態の更新（ポーリング用）
```
PATCH /api/guests/:id
Content-Type: application/json
```
- **認証**: 不要（公開 - ゲスト自身のオンライン状態更新のため）
- **リクエストボディ**:
  ```json
  {
    "isOnline": true,
    "lastSeen": "2026-07-10T14:56:56.006Z"
  }
  ```
- **最適化**: `isOnline` または `lastSeen` のみの更新リクエストの場合、D1 へのクエリ発行・データベース書き込み（D1 Write）は一切行われず、**Worker のインメモリ上でのみ高速に状態が同期されます（D1 Write 0回）**。これにより、高頻度のポーリングでも D1 の実行限界数を超過しません。
- **注意**: `name` や `roomId` などのデータベース書き換えを伴うフィールドを更新する場合は、管理者認証が必要となり、D1 への書き込みが発生します。

### ゲストオフラインイベント送信
```
POST /api/guests/:id/offline
```
- **認証**: 不要（公開）
- **説明**: ゲストがブラウザタブを閉じた際（sendBeacon 等）に呼び出され、D1 Write を伴わずに Worker メモリ上のステータスを即時にオフラインへ切り替えます。
- **レスポンス 204**: ボディなし

---

## 3. Menu Items API (メニュー管理)

### メニュー一覧取得
```
GET /api/menu-items?limit=<number>
```
- **認証**: 不要（公開）
- **最適化**: Worker 内のグローバルキャッシュから高速返却されます（D1 アクセス 0 回）。
- **レスポンス 200**: メニュー一覧

### メニュー追加
```
POST /api/menu-items
Content-Type: application/json
X-Admin-Password: <password>
```
- **認証**: 管理者パスワードが必要
- **レスポンス 201**: 追加されたメニュー

### メニュー更新
```
PATCH /api/menu-items/:id
Content-Type: application/json
X-Admin-Password: <password>
```
- **認証**: 管理者パスワードが必要
- **レスポンス 200**: 更新されたメニュー

### メニュー削除
```
DELETE /api/menu-items/:id
X-Admin-Password: <password>
```
- **認証**: 管理者パスワードが必要
- **レスポンス 204**: 削除成功

---

## 4. ヘルスチェック

```
GET /api/health
```
- **レスポンス 200**: `{ "ok": true, "database": "d1" }`
- **レスポンス 503**: `{ "ok": false, "error": "D1 connection failed" }`
