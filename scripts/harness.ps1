$entry = Join-Path $PSScriptRoot 'harness\wsl.sh'
$entry = $entry.Replace('\', '/')
$converted = & wsl -d Ubuntu-20.04 -- wslpath -a $entry
if ($LASTEXITCODE -ne 0) { throw 'No se pudo convertir la ruta para WSL.' }
$linuxEntry = ($converted -join '').Trim()
& wsl -d Ubuntu-20.04 -- bash $linuxEntry @args
exit $LASTEXITCODE
