@echo off
REM ============================================================
REM  Build tts_server.exe with PyInstaller
REM  for AstralFox offline AI brain
REM ============================================================
REM  Prerequisites:
REM    - Python 3.10+
REM    - pip install sherpa-onnx pyinstaller
REM    - Model: vits-melo-zh from sherpa-onnx releases
REM ============================================================

setlocal enabledelayedexpansion

echo ============================================================
echo   AstralFox — TTS Server Build
echo ============================================================
echo.

REM ── Check Python ────────────────────────────────────────────
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found. Please install Python 3.10+.
    pause
    exit /b 1
)

REM ── Install dependencies ────────────────────────────────────
echo [1/4] Installing Python dependencies...
pip install sherpa-onnx pyinstaller -q
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

REM ── Download model (if not present) ─────────────────────────
echo [2/4] Checking model...
set MODEL_FOUND=0
if exist "models\vits-melo-zh\model.onnx" set MODEL_FOUND=1
if exist "models\vits-zh-aishell3\model.onnx" set MODEL_FOUND=1

if %MODEL_FOUND% EQU 0 (
    echo.
    echo   [WARNING] TTS model not found!
    echo.
    echo   Please download vits-melo-zh from:
    echo     https://github.com/k2-fsa/sherpa-onnx/releases
    echo.
    echo   Extract and place in: models\vits-melo-zh\
    echo   Required files: model.onnx, tokens.txt, lexicon.txt
    echo.
    echo   Build will continue but tts_server.exe will need the model at runtime.
    echo.
)

REM ── Build with PyInstaller ──────────────────────────────────
echo [3/4] Building executable with PyInstaller...
pyinstaller --onefile ^
    --name tts_server ^
    --add-data "models;models" ^
    --hidden-import sherpa_onnx ^
    --collect-all sherpa_onnx ^
    --clean ^
    --noconfirm ^
    tts_server.py

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PyInstaller build failed.
    pause
    exit /b 1
)

REM ── Copy output ─────────────────────────────────────────────
echo [4/4] Copying output files...
copy /Y "dist\tts_server.exe" "." >nul
echo   tts_server.exe copied to StreamingAssets/tts/

echo.
echo ============================================================
echo   Build Complete!
echo   Output: dist\tts_server.exe
echo.
echo   StreamingAssets structure:
echo     StreamingAssets\tts\tts_server.exe      (executable)
echo     StreamingAssets\tts\models\             (TTS model)
echo ============================================================
pause
