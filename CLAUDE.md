# quiz-match

複数プロジェクトを含むモノレポ。ルート直下にプロジェクトフォルダを置き、共有コードは `packages/` に置く。

**このファイルは概要とインデックス。詳細は書かず、[docs/](docs/README.md) にリンクする。**

## 絶対に守ること

- **作業は GitHub Issue 起点。** issue のない変更は入れない → [docs/workflow/issue-driven.md](docs/workflow/issue-driven.md)
- **ブランチは `<type>/<issue番号>-<slug>`。** `main` への直 push は禁止
- **コミットは Conventional Commits + フッターに `Refs: #<番号>`。** scope は feature 名
- **domain 層で import してよい外部ライブラリは zod のみ** → [docs/architecture/onion-layers.md](docs/architecture/onion-layers.md)
- **パッケージ操作は bun。** npm / yarn / pnpm は使わない

## スタック

Vue 3 + Quasar（SPA）+ TypeScript / bun / Pinia / zod / vue-i18n / ESLint + Prettier / Vitest + Playwright。
バックエンドは ASP.NET で、OpenAPI から型を自動生成する。

## ディレクトリ

```
.github/          ワークフロー、issue / PR テンプレート
docs/             リポジトリ共通の規約
packages/         共有パッケージ（eslint-config, api-client など）
scripts/          hook と CI から呼ぶシェルスクリプト
<project-name>/   各プロジェクト。ソースはここ。docs/{spec,architecture,adr} を持つ
```

ルート直下にアプリのソースは置かない。

## ドキュメント

| 知りたいこと                          | 参照先                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------ |
| 作業の始め方、issue-driven の強制方法 | [docs/workflow/issue-driven.md](docs/workflow/issue-driven.md)           |
| ブランチ名とコミットメッセージの形式  | [docs/workflow/commit-and-branch.md](docs/workflow/commit-and-branch.md) |
| GitHub 側の初期設定                   | [docs/workflow/branch-protection.md](docs/workflow/branch-protection.md) |
| リモート操作の承認ガードレール        | [docs/workflow/remote-guardrails.md](docs/workflow/remote-guardrails.md) |
| 層構成と依存の向き                    | [docs/architecture/onion-layers.md](docs/architecture/onion-layers.md)   |
| Pinia に何を書いてよいか              | [docs/architecture/pinia.md](docs/architecture/pinia.md)                 |
| API の型生成と腐敗防止層              | [docs/architecture/api-client.md](docs/architecture/api-client.md)       |
| セットアップ、プロジェクト追加手順    | [docs/tooling/setup.md](docs/tooling/setup.md)                           |
| ESLint の層強制、違反時の直し方       | [docs/tooling/eslint-boundaries.md](docs/tooling/eslint-boundaries.md)   |
| テストの書き分け                      | [docs/tooling/testing.md](docs/tooling/testing.md)                       |

プロジェクト固有の仕様は `<project-name>/docs/spec/`、設計判断の記録は `<project-name>/docs/adr/` にある。
