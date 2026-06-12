# MOTOFIX — recover the backend after a Docker Desktop networking hiccup.
#
# WHEN TO USE: login OTP times out, requests won't dispatch, or the app shows
# "timeout of 30000ms exceeded" — i.e. the host can't reach the Docker services.
#
# IMPORTANT: if this script's health checks STILL fail after running, the fix is
# to fully restart Docker Desktop (tray icon -> Quit Docker Desktop -> reopen),
# wait ~1 min, then run this script again. A full Docker Desktop restart rebuilds
# ALL the host<->container port forwarding, which a per-container restart cannot.
#
# Usage (from the repo root):  ./scripts/heal-services.ps1

$ErrorActionPreference = 'Continue'
Write-Host "`nRecreating MOTOFIX backend services (re-attaches Docker network + DB)..." -ForegroundColor Cyan
docker compose up -d --force-recreate `
  auth-service verification-service dispatch-service matching-service `
  analytics-service insurance-service notifications-service core-service diagnosis-service

Write-Host "`nWaiting for services to become reachable from the host..." -ForegroundColor Cyan
$ports = [ordered]@{ auth = 8000; dispatch = 8001; verification = 8002; matching = 8003; insurance = 8006; diagnosis = 8007 }
$allOk = $true
foreach ($name in $ports.Keys) {
  $p = $ports[$name]; $ok = $false
  for ($i = 0; $i -lt 20; $i++) {
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:$p/health" -TimeoutSec 4 -UseBasicParsing -ErrorAction Stop
      if ($r.StatusCode -eq 200) { $ok = $true; break }
    } catch { }
    Start-Sleep -Seconds 3
  }
  if ($ok) { Write-Host ("  {0,-13} :{1}  OK" -f $name, $p) -ForegroundColor Green }
  else     { Write-Host ("  {0,-13} :{1}  NOT reachable" -f $name, $p) -ForegroundColor Red; $allOk = $false }
}

if ($allOk) {
  Write-Host "`nAll services healthy. Try the app again.`n" -ForegroundColor Green
} else {
  Write-Host "`nSome services are still unreachable -> RESTART DOCKER DESKTOP (tray -> Quit -> reopen)," -ForegroundColor Yellow
  Write-Host "wait ~1 minute, then run this script again.`n" -ForegroundColor Yellow
}
