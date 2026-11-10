@echo off
echo ==============================================
echo   Media Downloader - Windows Launcher
echo ==============================================
echo.

if not exist backend\node_modules (
  echo Installing backend dependencies...
  cd backend && call npm install && cd ..
)

if not exist frontend\node_modules (
  echo Installing frontend dependencies...
  cd frontend && call npm install && cd ..
)

echo Starting backend and frontend...
call npm run dev
pause

