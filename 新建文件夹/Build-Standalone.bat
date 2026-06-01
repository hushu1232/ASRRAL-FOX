@echo off
chcp 65001 >nul
echo ============================================
echo   AstralFox 星尘 — Standalone Build
echo ============================================
echo.

set UNITY_PATH=C:\Program Files\Tuanjie\Hub\Editor\2022.3.61t11\Editor\Tuanjie.exe

if not exist "%UNITY_PATH%" (
    echo [ERROR] Cannot find Tuanjie at: %UNITY_PATH%
    pause
    exit /b 1
)

echo Editor: %UNITY_PATH%
echo.

set PROJECT_PATH=%~dp0AstralFox
set BUILD_PATH=%~dp0AstralFox\Build
set BUILD_TARGET=Win64

echo Project: %PROJECT_PATH%
echo Output:  %BUILD_PATH%
echo.

echo Cleaning old build...
if exist "%BUILD_PATH%" rmdir /s /q "%BUILD_PATH%"

mkdir "%BUILD_PATH%"

echo Starting build (this may take several minutes)...
"%UNITY_PATH%" ^
    -quit ^
    -batchmode ^
    -nographics ^
    -projectPath "%PROJECT_PATH%" ^
    -executeMethod AstralFox.Editor.BatchBuild.Build ^
    -logFile "%BUILD_PATH%\build.log"

if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] Build failed. Check log: %BUILD_PATH%\build.log
    type "%BUILD_PATH%\build.log"
    pause
    exit /b 1
)

echo.
echo [OK] Build successful!

REM Copy backend
if exist "%PROJECT_PATH%\..\backend" (
    echo Copying backend files...
    xcopy /e /i /y "%PROJECT_PATH%\..\backend" "%BUILD_PATH%\backend\"
    echo   backend copied.
)

echo.
echo ============================================
echo   Build output: %BUILD_PATH%
echo ============================================
echo.
echo Now creating desktop shortcuts...
powershell -ExecutionPolicy Bypass -File "%~dp0CreateDesktopShortcuts.ps1" -BuildPath "%BUILD_PATH%"
echo.
pause
