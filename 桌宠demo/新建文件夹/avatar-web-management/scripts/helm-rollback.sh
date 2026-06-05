#!/usr/bin/env bash
# helm-rollback.sh — Rollback avatar-web to a previous Helm release revision.
#
# Usage:
#   ./scripts/helm-rollback.sh [REVISION]
#     REVISION — Helm revision number (default: previous revision, 0)
#
#   ./scripts/helm-rollback.sh            # rollback to previous revision
#   ./scripts/helm-rollback.sh 5          # rollback to revision 5
#
# Requires: helm, kubectl, and access to the cluster + namespace.

set -euo pipefail

RELEASE="${RELEASE_NAME:-avatar-web}"
NAMESPACE="${NAMESPACE:-production}"
REVISION="${1:-0}"

echo "=== Avatar Web Helm Rollback ==="
echo "Release:   ${RELEASE}"
echo "Namespace: ${NAMESPACE}"
echo "Revision:  ${REVISION} (0 = previous)"
echo ""

# ── Show release history ──────────────────────────────────────
echo "--- Release history (last 10) ---"
helm history "${RELEASE}" -n "${NAMESPACE}" --max 10

# ── Confirm ────────────────────────────────────────────────────
if [ "${REVISION}" = "0" ]; then
  echo ""
  echo "Rolling back to PREVIOUS revision of ${RELEASE} in ${NAMESPACE}..."
else
  echo ""
  echo "Rolling back to revision ${REVISION} of ${RELEASE} in ${NAMESPACE}..."
fi

read -p "Proceed? [y/N] " -n 1 -r
echo
if [[ ! "${REPLY}" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

# ── Execute rollback ───────────────────────────────────────────
helm rollback "${RELEASE}" "${REVISION}" -n "${NAMESPACE}" --wait --timeout 5m

# ── Verify rollout ─────────────────────────────────────────────
echo ""
echo "Waiting for rollout to complete..."
kubectl rollout status "deployment/${RELEASE}" -n "${NAMESPACE}" --timeout=5m

echo ""
echo "=== Rollback complete ==="
helm history "${RELEASE}" -n "${NAMESPACE}" --max 3
