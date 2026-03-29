# One-time: log into GitHub, create repo if needed, push main.
# Run from PowerShell:  cd c:\work\window-installer-react
#                        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#                        .\publish-github.ps1

$ErrorActionPreference = "Stop"
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
  [System.Environment]::GetEnvironmentVariable("Path", "User")
Set-Location $PSScriptRoot

$git = "${env:ProgramFiles}\Git\cmd\git.exe"
if (-not (Test-Path $git)) {
  $git = "git"
}

Write-Host "Checking GitHub CLI login..."
gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Sign in when prompted (browser or device code at github.com/login/device)."
  gh auth login -h github.com -p https -w
}

Write-Host "Checking if repo exists..."
gh repo view ethanhabib15-star/clearview-windows 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Creating public repo ethanhabib15-star/clearview-windows ..."
  gh repo create clearview-windows --public --description "ClearView Windows — marketing site and admin"
}

Write-Host "Pushing branch main..."
& $git push -u origin main
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "Done: https://github.com/ethanhabib15-star/clearview-windows"
