@echo off
chcp 65001 >nul
title Homina Server - http://localhost:4751
rem ==== تشغيل خادم هومينا (وضع الويب) ====
where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js غير مثبت أو غير موجود في PATH.
  echo     شغّل النسخة المحمولة dist\Homina-Portable-1.0.0.exe بدلاً من هذا الملف،
  echo     أو ثبّت Node.js 22+ من https://nodejs.org
  pause
  exit /b 1
)
cd /d "%~dp0"
if not exist node_modules (
  echo جارٍ تنزيل التبعيات لأول مرة...
  call npm.cmd install --no-audit --no-fund
)
node server/index.js --open
pause
