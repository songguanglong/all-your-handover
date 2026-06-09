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

echo Data directory: %DATA_DIR%
echo Admin URL: http://localhost:%PORT%/admin
echo.

"%NODEEXE%" "%SCRIPTDIR%dist\index.js"

pause
