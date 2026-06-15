#!/usr/bin/env bash
#
# detect-plan-ready.sh <base-ref> <head-ref>
#
# Prints, one per line, the slug of every scifi feature that
#   (a) had files changed in the range <base-ref>..<head-ref>, AND
#   (b) currently reports lifecycle status "plan-ready".
#
# Used by the CI workflow to decide which newly merged specs are ready for an
# autonomous `sf-implement` run. Requires `scifi` on PATH and `jq`.
#
set -euo pipefail

BASE="${1:?usage: detect-plan-ready.sh <base-ref> <head-ref>}"
HEAD="${2:?usage: detect-plan-ready.sh <base-ref> <head-ref>}"

# Feature dirs live at docs/scifi/specs/<slug>/. Pull the unique slugs whose
# files changed in the merged range.
changed_slugs="$(
  git diff --name-only "$BASE" "$HEAD" -- 'docs/scifi/specs/*' \
    | sed -n 's#^docs/scifi/specs/\([^/]*\)/.*#\1#p' \
    | sort -u
)"

[ -z "$changed_slugs" ] && exit 0

while IFS= read -r slug; do
  [ -z "$slug" ] && continue
  # `scifi status` exits non-zero for unknown slugs (e.g. a dir deleted in the
  # range). The `|| true` keeps `set -e -o pipefail` from killing the loop on it.
  status="$(scifi status "$slug" --json 2>/dev/null | jq -r '.status // empty' || true)"
  if [ "$status" = "plan-ready" ]; then
    printf '%s\n' "$slug"
  fi
done <<< "$changed_slugs"
