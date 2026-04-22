@echo off
chcp 65001 >nul
setlocal

REM -- Determine project root (parent of scripts/) --
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_DIR=%%~fI"

REM -- Load .env.win if it exists --
REM NOTE: bat's for /f with delims== splits at FIRST = only,
REM so values containing = are preserved. However, trailing
REM spaces in values are NOT trimmed. Do NOT put spaces around =.
REM Values with spaces work: set "KEY=value with spaces"
if exist "%PROJECT_DIR%\.env.win" (
  for /f "usebackq tokens=1,* delims==" %%a in ("%PROJECT_DIR%\.env.win") do (
    set "LINE=%%a"
    if not "%%a"=="" (
      setlocal enabledelayedexpansion
      set "FIRST=!LINE:~0,1!"
      if not "!FIRST!"=="#" (
        endlocal & set "%%a=%%b"
      ) else endlocal
    )
  )
)

REM -- Build CLI args from env (quote values that may contain spaces) --
set "APP_ARGS="
if defined PORT set "APP_ARGS=%APP_ARGS% --port %PORT%"
if defined DATA_DIR set "APP_ARGS=%APP_ARGS% --data "%DATA_DIR%""

REM -- Detect exe mode vs node mode --
if exist "%PROJECT_DIR%\dist\all-your-handover-win-x64.exe" (
  "%PROJECT_DIR%\dist\all-your-handover-win-x64.exe"%APP_ARGS%
) else (
  node "%PROJECT_DIR%\dist\index.js"%APP_ARGS%
)

endlocal