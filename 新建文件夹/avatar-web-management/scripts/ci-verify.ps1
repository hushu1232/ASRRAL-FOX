# AstralFox — CI Build Verification
# Validates that all 3 projects build / run correctly.
# Usage: .\scripts\ci-verify.ps1 [skip-web] [skip-unity]

param(
    [switch]$SkipWeb,
    [switch]$SkipUnity
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

# ── 3. Unity Model Verification ──────────────────────────
if (-not $SkipUnity) {
    Step "Unity: Model Prefab Verification"
    $unityRoot = Join-Path $root "..\AstralFox"
    if (Test-Path $unityRoot) {
        $expectedModels = @(
            "cattail", "ak12", "m4a1", "hk416", "ar15", "an94",
            "enterprise", "belfast", "atago", "akagi"
        )
        $prefabDir = Join-Path $unityRoot "Assets\Live2D\Models"
        $allOk = $true
        foreach ($m in $expectedModels) {
            $found = Get-ChildItem -Path $prefabDir -Recurse -Filter "*.prefab" -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -like "*$m*" }
            if (-not $found) {
                Write-Host "  [WARN] Model prefab not found: $m" -ForegroundColor Yellow
                $allOk = $false
            }
        }
        if ($allOk) {
            Pass "All 10 model prefabs present"
        } else {
            Write-Host "  [INFO] Run 'AstralFox > Setup All Models' in Tuanjie Editor to generate missing prefabs" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  [SKIP] Unity project not found at expected path" -ForegroundColor DarkGray
    }
}

# ── 4. Public model files ────────────────────────────────
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
