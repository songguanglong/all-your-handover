@echo off
setlocal enabledelayedexpansion

chcp 65001 >nul

echo [All Your Handover] Starting...

set SCRIPTDIR=%~dp0
set NODEEXE=%SCRIPTDIR%node.exe
set DATA_DIR=%SCRIPTDIR%data
set PORT=3000

if not exist "%NODEEXE%" (
  echo [ERROR] node.exe not found in %SCRIPTDIR%
  echo Please make sure node.exe is in the same folder as this script.
  pause
  exit /b 1
)

if not exist "%DATA_DIR%" (
  echo [INFO] Creating data directory: %DATA_DIR%
  mkdir "%DATA_DIR%"
)

git --version >nul 2>&1
if errorlevel 1 (
  echo.
  echo [WARNING] Git not found on this system.
  echo   Git is used for automatic data backup. Installing it is recommended.
  echo.
  echo   1. Download and install Git  ^(opens browser^)
  echo   2. Run without Git  ^(file-only mode, no automatic backup^)
  echo.
  set /p choice="Choose (1/2): "
  if "!choice!"=="1" (
    start https://git-scm.com/download/win
    echo.
    echo Please install Git and then re-run this program.
    pause
    exit /b 1
  )
  set NO_GIT=1
)

echo Data directory: %DATA_DIR%
echo Admin URL: http://localhost:%PORT%/admin
echo.

"%NODEEXE%" "%SCRIPTDIR%dist\index.js"

pause
