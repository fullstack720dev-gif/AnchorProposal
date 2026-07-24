# AnchorProposal trial / QA share mode
# - Kills anything on 3000/3001 (especially next dev)
# - Starts API + production web on 127.0.0.1:3000
# - Smoke-tests hashed assets + Master login
#
# Usage (from repo root):
#   pnpm share
#   powershell -ExecutionPolicy Bypass -File .\scripts\start-share.ps1
#
# Then in another terminal:
#   ngrok http 127.0.0.1:3000

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host ""
Write-Host "=== AnchorProposal share mode (production web) ===" -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host ""

function Test-PortListening([int]$Port) {
  try {
    $c = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $c
  } catch {
    return $false
  }
}

function Stop-PortListeners([int]$Port) {
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object {
      if ($_ -and $_ -ne 0) {
        Write-Host "  Stopping PID $_ on port $Port"
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
      }
    }
}

function Stop-NextAndApiProcesses {
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.CommandLine -and (
        $_.CommandLine -match 'next(\.js)?\s+(dev|start)' -or
        $_.CommandLine -match 'next\\dist\\bin\\next' -or
        $_.CommandLine -match 'apps\\web\\node_modules' -or
        ($_.CommandLine -match 'dist\\main\.js' -and $_.CommandLine -match 'apps\\api') -or
        ($_.CommandLine -match 'node.*dist\\main\.js' -and $_.ExecutablePath -match 'nodejs')
      )
    } |
    ForEach-Object {
      # Skip this PowerShell session / Cursor helpers
      if ($_.ProcessId -eq $PID) { return }
      Write-Host "  Stopping related process PID $($_.ProcessId)"
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

function Wait-Port([int]$Port, [int]$TimeoutSec) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while (-not (Test-PortListening $Port)) {
    if ((Get-Date) -gt $deadline) { return $false }
    Start-Sleep -Seconds 1
  }
  return $true
}

# --- 1) Force-stop listeners (next dev must not own 3000) ---
Write-Host "Stopping processes on ports 3000 and 3001..." -ForegroundColor Yellow
Stop-PortListeners 3000
Stop-PortListeners 3001
Stop-NextAndApiProcesses
Start-Sleep -Seconds 2
Stop-PortListeners 3000
Stop-PortListeners 3001
Start-Sleep -Seconds 1

if ((Test-PortListening 3000) -or (Test-PortListening 3001)) {
  Write-Host "Could not free ports 3000/3001. Close other terminals running pnpm dev / next / API and retry." -ForegroundColor Red
  exit 1
}
Write-Host "Ports 3000 and 3001 are free." -ForegroundColor Green

# --- 2) Ensure API dist exists ---
$apiMain = Join-Path $Root "apps\api\dist\main.js"
if (-not (Test-Path $apiMain)) {
  Write-Host "Building API (dist/main.js missing)..." -ForegroundColor Yellow
  pnpm --filter @anchorproposal/shared build
  if ($LASTEXITCODE -ne 0) { Write-Host "Shared build failed." -ForegroundColor Red; exit 1 }
  Push-Location (Join-Path $Root "apps\api")
  pnpm exec tsc -p tsconfig.json
  $tscOk = $LASTEXITCODE
  Pop-Location
  if ($tscOk -ne 0) { Write-Host "API build failed." -ForegroundColor Red; exit 1 }
}

# --- 3) Start API ---
Write-Host "Starting API on port 3001..." -ForegroundColor Cyan
$apiDir = Join-Path $Root "apps\api"
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$apiDir'; Write-Host 'AnchorProposal API (share mode)' -ForegroundColor Cyan; pnpm run start"
) | Out-Null

if (-not (Wait-Port 3001 60)) {
  Write-Host "API did not start on 3001 within 60s." -ForegroundColor Red
  Write-Host "Check Postgres/Redis (or Memurai) are running, then retry: pnpm share" -ForegroundColor Red
  exit 1
}
Write-Host "API is up on 3001." -ForegroundColor Green

