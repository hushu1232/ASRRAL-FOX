# AstralFox — Development Status Check
# Usage: .\scripts\dev-status.ps1

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  AstralFox 星尘狐 — Dev Status" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$root = Split-Path -Parent $PSScriptRoot

# ── Python Backend (BFF) ──────────────────────────────────

Write-Host "[BFF] Python Backend" -ForegroundColor Yellow
$backendDir = Join-Path $root "backend"

try {
    $pyVersion = python --version 2>&1
    Write-Host "  Python:   $pyVersion" -ForegroundColor Green
} catch {
    Write-Host "  Python:   NOT INSTALLED (https://python.org)" -ForegroundColor Red
}

$envFile = Join-Path $backendDir ".env"
if (Test-Path $envFile) {
    Write-Host "  .env:     Present" -ForegroundColor Green
} else {
    Write-Host "  .env:     Missing — copy .env.example → .env" -ForegroundColor Yellow
}

$mainFile = Join-Path $backendDir "main.py"
if (Test-Path $mainFile) {
    Write-Host "  main.py:  Present" -ForegroundColor Green
} else {
    Write-Host "  main.py:  MISSING" -ForegroundColor Red
}

try {
    $reqContent = Get-Content (Join-Path $backendDir "requirements.txt") -ErrorAction Stop
    Write-Host "  deps:     requirements.txt ready" -ForegroundColor Green
} catch {
    Write-Host "  deps:     requirements.txt MISSING" -ForegroundColor Red
}

# ── Next.js Web App ───────────────────────────────────────

Write-Host "`n[WEB] Avatar Web Management" -ForegroundColor Yellow
$webDir = Join-Path $root "avatar-web-management"

if (Test-Path (Join-Path $webDir "node_modules")) {
    $pkg = Get-Content (Join-Path $webDir "package.json") | ConvertFrom-Json
    Write-Host "  Project:  $($pkg.name) v$($pkg.version)" -ForegroundColor Green
    Write-Host "  Next.js:  $($pkg.dependencies.next)" -ForegroundColor Green
} else {
    Write-Host "  node_modules: NOT INSTALLED — run npm install" -ForegroundColor Yellow
}

if (Test-Path (Join-Path $webDir ".next")) {
    Write-Host "  Build:    .next/ present" -ForegroundColor Green
} else {
    Write-Host "  Build:    not yet built — run npm run build" -ForegroundColor Cyan
}

Write-Host "  Tests:    npm test (Jest) — $((Get-ChildItem (Join-Path $webDir 'tests') -Filter *.test.ts).Count) test files found" -ForegroundColor Green

# ── Unity / Tuanjie ───────────────────────────────────────

Write-Host "`n[UNITY] AstralFox" -ForegroundColor Yellow
$unityProj = Join-Path $root "AstralFox"
if (Test-Path $unityProj) {
    Write-Host "  Project:  $(Split-Path $unityProj -Leaf)" -ForegroundColor Green
} else {
    Write-Host "  Project:  MISSING" -ForegroundColor Red
}

# Count model prefabs
$prefabDir = Join-Path $unityProj "Assets\Live2D\Models"
if (Test-Path $prefabDir) {
    $prefabs = Get-ChildItem -Path $prefabDir -Recurse -Filter "*.prefab" -ErrorAction SilentlyContinue
    Write-Host "  Prefabs:  $($prefabs.Count) Live2D model prefabs" -ForegroundColor Green
}

# Count C# scripts
$scriptsDir = Join-Path $unityProj "Assets\Scripts"
if (Test-Path $scriptsDir) {
    $scripts = Get-ChildItem -Path $scriptsDir -Recurse -Filter "*.cs" -ErrorAction SilentlyContinue
    Write-Host "  Scripts:  $($scripts.Count) C# files" -ForegroundColor Green
}

# ── Quick Start Commands ──────────────────────────────────

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Quick Start" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BFF:   cd backend && python main.py" -ForegroundColor White
Write-Host "  Web:   cd avatar-web-management && npm run dev" -ForegroundColor White
Write-Host "  Test:  cd avatar-web-management && npm test" -ForegroundColor White
Write-Host ""
