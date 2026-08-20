[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$TaskName = "JoshuaNguyen-LocalActivityFeed"
)

$ErrorActionPreference = "Stop"

$taskRoot = Split-Path -Parent $PSScriptRoot
$hiddenRunner = Join-Path $PSScriptRoot "run-live-activity-hidden.vbs"
if (-not (Test-Path -LiteralPath $hiddenRunner -PathType Leaf)) { throw "Hidden collector runner was not found: $hiddenRunner" }

Get-Command node -ErrorAction Stop | Out-Null
Get-Command gh -ErrorAction Stop | Out-Null
$currentUser = "$env:USERDOMAIN\$env:USERNAME"
$scriptHost = Join-Path $env:SystemRoot "System32\wscript.exe"
$action = New-ScheduledTaskAction -Execute $scriptHost -Argument "//B //NoLogo `"$hiddenRunner`"" -WorkingDirectory $taskRoot
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 30) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited

if ($PSCmdlet.ShouldProcess($TaskName, "Register the thirty-minute no-cost local activity collector")) {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  Write-Output "Scheduled task '$TaskName' is installed. It uses local hooks and the existing GitHub CLI login; no paid analytics service is required."
}
