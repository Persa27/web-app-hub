# 累計ページビュー

Hubの各カードは`GET /api/page-views`の累計値を表示する。`APP_IDS`に登録したIDごとの既存Durable Objectを使い、デプロイ時に数値を初期化しない。

各アプリの公開HTMLに、対応するIDのタグを非同期で読み込む。

```html
<script async src="https://tamalab-metrics.tamalab-hub.workers.dev/client.js?app=APP_ID"></script>
```

HTMLの読み込み1回につき1加算する。Cookie・ユーザーID・個別イベント履歴は保存せず、送信失敗はアプリの起動に影響させない。未導入期間の閲覧数は遡って加算しない。

新しい作品を追加するときは`src/index.js`の`APP_IDS`と`APP_ORIGINS`に登録し、公開HTMLへタグを追加してそのアプリも再デプロイする。Hubだけを更新しても計測は始まらない。`npm run test:metrics`は公開カタログに対する登録漏れと、アプリのオリジン・IDの組み合わせを検査する。

BIGBLADE KNIGHTはitch.io内のゲーム本体（`html-classic.itch.zone`上のHTML）の読み込みを数える。itch.ioの作品紹介ページの閲覧数とは別の値。更新タグを含むゲームZIPの再アップロードが必要になる。

確認はAPIの読み取りと実際のアプリ読み込みで行う。動作確認のために直接POSTして本番の値を加算しない。
