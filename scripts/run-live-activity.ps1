[CmdletBinding()]
param([string]$RepositoryRoot)

$ErrorActionPreference = "Stop"

$runtimeConfig = Join-Path $PSScriptRoot "collector-config.json"
if (-not $RepositoryRoot -and (Test-Path -LiteralPath $runtimeConfig -PathType Leaf)) {
  $RepositoryRoot = (Get-Content -LiteralPath $runtimeConfig -Raw | ConvertFrom-Json).repositoryRoot
}
$taskRoot = if ($RepositoryRoot) { [IO.Path]::GetFullPath($RepositoryRoot) } else { Split-Path -Parent $PSScriptRoot }
$collector = Join-Path $PSScriptRoot "scripts\live-activity-collector.mjs"
if (-not (Test-Path -LiteralPath $collector -PathType Leaf)) { $collector = Join-Path $PSScriptRoot "live-activity-collector.mjs" }
if (-not (Test-Path -LiteralPath $collector -PathType Leaf)) { throw "Installed activity collector was not found: $collector" }
$taskNode = Get-Command node -ErrorAction Stop

Push-Location -LiteralPath $taskRoot
try {
  & $taskNode.Source $collector
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
