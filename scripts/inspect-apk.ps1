Add-Type -AssemblyName System.IO.Compression.FileSystem

$apkPath = "apk/strongerN.apk"
$item = Get-Item $apkPath
$bytes = $item.Length
$mb = [Math]::Round($bytes / 1MB, 2)
$mbExact = $bytes / (1024 * 1024)

Write-Host "========================================="
Write-Host "       RELEASE APK CENSUS & AUDIT        "
Write-Host "========================================="
Write-Host "APK Path: $apkPath"
Write-Host "Exact Size: $bytes bytes ($mb MB / $([Math]::Round($mbExact, 3)) MiB)"

$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $apkPath))

Write-Host "`n--- FONT CENSUS ---"
$fonts = @($zip.Entries | Where-Object { $_.FullName -match '\.(ttf|otf)$' })
Write-Host "Total Font Count: $($fonts.Count)"
foreach ($font in $fonts) {
    $lenKb = [Math]::Round($font.Length / 1KB, 1)
    $compKb = [Math]::Round($font.CompressedLength / 1KB, 1)
    Write-Host "  - $($font.FullName) (Uncompressed: $lenKb KB, Compressed: $compKb KB)"
}

Write-Host "`n--- DEX FILES (R8 Minification) ---"
$dexFiles = @($zip.Entries | Where-Object { $_.FullName -match '\.dex$' })
Write-Host "Total Dex Files: $($dexFiles.Count)"
$totalDexUncomp = 0
$totalDexComp = 0
foreach ($dex in $dexFiles) {
    $totalDexUncomp += $dex.Length
    $totalDexComp += $dex.CompressedLength
    $lenMb = [Math]::Round($dex.Length / 1MB, 2)
    $compMb = [Math]::Round($dex.CompressedLength / 1MB, 2)
    Write-Host "  - $($dex.FullName) (Uncompressed: $lenMb MB, In APK: $compMb MB)"
}
Write-Host "Total Dex Size in APK: $([Math]::Round($totalDexComp / 1MB, 2)) MB (Uncompressed: $([Math]::Round($totalDexUncomp / 1MB, 2)) MB)"

Write-Host "`n--- NATIVE LIBRARIES (.so) ---"
$soFiles = @($zip.Entries | Where-Object { $_.FullName -match '\.so$' })
$totalSoComp = 0
foreach ($so in $soFiles) {
    $totalSoComp += $so.CompressedLength
    $lenKb = [Math]::Round($so.Length / 1KB, 1)
    $compKb = [Math]::Round($so.CompressedLength / 1KB, 1)
    Write-Host "  - $($so.FullName) (Uncompressed: $lenKb KB, In APK: $compKb KB)"
}
Write-Host "Total Native Libs Size in APK: $([Math]::Round($totalSoComp / 1MB, 2)) MB"

Write-Host "`n--- BUNDLE / ASSETS ---"
$bundleFiles = @($zip.Entries | Where-Object { $_.FullName -match 'index\.android\.bundle' })
foreach ($b in $bundleFiles) {
    $lenMb = [Math]::Round($b.Length / 1MB, 2)
    $compMb = [Math]::Round($b.CompressedLength / 1MB, 2)
    Write-Host "  - $($b.FullName) (Uncompressed: $lenMb MB, In APK: $compMb MB)"
}

Write-Host "`n--- TOP 15 LARGEST ENTRIES IN APK ---"
$topEntries = $zip.Entries | Sort-Object CompressedLength -Descending | Select-Object -First 15
foreach ($entry in $topEntries) {
    $lenKb = [Math]::Round($entry.Length / 1KB, 1)
    $compKb = [Math]::Round($entry.CompressedLength / 1KB, 1)
    Write-Host "  - $($entry.FullName) (APK Size: $compKb KB, Uncompressed: $lenKb KB)"
}

$zip.Dispose()
