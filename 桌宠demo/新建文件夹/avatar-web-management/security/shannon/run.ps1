<#
.SYNOPSIS
  Run Shannon AI pentest against avatar-web-management.
.DESCRIPTION
  Prerequisites:
    - Docker Desktop running
    - Anthropic API key (set via env var or shannon setup)
    - Next.js dev server running (npm run dev)
    - Dedicated pentest test account exists in the database
  Cost: ~$50 in Anthropic API fees per full scan (1-1.5 hours).
  Output: security/shannon/reports/ (JSON, HTML, PDF)
.PARAMETER Environment
  Target to scan: "local" (default), "staging", or "production".
  WARNING: Never use "production" — Shannon executes real exploits.
.PARAMETER Quick
  Use pipeline-testing mode for a faster, less thorough scan (~20 min).
.PARAMETER Clean
  Stop and remove all Shannon containers after scan completes.
.EXAMPLE
  .\security\shannon\run.ps1                    # Full scan against localhost:3000
  .\security\shannon\run.ps1 -Quick             # Fast pipeline-testing scan
  .\security\shannon\run.ps1 -Environment staging
  .\security\shannon\run.ps1 -Clean             # Scan + cleanup containers after
#>

param(
    [ValidateSet("local", "staging", "production")]
    [string]$Environment = "local",

    [switch]$Quick,

    [switch]$Clean
)

$ErrorActionPreference = "Stop"
$repoRoot = git rev-parse --show-toplevel
Set-Location $repoRoot

# --- Target URL ---
$targetUrls = @{
    local      = "http://localhost:3000"
    staging    = "https://avatar-web-staging.internal"
    production = "https://avatar-web.production.internal"
}
$TargetUrl = $targetUrls[$Environment]

if ($Environment -eq "production") {
    Write-Host "`n  PRODUCTION TARGET — REAL EXPLOITS WILL BE EXECUTED!" -ForegroundColor Red
    Write-Host "  Shannon WILL modify data, create users, and potentially cause damage.`n" -ForegroundColor Red
    $confirm = Read-Host "  Type 'I understand the risks' to continue"
    if ($confirm -ne "I understand the risks") {
        Write-Host "Aborted." -ForegroundColor Yellow
        exit 1
    }
}

# --- Prerequisites check ---
Write-Host "[1/4] Checking prerequisites..." -ForegroundColor Cyan

$dockerRunning = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERROR: Docker is not running. Start Docker Desktop first." -ForegroundColor Red
    exit 1
}
Write-Host "  Docker: running" -ForegroundColor Green

try {
    $null = Invoke-WebRequest -Uri "$TargetUrl/api/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "  Target $TargetUrl: reachable" -ForegroundColor Green
} catch {
    Write-Host "  WARNING: $TargetUrl not reachable — start the app first (npm run dev)" -ForegroundColor Yellow
}

# --- Check Shannon setup ---
Write-Host "[2/4] Checking Shannon setup..." -ForegroundColor Cyan
$shannonHome = "$env:USERPROFILE\.shannon"
if (-not (Test-Path "$shannonHome\config.toml")) {
    Write-Host "  Shannon not configured. Run: npx @keygraph/shannon setup" -ForegroundColor Yellow
    Write-Host "  You'll need an Anthropic API key: https://console.anthropic.com/" -ForegroundColor Yellow
    exit 1
}
Write-Host "  Shannon config: found" -ForegroundColor Green

# --- Output directory ---
$outputDir = "security/shannon/reports"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = "$outputDir/$timestamp"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

# --- Run scan ---
Write-Host "[3/4] Starting Shannon scan..." -ForegroundColor Cyan
Write-Host "  Target:  $TargetUrl" -ForegroundColor White
Write-Host "  Workspace: avatar-web-pentest" -ForegroundColor White
Write-Host "  Output: $outputDir" -ForegroundColor White
Write-Host "  Monitor: http://localhost:8233`n" -ForegroundColor White

$shannonArgs = @(
    "start",
    "--url", $TargetUrl,
    "--repo", $repoRoot,
    "--config", "security/shannon/config.yaml",
    "--workspace", "avatar-web-pentest",
    "--output", $outputDir
)

if ($Quick) {
    $shannonArgs += "--pipeline-testing"
    Write-Host "  Mode: pipeline-testing (fast)" -ForegroundColor Magenta
}

Write-Host "  [Shannon output will stream below]" -ForegroundColor Gray
Write-Host "  " -NoNewline

npx @keygraph/shannon @shannonArgs

# --- Post-scan ---
Write-Host "`n[4/4] Scan complete." -ForegroundColor Cyan
Write-Host "  Reports: $outputDir" -ForegroundColor White
Write-Host "  Live monitor was at: http://localhost:8233" -ForegroundColor White

if ($Clean) {
    Write-Host "  Cleaning up containers..." -ForegroundColor Yellow
    npx @keygraph/shannon stop --clean
}

# Open report (Windows)
$htmlReport = Get-ChildItem -Path $outputDir -Filter "*.html" -Recurse | Select-Object -First 1
if ($htmlReport) {
    Start-Process $htmlReport.FullName
}
