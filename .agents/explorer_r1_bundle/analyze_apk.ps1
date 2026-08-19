Add-Type -AssemblyName System.IO.Compression.FileSystem

$apkPath = "c:\Antigravity\strongerN\apk\strongerN.apk"
if (-not (Test-Path $apkPath)) {
    Write-Host "APK not found at $apkPath"
    exit 1
}

$zip = [System.IO.Compression.ZipFile]::OpenRead($apkPath)
$entries = $zip.Entries

Write-Host "=== APK SUMMARY CENSUS ==="
Write-Host "Total Entries: $($entries.Count)"
Write-Host "Total APK File Size: $([Math]::Round((Get-Item $apkPath).Length / 1MB, 2)) MB ($((Get-Item $apkPath).Length) bytes)"

$categories = @{}
$fonts = @()
$soLibs = @()
$dexFiles = @()
$bundles = @()
$images = @()

foreach ($entry in $entries) {
    $cat = "other"
    $name = $entry.FullName
    if ($name.EndsWith(".ttf") -or $name.EndsWith(".otf")) {
        $cat = "fonts"
        $fonts += $entry
    } elseif ($name.EndsWith(".so")) {
        $cat = "native_so"
        $soLibs += $entry
    } elseif ($name.EndsWith(".dex")) {
        $cat = "dex"
        $dexFiles += $entry
    } elseif ($name.Contains("index.android.bundle")) {
        $cat = "js_bundle"
        $bundles += $entry
    } elseif ($name.EndsWith(".png") -or $name.EndsWith(".webp") -or $name.EndsWith(".jpg") -or $name.EndsWith(".jpeg")) {
        $cat = "images"
        $images += $entry
    } elseif ($name.StartsWith("res/")) {
        $cat = "res_xml_raw"
    }

    if (-not $categories.ContainsKey($cat)) {
        $categories[$cat] = [PSCustomObject]@{ Count = 0; CompressedSize = 0; UncompressedSize = 0 }
    }
    $categories[$cat].Count += 1
    $categories[$cat].CompressedSize += $entry.CompressedLength
    $categories[$cat].UncompressedSize += $entry.Length
}

Write-Host "`n=== BREAKDOWN BY CATEGORY ==="
foreach ($key in $categories.Keys) {
    $c = $categories[$key]
    $compMb = [Math]::Round($c.CompressedSize / 1MB, 2)
    $uncompMb = [Math]::Round($c.UncompressedSize / 1MB, 2)
    Write-Host ("{0,-15} : {1,4} files | Compressed: {2,6} MB | Uncompressed: {3,6} MB" -f $key, $c.Count, $compMb, $uncompMb)
}

Write-Host "`n=== FONTS IN CURRENT APK ($($fonts.Count) fonts) ==="
$totalFontComp = 0
$totalFontUncomp = 0
foreach ($f in ($fonts | Sort-Object Length -Descending)) {
    $totalFontComp += $f.CompressedLength
    $totalFontUncomp += $f.Length
    Write-Host ("  {0,-50} | {1,8} KB uncomp | {2,8} KB in APK" -f $f.FullName, [Math]::Round($f.Length/1KB, 1), [Math]::Round($f.CompressedLength/1KB, 1))
}
Write-Host ("Total Fonts: {0} KB ({1} MB) uncompressed | {2} KB ({3} MB) compressed" -f [Math]::Round($totalFontUncomp/1KB, 1), [Math]::Round($totalFontUncomp/1MB, 2), [Math]::Round($totalFontComp/1KB, 1), [Math]::Round($totalFontComp/1MB, 2))

Write-Host "`n=== DEX FILES ==="
foreach ($d in $dexFiles) {
    Write-Host ("  {0,-30} | {1,8} KB uncomp | {2,8} KB in APK" -f $d.FullName, [Math]::Round($d.Length/1KB, 1), [Math]::Round($d.CompressedLength/1KB, 1))
}

Write-Host "`n=== JS BUNDLE ==="
foreach ($b in $bundles) {
    Write-Host ("  {0,-30} | {1,8} KB uncomp | {2,8} KB in APK" -f $b.FullName, [Math]::Round($b.Length/1KB, 1), [Math]::Round($b.CompressedLength/1KB, 1))
}

Write-Host "`n=== LARGEST IMAGES (Top 15) ==="
foreach ($img in ($images | Sort-Object Length -Descending | Select-Object -First 15)) {
    Write-Host ("  {0,-50} | {1,8} KB uncomp | {2,8} KB in APK" -f $img.FullName, [Math]::Round($img.Length/1KB, 1), [Math]::Round($img.CompressedLength/1KB, 1))
}

$zip.Dispose()
