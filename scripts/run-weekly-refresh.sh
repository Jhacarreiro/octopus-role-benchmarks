#!/usr/bin/env bash
set +e

: > /tmp/octopus-refresh.log
RUN_URL="${RUN_URL:-}"

write_error() {
  local stage="$1"
  node scripts/write-refresh-status.mjs --status error --stage "$stage" --log-file /tmp/octopus-refresh.log --run-url "$RUN_URL"
  node scripts/write-public-weekly-review.mjs
  echo "publish_snapshot=false" >> "$GITHUB_OUTPUT"
}

write_success() {
  local mode="$1"
  local message="${2:-}"
  if [ -n "$message" ]; then
    node scripts/write-refresh-status.mjs --status success --mode "$mode" --message "$message" --run-url "$RUN_URL"
  else
    node scripts/write-refresh-status.mjs --status success --mode "$mode" --run-url "$RUN_URL"
  fi
  node scripts/write-public-weekly-review.mjs
  echo "publish_snapshot=true" >> "$GITHUB_OUTPUT"
}

npm run update 2>&1 | tee -a /tmp/octopus-refresh.log
update_code=${PIPESTATUS[0]}

if [ "$update_code" -ne 0 ]; then
  if grep -q "SciCode estimator validation failed:" /tmp/octopus-refresh.log; then
    echo "::warning::Full refresh blocked by SciCode estimator validation; running narrow lineup-input refresh"

    node scripts/refresh-lineup-inputs.mjs 2>&1 | tee -a /tmp/octopus-refresh.log
    narrow_code=${PIPESTATUS[0]}
    if [ "$narrow_code" -ne 0 ]; then
      write_error "lineup-input-refresh"
      exit "$narrow_code"
    fi

    npm run check:snapshot 2>&1 | tee -a /tmp/octopus-refresh.log
    validate_code=${PIPESTATUS[0]}
    if [ "$validate_code" -ne 0 ]; then
      write_error "lineup-input-validation"
      exit "$validate_code"
    fi

    npm run update-lineups 2>&1 | tee -a /tmp/octopus-refresh.log
    lineup_code=${PIPESTATUS[0]}
    if [ "$lineup_code" -ne 0 ]; then
      write_error "lineup-generation"
      exit "$lineup_code"
    fi

    write_success "lineup-inputs-only" "Full refresh blocked by SciCode estimator validation; refreshed CommandCode Max pricing/allowances, AA Intelligence, CyberBench and portfolios from the last validated benchmark snapshot."
    exit 0
  fi

  write_error "update"
  exit "$update_code"
fi

npm run check:snapshot 2>&1 | tee -a /tmp/octopus-refresh.log
validate_code=${PIPESTATUS[0]}
if [ "$validate_code" -ne 0 ]; then
  write_error "validation"
  exit "$validate_code"
fi

npm run update-lineups 2>&1 | tee -a /tmp/octopus-refresh.log
lineup_code=${PIPESTATUS[0]}
if [ "$lineup_code" -ne 0 ]; then
  write_error "lineup-generation"
  exit "$lineup_code"
fi

write_success "full"
exit 0
