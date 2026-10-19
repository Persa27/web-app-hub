# Cloudflare移行の作業記録

Plan: docs/superpowers/plans/2026-10-19-cloudflare-migration.md

## 方針・進捗

- 2026-10-19: 現在のファイルを維持するため専用ブランチcodex/cloudflare-pagesで作業。元の未コミット変更は維持する。
- Cloudflare: Wrangler 4.151.1は未認証。利用者へOAuthログインを依頼済み。公開名の空き確認とデプロイは認証後。
- sock-pair: Persa27/sock-pairのmainにはREADME.mdだけ。ソースを追加調査中。
- Ruling: Task 1の認証待ちでも、独立したローカルの公開出力準備・検証を続ける。未確認URLには切り替えない。
- Ruling: Hubのnoscript内にone-cut-balanceへの旧リンクがある。カタログ9件には含まれないため現段階では維持し、移行対象を利用者へ確認する。
- Pre-flight: Task 2/3の公開出力をTask 4が消費する。固定した公開ディレクトリとプロジェクト名を共有する。Task 5はTask 4の本番確認成功が前提。

## 公開予定

| サイト | Pagesプロジェクト | 状態 |
| --- | --- | --- |
| Hub | tamalab-hub | 公開出力を準備中 |
| 靴下神経衰弱 | tamalab-sock-pair | ソース調査中 |
| チモレース | tamalab-chimo-race | 準備中 |
| ボールレース | tamalab-ball-race | 準備中 |
| モグモン | tamalab-mogumon | 準備中 |
| AR宝さがし | tamalab-indoor-treasure-hunt | 準備中 |
| 化石発掘 | tamalab-kaseki-excavation | 準備中 |
| さんすうマラソン | tamalab-math-marathon | 準備中 |
| なまえあてクイズ | tamalab-quiz-zukan | 準備中 |
| SENTINEL | tamalab-sentinel-blacklist | 準備中 |

## 検証記録

- Hub公開出力のテストを実装前に実行し、ビルドスクリプト未実装により失敗することを確認。
- 旧サイトの削除・解約・リンク切り替えは未実施。
- チモレースのpublic/sampled（579ファイル）は実行コードから参照されない制作素材のため、次回公開出力から除外する。初回出力には含まれていたため、除外後に再配信する。
