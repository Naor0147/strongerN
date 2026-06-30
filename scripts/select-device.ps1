param(
    [string]$AutoMode = "false"
)

# Use ANDROID_HOME environment variable to locate adb
$androidHome = $env:ANDROID_HOME
if ([string]::IsNullOrEmpty($androidHome)) {
    $androidHome = "C:\Users\NAORA\AppData\Local\Android\Sdk"
}
$adb = Join-Path $androidHome "platform-tools\adb.exe"

if (-not (Test-Path $adb)) {
    # Fallback to system adb
    $adb = "adb.exe"
}

# Run adb devices and parse
$adbOutput = & $adb devices 2>$null
$devices = @()
$unauthorized = @()

if ($adbOutput) {
    foreach ($line in $adbOutput) {
        if ($line -match '^([^\s]+)\s+device$') {
            $devices += $Matches[1]
        } elseif ($line -match '^([^\s]+)\s+(unauthorized|offline|connecting)$') {
            $unauthorized += [PSCustomObject]@{
                Serial = $Matches[1]
                Status = $Matches[2]
            }
        }
    }
}

# Print unauthorized warnings if any exist
if ($unauthorized.Count -gt 0) {
    Write-Host "----------------------------------------------------------------------" -ForegroundColor Yellow
    Write-Host "WARNING: Detected unauthorized/offline/connecting device(s):" -ForegroundColor Yellow
    foreach ($u in $unauthorized) {
        Write-Host "  * $($u.Serial) [$($u.Status)]" -ForegroundColor Red
    }
    Write-Host "Please check your phone's screen and allow USB debugging." -ForegroundColor Yellow
    Write-Host "----------------------------------------------------------------------" -ForegroundColor Yellow
    Write-Host ""
}

if ($devices.Count -eq 0) {
    exit 0
}

$selected = $null

if ($devices.Count -eq 1) {
    # Only one device, select it directly
    $selected = $devices[0]
    $model = "Unknown Model"
    try {
        $modelOutput = & $adb -s $selected shell getprop ro.product.model 2>$null
        if ($modelOutput) {
            $model = $modelOutput.Trim()
        }
    } catch {}
    if ([string]::IsNullOrEmpty($model)) {
        $model = "Unknown Model"
    }
    Write-Host "[ADB] Automatically selected single device: $selected ($model)" -ForegroundColor Green
} elseif ($AutoMode -eq "true") {
    # Prefer physical devices (usually don't match emulator or 127.0.0.1)
    $physical = $devices | Where-Object { $_ -notmatch '^emulator-' -and $_ -notmatch '^127\.' }
    if ($physical) {
        $selected = $physical[0]
    } else {
        $selected = $devices[0]
    }
} else {
    # Interactive mode: let user choose
    Write-Host "======================================================================" -ForegroundColor Yellow
    Write-Host "Multiple Android Devices Detected:" -ForegroundColor Yellow
    Write-Host "======================================================================" -ForegroundColor Yellow
    
    $deviceInfoList = @()
    for ($i = 0; $i -lt $devices.Count; $i++) {
        $serial = $devices[$i]
        $model = "Unknown Model"
        try {
            $modelOutput = & $adb -s $serial shell getprop ro.product.model 2>$null
            if ($modelOutput) {
                $model = $modelOutput.Trim()
            }
        } catch {}
        if ([string]::IsNullOrEmpty($model)) {
            $model = "Unknown Model"
        }
        Write-Host "  [$($i+1)] $serial ($model)" -ForegroundColor Cyan
        $deviceInfoList += $serial
    }
    Write-Host "======================================================================" -ForegroundColor Yellow

    $choice = $null
    while ($choice -lt 1 -or $choice -gt $devices.Count) {
        $input = Read-Host "Select device number (1-$($devices.Count)) [Default is 1]"
        if ([string]::IsNullOrWhiteSpace($input)) {
            $choice = 1
        } else {
            [int]::TryParse($input, [ref]$choice) | Out-Null
        }
    }
    $selected = $deviceInfoList[$choice-1]
}

if ($selected) {
    $tempFile = Join-Path $env:TEMP "selected_adb_device.txt"
    $selected | Out-File -FilePath $tempFile -Encoding ascii -Force
}
exit 0

