#!/usr/bin/env bash
# Delete local branches already merged into main (keeps main + current branch).
set -euo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "not a git repository" >&2
  exit 1
}
cd "$root"

git fetch origin main --prune

base="main"
if ! git show-ref --verify --quiet "refs/heads/${base}"; then
  echo "local branch '${base}' missing — run: git checkout main && git pull" >&2
  exit 1
fi

git checkout "${base}" >/dev/null
git merge --ff-only "origin/${base}" >/dev/null

current="$(git branch --show-current)"
deleted=0

while IFS= read -r branch; do
  [[ -z "${branch}" ]] && continue
  [[ "${branch}" == "${base}" ]] && continue
  [[ "${branch}" == "${current}" ]] && continue
  if git branch -d "${branch}"; then
    deleted=$((deleted + 1))
  fi
done < <(git branch --merged "${base}" | sed 's/^[* ]*//')

echo "pruned ${deleted} local branch(es) merged into ${base}"
