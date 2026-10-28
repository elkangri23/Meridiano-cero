# Explicit opt-in command; the normal Harness launchers do not start the relay.
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'start-windows-relay.ps1')
if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar el puente privado.' }
$configScript = (Join-Path $PSScriptRoot 'configure-private-relay.py').Replace('\', '/')
$linuxPath = & wsl -d Ubuntu-20.04 -- wslpath -a $configScript
if ($LASTEXITCODE -ne 0) { throw 'No se pudo convertir la ruta de configuración.' }
& wsl -d Ubuntu-20.04 -- python3 (($linuxPath -join '').Trim())
if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar la URL privada en Ubuntu.' }
Write-Output 'Conexión preparada. Ahora puedes ejecutar .\scripts\harness.ps1.'
