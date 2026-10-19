# Cloudflare Pages Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Hubと9アプリをtamalab-で始まるCloudflare Pagesの無料URLへ移行する。

**Architecture:** 各サイトを独立したPagesプロジェクトにする。Viteはdist、静的サイトは許可した公開ファイルだけを専用出力へ収集し、Wrangler Direct Uploadで配信する。Hubは検証済みURLのみへ切り替える。

**Tech Stack:** Cloudflare Pages / Wrangler 4、Node.js、既存のVite・TypeScript・静的HTML。

**Spec:** ../specs/2026-10-19-cloudflare-migration-design.md

## Global Constraints

- 無料ドメインを利用する。
- Hubはtamalab-hub.pages.dev、各アプリはtamalab-<既存のサイト名>.pages.devとする。
- 新URLではゲームを初期状態から開始し、旧URLのlocalStorageやIndexedDBの移行機能は作らない。
- 既存の画面・ゲーム内容・開発中表示は維持する。
- 旧プロジェクトの削除やVercel契約の解約は今回行わない。
- 未コミットの利用者の変更を維持し、移行用変更だけをコミット対象とする。
- 初回は手動Direct Upload。継続デプロイは後続作業として明示する。

## Review Focus

- 公開出力に.envや制作ファイルが混ざるケース：許可したファイル以外を配信しない。
- HTMLの配信場所を変更したケース：相対画像URLと外部ライブラリが正常に読み込める。
- PagesのSPA既定動作：存在しないJSや画像をHTMLの200応答で見逃さない。
- 公開名の衝突・認証失敗：Hubのリンクを未公開URLに変更しない。
- 別アプリの保存領域：各ホストで初期状態から開始し、再読み込みで保存が保持される。

## Task 1: 公開元・アカウントの確定

**Files:** 各リポジトリのAGENTS.md・既存ビルド設定を読む。Hubのdocs/cloudflare-migration-status.mdを作成。

**Interfaces:** サイトID、絶対ソースパス、Pagesプロジェクト名、公開出力ディレクトリを記録し、後続タスクへ渡す。

- [x] `npx wrangler whoami`で認証するアカウントを確認。未認証なら利用者にWrangler OAuthログインを案内し、完了後再実行する。
- [x] `wrangler pages project list`で既存プロジェクトを確認。名前の衝突時は作成・更新を止めて報告する。
- [x] sock-pairのリモートブランチ、既存デプロイの参照元、ローカル候補を調べ、実際のソースを確保する。見つからなければそのアプリを未完了と記録する。
- [x] 各サイトの参照資産・外部依存・エントリーポイントを確認し、公開対象一覧を確定する。

## Task 2: Hubの公開出力を作る

**Files:** Hubにscripts/build-pages.mjs、package.json、wrangler.jsonc、docs/CLOUDFLARE.mdを作成。.gitignoreに公開出力を追加。index.htmlなどの既存動作は変えない。

**Interfaces:** `npm run build:pages`は`.pages-dist/`にindex.html、main.js、style.css、apps.json、privacy-quiz-boost.html、参照画像を作る。Wranglerのpages_build_output_dirは同ディレクトリを指す。

- [x] 公開ページから必要なファイル集合を確認してコピー処理を実装する。出力先はリポジトリ内の固定パスに限定する。
- [x] `npm run build:pages`を実行し、.git、.env、docs、node_modulesが出力されていないことを検証する。
- [x] 出力したHubをローカル配信し、カテゴリ、9カード、全画像、プライバシーページを確認する。
- [x] 対象ファイルだけをコミットする。

## Task 3: アプリのPages配信設定

**Files:** 確定済み各リポジトリにwrangler.jsonc、docs/CLOUDFLARE.mdを作成。必要な静的サイトにはscripts/build-pages.mjsと出力用ignoreを追加。ARアプリはpublic/_headersを追加。

**Interfaces:** 各プロジェクトは`npx wrangler pages deploy <公開出力> --project-name <確定名> --branch main`で更新できる。

- [x] Vite4本（チモ・ボール・AR・さんすう）は既存`npm run build`を実行し、distを配信元に設定する。既存失敗は移行に必要な範囲で原因を調べ、利用者の変更を破壊しない。
- [x] モグモン、クイズ、化石発掘、SENTINEL、所在確定後の靴下は、参照資産を含む許可リストから専用の公開出力を作る。化石発掘はルート表示と相対パスを維持する。
- [x] ARのvercel.jsonにある全ヘッダーを_headersへ移し、配信応答に同じ値が出ることを確認する。
- [x] 全公開出力について単一ファイル25MiB以下、ファイル数20,000以下を検証する。秘密情報や制作ファイルが含まれていないことを確認する。
- [x] 既存の関連テストとローカル起動を確認。存在しない資産のステータス・Content-Typeも確認し、HTML応答で不足ファイルを見逃さない。
- [x] 各リポジトリで移行用の変更だけをコミットする。

## Task 4: アプリ公開とHub切り替え

**Files:** Hubのapps.jsonを変更。docs/cloudflare-migration-status.mdに実URL、デプロイID、検証結果、旧URLを記録。

**Interfaces:** 検証が成功したサイトIDとURLの組だけをHubのカタログ更新へ渡す。

- [x] 認証したアカウントに各Pagesプロジェクトを作成し、公開出力をDirect Uploadする。想定と違う名前が割り当てられたらリンクを書き換えず報告する。
- [x] 各本番URLでHTTP応答、画像・JS・CSS、コンソール、初回プレイ、利用する場合の保存と再読み込みを確認する。AR実機で未確認の範囲は記録する。
- [x] 成功したアプリのURLだけをapps.jsonへ反映する。全9ID、開発中3件の表示、カテゴリが保たれていることを検証する。
- [x] Hubをビルドしてtamalab-hubへ公開し、モバイル幅とPC幅でカードから各アプリを開けることを確認する。
- [x] 確認結果とHub変更をコミットする。未完了サイトがあれば全面移行完了とは報告しない。

## Task 5: 旧URLの案内と引き渡し

**Files:** 対象Vercel設定または移転案内ページ、docs/cloudflare-migration-status.md。

- [x] 動作確認できた旧URLに対し、セーブが引き継がれない旨を含む移転案内を用意する。履歴ドキュメントのURLは書き換えない。
- [x] Vercelへの反映権限と既存公開構成を確認し、対応する旧サイトにのみ反映する。旧プロジェクトは削除しない。
- [x] 旧URLから新URLへ到達できることを確認し、問題時に戻す旧URL・操作方法を記録する。
- [x] 実URL一覧、検証結果、AR実機などの未検証事項、手動更新コマンド、自動デプロイ未設定を報告する。

## 実行上の変更と結果

詳細・Ruling・検証証跡はdocs/cloudflare-migration-status.mdを参照。チモと靴下の公開出力は.pages-release。靴下はD:/work-godot/sock-pairに所在確定し、圧縮WASMを静的配信。公開元が未コミットのサイトは再ビルドに必要な公開ファイルだけを専用ブランチにスナップショット保存した。全10サイトと旧10案内のHTTP検証は成功。AR実機のみ未確認として記録。
