#!/usr/bin/env sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
DEPLOY=/data/workspace/whipit-pages
DST="$DEPLOY/benchmark"
[ -d "$DEPLOY/.git" ] || { echo "whipit-pages checkout missing" >&2; exit 2; }
rm -rf "$DST"
mkdir -p "$DST"
cp -a "$ROOT/site/." "$DST/"
cd "$DEPLOY"
git add benchmark
if git diff --cached --quiet; then
  echo "No benchmark page changes"
  exit 0
fi
git commit -m "benchmark: publish static page"
[ -n "${GH_TOKEN:-}" ] || { echo "GH_TOKEN missing; committed locally but not pushed" >&2; exit 2; }
ASKPASS=$(mktemp /tmp/git-askpass-benchmark.XXXXXX)
printf '%s
' '#!/bin/sh' 'case "$1" in' '*Username*) echo x-access-token ;;' '*Password*) printf "%s" "$GH_TOKEN" ;;' '*) echo ;;' 'esac' > "$ASKPASS"
chmod 700 "$ASKPASS"
GIT_ASKPASS="$ASKPASS" GIT_TERMINAL_PROMPT=0 git push origin main
rm -f "$ASKPASS"
