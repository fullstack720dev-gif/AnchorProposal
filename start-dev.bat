@echo off
REM Local coding only (starts next DEV). For QA / ngrok trial use: pnpm share
REM Do NOT use this bat while ngrok is forwarding to port 3000.
echo.
echo NOTE: start-dev.bat uses next DEV (local coding only).
echo For multi-user ngrok trial, stop this and run: pnpm share
echo.
set ROOT=%~dp0
set DATABASE_URL=postgresql://anchorproposal:anchorproposal@localhost:5432/anchorproposal
set REDIS_URL=redis://localhost:6379
set JWT_SECRET=dev-jwt-secret-change-in-production
set JWT_REFRESH_SECRET=dev-refresh-secret-change-in-production
set API_PORT=3001
set STORAGE_PATH=%ROOT%storage
set APP_WEB_URL=http://localhost:3000

echo Starting PostgreSQL and Memurai...
net start postgresql-x64-16 >nul 2>&1
net start Memurai >nul 2>&1

echo Building shared package and API...
cd /d %ROOT%
call pnpm --filter @anchorproposal/shared build
if errorlevel 1 (
  echo Shared build failed.
  pause
  exit /b 1
)
cd /d %ROOT%apps\api
if exist dist rmdir /s /q dist
call pnpm exec tsc -p tsconfig.json
if errorlevel 1 (
  echo API build failed.
  pause
  exit /b 1
)

echo Starting API on http://localhost:3001 ...
start "AnchorProposal API" cmd /k "cd /d %ROOT%apps\api && set DATABASE_URL=%DATABASE_URL% && set REDIS_URL=%REDIS_URL% && set JWT_SECRET=%JWT_SECRET% && set JWT_REFRESH_SECRET=%JWT_REFRESH_SECRET% && set API_PORT=%API_PORT% && set STORAGE_PATH=%STORAGE_PATH% && set APP_WEB_URL=%APP_WEB_URL% && node dist\main.js"

timeout /t 3 /nobreak >nul

echo Starting Web on http://localhost:3000 ...
start "AnchorProposal Web" cmd /k "cd /d %ROOT%apps\web && pnpm dev"

echo.
echo AnchorProposal started.
echo   Web: http://localhost:3000
echo   API: http://localhost:3001
echo   Master: Master / Master@12345
echo   Admin: admin@anchorproposal.com / admin123
echo.
pause
