param(
  [string]$ConfigPath = (Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path ".env.odroid")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-KeyValueFile {
  param([string]$Path)

  $result = @{}
  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) {
      continue
    }
    $pair = $trimmed -split "=", 2
    if ($pair.Count -eq 2) {
      $result[$pair[0]] = $pair[1]
    }
  }
  return $result
}

$config = Read-KeyValueFile -Path $ConfigPath
$odroidHost = $config["ODROID_HOST"]
$webPort = $config["PUBLIC_WEB_PORT"]
$apiPort = $config["PUBLIC_API_PORT"]

$webStatus = (Invoke-WebRequest -Uri "http://$odroidHost`:$webPort" -UseBasicParsing -TimeoutSec 20).StatusCode
$collectorStatus = Invoke-RestMethod -Uri "http://$odroidHost`:$apiPort/admin/collector-status" -Method Get -TimeoutSec 20

[pscustomobject]@{
  web_status = $webStatus
  scheduler_enabled = $collectorStatus.scheduler_enabled
  client_mode = $collectorStatus.client_mode
  collect_interval_seconds = $collectorStatus.collect_interval_seconds
  last_run_status = $collectorStatus.last_run.status
  last_run_trigger = $collectorStatus.last_run.trigger
  last_run_snapshot_count = $collectorStatus.last_run.snapshot_count
}
