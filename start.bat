@echo off
setlocal

REM 设置数据目录为程序同级目录下的 data 文件夹
set DATA_DIR=%~dp0data
set PORT=3000

REM 启动服务
echo 正在启动 All Your Handover...
echo 数据目录: %DATA_DIR%
echo 访问地址: http://localhost:%PORT%/admin

"%~dp0node.exe" "%~dp0dist\index.js"

pause
