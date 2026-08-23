# quiz-match

複数プロジェクトを含むモノレポ。

## セットアップ

```sh
bun install
```

詳細は [docs/tooling/setup.md](docs/tooling/setup.md)。

## 開発の進め方

**すべての変更は GitHub Issue から始める。** ブランチは `<type>/<issue番号>-<slug>`、コミットには `Refs: #<番号>` を付ける。PR 本文に `Closes #<番号>` を書く。

→ [docs/workflow/issue-driven.md](docs/workflow/issue-driven.md)

## 構成

```
.github/          ワークフロー、issue / PR テンプレート
docs/             リポジトリ共通の規約
packages/         共有パッケージ
scripts/          hook と CI から呼ぶスクリプト
<project-name>/   各プロジェクト
```

規約の一覧は [docs/README.md](docs/README.md)。
