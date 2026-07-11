# Cloudflare Workers & D1 移行版 デプロイマニュアル

本システムを Cloudflare Workers + D1 データベース構成で起動・デプロイするためのマニュアルです。

---

## 1. ローカル開発環境での起動手順

ローカル環境では、Cloudflare Workers のエミュレータ（Miniflare）を用いて完全にオフラインで動作させることができます。

### ステップ 1: 依存関係のインストール
```bash
npm install
```

### ステップ 2: ローカル SQLite D1 データベースの初期化
```bash
npx wrangler d1 migrations apply DB --local
```

### ステップ 3: ローカル D1 データベースへの初期デモデータの投入
```bash
npx wrangler d1 execute DB --local --command="INSERT INTO menu_items (id, name, price, category, description, order_index) VALUES ('1', 'オムライス♡', 980, 'food', 'ふわとろ卵の王道メニュー', 0), ('2', '萌え萌えハンバーグ', 1280, 'food', 'デミグラスたっぷり', 1), ('3', 'ロイヤルミルクティー', 680, 'drink', '当店自慢 of ブレンド', 2), ('4', '毒々ベリーパフェ', 880, 'dessert', '見た目は可愛い、味は…？', 3), ('5', '秘密のスペシャルセット', 1980, 'special', 'メイド長おすすめ', 4);"
```

### ステップ 4: フロントエンドのビルド
```bash
npm run build
```

### ステップ 5: ローカル開発サーバーの起動
```bash
npm run dev
```
起動すると、ブラウザで自動的に http://localhost:8787 が開きます。
管理画面のデフォルトパスワードは `maid2024` です。

---

## 2. Cloudflare (本番環境) へのデプロイ手順

### ステップ 1: Cloudflare アカウントへのログイン
```bash
npx wrangler login
```

### ステップ 2: 本番用 Cloudflare D1 データベースの作成
```bash
npx wrangler d1 create maid_cafe_db
```
コマンド実行後にターミナルに表示される `database_id` をコピーします。

### ステップ 3: `wrangler.json` の更新
`wrangler.json` 内の `d1_databases[0].database_id` を、コピーした `database_id` に書き換えます。
```json
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "maid_cafe_db",
      "database_id": "作成されたdatabase_idをここに設定"
    }
  ]
```

### ステップ 4: 本番用 D1 データベースへのスキーママイグレーション実行
```bash
npx wrangler d1 migrations apply DB --remote
```

### ステップ 5: フロントエンドのビルドと Worker へのデプロイ
```bash
npm run build
npm run deploy
```

デプロイが完了すると、`xxx.workers.dev` などの公開アクセスURLが出力されます。

---

## 3. 本番環境の管理者パスワードの変更方法

本番環境の管理者パスワード（Admin Console ログインパスワード）を変更するには、Cloudflare Dashboard にログインし、以下の手順で行います：

1. Cloudflare Dashboard から **Workers & Pages** -> **maid-cafe-menu** を選択します。
2. **Settings (設定)** タブを開き、**Variables (環境変数)** セクションに移動します。
3. `ADMIN_PASSWORD` という名前の環境変数を追加または編集し、新しいパスワードを入力して保存（Encrypt / 保存）します。
4. 再度 `npm run deploy` でデプロイするか、コンソール上の「Deploy (再デプロイ)」ボタンをクリックすると設定が反映されます。
