[CmdletBinding()]
param()

$taskRoot = Split-Path -Parent $PSScriptRoot
$taskNode = Get-Command node -ErrorAction Stop

Push-Location -LiteralPath $taskRoot
try {
  & $taskNode.Source (Join-Path $PSScriptRoot "live-activity-collector.mjs")
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
