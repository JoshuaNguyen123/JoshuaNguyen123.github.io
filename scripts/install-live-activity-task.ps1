[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$TaskName = "JoshuaNguyen-LocalActivityFeed"
)

$ErrorActionPreference = "Stop"

$taskRoot = Split-Path -Parent $PSScriptRoot

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

Get-Command node -ErrorAction Stop | Out-Null
Get-Command gh -ErrorAction Stop | Out-Null
$currentUser = "$env:USERDOMAIN\$env:USERNAME"
$scriptHost = Join-Path $env:SystemRoot "System32\wscript.exe"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited

if ($PSCmdlet.ShouldProcess($TaskName, "Register the hourly no-cost local activity collector")) {
  $activityHome = Resolve-ActivityHome
  $runtimeRoot = Join-Path $activityHome "collector-runtime"
  $runtimeScripts = Join-Path $runtimeRoot "scripts"
  $runtimeData = Join-Path $runtimeRoot "data"
  New-Item -ItemType Directory -Path $runtimeScripts -Force | Out-Null
  New-Item -ItemType Directory -Path $runtimeData -Force | Out-Null
  & icacls $activityHome /inheritance:r /grant:r "${currentUser}:(OI)(CI)(F)" "SYSTEM:(OI)(CI)(F)" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not restrict the installed collector runtime to the current Windows account." }
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot "run-live-activity.ps1") -Destination $runtimeRoot -Force
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot "run-live-activity-hidden.vbs") -Destination $runtimeRoot -Force
  Get-ChildItem -LiteralPath $PSScriptRoot -Filter "*.mjs" -File | Copy-Item -Destination $runtimeScripts -Force
  Copy-Item -LiteralPath (Join-Path $taskRoot "data\history-backfill.json") -Destination $runtimeData -Force
  @{ repositoryRoot = [IO.Path]::GetFullPath($taskRoot) } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimeRoot "collector-config.json") -Encoding UTF8
  $hiddenRunner = Join-Path $runtimeRoot "run-live-activity-hidden.vbs"
  $action = New-ScheduledTaskAction -Execute $scriptHost -Argument "//B //NoLogo `"$hiddenRunner`"" -WorkingDirectory $taskRoot
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  Write-Output "Scheduled task '$TaskName' is installed (hourly) from the owner-only runtime at $runtimeRoot."
}
