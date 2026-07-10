-- 任意: デモ用メニュー（schema.sql 実行後に SQL Editor で実行）

INSERT INTO menu_items (name, price, category, description, order_index) VALUES
  ('オムライス♡', 980, 'food', 'ふわとろ卵の王道メニュー', 0),
  ('萌え萌えハンバーグ', 1280, 'food', 'デミグラスたっぷり', 1),
  ('ロイヤルミルクティー', 680, 'drink', '当店自慢のブレンド', 2),
  ('毒々ベリーパフェ', 880, 'dessert', '見た目は可愛い、味は…？', 3),
  ('秘密のスペシャルセット', 1980, 'special', 'メイド長おすすめ', 4);
