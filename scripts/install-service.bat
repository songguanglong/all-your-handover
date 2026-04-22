@echo off
chcp 65001 >nul

REM ==============================
REM  All Your Handover - Windows 服务安装
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

REM -- Determine project root --
set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "PROJECT_DIR=%%~fI"

REM -- Find NSSM --
set "NSSM="
if exist "%SCRIPT_DIR%nssm.exe" (
  set "NSSM=%SCRIPT_DIR%nssm.exe"
) else (
  where nssm.exe >nul 2>&1
  if %errorlevel% equ 0 set "NSSM=nssm.exe"
)
if not defined NSSM (
  echo [错误] 未找到 nssm.exe。
  echo 请从 https://nssm.cc/download 下载，放入: %SCRIPT_DIR%
  echo 或将 nssm.exe 所在目录加入系统 PATH。
  pause
  exit /b 1
)

REM -- Verify app is built --
if not exist "%PROJECT_DIR%\dist\index.js" (
  if not exist "%PROJECT_DIR%\dist\all-your-handover-win-x64.exe" (
    echo [错误] 应用未构建。请先运行:
    echo   cd %PROJECT_DIR%
    echo   npm install
    echo   npm run build
    pause
    exit /b 1
  )
)

REM -- Create .env.win template if not exists --
if not exist "%PROJECT_DIR%\.env.win" (
  (
    echo # All Your Handover - Windows 服务环境配置
    echo # 修改后需重启服务: nssm restart AllYourHandover
    echo.
    echo PORT=3000
    echo DATA_DIR=./data
    echo # ENCRYPTION_KEY=
    echo # ADMIN_TOKEN=
  ) > "%PROJECT_DIR%\.env.win"
  echo [信息] 已创建 .env.win 配置模板，请根据需要修改。
  echo [重要] 生产环境请设置 ADMIN_TOKEN，否则管理后台无认证保护。
  echo.
)

REM -- Check ADMIN_TOKEN --
findstr /r "^ADMIN_TOKEN=..*" "%PROJECT_DIR%\.env.win" >nul 2>&1
if %errorlevel% neq 0 (
  echo [警告] ADMIN_TOKEN 未设置，管理后台接口无认证保护！
  echo 生产环境请编辑 .env.win 设置 ADMIN_TOKEN。
  echo.
  set /p "CONTINUE=是否继续安装? (y/N): "
  if /i not "%CONTINUE%"=="y" exit /b 0
  echo.
)

REM -- Register service --
set "SERVICE_NAME=AllYourHandover"
"%NSSM%" install %SERVICE_NAME% "%SCRIPT_DIR%run-with-env.bat"
if %errorlevel% neq 0 (
  echo [错误] 服务注册失败。可能已注册，先运行 uninstall-service.bat 卸载。
  pause
  exit /b 1
)

REM -- Configure service --
"%NSSM%" set %SERVICE_NAME% AppDirectory "%PROJECT_DIR%"
"%NSSM%" set %SERVICE_NAME% DisplayName "All Your Handover"
"%NSSM%" set %SERVICE_NAME% Description "交接班助手 - 轻量级本地部署"
"%NSSM%" set %SERVICE_NAME% Start SERVICE_AUTO_START
"%NSSM%" set %SERVICE_NAME% AppStdout "%PROJECT_DIR%\data\logs\service-stdout.log"
"%NSSM%" set %SERVICE_NAME% AppStderr "%PROJECT_DIR%\data\logs\service-stderr.log"
"%NSSM%" set %SERVICE_NAME% AppRotateFiles 1
"%NSSM%" set %SERVICE_NAME% AppRotateBytes 10485760

REM -- Ensure log directory exists --
if not exist "%PROJECT_DIR%\data\logs" mkdir "%PROJECT_DIR%\data\logs"

REM -- Start the service --
"%NSSM%" start %SERVICE_NAME%

echo.
echo ============================================
echo  服务 "AllYourHandover" 已注册并启动
echo ============================================
echo.
echo   自动启动: 已启用
echo   崩溃重启: 已启用 (NSSM 自动重启)
echo   应用日志: %PROJECT_DIR%\data\logs\app.log
echo   控制台日志: %PROJECT_DIR%\data\logs\service-stdout.log
echo   错误日志: %PROJECT_DIR%\data\logs\service-stderr.log
echo.
echo   管理命令:
echo     nssm start AllYourHandover     启动
echo     nssm stop AllYourHandover      停止
echo     nssm restart AllYourHandover   重启
echo     nssm status AllYourHandover    查看状态
echo     nssm edit AllYourHandover      编辑配置(GUI)
echo.
echo   修改配置后: notepad .env.win ^&^& nssm restart AllYourHandover
echo.
pause