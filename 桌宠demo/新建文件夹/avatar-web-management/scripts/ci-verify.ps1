# AstralFox — CI Build Verification
# Validates that the active Web project builds / runs correctly.
# Usage: .\scripts\ci-verify.ps1 [skip-web]

param(
    [switch]$SkipWeb
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$failed = 0
$total = 0

function Pass($msg) { Write-Host "  [PASS] $msg" -ForegroundColor Green }
function Fail($msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $global:failed++ }
function Step($msg) { Write-Host "`n--- $msg ---" -ForegroundColor Yellow; $global:total++ }

Push-Location $root

# ── 1. Next.js TypeScript Compilation ─────────────────────
if (-not $SkipWeb) {
    Step "Next.js: TypeScript Compilation"
    $tsOutput = npx tsc --noEmit --pretty 2>&1
    if ($LASTEXITCODE -eq 0) {
        Pass "TypeScript compiles without errors"
    } else {
        Fail "TypeScript errors found:`n$tsOutput"
    }

    # ── 2. Next.js Build ─────────────────────────────────
    Step "Next.js: Production Build"
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -eq 0) {
        Pass "next build succeeded"
    } else {
        Fail "Build failed (may need .env.local setup or dependencies)"
    }
}

# ── 3. Public model files ────────────────────────────────
Step "Next.js: Static Model Files"
$modelsDir = Join-Path $root "public\models"
if (Test-Path $modelsDir) {
    $glbs = Get-ChildItem -Path $modelsDir -Filter "*.glb" -ErrorAction SilentlyContinue
    if ($glbs.Count -ge 2) {
        Pass "Base model GLBs present ($($glbs.Count) files)"
    } else {
        Write-Host "  [INFO] Run 'node scripts/generate-models.mjs' to generate base models" -ForegroundColor Cyan
    }
} else {
    Write-Host "  [INFO] public/models/ not created yet — run generate-models script" -ForegroundColor Cyan
}

Pop-Location

# ── Summary ──────────────────────────────────────────────
Write-Host "`n========================================" -ForegroundColor Cyan
if ($failed -eq 0) {
    Write-Host "  ALL CHECKS PASSED" -ForegroundColor Green
} else {
    Write-Host "  $failed FAILURE(S) out of $total checks" -ForegroundColor Red
}
Write-Host "========================================" -ForegroundColor Cyan
exit $failed
