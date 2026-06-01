@echo off
chcp 65001 >nul
title AstralFox 星尘 — Launcher

echo ============================================
echo   AstralFox 星尘 — Desktop AI Pet
echo ============================================

cd /d "%~dp0"

REM ── Start Python backend ────────────────────────────
echo.
echo [1/2] Starting Python backend...
if exist "backend\main.py" (
    start "AstralFox-Backend" /min cmd /c "cd /d backend && python main.py"
    echo   Backend started (minimized).
) else (
    echo   [WARN] backend/ not found, skipping.
)

REM Wait for backend
timeout /t 2 /nobreak >nul

REM ── Start AstralFox ──────────────────────────────────
echo [2/2] Starting AstralFox...
if exist "AstralFox\Build\AstralFox.exe" (
    start "AstralFox" /min "AstralFox\Build\AstralFox.exe" %*
    echo   AstralFox started.
) else if exist "AstralFox\AstralFox.exe" (
    start "AstralFox" /min "AstralFox\AstralFox.exe" %*
    echo   AstralFox started.
) else (
    echo   [WARN] AstralFox.exe not found. Build the project first.
    echo   Run: Build-Standalone.bat
)

echo.
echo ============================================
echo   AstralFox is running!
echo   Ctrl+Alt+S = Open settings
echo   Ctrl+Alt+F = Show/hide pet
echo   System tray icon is in the taskbar.
echo ============================================
