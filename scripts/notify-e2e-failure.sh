#!/usr/bin/env bash
# main の E2E が失敗したことを issue で知らせる。.github/workflows/e2e.yml から呼ぶ。
#
# 同じタイトルの issue が開いていれば、新しく立てずにコメントを足す。直るまでの
# 失敗が1つの issue にまとまり、通知が積み上がらない。
#
# 必要な環境変数: GH_TOKEN, RUN_URL, SHA
set -euo pipefail

title='main の E2E が失敗している'
body="main の E2E が失敗した。

- 実行: ${RUN_URL}
- コミット: ${SHA}

レポートは実行の Artifacts（playwright-report）にある。直したらこの issue を閉じる。"

existing=$(gh issue list --state open --search "\"${title}\" in:title" --json number,title \
  --jq ".[] | select(.title == \"${title}\") | .number" | head -n 1)

if [ -n "$existing" ]; then
  gh issue comment "$existing" --body "$body"
else
  gh issue create --title "$title" --body "$body"
fi