# --- 4) Production web build ---
$buildId = Join-Path $Root "apps\web\.next\BUILD_ID"
if (-not (Test-Path $buildId)) {
  Write-Host "No web production build. Running pnpm build:web..." -ForegroundColor Yellow
  $env:API_PROXY_TARGET = "http://127.0.0.1:3001"
  $env:NEXT_PUBLIC_API_URL = "/backend"
  pnpm build:web
  if ($LASTEXITCODE -ne 0) { Write-Host "Web build failed." -ForegroundColor Red; exit 1 }
} else {
  Write-Host "Web production build present (.next/BUILD_ID)." -ForegroundColor Green
}

# --- 5) Start production web on 127.0.0.1:3000 ---
Write-Host "Starting production web on http://127.0.0.1:3000 ..." -ForegroundColor Cyan
$webDir = Join-Path $Root "apps\web"
Start-Process powershell -ArgumentList @(
  "-NoExit",
  "-Command",
  "Set-Location '$webDir'; `$env:API_PROXY_TARGET='http://127.0.0.1:3001'; `$env:NEXT_PUBLIC_API_URL='/backend'; Write-Host 'AnchorProposal Web PRODUCTION (share mode) - do not run pnpm dev' -ForegroundColor Cyan; pnpm exec next start -H 127.0.0.1 -p 3000"
) | Out-Null

if (-not (Wait-Port 3000 45)) {
  Write-Host "Web did not start on 3000." -ForegroundColor Red
  exit 1
}
Write-Host "Web is up on http://127.0.0.1:3000" -ForegroundColor Green

# --- 6) Smoke tests ---
Write-Host ""
Write-Host "Running smoke tests..." -ForegroundColor Cyan
Start-Sleep -Seconds 2

try {
  $page = Invoke-WebRequest -Uri "http://127.0.0.1:3000/login" -UseBasicParsing -TimeoutSec 20
} catch {
  Write-Host "FAIL: GET /login - $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

if ($page.Content -match '/_next/static/chunks/main-app\.js["'']') {
  Write-Host "FAIL: login page serves DEV main-app.js (huge). next dev is still running." -ForegroundColor Red
  Write-Host "Close all 'pnpm dev' terminals and run: pnpm share" -ForegroundColor Red
  exit 1
}

if ($page.Content -notmatch '/_next/static/chunks/[^"]+-[a-f0-9]+\.js') {
  Write-Host "FAIL: login page has no hashed production chunks." -ForegroundColor Red
  exit 1
}
Write-Host "OK: production hashed JS assets" -ForegroundColor Green

try {
  $login = Invoke-WebRequest -Uri "http://127.0.0.1:3000/backend/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body '{"email":"Master","password":"Master@12345"}' `
    -UseBasicParsing `
    -TimeoutSec 20
  if ($login.StatusCode -ne 201 -and $login.StatusCode -ne 200) {
    Write-Host "FAIL: login status $($login.StatusCode)" -ForegroundColor Red
    exit 1
  }
  Write-Host "OK: POST /backend/auth/login -> $($login.StatusCode)" -ForegroundColor Green
} catch {
  Write-Host "FAIL: POST /backend/auth/login - $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "API proxy or credentials issue. Check apps/api/.env and Postgres." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "=== Share mode ready ===" -ForegroundColor Green
Write-Host ""
Write-Host "Local login (use this URL):" -ForegroundColor Cyan
Write-Host "  http://127.0.0.1:3000"
Write-Host ""
Write-Host "Remote QA - in a SEPARATE terminal keep ngrok running:" -ForegroundColor Cyan
Write-Host "  ngrok http 127.0.0.1:3000"
Write-Host "  (or: ngrok start --config ngrok.yml --all)"
Write-Host ""
Write-Host "Demo accounts:" -ForegroundColor Cyan
Write-Host "  Master / Master@12345"
Write-Host "  admin@anchorproposal.com / admin123"
Write-Host "  bidder@anchorproposal.com / bidder123"
Write-Host ""
Write-Host "IMPORTANT: Do NOT run 'pnpm dev' while sharing." -ForegroundColor Yellow
Write-Host "           That replaces production with a 7MB bundle and breaks login." -ForegroundColor Yellow
Write-Host ""
Write-Host "If ngrok URL changed, update APP_WEB_URL and CORS_ORIGIN in apps/api/.env and restart API." -ForegroundColor DarkGray
Write-Host ""
