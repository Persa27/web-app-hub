# 2026-11-07 公開作品の累計ページビュー

集計対象を既存11 IDから14 IDへ拡張し、公開カタログの全11作品を登録した。既存Durable ObjectのID・保存形式は変更しておらず、デプロイ前後で既存11 IDの値が減っていないことを確認した。Hubの表示コードは既存API応答を利用できるため変更不要。

## 公開済み

- Metrics Worker: `ea4759e4-0a94-43a4-9cde-b4496a036b43`。ソースコミット`1e929d7`。
- Vegenetica: `db4bb360-5231-4e2e-98d9-12f0d25ae0f0`、`vegenetica`プロジェクトの`tamalab`ブランチ（Hub既存リンク先）。ソースコミット`672bcea`。配信ゲームデータとエンジンのSHA-256は更新前と一致。
- ひらめきスープ: Workerバージョン`14f28257-4b70-4868-af4e-e280aeca0910`。ソースコミット`5828633`。変更した公開資産は`index.html`と`sw.js`の2ファイル。

ブラウザでVegeneticaとひらめきスープを1回ずつ自然に読み込み、両方の累計が0から1へ増加することを確認した。確認アクセスは累計に含まれる。Hubの公開11カードは数値を表示し、既存の累計も維持している。新規導入作品は導入後の読み込みを計測し、導入前の閲覧数は含まない。

## itch反映待ち

BIGBLADE KNIGHTはカウンターと`html-classic.itch.zone`オリジンを登録済み。`proto.html`へ計測タグを追加したソースコミットは`12ae63c`。公開ゲーム本体への反映は、itch.ioへのログインとZIP差し替えの確認待ち。

更新用ZIP: `D:/work-godot/bigblade-knight/output/itch/web/bigblade-knight-web-metrics-20261107.zip`。元の48ファイル中`index.html`だけを変更。残り47ファイルは現在のitch公開資産とSHA-256が一致し、元のHTMLもitchが追加するスクリプトを除き一致する。ZIPのSHA-256は`2B10D6179EBF8B85DC9975EA890A1F8F7B4493360C24B8D775B74BD73C545823`。

計測値はゲーム本体HTMLの読み込み回数で、itch.ioの作品紹介ページの閲覧数とは別。未反映時点のカウンターは0で、ZIP反映後から加算される。

## 検証

- Metrics Worker: 14テスト通過（公開作品登録漏れ、各オリジン、別作品IDへの書き込み拒否、既存累計、通信失敗時の処理）。
- Vegenetica: Web配信テスト3件通過。
- ひらめきスープ: 72問とUIのフリガナ検査、Service Workerの構文検査通過。
- Hub: 公開11カードの累計表示をブラウザのDOMで確認。

各アプリの変更は既存ブランチにローカルコミットしている。Hubの集計Workerソースは`origin/main`へpush済み。
