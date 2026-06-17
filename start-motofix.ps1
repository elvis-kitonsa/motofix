# ─────────────────────────────────────────────────────────────────────────────
# start-motofix.ps1 — make sure the MOTOFIX backend (Docker) is up and reachable.
#
# Run this whenever login shows "Network error / cannot reach server". It will:
#   1. Start the Docker engine (and hard-restart it if it's hung), then wait.
#   2. Start every MOTOFIX container.
#   3. Wait until the auth service answers, then report.
#
# Double-click start-motofix.bat, or run:  pwsh -File start-motofix.ps1
# (-Silent skips the "Press Enter" prompt — used by the login auto-start shortcut.)
# ─────────────────────────────────────────────────────────────────────────────

param([switch]$Silent)

$ErrorActionPreference = 'SilentlyContinue'
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$dockerExe  = "C:\Program Files\Docker\Docker\Docker Desktop.exe"

function Test-Engine {
    docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
}

function Wait-Engine([int]$tries) {
    for ($i = 0; $i -lt $tries; $i++) { if (Test-Engine) { return $true }; Start-Sleep 5 }
    return (Test-Engine)
}

Write-Host ""
Write-Host "MOTOFIX startup — checking the Docker engine..." -ForegroundColor Cyan

# 1) Start Docker Desktop if the engine isn't answering.
if (-not (Test-Engine)) {
    Write-Host "  Engine not responding — launching Docker Desktop..."
    if (-not (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue)) { Start-Process $dockerExe }
    Wait-Engine 24 | Out-Null
}

# 2) If still hung, do a hard restart (stop everything + reset WSL + relaunch).
if (-not (Test-Engine)) {
    Write-Host "  Engine still hung — performing a hard restart..." -ForegroundColor Yellow
    foreach ($n in 'Docker Desktop','com.docker.backend','com.docker.service','vpnkit','dockerd') {
        Get-Process -Name $n -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    }
    wsl --shutdown 2>$null
    Start-Sleep 3
    Start-Process $dockerExe
    Wait-Engine 36 | Out-Null
}

if (-not (Test-Engine)) {
    Write-Host "ERROR: the Docker engine could not be started. Open Docker Desktop manually and retry." -ForegroundColor Red
    if (-not $Silent -and $Host.Name -eq 'ConsoleHost') { Read-Host "Press Enter to close" }
    exit 1
}
Write-Host "  Engine is up." -ForegroundColor Green

# 3) Start every MOTOFIX container (restart:unless-stopped means most auto-start, but
#    this catches any that were stopped — and `docker start` bypasses the compose
#    healthcheck gate that can otherwise block `compose up`).
Write-Host "Ensuring MOTOFIX services are running..."
$ids = docker ps -aq --filter "name=motofix-" 2>$null
if ($ids) { docker start $ids 2>$null | Out-Null }

# 4) Wait for the auth service to answer.
Write-Host "Waiting for the auth service..."
$ok = $false
for ($i = 0; $i -lt 24; $i++) {
    try {
        $r = Invoke-WebRequest 'http://127.0.0.1:8000/health' -TimeoutSec 4 -UseBasicParsing
        if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch {}
    Start-Sleep 5
}

Write-Host ""
if ($ok) {
    Write-Host "MOTOFIX backend is UP and reachable — you can log in now." -ForegroundColor Green
} else {
    Write-Host "Services started but auth isn't answering yet. Wait ~30s, then refresh the login page." -ForegroundColor Yellow
}
if (-not $Silent -and $Host.Name -eq 'ConsoleHost') { Read-Host "Press Enter to close" }
