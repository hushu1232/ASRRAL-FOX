#!/usr/bin/env bash
# deploy.sh — Trigger an ArgoCD sync for avatar-web (manual deploy).
#
# Usage:
#   ./scripts/deploy.sh              # sync production
#   ./scripts/deploy.sh staging      # sync staging
#
# Requires: argocd CLI logged in, or ArgoCD API token in ARGOCD_AUTH_TOKEN.

set -euo pipefail

APP="${ARGOCD_APP:-avatar-web}"
SERVER="${ARGOCD_SERVER:-}"
TOKEN="${ARGOCD_AUTH_TOKEN:-}"
NAMESPACE="${1:-production}"

echo "=== Avatar Web Deploy ==="
echo "App:       ${APP}"
echo "Namespace: ${NAMESPACE}"
echo ""

# ── Authenticate ───────────────────────────────────────────────
if [ -n "${TOKEN}" ] && [ -n "${SERVER}" ]; then
  echo "Authenticating to ArgoCD server ${SERVER}..."
  argocd login "${SERVER}" --auth-token "${TOKEN}" --grpc-web
fi

# ── Sync ───────────────────────────────────────────────────────
echo "Triggering ArgoCD sync for ${APP}..."
argocd app sync "${APP}" --prune --timeout 300

# ── Wait ───────────────────────────────────────────────────────
echo "Waiting for app to become healthy..."
argocd app wait "${APP}" --health --timeout 300

# ── Status ─────────────────────────────────────────────────────
echo ""
echo "=== Deploy complete ==="
argocd app get "${APP}" --show-params
