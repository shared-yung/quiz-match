# issue-driven 開発

**すべての変更は GitHub Issue から始める。** issue のない変更は入れない。例外は最初のコミット（root commit）だけ。

## 手順

1. Issue を立てる（機能追加なら「機能追加・変更」テンプレート、バグなら「バグ報告」）
2. issue 番号を使ってブランチを切る — `feat/42-quiz-scoring`
3. コミットのフッターに `Refs: #42` を書く
4. PR を出し、本文に `Closes #42` を書く
5. CI が通ったら squash merge

## なぜ3層で強制するのか

git hook だけでは `git commit --no-verify` や `git push --no-verify` で迂回できる。ルールを実効的にしているのは CI とブランチ保護の側で、hook は「早く気づくため」の仕組みという位置づけ。

| 層                   | 何を見るか                                                      | 迂回 |
| -------------------- | --------------------------------------------------------------- | ---- |
| lefthook（ローカル） | コミットメッセージ、staged ファイルの lint、push 時のブランチ名 | 可能 |
| GitHub Actions       | 全コミット、ブランチ名、PR タイトル、issue リンクの有無         | 不可 |
| ブランチ保護         | main への直 push 禁止、PR 必須、上記チェックの通過必須          | 不可 |

「コミットメッセージだけ形式を整えて issue を立てない」という抜け道は、`Conventions` ワークフローの **PR に issue がリンクされているか検証** ステップが塞ぐ。これは GraphQL の `closingIssuesReferences` を見ているので、本文に `Closes #<番号>` を書いて実際に issue と紐づいていないと通らない。

## 最初のコミットの例外

`scripts/commit-msg.sh` が `git rev-parse -q --verify HEAD` で親コミットの有無を判定し、root commit なら commitlint を実行しない。

CI 側は PR の base..head 範囲しか検証しないため、root commit がチェック対象に入ることはない。初回コミットは main に直接置き、その後 `scripts/setup-branch-protection.sh` を実行してブランチ保護を有効化する。

関連: [コミット・ブランチ規約](commit-and-branch.md) / [ブランチ保護の設定](branch-protection.md)
