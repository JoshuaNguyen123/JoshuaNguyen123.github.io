[CmdletBinding(SupportsShouldProcess)]
param(
  [ValidateSet("preflight", "install", "status", "uninstall")]
  [string]$Action = "status"
)

$taskRoot = Split-Path -Parent $PSScriptRoot
$taskNode = Get-Command node -ErrorAction Stop
$manager = Join-Path $PSScriptRoot "hook-installer.mjs"

if ($Action -eq "install" -and -not $PSCmdlet.ShouldProcess("Cursor and Claude user settings", "Install privacy-safe global activity hooks with backups")) {
  return
}

Push-Location -LiteralPath $taskRoot
try {
  & $taskNode.Source $manager $Action
  if ($LASTEXITCODE -ne 0) { throw "Local activity hook $Action failed." }
} finally {
  Pop-Location
}

if ($Action -eq "install") {
  $activityHome = Join-Path $env:LOCALAPPDATA "EngineeringActivity"
  $currentUser = "$env:USERDOMAIN\$env:USERNAME"
  & icacls $activityHome /inheritance:r /grant:r "${currentUser}:(OI)(CI)(F)" "SYSTEM:(OI)(CI)(F)" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not restrict the local activity directory to the current Windows account." }
  Write-Output "Local activity hooks installed with owner-only storage at $activityHome"
}
