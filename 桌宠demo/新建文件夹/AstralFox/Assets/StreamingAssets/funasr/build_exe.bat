@echo off
REM ============================================================
REM  Build funasr_server.exe with PyInstaller
REM  for AstralFox offline AI brain
REM ============================================================
REM  Prerequisites:
REM    - Python 3.10+
REM    - pip install funasr soundfile numpy scipy pyinstaller
REM    - Model: paraformer-large from modelscope
REM ============================================================

setlocal enabledelayedexpansion

echo ============================================================
echo   AstralFox — FunASR Server Build
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
pip install funasr soundfile numpy scipy pyinstaller modelscope -q
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

REM ── Download model (if not present) ─────────────────────────
echo [2/4] Checking model...
if not exist "models\paraformer-large" (
    if not exist "models\paraformer-large-local" (
        echo   Downloading paraformer-large model from ModelScope...
        python -c "from modelscope import snapshot_download; snapshot_download('iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch', cache_dir='models')"
        if %ERRORLEVEL% NEQ 0 (
            echo   [WARNING] Auto-download failed. Model will download on first run.
            echo   You can manually download from: https://modelscope.cn/models/iic/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-pytorch
        )
    )
) else (
    echo   Model found: models\paraformer-large
)

REM ── Build with PyInstaller ──────────────────────────────────
echo [3/4] Building executable with PyInstaller...
pyinstaller --onefile ^
    --name funasr_server ^
    --add-data "models;models" ^
    --hidden-import funasr ^
    --hidden-import funasr.models ^
    --hidden-import funasr.utils ^
    --hidden-import soundfile ^
    --hidden-import numpy ^
    --hidden-import scipy ^
    --hidden-import scipy.signal ^
    --collect-all funasr ^
    --clean ^
    --noconfirm ^
    funasr_server.py

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PyInstaller build failed.
    pause
    exit /b 1
)

REM ── Copy output ─────────────────────────────────────────────
echo [4/4] Copying output files...
if not exist "..\..\" mkdir "..\..\"

REM Copy exe to StreamingAssets/funasr/
copy /Y "dist\funasr_server.exe" "." >nul
echo   funasr_server.exe copied to StreamingAssets/funasr/

REM Copy model (if bundled separately)
if exist "models" (
    if not exist "..\..\models" (
        echo   Copying models folder...
        xcopy /E /I /Y "models" "models_backup" >nul
    )
)

echo.
echo ============================================================
echo   Build Complete!
echo   Output: dist\funasr_server.exe
echo.
echo   StreamingAssets structure:
echo     StreamingAssets\funasr\funasr_server.exe   (executable)
echo     StreamingAssets\funasr\models\             (ASR model)
echo ============================================================
pause
