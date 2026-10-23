@echo off
chcp 65001 >nul
title Homina — النشر على الإنترنت

rem ==== استخدم Node المحمول إن لم يكن في المسار ====
set "NODE=node"
where node >nul 2>&1 || set "NODE=C:\Users\WDAGUtilityAccount\nodejs\node.exe"

cd /d "%~dp0"

rem ==== 1) إن كان الخادم يعمل لا نكرر التشغيل ====
netstat -ano | findstr /R ":4751 .*LISTENING" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo [1/3] تشغيل خادم هومينا المحلي...
  start "Homina Server" /min cmd /c "%NODE% server/index.js"
  timeout /t 4 /nobreak >nul
) else (
  echo [1/3] الخادم يعمل بالفعل.
)

rem ==== 2) فتح نفق إنترنت مجاني (عنوان مؤقت يتغير كل تشغيل) ====
echo [2/3] فتح النفق... انتظر ظهور رابط https marked trycloudflare.com أدناه ثم شاركه مع السكان.
echo.
tools\bin\cloudflared.exe tunnel --url http://localhost:4751 --no-autoupdate

pause
