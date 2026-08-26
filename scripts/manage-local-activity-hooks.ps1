[CmdletBinding(SupportsShouldProcess)]
param(
  [ValidateSet("preflight", "install", "status", "uninstall")]
  [string]$Action = "status"
)

$ErrorActionPreference = "Stop"

$taskRoot = Split-Path -Parent $PSScriptRoot
$taskNode = Get-Command node -ErrorAction Stop
$manager = Join-Path $PSScriptRoot "hook-installer.mjs"

function Resolve-ActivityHome {
  if ($env:ENGINEERING_ACTIVITY_HOME) {
    if (-not [IO.Path]::IsPathFullyQualified($env:ENGINEERING_ACTIVITY_HOME)) { throw "ENGINEERING_ACTIVITY_HOME must be an absolute local path." }
    if ($env:ENGINEERING_ACTIVITY_HOME.StartsWith("\\")) { throw "ENGINEERING_ACTIVITY_HOME cannot use a network path." }
    $candidate = [IO.Path]::GetFullPath($env:ENGINEERING_ACTIVITY_HOME)
  } else {
    $candidate = Join-Path $env:LOCALAPPDATA "EngineeringActivity"
  }
  New-Item -ItemType Directory -Path $candidate -Force | Out-Null
  $resolved = (Resolve-Path -LiteralPath $candidate).Path
  if ((Get-Item -LiteralPath $resolved -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "ENGINEERING_ACTIVITY_HOME cannot be a reparse point." }
  return $resolved
}

if ($Action -eq "install" -and -not $PSCmdlet.ShouldProcess("Cursor and Claude user settings", "Install privacy-safe global activity hooks with backups")) {
  return
}

Push-Location -LiteralPath $taskRoot
try {
  if ($Action -eq "install") {
    $activityHome = Resolve-ActivityHome
    $env:ENGINEERING_ACTIVITY_HOME = $activityHome
    $currentUser = "$env:USERDOMAIN\$env:USERNAME"
    & icacls $activityHome /inheritance:r /grant:r "${currentUser}:(OI)(CI)(F)" "SYSTEM:(OI)(CI)(F)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Could not restrict the local activity directory to the current Windows account." }
  }
  & $taskNode.Source $manager $Action
  if ($LASTEXITCODE -ne 0) { throw "Local activity hook $Action failed." }
} finally {
  Pop-Location
}

if ($Action -eq "install") {
  Write-Output "Local activity hooks installed with owner-only storage at $activityHome"
}
