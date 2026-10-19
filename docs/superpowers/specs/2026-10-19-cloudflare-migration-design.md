# Hub・掲載アプリのCloudflare移行設計

## 目的と確定した条件

Vercelで公開しているtamalabのHubと、apps.jsonに登録された9アプリをCloudflareへ移す。無料ドメインを利用する。新URLではゲームを初期状態から開始し、旧URLのlocalStorageやIndexedDBの移行機能は作らない。既存の画面・ゲーム内容・開発中表示は維持する。

## 公開構成

Cloudflare Workers Static AssetsでHubと9アプリをそれぞれ独立して公開する。静的ファイルを直接配信し、今回の移行のためのAPIやデータベースは追加しない。

URLの形式は `https://<サイト名>.<Cloudflareアカウントのサブドメイン>.workers.dev/` とする。Hubのサイト名は `tama-lab`、アプリは下表の名前を使用する方針とし、実際のアカウント・名前の使用可否を確認してからURLを確定する。未確認のURLをHubへ書き込まない。

選択肢としてPagesの無料ドメインも使えるが、Cloudflareの現行ドキュメントが新規サイトにWorkersを推奨しているためWorkersを選ぶ。1サイト内のサブパスに全アプリを集約する案は、アセットの絶対パスや保存領域の干渉への対応が増えるため採用しない。

## 移行対象と配信元

| サイト名 | ローカルの候補 | 配信方法 |
| --- | --- | --- |
| tama-lab | D:/work/web-app-hub | HTML・CSS・JS・apps.json・公開画像を専用出力先へコピー |
| sock-pair | ソースの所在を追加調査 | ソースと現行デプロイ構成を特定後、公開出力を作成 |
| chimo-race | D:/work/chimo-race | npm run buildで生成するdist |
| ball-race | D:/work/ball-race | npm run buildで生成するdist |
| mogumon | D:/work/mogumon/public | public内の実行に必要なファイル |
| indoor-treasure-hunt | D:/work/indoor-treasure-hunt | npm run buildで生成するdist |
| kaseki-excavation | D:/work/kaseki-excavation | 現行HTMLと参照アセットから専用出力を作成 |
| math-marathon | D:/work/math-marathon | npm run buildで生成するdist |
| quiz-zukan | D:/work/quiz-zukan | 現行ページ・実行JS・CSS・必要なデータと画像を専用出力へコピー |
| sentinel-blacklist | D:/work/sentinel-blacklist/deploy/sentinel-blacklist | 現行公開用index.htmlとその参照アセット |

ソース・現行公開物・ビルド出力の一致を確認してから各サイトを配信する。靴下神経衰弱の所在が解決しない場合、そのアプリの移行は未完了として明示し、既存リンクを維持する。旧サイトを取得してソースの代わりにする判断は行わない。

## 設定と公開ファイル

各リポジトリに再現可能な公開手順とWrangler設定を置く。リポジトリ全体を静的アセットの配信元に指定しない。秘密情報、.env、.git、node_modules、制作素材、テスト、販促動画などを公開出力から除外する。既存の未コミット変更を維持し、移行用の変更だけを区別して扱う。

AR宝さがしのvercel.jsonにあるCSP、Permissions-Policy、その他セキュリティヘッダーをCloudflareの_headersへ移す。化石発掘のルートURLからHTMLへの書き換えは、公開物の配置・相対パスを確認した上で同じ動作を再現する。SPAフォールバックは実際にルーティングを必要とするアプリに限定する。

公開出力に対してファイル数・単一ファイル容量の制限を確認する。一次調査ではHub画像、モグモン、クイズ画像、チモ、さんすうのpublic内に25MiBを超えるファイルは見つかっていない。最終判定はビルド後に全サイトで行う。

## 公開と切り替え

1. Cloudflareの認証と対象アカウント、workers.devのサブドメインを確認する。認証操作が必要ならユーザーへ具体的な手順を案内する。認証情報をドキュメントやリポジトリに保存しない。
2. 各アプリの設定と公開出力を作り、ローカル検証後にCloudflareで公開する。
3. 公開先のHTTP応答とブラウザ動作を確認する。
4. 検証済みアプリの実在するURLだけをapps.jsonなどの有効な参照へ反映する。過去のリリース記録にあるURLは履歴として維持する。
5. 最後にHubを公開し、全カードとカテゴリ表示を確認する。
6. 旧Vercel側の移転案内・リダイレクトは、新URLでの確認完了後に導入する。旧セーブが自動移行されないことを案内する。旧プロジェクトの削除やVercel契約の解約は今回行わない。

デプロイ時点のスナップショットとコマンドを記録し、更新を再実行できるようにする。Git連携による継続デプロイが未設定の場合は、その点を完了報告に明記する。

## 検証・復旧

- Viteアプリはそれぞれ既存のビルドと、その変更に関係する既存テストを実行する。
- 全サイトでトップページ、参照画像・JS・CSSの取得、コンソールエラー、初回プレイの開始を確認する。
- セーブを使うアプリは新URL上で保存と再読み込みを確認する。旧URLの保存値には触れない。
- ARアプリはHTTPSとヘッダーを確認する。対応Android実機でのAR確認ができない場合、その未検証範囲を明記する。
- Hubで全9件のURL・開発中表示・カテゴリ・サムネイルを確認する。
- 失敗したアプリのHubリンクは切り替えない。切り替え後の問題は保存した旧URLへ戻せるようにする。
- 10サイトの公開・検証が揃うまで全面移行完了とは扱わない。

## 参照したCloudflare公式資料

- https://developers.cloudflare.com/pages/
- https://developers.cloudflare.com/workers/static-assets/
- https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- https://developers.cloudflare.com/workers/static-assets/headers/
- https://developers.cloudflare.com/workers/static-assets/redirects/
