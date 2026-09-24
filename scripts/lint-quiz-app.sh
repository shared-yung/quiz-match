#!/bin/sh
# lefthook の lint-quiz-app コマンド専用。root: 'quiz-app/' で cwd が quiz-app/ になった状態で呼ばれる。
#
# git commit 経由だとフックには GIT_DIR は渡るが GIT_WORK_TREE は渡らない。
# GIT_WORK_TREE が無いと git は現在の cwd(ここでは quiz-app/)自体を work tree の
# トップと誤認し、後段の git add がリポジトリルート直下に prefix 無しで
# 二重コミットしてしまう(issue #68)。GIT_WORK_TREE を明示してこの誤認を防ぐ。
set -e

bun x eslint --fix "$@"

work_tree=$(cd .. && pwd)
GIT_WORK_TREE="$work_tree" git add "$@"
