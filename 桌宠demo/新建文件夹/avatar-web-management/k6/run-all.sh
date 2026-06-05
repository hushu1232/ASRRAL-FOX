#!/bin/bash
# k6 load test runner — runs all API load tests sequentially
# Usage:
#   bash k6/run-all.sh [BASE_URL] [TOKEN]
#   bash k6/run-all.sh http://localhost:3000 "$(curl -s ... | jq -r .data.token)"

set -e

BASE_URL="${1:-http://localhost:3000}"
TOKEN="${2:-test-token}"
OUTPUT_DIR="k6/results/$(date +%Y%m%d_%H%M%S)"

mkdir -p "$OUTPUT_DIR"

echo "Running k6 load tests against: $BASE_URL"
echo "Results will be saved to: $OUTPUT_DIR"
echo ""

for test in k6/*-load.js; do
  name=$(basename "$test" .js)
  echo "══════════════ $name ══════════════"

  k6 run "$test" \
    --env BASE_URL="$BASE_URL" \
    --env TOKEN="$TOKEN" \
    --summary-export="$OUTPUT_DIR/${name}-summary.json" \
    --out json="$OUTPUT_DIR/${name}-results.json" \
    2>&1 | tee "$OUTPUT_DIR/${name}-stdout.log"

  echo ""
done

echo "All tests complete. Results: $OUTPUT_DIR"
