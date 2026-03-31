# Stops whatever is listening on PORT/API_PORT from .env, then starts a fresh API.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
$pPort = $null
$aPort = $null
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*PORT\s*=\s*(\d+)') { $script:pPort = [int]$matches[1] }
    if ($_ -match '^\s*API_PORT\s*=\s*(\d+)') { $script:aPort = [int]$matches[1] }
  }
}
$port = if ($null -ne $pPort) { $pPort } elseif ($null -ne $aPort) { $aPort } else { 3001 }
Write-Host "Stopping listener on port $port (if any)..."
Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 500
Set-Location $root
$nodeExe = (Get-Command node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source)
if (-not $nodeExe -and (Test-Path "C:\Program Files\nodejs\node.exe")) {
  $nodeExe = "C:\Program Files\nodejs\node.exe"
}
if (-not $nodeExe) {
  Write-Error "Node.js not found. Install Node or add it to PATH."
  exit 1
}
Write-Host "Starting API on port $port using $nodeExe..."
& $nodeExe server/index.js
