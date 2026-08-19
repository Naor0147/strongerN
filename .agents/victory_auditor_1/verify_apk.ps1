Add-Type -AssemblyName System.IO.Compression.FileSystem

$apkPath = "c:\Antigravity\strongerN\apk\strongerN.apk"
$apkItem = Get-Item $apkPath
Write-Host "APK Path: $($apkItem.FullName)"
Write-Host "APK Size: $($apkItem.Length) bytes ($([Math]::Round($apkItem.Length / 1MB, 2)) MB)"

$zip = [System.IO.Compression.ZipFile]::OpenRead($apkItem.FullName)

Write-Host "`n--- FONT ENTRIES (.ttf) ---"
$fontEntries = $zip.Entries | Where-Object { $_.FullName -like "*.ttf" }
$fontEntries | ForEach-Object {
    Write-Host "$($_.FullName) - Size: $($_.Length) bytes (Compressed: $($_.CompressedLength) bytes)"
}
Write-Host "Total TTF font count: $($fontEntries.Count)"

Write-Host "`n--- DEX FILES ---"
$dexEntries = $zip.Entries | Where-Object { $_.FullName -like "*.dex" }
$dexEntries | ForEach-Object {
    Write-Host "$($_.FullName) - Size: $($_.Length) bytes (Compressed: $($_.CompressedLength) bytes)"
}

Write-Host "`n--- JS BUNDLE (assets/index.android.bundle) ---"
$bundleEntry = $zip.Entries | Where-Object { $_.FullName -eq "assets/index.android.bundle" }
if ($bundleEntry) {
    Write-Host "Bundle found: Length=$([Math]::Round($bundleEntry.Length / 1KB, 1)) KB, Compressed=$([Math]::Round($bundleEntry.CompressedLength / 1KB, 1)) KB"
    $stream = $bundleEntry.Open()
    $buffer = New-Object byte[] 16
    $bytesRead = $stream.Read($buffer, 0, 16)
    $stream.Close()
    $hex = ($buffer | ForEach-Object { '{0:x2}' -f $_ }) -join ' '
    Write-Host "Header Magic Hex: $hex"
    if ($hex.StartsWith("c6 1f bc 03 c1 03 19 1f")) {
        Write-Host "HERMES BYTECODE CONFIRMED (Magic: 0x1F1903C103BC1FC6)"
    } else {
        Write-Host "WARNING: Not standard Hermes bytecode header"
    }
} else {
    Write-Host "ERROR: assets/index.android.bundle not found!"
}

Write-Host "`n--- NATIVE LIBRARIES (lib/arm64-v8a) ---"
$nativeLibs = $zip.Entries | Where-Object { $_.FullName -like "lib/arm64-v8a/*" }
Write-Host "Native libs count: $($nativeLibs.Count)"
$totalNativeCompressed = ($nativeLibs | Measure-Object -Property CompressedLength -Sum).Sum
Write-Host "Total native libs compressed: $([Math]::Round($totalNativeCompressed / 1MB, 2)) MB"

Write-Host "`n--- DEAD ASSETS CHECK IN APK ---"
$deadLogos = $zip.Entries | Where-Object { $_.FullName -like "*assets/logos/*" -or $_.FullName -like "*assets/logos_v2/*" }
$deadPhotos = $zip.Entries | Where-Object { $_.FullName -like "*assets/photos/*" }
$deadSounds = $zip.Entries | Where-Object { $_.FullName -like "*assets/sounds/*.mp3" }
Write-Host "Dead logos in APK: $($deadLogos.Count)"
Write-Host "Dead photos in APK: $($deadPhotos.Count)"
Write-Host "Dead sounds in APK: $($deadSounds.Count)"

$zip.Dispose()
