# コミット・ブランチ規約

## ブランチ名

```
<type>/<issue番号>-<slug>
```

`<type>` は Conventional Commits と同じ語彙（`feat` `fix` `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` `revert`）。slug は英小文字・数字・ハイフン。

```
feat/42-quiz-scoring
fix/57-answer-validation
chore/61-bump-quasar
```

検証しているのは `scripts/check-branch-name.sh`。`main` は対象外。

## コミットメッセージ

Conventional Commits に **issue 参照のフッターを必須**で追加する。

```
feat(quiz): 採点ロジックを追加

正答率に応じた重み付けを domain 層に実装した。

Refs: #42
```

- **scope は feature 名**にする。`src/features/` 配下のフォルダ名と一致させること。これによりコミット履歴が feature 単位で追える
- 件名は日本語で構わない（`subject-case` は無効化済み）。100 文字まで
- `Refs:` のほか `Closes:` `Fixes:` なども参照として認識される

検証しているのは `commitlint.config.js` の `references-empty` ルール。

## PR

- タイトルは Conventional Commits 形式。**squash merge するとタイトルがコミット件名になる**ため
- 本文に `Closes #<issue番号>` を必ず書く（PR テンプレートに枠がある）
- マージ方法は squash のみ（ブランチ保護で他を禁止）

PR タイトルの検証には `commitlint.title.config.js` を使う。こちらは `references-empty` を課していない。issue との紐づけは本文の `Closes` を GraphQL で確認する方式に分離しているため。

関連: [issue-driven 開発](issue-driven.md)
