[CmdletBinding(SupportsShouldProcess)]
param(
  [string]$TaskName = "JoshuaNguyen-LocalActivityFeed"
)

$ErrorActionPreference = "Stop"

$taskRoot = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $PSScriptRoot "run-live-activity.ps1"
if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) { throw "Collector runner was not found: $runner" }

Get-Command node -ErrorAction Stop | Out-Null
Get-Command gh -ErrorAction Stop | Out-Null
$currentUser = "$env:USERDOMAIN\$env:USERNAME"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`"" -WorkingDirectory $taskRoot
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited

if ($PSCmdlet.ShouldProcess($TaskName, "Register the five-minute no-cost local activity collector")) {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  Write-Output "Scheduled task '$TaskName' is installed. It uses local hooks and the existing GitHub CLI login; no paid analytics service is required."
}
