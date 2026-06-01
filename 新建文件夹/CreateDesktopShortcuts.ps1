# CreateDesktopShortcuts.ps1
# AstralFox - Desktop shortcut creator
# Run after building the project.

param(
    [string]$BuildPath = "",
    [string]$DesktopPath = [Environment]::GetFolderPath("Desktop")
)

$ErrorActionPreference = "Stop"

if ($BuildPath -eq "") {
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $searchRoots = @(
        "$scriptRoot\AstralFox\Build",
        "$scriptRoot\AstralFox\Builds",
        "$scriptRoot\AstralFox\bin"
    )
    foreach ($root in $searchRoots) {
        if (Test-Path $root) {
            $found = Get-ChildItem -Path $root -Recurse -Filter "AstralFox.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($found) {
                $BuildPath = $found.DirectoryName
                break
            }
        }
    }
}

if ($BuildPath -eq "" -or !(Test-Path "$BuildPath\AstralFox.exe")) {
    Write-Host "ERROR: Cannot find AstralFox.exe." -ForegroundColor Red
    Write-Host "Usage: .\CreateDesktopShortcuts.ps1 -BuildPath 'C:\path\to\build'" -ForegroundColor Yellow
    exit 1
}

$ExePath = "$BuildPath\AstralFox.exe"

Write-Host "Build:   $BuildPath" -ForegroundColor Cyan
Write-Host "Desktop: $DesktopPath" -ForegroundColor Cyan
Write-Host ""

$WshShell = New-Object -ComObject WScript.Shell

# 1. Normal launch
$s1 = $WshShell.CreateShortcut("$DesktopPath\AstralFox.lnk")
$s1.TargetPath = $ExePath
$s1.WorkingDirectory = $BuildPath
$s1.Description = "AstralFox - Desktop AI Pet"
$s1.IconLocation = "$ExePath,0"
$s1.Save()
Write-Host "[OK] AstralFox.lnk" -ForegroundColor Green

# 2. Settings panel
$s2 = $WshShell.CreateShortcut("$DesktopPath\AstralFox Settings.lnk")
$s2.TargetPath = $ExePath
$s2.Arguments = "--settings"
$s2.WorkingDirectory = $BuildPath
$s2.Description = "AstralFox - Settings Panel"
$s2.IconLocation = "$ExePath,0"
$s2.Save()
Write-Host "[OK] AstralFox Settings.lnk" -ForegroundColor Green

# 3. Diagnostic mode (normal window, red overlay test)
$s3 = $WshShell.CreateShortcut("$DesktopPath\AstralFox Diagnose.lnk")
$s3.TargetPath = $ExePath
$s3.Arguments = "--no-transparent --diag"
$s3.WorkingDirectory = $BuildPath
$s3.Description = "AstralFox - Diagnostic Mode (no transparency, debug overlay)"
$s3.IconLocation = "$ExePath,0"
$s3.Save()
Write-Host "[OK] AstralFox Diagnose.lnk" -ForegroundColor Cyan

Write-Host ""
Write-Host "Shortcuts created:"
Write-Host "  1. AstralFox          - Normal mode"
Write-Host "  2. AstralFox Settings  - Opens settings on start"
Write-Host "  3. AstralFox Diagnose  - No transparency + diagnostic log"
Write-Host ""
Write-Host "Hotkeys: Ctrl+Alt+S = Settings | Ctrl+Alt+F = Toggle Fox"
