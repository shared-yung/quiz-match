#!/bin/sh
# main ブランチの保護ルールセットを作成する。
# GitHub にリポジトリを作成し、remote を設定したあとで一度だけ実行する。
#
#   sh scripts/setup-branch-protection.sh [owner/repo]
#
# ローカルの git hook は --no-verify で迂回できるため、
# issue-driven を実際に必須にしているのはこの設定。
set -e

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
echo "対象リポジトリ: $REPO"

gh api --method POST "repos/$REPO/rulesets" --input - <<'JSON'
{
  "name": "main protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["squash"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "check" },
          { "context": "conventions" }
        ]
      }
    }
  ]
}
JSON

echo "完了しました。main への直 push は禁止され、PR と CI の通過が必須になります。"
