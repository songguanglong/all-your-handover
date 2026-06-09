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
  echo   1. Install Git automatically  ^(recommended^)
  echo   2. Run without Git  ^(file-only mode, no automatic backup^)
  echo.
  set /p choice="Choose (1/2): "
  if "!choice!"=="1" (
    echo [INFO] Downloading Git installer...
    set GIT_URL=https://github.com/git-for-windows/git/releases/download/v2.45.2.windows.1/Git-2.45.2-64-bit.exe
    set GIT_INSTALLER=%TEMP%\Git-64-bit.exe
    powershell -Command "Invoke-WebRequest -Uri '%GIT_URL%' -OutFile '%GIT_INSTALLER%'"
    if not exist "%GIT_INSTALLER%" (
      echo [ERROR] Download failed. Please check your network or visit https://git-scm.com/download/win
      pause
      exit /b 1
    )
    echo [INFO] Installing Git silently, please wait...
    "%GIT_INSTALLER%" /VERYSILENT /NORESTART
    if errorlevel 1 (
      echo [ERROR] Git installation failed. Please install manually from https://git-scm.com/download/win
      del "%GIT_INSTALLER%"
      pause
      exit /b 1
    )
    del "%GIT_INSTALLER%"
    echo [INFO] Git installed successfully. Please restart this program.
    pause
    exit /b 0
  )
)

echo Data directory: %DATA_DIR%
echo Admin URL: http://localhost:%PORT%/admin
echo.

"%NODEEXE%" "%SCRIPTDIR%dist\index.js"

pause
