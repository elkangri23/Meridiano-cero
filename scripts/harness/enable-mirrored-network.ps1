$ErrorActionPreference = 'Stop'
$configPath = Join-Path $env:USERPROFILE '.wslconfig'
$configLines = if (Test-Path -LiteralPath $configPath) { @(Get-Content -LiteralPath $configPath) } else { @() }
$headers = @()
for ($lineIndex = 0; $lineIndex -lt $configLines.Count; $lineIndex++) {
    if ($configLines[$lineIndex].Trim() -ieq '[wsl2]') { $headers += $lineIndex }
}
if ($headers.Count -gt 1) { throw 'Hay varias secciones wsl2; se requiere revisión manual.' }
if ($headers.Count -eq 0) {
    $configLines += @('', '[wsl2]', 'networkingMode=mirrored')
} else {
    $sectionStart = $headers[0]
    $sectionEnd = $configLines.Count
    for ($lineIndex = $sectionStart + 1; $lineIndex -lt $configLines.Count; $lineIndex++) {
        if ($configLines[$lineIndex] -match '^\s*\[') { $sectionEnd = $lineIndex; break }
    }
    $networkKeys = @()
    for ($lineIndex = $sectionStart + 1; $lineIndex -lt $sectionEnd; $lineIndex++) {
        if ($configLines[$lineIndex] -match '^\s*networkingMode\s*=') { $networkKeys += $lineIndex }
    }
    if ($networkKeys.Count -gt 1) { throw 'Hay varias opciones networkingMode; se requiere revisión manual.' }
    if ($networkKeys.Count -eq 1) {
        $configLines[$networkKeys[0]] = 'networkingMode=mirrored'
    } else {
        $before = @($configLines[0..$sectionStart])
        $after = if ($sectionStart + 1 -lt $configLines.Count) { @($configLines[($sectionStart + 1)..($configLines.Count - 1)]) } else { @() }
        $configLines = $before + @('networkingMode=mirrored') + $after
    }
}
if (Test-Path -LiteralPath $configPath) {
    $backupPath = $configPath + '.before-meridiano-' + (Get-Date -Format 'yyyyMMddHHmmss')
    Copy-Item -LiteralPath $configPath -Destination $backupPath
    Write-Output ('Copia anterior: ' + $backupPath)
}
[System.IO.File]::WriteAllLines($configPath, [string[]]$configLines, [System.Text.UTF8Encoding]::new($false))
Write-Output 'networkingMode=mirrored preparado. Requiere reiniciar WSL para aplicarlo.'
