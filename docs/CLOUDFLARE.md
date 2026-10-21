# Cloudflare Pagesで公開する

## 初回

1. Node.js 22以降を利用する。
2. `npx wrangler@4.151.1 login` で対象Cloudflareアカウントにログインする。
3. `npx wrangler@4.151.1 whoami` と `npx wrangler@4.151.1 pages project list` で対象を確認する。
4. 未作成の場合のみ `npx wrangler@4.151.1 pages project create hub --production-branch main --force` を実行する。新規作成時だけ `--force` を付ける。
5. `npm run test:pages` を実行する。
6. `npm run deploy:pages` を実行する。

公開URL: https://tamalab.hub-6r8.pages.dev/

## 公開範囲と更新

`pages-assets.json`に列挙したファイルだけを`.pages-dist/`へ集める。リポジトリ直下をアップロードしない。画像追加時はカタログの参照先を確認し、`npm run test:pages`で不足を検出する。

更新も`npm run deploy:pages`で行う。デプロイブランチは`tamalab`で、Cloudflare Pagesのブランチ別名 `tamalab.hub-6r8.pages.dev` を更新する。希望した`hub.pages.dev`はすでに他アカウントで使用されていたため、Cloudflareが割り当てた`hub-6r8`を使用する。Pagesのプロジェクト名は小文字英数字とハイフンのみのため、`tamalab.<project>.pages.dev` は`tamalab`ブランチ別名として公開する。ブランチ別名はプレビュー扱いで、`X-Robots-Tag: noindex` が付くが、公開URLとして閲覧できる。

今回はDirect Upload方式。Pages標準Git連携への後からの切り替えはできないため、自動更新が必要な場合はGitHub Actionsなどから同じデプロイ手順を呼ぶ。認証トークンをリポジトリに保存しない。

旧Vercelサイトは新URLの検証が済むまで維持する。新URLではゲームの保存データは最初からになり、旧URLの保存値は引き継がない。

移行の結果・全アプリのURL・復旧情報はcloudflare-migration-status.mdとcloudflare-url-mapping.jsonに記録している。旧Vercelには移転案内を設置済み。Git連携のある旧プロジェクトはIgnored Build Stepをexit 0へ設定し、Git pushによる再公開を止めている。

旧サイトへ戻す場合のコマンドは `npx vercel@64.5.0 promote <previousDeploymentId> --scope tamas-projects-ba7ff5ed`。IDはcloudflare-url-mapping.jsonで対象サイトと照合する。Gitビルドを再開する場合はVercelのBuild and Deployment設定でIgnored Build Stepを移行前のAutomaticへ戻す。

Wrangler 4.151.1では新規Pages作成時のWorkersへの自動誘導を避けるため、初回のproject createにのみ--forceを付けます。既存Pagesへの更新には不要です。
