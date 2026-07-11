# Cloudflare デプロイ・設定マニュアル

本システムを Cloudflare Workers / Pages & D1 構成で起動・デプロイするためのマニュアルです。
**「コマンド操作不要で、Cloudflare のダッシュボード（管理画面）上で直接デプロイ・設定を完結させる方法」**および**「ローカル開発手順」**の双方を解説します。

---

## 1. Cloudflare ダッシュボード上で直接デプロイする方法（コマンド不要）

GitHub 連携を利用し、Cloudflare の管理画面操作のみで本番環境の構築からデータベース作成、自動ビルド・デプロイまでを完結できます。

### ステップ 1: GitHub へのプッシュ
本リポジトリをお手持ちの GitHub アカウントにプッシュしておきます。

### ステップ 2: Cloudflare D1 データベースの作成
1. [Cloudflare 管理画面](https://dash.cloudflare.com)にログインします。
2. 左メニューから **「Storage & Databases（ストレージとデータベース）」** -> **「D1」** を選択します。
3. **「Create database（データベースの作成）」** ボタンをクリックします。
4. データベース名として **`maid_cafe_db`** と入力し、作成を完了します。
5. 作成完了後、管理画面に表示されている **「Database ID」**（ハイフンで区切られた英数字。例: `xxxx-xxxx-...`）をコピーしておきます。

### ステップ 3: データベース初期化（スキーマ作成）
Cloudflare D1 の管理画面から、直接テーブルスキーマを作成できます：
1. 作成した `maid_cafe_db` の詳細画面を開き、**「Console（コンソール）」** タブを選択します。
2. 本リポジトリ内の **`migrations/0001_schema.sql`** の中身をすべてコピーします。
3. コンソールの入力欄に貼り付け、**「Execute（実行）」** をクリックします。これでデータベースの初期化は完了です！

### ステップ 4: Cloudflare Pages でデプロイ設定
1. Cloudflare 管理画面のトップに戻り、左メニューから **「Workers & Pages（Worker と Pages）」** を選択します。
2. **「Create application（アプリケーションの作成）」** -> **「Pages」** タブ -> **「Connect to Git（Git に接続）」** を選択します。
3. GitHub アカウントと連携し、本リポジトリを選択して **「Begin setup（セットアップの開始）」** をクリックします。
4. **ビルド設定**を以下のように構成します：
   - **Framework preset（フレームワーク プリセット）**: `Vite`
   - **Build command（ビルドコマンド）**: `npm run build`
   - **Build output directory（ビルド出力ディレクトリ）**: `dist`
5. **「Save and deploy（保存してデプロイ）」** をクリックします（初回ビルドはデータベース設定がまだのため完了後でもOK）。

### ステップ 5: D1 データベースと環境変数のバインド
1. デプロイした Pages プロジェクトの画面から **「Settings（設定）」** -> **「Functions（関数）」** タブを開きます。
2. **「D1 database bindings（D1 データベース バインディング）」** セクションを探し、**「Add binding（バインディングの追加）」** をクリックします。
   - **Variable name（変数名）**: **`DB`**（必ず大文字で `DB` と指定してください）
   - **D1 database（D1 データベース）**: 作成した **`maid_cafe_db`** を選択
3. 同様に、**「Settings（設定）」** -> **「Environment variables（環境変数）」** タブを開き、**「Add variable（変数の追加）」** をクリックします。
   - **Variable name（変数名）**: **`ADMIN_PASSWORD`**
   - **Value（値）**: 管理画面で使用したい任意のログインパスワード（例: `maid2024`）を設定します。
4. 設定後、画面に表示される指示に従い **「Redeploy（再デプロイ）」**、または **「Deployments（デプロイ）」** タブから **「Retry deployment（デプロイの再試行）」** をクリックします。

これですべての準備が完了し、公開URL（`xxx.pages.dev`）にブラウザでアクセスできるようになります！

---

## 2. コマンドライン（CLI）を用いたデプロイ方法

ターミナルから高速にデプロイしたい場合は以下の手順に従います。

### ステップ 1: Cloudflare アカウントへログイン
```bash
npx wrangler login
```

### ステップ 2: D1 データベースの作成
```bash
npx wrangler d1 create maid_cafe_db
```
出力された `database_id` を、`wrangler.json` 内の `d1_databases[0].database_id` に設定してください。

### ステップ 3: スキーママイグレーションの適用
```bash
npx wrangler d1 migrations apply DB --remote
```

### ステップ 4: ビルド & デプロイ
```bash
npm run build
npm run deploy
```

---

## 3. ローカル開発手順

PC ローカル環境で動作させ、挙動を確認する方法です。

### ステップ 1: 依存関係のインストール
```bash
npm install
```

### ステップ 2: ローカル SQLite D1 の初期化
```bash
npx wrangler d1 migrations apply DB --local
```

### ステップ 3: デモデータの登録 (任意)
```bash
npx wrangler d1 execute DB --local --command="INSERT INTO menu_items (id, name, price, category, description, order_index) VALUES ('1', 'オムライス♡', 980, 'food', 'ふわとろ卵の王道メニュー', 0), ('2', '萌え萌えハンバーグ', 1280, 'food', 'デミグラスたっぷり', 1), ('3', 'ロイヤルミルクティー', 680, 'drink', '当店自慢 of ブレンド', 2), ('4', '毒々ベリーパフェ', 880, 'dessert', '見た目は可愛い、味は…？', 3), ('5', '秘密のスペシャルセット', 1980, 'special', 'メイド長おすすめ', 4);"
```

### ステップ 4: 起動
```bash
npm run build
npm run dev
```
ブラウザが起動し、自動的に http://localhost:8787 が開きます。
管理画面ログインのデフォルトパスワードは `maid2024` です。
