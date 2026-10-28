$ErrorActionPreference = 'Stop'
$route = (& wsl -d Ubuntu-20.04 -- ip route show default) -join ' '
if ($LASTEXITCODE -ne 0 -or $route -notmatch 'default via (\d+\.\d+\.\d+\.\d+)') { throw 'No se ha podido localizar la interfaz privada de WSL.' }
$hostAddress = $Matches[1]
$addressJson = (& wsl -d Ubuntu-20.04 -- ip -j -4 address show dev eth0) -join ''
if ($LASTEXITCODE -ne 0) { throw 'No se ha podido localizar la dirección de Ubuntu.' }
$clientAddress = (($addressJson | ConvertFrom-Json).addr_info | Where-Object family -eq 'inet' | Select-Object -First 1).local
if (-not $clientAddress) { throw 'Ubuntu no tiene dirección IPv4.' }
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$stateDirectory = Join-Path $projectRoot '.harness\runs\windows-relay'
New-Item -ItemType Directory -Force -Path $stateDirectory | Out-Null
$stateFile = Join-Path $stateDirectory 'state.json'
$relayScript = Join-Path $PSScriptRoot 'windows-relay.cjs'
if (Test-Path -LiteralPath $stateFile) {
    $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    $existing = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$state.pid)" -ErrorAction SilentlyContinue
    if ($existing) {
        if ($existing.CommandLine -notlike "*$relayScript*") { throw 'El PID guardado pertenece a otro proceso; no se modifica.' }
        if ($state.host -eq $hostAddress -and $state.client -eq $clientAddress -and $state.port -eq 31416) {
            Write-Output 'Puente privado de WSL ya activo.'
            exit 0
        }
        Stop-Process -Id $state.pid
    }
    Remove-Item -LiteralPath $stateFile
}
$nodePath = (Get-Command node -CommandType Application | Select-Object -First 1).Source
$arguments = @(('"' + $relayScript + '"'), $hostAddress, $clientAddress, '31416', ('"' + $stateFile + '"'))
$process = Start-Process -FilePath $nodePath -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateDirectory 'stdout.log') -RedirectStandardError (Join-Path $stateDirectory 'stderr.log')
for ($attempt = 0; $attempt -lt 50; $attempt++) {
    if (Test-Path -LiteralPath $stateFile) { break }
    if ($process.HasExited) { throw 'No se pudo iniciar el puente privado; revisa stderr.log.' }
    Start-Sleep -Milliseconds 100
}
if (-not (Test-Path -LiteralPath $stateFile)) { throw 'El puente no confirmó su inicio.' }
Write-Output 'Puente privado activo: solo acepta conexiones de este Ubuntu hacia FreeLLMAPI en Windows.'
