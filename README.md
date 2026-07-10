# 狂気メイド喫茶 — デジタルメニュー制御システム

React + Express + **Supabase** のスタンドアロン構成。Render にデプロイ可能。

## 構成

```
メニュー/
├── server/           Express API（Supabase 経由）
├── supabase/         DB スキーマ SQL
├── src/              React フロントエンド
└── render.yaml       Render デプロイ設定
```

## Supabase セットアップ

1. [Supabase](https://supabase.com) でプロジェクト作成
2. **SQL Editor** で `supabase/schema.sql` を実行
3. **Project Settings → API** から以下を取得:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`（サーバー専用・秘密）

## 環境変数

`.env.example` をコピーして `.env` を作成:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
PORT=3000
```

Render では Dashboard の Environment Variables に同じ値を設定（`render.yaml` 参照）。

## ローカル開発

```bash
npm install
npm run dev
```

- フロント: http://localhost:5173
- API: http://localhost:3000/api
- 管理画面パスワード: `maid2024`

## 本番

```bash
npm run build
NODE_ENV=production npm start
```

## Render デプロイ

1. GitHub に push
2. Render → **New → Blueprint** → `render.yaml`
3. 環境変数 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を設定
4. デプロイ

永続ディスクは不要（データは Supabase 上）。
