@echo off
echo ==============================================
echo   Media Downloader - Windows Launcher
echo ==============================================
echo.

cd /d "%~dp0"

if not exist backend\node_modules (
  echo 📦 Installing dependencies for first-time setup...
  call npm run setup
) else (
  if not exist frontend\node_modules (
    echo 📦 Installing dependencies for first-time setup...
    call npm run setup
  )
)

echo 🚀 Starting backend and frontend...
call npm run dev
pause
