@echo off
chcp 65001 >nul
title هومينا — إيقاف الخادم
rem ==== يوقف خادم هومينا ويفكّ قفل ملف homina.db ====
rem استخدمه قبل نقل أو ضغط ملف قاعدة البيانات يدويًا

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "C:\Users\WDAGUtilityAccount\nodejs\node.exe" set "NODE_EXE=C:\Users\WDAGUtilityAccount\nodejs\node.exe"
if not defined NODE_EXE (
  echo [!] Node.js غير موجود.
  pause
  exit /b 1
)

cd /d "%~dp0"
%NODE_EXE% tools/stop-server.js
pause
