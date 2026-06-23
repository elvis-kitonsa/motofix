# ─────────────────────────────────────────────────────────────────────────────
# bundle-env.ps1 — package every real .env file into ONE zip to hand to teammates.
#
# The .env files hold the working API keys and are (correctly) gitignored, so a
# teammate who clones the repo only gets the empty .env.example templates. Run this
# to gather all the real .env files into motofix-env-bundle.zip, then share that zip
# PRIVATELY (WhatsApp / Drive / USB) — never commit it or post it publicly.
#
# Teammate side: drop the zip in the project root and run  scripts/restore-env.ps1
#
# Run:  pwsh -File scripts/bundle-env.ps1
# ─────────────────────────────────────────────────────────────────────────────

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)   # repo root (this script lives in scripts/)
$out  = Join-Path $root 'motofix-env-bundle.zip'

# The exact .env locations docker-compose needs: the root file + each backend
# service + the notifications sub-service + each frontend app.
$candidates = @( Join-Path $root '.env' )
Get-ChildItem (Join-Path $root 'services')   -Directory -ErrorAction SilentlyContinue | ForEach-Object { $candidates += Join-Path $_.FullName '.env' }
$candidates += Join-Path $root 'services\motofix-analytics-service\notifications\.env'
Get-ChildItem (Join-Path $root 'interfaces') -Directory -ErrorAction SilentlyContinue | ForEach-Object { $candidates += Join-Path $_.FullName '.env' }

$files = $candidates | Where-Object { Test-Path $_ } | Get-Item
if (-not $files) {
    Write-Host "No .env files found — are you running this from the MOTOFIX project?" -ForegroundColor Yellow
    exit 1
}

# Stage the files into a temp folder that mirrors their relative paths, then zip it,
# so the archive unpacks straight back into the project tree.
$stage = Join-Path $env:TEMP ("motofix-env-" + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage -Force | Out-Null
foreach ($f in $files) {
    $rel  = $f.FullName.Substring($root.Length).TrimStart('\', '/')
    $dest = Join-Path $stage $rel
    New-Item -ItemType Directory -Path (Split-Path $dest) -Force | Out-Null
    Copy-Item $f.FullName $dest -Force
}

if (Test-Path $out) { Remove-Item $out -Force }
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $out -Force
Remove-Item $stage -Recurse -Force

Write-Host ""
Write-Host "Bundled $($files.Count) .env files into:" -ForegroundColor Green
Write-Host "  $out"
Write-Host ""
$files | ForEach-Object { Write-Host "  - $($_.FullName.Substring($root.Length).TrimStart('\','/'))" }
Write-Host ""
Write-Host "Share this zip PRIVATELY (WhatsApp / Google Drive / USB)." -ForegroundColor Yellow
Write-Host "It contains REAL secret keys — never commit it or post it in a public chat." -ForegroundColor Yellow
