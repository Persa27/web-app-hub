# Cloudflare Pages移行 作業記録

2026-10-19（日本時間）。Hubとカタログ9アプリをCloudflare Pagesへ公開し、旧Vercel URLに移転案内を設置した。

## 公開先

| 対象 | 本番URL | 検証 |
| --- | --- | --- |
| Hub | https://tamalab-hub.pages.dev/ | 9カード、開発中3件、全画像、カテゴリ、390pxで横はみ出しなし |
| 靴下神経衰弱 | https://tamalab-sock-pair.pages.dev/ | Godot起動完了、スマホ幅表示、WASM可逆一致 |
| チモレース | https://tamalab-chimo-race.pages.dev/ | 初回命名、起動、保存と再読み込み |
| ボールレース | https://tamalab-ball-race.pages.dev/ | ボール・ポイント選択、レース開始 |
| モグモン | https://tamalab-mogumon.pages.dev/ | 食事操作、画像、保存と再読み込み |
| AR宝さがし | https://tamalab-indoor-treasure-hunt.pages.dev/ | 起動、HTTPS、CSP・Permissions-Policyほか既存ヘッダーとの一致 |
| 化石発掘 | https://tamalab-kaseki-excavation.pages.dev/ | 標本選択、発掘台表示、共有URLのテスト |
| さんすうマラソン | https://tamalab-math-marathon.pages.dev/ | スタート、レースと問題表示 |
| なまえあてクイズ | https://tamalab-quiz-zukan.pages.dev/ | ジャンル・問題数選択、5問完走、実績保存と再読み込み、全1,023問の画像ファイル存在 |
| SENTINEL | https://tamalab-sentinel-blacklist.pages.dev/ | 監視開始、カメラ画面とゲーム進行 |

全10サイトのトップページはHTTP 200、存在しない資産は404。旧10サイトの案内は正しい新URLと保存データを引き継がない説明を含む。旧Hubのプライバシーポリシーも維持している。

## 実装と判断

- 各リポジトリのcodex/cloudflare-pagesブランチで作業。公開に必要な現行ソース・画像は再ビルド用に保存し、制作物・Android関連・別タスクの文書などの変更は巻き込まない。
- Ruling: 初期計画の「移行用変更のみコミット」を、公開物の再現に必要な現行ファイルのスナップショットまで拡張した。カタログや公開元HTMLが未コミットだったため、設定だけのコミットではclone後に再ビルドできない。元のmainや制作途中のファイルは変更せず、専用ブランチに公開対象だけ保存する。
- Wrangler 4.151.1で初回Pages作成時のWorkers自動誘導を避けるため、初回project createにのみ--forceを使用。更新は通常のpages deploy。
- 全サイトでリポジトリ全体の公開を避け、許可した資産だけを専用の出力フォルダへ作成した。
- チモは未使用のsampled 579件を除外し、.pages-releaseの274件を配信。診断出力・旧生成物は削除コマンドが自動承認レビューで拒否されたため、非公開・Git対象外のまま維持する。
- 靴下のソースはD:/work-godot/sock-pair。Godot 4.7.2の39,514,754バイトのWASMを10,153,810バイトのgzipへ可逆圧縮し、生成ローダーの読み込み1箇所だけをDecompressionStreamへ変更。Pages上で起動完了を確認した。Content-Encodingを手動指定する最初の案はCDNと二重圧縮になったため不採用。ゲーム内ロジックは変更していない。
- 化石の共有URLと結果画像の表記を新URLへ更新。
- ARのvercel.jsonの全ヘッダーをpublic/_headersへ移植。
- SENTINELの旧VercelプロジェクトはrootDirectoryがdeploy/sentinel-blacklistのため、設定を変えず案内側のディレクトリ構造を合わせた。
- 最初の旧案内4件に混ざったCLI実行ログは.vercelignoreを追加して再配信し、旧10サイト全件でログが取得されないことを確認した。
- Git連携のある旧Vercel 8プロジェクトはIgnored Build Stepをexit 0へ設定し、Git pushで旧ゲームが再公開されるのを防いだ。元の設定はURL対応表に記録。
- カットバランスはカタログ外のnoscriptリンクにだけ存在するため、利用者の指定どおり今回の9アプリには追加せず、その旧リンクを維持した。

## 検証と記録

- Hubの公開出力・画像・秘密ファイル排除・パス制約: Nodeテスト2件通過。
- 靴下の圧縮復元一致・公開サイズ・ローダー・必要資産: Nodeテスト1件通過。
- モグモンと化石発掘の既存テスト: 合計56件通過。
- さんすうマラソン: Vitest 22ファイル96件通過。
- Vite4アプリの型チェックとビルド成功。
- 独立した最終レビューでP1/P2指摘なし。
- 新サイトのHTTP確認: cloudflare-http-verification.json。
- 旧サイトの案内・ログ非公開・プライバシーポリシー確認: vercel-notice-verification.json。
- 実際のPagesデプロイID: cloudflare-deployments.json。
- 旧URL・移転先・元のVercelデプロイID・Gitビルド設定: cloudflare-url-mapping.json。

## 更新と復旧

各リポジトリのdocs/CLOUDFLARE.mdを参照。通常はnpm run deploy:pagesで更新する。靴下は先にGodotのWebリリースを書き出す。チモと靴下の出力は.pages-release、他は.pages-dist。

初回はDirect Upload方式。CloudflareへのGit自動デプロイは設定していない。追加時はGitHub Actions等から同じコマンドを呼ぶ。Pages標準Git連携への後からの方式変更はできない。

旧案内を再生成する場合は、Hubでnode scripts/create-migration-notices.mjsを実行する。出力は非公開の.migration-vercel/。再配信ログは各公開ディレクトリの外へ保存する。

旧Vercelへ戻す場合は、URL対応表のpreviousDeploymentIdを対象プロジェクトへ再昇格する。Git連携ビルドも戻す場合は、commandForIgnoringBuildStepをvercelIgnoreBuildCommandBeforeの値（移行前はいずれもnull）へ戻す。旧プロジェクトは削除・解約していない。

## 残る確認・運用上の制約

- 対応Android実機でのARセッションとカメラ動作は未確認。
- ブラウザのスマホ幅で確認したが、全ゲームの実機・Safari・長時間プレイを網羅した検証ではない。
- 新URLでは保存データを最初から開始する。旧URLの保存値には触れていない。
- ソースのGit pushやmainへのマージは行っていない。

最終ブラウザ確認: 旧Hubの案内ボタンから新Hubへ遷移。靴下は390px幅で起動・ドラッグ操作にコンソールエラーなし。クイズは5問全問正解後の金メダル実績がリロード後も保持されることを確認。テスト用ブラウザとローカルHTTPサーバーは終了した。
