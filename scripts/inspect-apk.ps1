param(
    [string]$ApkPath = "apk/strongerN.apk",
    [switch]$Assert
)

Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not (Test-Path $ApkPath)) {
    Write-Error "APK not found at $ApkPath"
    if ($Assert) { exit 1 }
    return
}

$item = Get-Item $ApkPath
$bytes = $item.Length
$mb = [Math]::Round($bytes / 1MB, 2)
$mbExact = $bytes / (1024 * 1024)

Write-Host "========================================="
Write-Host "       RELEASE APK CENSUS & AUDIT        "
Write-Host "========================================="
Write-Host "APK Path: $ApkPath"
Write-Host "Exact Size: $bytes bytes ($mb MB / $([Math]::Round($mbExact, 3)) MiB)"

$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $ApkPath))

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

if ($Assert) {
    Write-Host "`n--- SIZE & QUALITY GATE ASSERTIONS ---"
    $maxBytes = 20 * 1024 * 1024 # 20 MB
    $maxFonts = 10
    $maxDexComp = 6 * 1024 * 1024 # 6 MB

    $failed = $false
    if ($bytes -gt $maxBytes) {
        Write-Host "❌ ASSERTION FAILED: APK size ($mb MB) exceeds maximum allowed 20 MB ($maxBytes bytes)" -ForegroundColor Red
        $failed = $true
    } else {
        Write-Host "✅ APK size gate passed: $mb MB <= 20 MB" -ForegroundColor Green
    }

    if ($fonts.Count -gt $maxFonts) {
        Write-Host "❌ ASSERTION FAILED: Font count ($($fonts.Count)) exceeds maximum allowed $maxFonts" -ForegroundColor Red
        $failed = $true
    } else {
        Write-Host "✅ Font census gate passed: $($fonts.Count) <= $maxFonts" -ForegroundColor Green
    }

    if ($totalDexComp -gt $maxDexComp) {
        Write-Host "❌ ASSERTION FAILED: Compressed DEX size ($([Math]::Round($totalDexComp / 1MB, 2)) MB) exceeds maximum allowed 6 MB" -ForegroundColor Red
        $failed = $true
    } else {
        Write-Host "✅ DEX compression gate passed: $([Math]::Round($totalDexComp / 1MB, 2)) MB <= 6 MB" -ForegroundColor Green
    }

    if ($failed) {
        exit 1
    }
}
