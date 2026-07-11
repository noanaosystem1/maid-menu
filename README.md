# 狂気メイド喫茶 — デジタルメニュー制御システム (Cloudflare Workers & D1 移行版)

React + Cloudflare Workers + Cloudflare D1 (SQLite) のモダンなサーバーレス構成。

## 構成

```
メニュー/
├── wrangler.json     Wrangler 設定ファイル
├── server/
│   └── worker.js     Cloudflare Workers API (D1 & 高速インメモリキャッシュ管理)
├── migrations/
│   └── 0001_schema.sql D1 用 DB スキーマ SQL
├── src/              React フロントエンド
└── dist/             ビルド済みフロントエンドアセット
```

## Cloudflare D1 / Worker の最適化と仕組み

D1 への不要なクエリや書き込み（D1 Read/Write）を削減し、Cloudflare の実行制限（CPU時間やリクエスト数）を超過しないよう、以下の高度なインメモリキャッシュ設計を実装しています。

1. **インメモリキャッシュによる D1 Read の極小化:**
   - メニュー一覧 (`menu_items`) とルーム一覧 (`rooms`) を Worker のメモリ上にキャッシュします。
   - 変更（POST/PATCH/DELETE などの管理操作）が走った場合のみキャッシュをクリア・リフレッシュし、通常時のゲスト側からのポーリング等では D1 への直接の Read クエリを 0 に抑えています。

2. **D1 Write の完全削減（オンラインポーリングの超軽量化）:**
   - ゲスト（お客さん）がページを開いている間に定期送信される `isOnline` や `lastSeen` の更新は、**D1 への UPDATE クエリを完全に廃止**しました。
   - 代わりに、Worker のグローバルインメモリ Map 内でアクセス時刻を記録・集計します。これにより、従来の最大ボトルネックであった D1 Write の消費を **完全に 0** に削減しました。

3. **管理サイトの認証セキュリティ:**
   - パスワードは Worker 側の環境変数 `ADMIN_PASSWORD` (デフォルトは `"maid2024"`) にて安全に保持・検証。
   - 管理画面から送信される `X-Admin-Password` (または `Authorization`) ヘッダーと照合し、管理 API への不正アクセスを未然に防止します。

---

## ローカル開発環境のセットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. ローカル D1 データベースの初期化 & マイグレーション実行

```bash
npx wrangler d1 migrations apply DB --local
```

### 3. デモデータの登録 (任意)

```bash
npx wrangler d1 execute DB --local --command="INSERT INTO menu_items (id, name, price, category, description, order_index) VALUES ('1', 'オムライス♡', 980, 'food', 'ふわとろ卵の王道メニュー', 0), ('2', '萌え萌えハンバーグ', 1280, 'food', 'デミグラスたっぷり', 1), ('3', 'ロイヤルミルクティー', 680, 'drink', '当店自慢 of ブレンド', 2), ('4', '毒々ベリーパフェ', 880, 'dessert', '見た目は可愛い、味は…？', 3), ('5', '秘密のスペシャルセット', 1980, 'special', 'メイド長おすすめ', 4);"
```

### 4. フロントエンドのビルド & ローカルサーバーの起動

```bash
npm run build
npm run dev
```

- ブラウザで自動的に http://localhost:8787 にてフロントエンドと API が起動します。
- 管理サイトのデフォルトパスワード: `maid2024`

---

## 本番デプロイ

### 1. リモート D1 データベースの作成

Cloudflare Dashboard または Wrangler CLI で D1 データベースを作成します。

```bash
npx wrangler d1 create maid_cafe_db
```

作成された `database_id` を `wrangler.json` の `d1_databases[0].database_id` に設定してください。

### 2. リモート D1 へのマイグレーション適用

```bash
npx wrangler d1 migrations apply DB --remote
```

### 3. デプロイの実行

```bash
npm run build
npm run deploy
```

デプロイ完了後、Cloudflare 側で割り当てられた `xxx.workers.dev` などの URL からアクセス可能です。
管理画面のパスワードを変更する場合は、Cloudflare Dashboard の Worker の設定（Settings -> Variables）から `ADMIN_PASSWORD` 環境変数を追加・更新してください。
