$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$stateFile = Join-Path $projectRoot '.harness\runs\windows-relay\state.json'
if (-not (Test-Path -LiteralPath $stateFile)) { Write-Output 'No hay un puente registrado.'; exit 0 }
$state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
$relayScript = Join-Path $PSScriptRoot 'windows-relay.cjs'
$existing = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.pid)" -ErrorAction SilentlyContinue
if ($existing) {
    if ($existing.CommandLine -notlike "*$relayScript*") { throw 'El PID pertenece a otro proceso; no se detiene.' }
    Stop-Process -Id $state.pid
}
Remove-Item -LiteralPath $stateFile
Write-Output 'Puente detenido. FreeLLMAPI de Windows sigue intacto; usa connect-private-relay.ps1 para volver a conectar Ubuntu.'
