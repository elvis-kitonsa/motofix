# ─────────────────────────────────────────────────────────────────────────────
# restore-env.ps1 — unpack the shared .env bundle into the project (teammate side).
#
# After you clone the repo, drop the motofix-env-bundle.zip that Elvis sent you into
# the project root, then run this. It restores every .env file to the right place so
# docker compose can find the working keys.
#
# Run:  pwsh -File scripts/restore-env.ps1
#       pwsh -File scripts/restore-env.ps1 -Zip C:\Downloads\motofix-env-bundle.zip
# ─────────────────────────────────────────────────────────────────────────────

param([string]$Zip = 'motofix-env-bundle.zip')

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)   # repo root

# Find the zip: an explicit path, the project root, or the current folder.
$zipPath = $null
foreach ($p in @($Zip, (Join-Path $root $Zip), (Join-Path (Get-Location) $Zip))) {
    if ($p -and (Test-Path $p)) { $zipPath = (Resolve-Path $p).Path; break }
}
if (-not $zipPath) {
    Write-Host "Couldn't find '$Zip'. Put the bundle in the project root, or pass -Zip <full path>." -ForegroundColor Red
    exit 1
}

Expand-Archive -Path $zipPath -DestinationPath $root -Force

Write-Host ""
Write-Host "Restored the .env files into the project from:" -ForegroundColor Green
Write-Host "  $zipPath"
Write-Host ""
Write-Host "You're ready — now run:  docker compose up -d --build" -ForegroundColor Cyan
