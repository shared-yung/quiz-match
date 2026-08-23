# リポジトリ共通ドキュメント

このリポジトリ全体に適用される規約。**プロジェクト固有の仕様は各プロジェクトフォルダ直下の `docs/`**（`<project>/docs/spec` `architecture` `adr`）に置く。

## 開発フロー

- [issue-driven 開発](workflow/issue-driven.md) — 作業の始め方と、必須ルールをどう強制しているか
- [コミット・ブランチ規約](workflow/commit-and-branch.md) — 命名形式と具体例
- [ブランチ保護の設定](workflow/branch-protection.md) — GitHub 側の初期設定手順

## アーキテクチャ

- [オニオンの層構成](architecture/onion-layers.md) — ディレクトリ構成と依存の向き
- [Pinia の責務境界](architecture/pinia.md) — ストアに書いてよいこと・いけないこと
- [API クライアントと型生成](architecture/api-client.md) — OpenAPI からの生成と腐敗防止層

## ツール

- [セットアップ](tooling/setup.md) — 初回に動かすもの、改行コードの統一、新規プロジェクトの追加手順
- [ESLint による層の強制](tooling/eslint-boundaries.md) — boundaries の設定と違反例
- [テスト方針](tooling/testing.md) — 層ごとの書き分けとランナー構成
