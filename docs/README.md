# リポジトリ共通ドキュメント

このリポジトリ全体に適用される規約。**プロジェクト固有の仕様は各プロジェクトフォルダ直下の `docs/`**（`<project>/docs/spec` `architecture` `adr`）に置く。

設計判断の記録（ADR）は対象範囲で置き場所が分かれる。**リポジトリ全体にまたがる判断はここの `adr/`、プロジェクト固有の判断は `<project>/docs/adr/`。**

## 開発フロー

- [issue-driven 開発](workflow/issue-driven.md) — 作業の始め方と、必須ルールをどう強制しているか
- [コミット・ブランチ規約](workflow/commit-and-branch.md) — 命名形式と具体例
- [ブランチ保護の設定](workflow/branch-protection.md) — GitHub 側の初期設定手順
- [リモート操作のガードレール](workflow/remote-guardrails.md) — AI にリモートを触らせる前の承認の仕組み

## 決定の記録（ADR）

- [0001 Linter と Formatter に ESLint + Prettier を使い続ける](adr/0001-linter-and-formatter.md) — oxlint / oxfmt を評価して見送った理由と、再検討のトリガー
- [0002 i18n のロケールファイルは TypeScript で持つ](adr/0002-i18n-message-format.md) — 未使用キー検出を諦めて型の保証を取った理由

## アーキテクチャ

- [オニオンの層構成](architecture/onion-layers.md) — ディレクトリ構成と依存の向き
- [Pinia の責務境界](architecture/pinia.md) — ストアに書いてよいこと・いけないこと
- [API クライアントと型生成](architecture/api-client.md) — OpenAPI からの生成と腐敗防止層
- [i18n の方針](architecture/i18n.md) — 置き場所と、キーを型で縛る理由
- [TypeScript の書き方の規約](architecture/typescript-conventions.md) — enum 相当の値の定義と、どこまで機械的に強制しているか

## ツール

- [セットアップ](tooling/setup.md) — 初回に動かすもの、改行コードの統一、新規プロジェクトの追加手順
- [ESLint による層の強制](tooling/eslint-boundaries.md) — boundaries の設定と違反例
- [テスト方針](tooling/testing.md) — 層ごとの書き分けとランナー構成
