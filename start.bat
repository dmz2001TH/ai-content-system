@echo off
title AI Content System
echo.
echo  ========================================
echo   AI Content System - Starting...
echo  ========================================
echo.

cd /d "%~dp0"

set DATABASE_URL=file:./dev.db
set OPENAI_API_KEY=sk-09accf634aa9439c8323c04bf495a9e7
set OPENAI_BASE_URL=https://api.deepseek.com/v1
set OPENAI_MODEL=deepseek-chat
set API_PORT=3001
set WEB_PORT=3000

echo  [OK] Starting API + Worker + Web...
echo  [OK] Open browser: http://localhost:3000
echo  [OK] Press Ctrl+C to stop
echo.

npm run dev
