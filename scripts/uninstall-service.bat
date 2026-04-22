@echo off
chcp 65001 >nul

REM ==============================
REM  All Your Handover - Windows 服务卸载
REM  需要管理员权限运行
REM ==============================

REM -- Check admin privileges --
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo [错误] 此脚本需要管理员权限。
  echo 请右键选择"以管理员身份运行"。
  pause
  exit /b 1
)

REM -- Find NSSM --
set "SCRIPT_DIR=%~dp0"
set "NSSM="
if exist "%SCRIPT_DIR%nssm.exe" (
  set "NSSM=%SCRIPT_DIR%nssm.exe"
) else (
  where nssm.exe >nul 2>&1
  if %errorlevel% equ 0 set "NSSM=nssm.exe"
)
if not defined NSSM (
  echo [错误] 未找到 nssm.exe，无法卸载服务。
  echo 请从 https://nssm.cc/download 下载。
  pause
  exit /b 1
)

set "SERVICE_NAME=AllYourHandover"

REM -- Check if service exists --
"%NSSM%" status %SERVICE_NAME% >nul 2>&1
if %errorlevel% neq 0 (
  echo [信息] 服务 "%SERVICE_NAME%" 未注册，无需卸载。
  pause
  exit /b 0
)

REM -- Stop the service --
echo 正在停止服务...
"%NSSM%" stop %SERVICE_NAME%
timeout /t 3 /nobreak >nul

REM -- Remove the service --
echo 正在移除服务注册...
"%NSSM%" remove %SERVICE_NAME% confirm

echo.
echo ============================================
echo  服务 "AllYourHandover" 已停止并移除
echo ============================================
echo.
echo   数据保留在 data/ 目录中，不会被删除。
echo.
pause