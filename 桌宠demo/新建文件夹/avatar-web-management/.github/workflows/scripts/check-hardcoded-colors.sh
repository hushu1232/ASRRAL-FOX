#!/bin/bash
# Check that TSX files do not contain hardcoded hex/rgba colors.
# Colors must use CSS variables (var(--xxx)).
set -euo pipefail

# Match #xxx or #xxxxxx hex colors in style={{}} or className, but NOT in comments
# and NOT in CSS variable definitions or DESIGN.md
VIOLATIONS=$(grep -rn \
  --include='*.tsx' \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  -E "(style=\{\{.*['\"]#[0-9a-fA-F]{3,8}|className=.*['\"]#[0-9a-fA-F]{3,8})" \
  src/ || true)

if [ -n "$VIOLATIONS" ]; then
  echo "ERROR: Hardcoded colors found in TSX files:"
  echo "$VIOLATIONS"
  echo ""
  echo "Use CSS variables instead: var(--bg-deep), var(--bg-card), var(--accent), etc."
  echo "See DESIGN.md for the full color palette."
  exit 1
fi

echo "✓ No hardcoded colors found in TSX files."
