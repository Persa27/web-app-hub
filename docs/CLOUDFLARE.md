# Cloudflare Pagesで公開する

## 初回

1. Node.js 22以降を利用する。
2. `npx wrangler@4.151.1 login` で対象Cloudflareアカウントにログインする。
3. `npx wrangler@4.151.1 whoami` と `npx wrangler@4.151.1 pages project list` で対象を確認する。
4. 未作成の場合のみ `npx wrangler@4.151.1 pages project create tamalab-hub --production-branch main --force` を実行する。名前が利用できなければ先にURL方針を見直す。
5. `npm run test:pages` を実行する。
6. `npm run deploy:pages` を実行する。

公開予定URL: https://tamalab-hub.pages.dev/ （作成・検証前のため未確定）

## 公開範囲と更新

`pages-assets.json`に列挙したファイルだけを`.pages-dist/`へ集める。リポジトリ直下をアップロードしない。画像追加時はカタログの参照先を確認し、`npm run test:pages`で不足を検出する。

更新も`npm run deploy:pages`で行う。ブランチ名がcodex/...でも`--branch main`でPagesの本番へ配信する。既存Pagesプロジェクトのproduction_branchがmainであることを事前に確認する。

今回はDirect Upload方式。Pages標準Git連携への後からの切り替えはできないため、自動更新が必要な場合はGitHub Actionsなどから同じデプロイ手順を呼ぶ。認証トークンをリポジトリに保存しない。

旧Vercelサイトは新URLの検証が済むまで維持する。新URLではゲームの保存データは最初からになり、旧URLの保存値は引き継がない。

Wrangler 4.151.1では新規Pages作成時のWorkersへの自動誘導を避けるため、初回のproject createにのみ--forceを付けます。既存Pagesへの更新には不要です。
