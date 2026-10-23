@echo off
chcp 65001 >nul
title هومينا — نسخة احتياطية الآن
rem ==== نسخة احتياطية متسقة تعمل حتى وأثناء تشغيل الخادم ====
rem النسخ تُحفظ في مجلد "هومينا-نسخ-احتياطية" على سطح المكتب

set "NODE_EXE="
where node >nul 2>nul && set "NODE_EXE=node"
if not defined NODE_EXE if exist "C:\Users\WDAGUtilityAccount\nodejs\node.exe" set "NODE_EXE=C:\Users\WDAGUtilityAccount\nodejs\node.exe"
if not defined NODE_EXE (
  echo [!] Node.js غير موجود. ثبّت Node.js 22+ أو استخدم زر "تنزيل نسخة احتياطية" من داخل التطبيق.
  pause
  exit /b 1
)

cd /d "%~dp0"
%NODE_EXE% tools/backup.js
pause
