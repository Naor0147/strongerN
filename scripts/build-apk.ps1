# scripts/build-apk.ps1
# Standalone APK Builder and Server for strongerN
# Optimized for maximum compilation speed and ease of use.

$ErrorActionPreference = "Stop"

# Define colors
$PrimaryColor = "Cyan"
$SuccessColor = "Green"
$WarningColor = "Yellow"
$ErrorColor = "Red"
$AccentColor = "Magenta"

Write-Host "======================================================================" -ForegroundColor $PrimaryColor
Write-Host "                 strongerN - Standalone APK Builder" -ForegroundColor $PrimaryColor
Write-Host "======================================================================" -ForegroundColor $PrimaryColor

# Resolve paths relative to script location
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
cd $ProjectRoot

# Load version info
$appJsonPath = Join-Path $ProjectRoot "app.json"
if (Test-Path $appJsonPath) {
    try {
        $appJson = Get-Content -Raw -Path $appJsonPath | ConvertFrom-Json
        $version = $appJson.expo.version
        $versionCode = $appJson.expo.android.versionCode
        Write-Host "[INFO] App Version: $version (Version Code: $versionCode)" -ForegroundColor $SuccessColor
    } catch {
        Write-Host "[WARN] Could not parse app.json version." -ForegroundColor $WarningColor
    }
}

# 1. Environment Diagnostics & Setup
Write-Host "`n[1/6] Diagnostic Checks..." -ForegroundColor $PrimaryColor

# Set Android Home
$AndroidHome = $env:ANDROID_HOME
if ([string]::IsNullOrEmpty($AndroidHome)) {
    $AndroidHome = "C:\Users\NAORA\AppData\Local\Android\Sdk"
    $env:ANDROID_HOME = $AndroidHome
}
$env:PATH = "$env:PATH;$AndroidHome\platform-tools"
Write-Host "   - Android SDK: $AndroidHome" -ForegroundColor Gray

# Ensure Node is available in PATH
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if (Get-Command fnm -ErrorAction SilentlyContinue) {
        fnm env --shell powershell | Out-String | Invoke-Expression
    }
}
if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVer = (node -v).Trim()
    Write-Host "   - Node.js: $nodeVer" -ForegroundColor Gray
} else {
    Write-Host "   - Node.js: [WARN] node not found in PATH" -ForegroundColor $WarningColor
}

# Set Java Home to JDK 19 if available
$jdk19Path = "C:\Program Files\Java\jdk-19"
if (Test-Path $jdk19Path) {
    $env:JAVA_HOME = $jdk19Path
    Write-Host "   - Java: Using compatible JDK 19 at $jdk19Path" -ForegroundColor Gray
} else {
    Write-Host "   - Java: Attempting default JAVA_HOME ($env:JAVA_HOME)" -ForegroundColor Gray
}

# Windows Defender Exclusion Check
try {
    if ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent().IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        # Check exclusion path if administrator
        $exclusions = (Get-MpPreference -ErrorAction SilentlyContinue).ExclusionPath
        if ($exclusions -notcontains $ProjectRoot.Path) {
            Write-Host "   [TIP] Exclude this folder from Windows Defender to speed up builds by 40-60%!" -ForegroundColor $WarningColor
            Write-Host "      Run: Add-MpPreference -ExclusionPath `"$($ProjectRoot.Path)`"" -ForegroundColor $PrimaryColor
        } else {
            Write-Host "   - Windows Defender: Folder is excluded (Optimized)" -ForegroundColor $SuccessColor
        }
    } else {
        Write-Host "   - Note: Run as Administrator to verify Windows Defender folder exclusions for build speedup." -ForegroundColor Gray
    }
} catch {
    # Silently ignore preference check errors
}

# 2. Memory Sizing & Optimization Info
Write-Host "`n[2/6] Configuring Gradle optimizations..." -ForegroundColor $PrimaryColor
$totalRamGb = 8 # Default fallback
try {
    $memInfo = Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum
    $totalRamGb = [Math]::Round($memInfo.Sum / 1GB)
} catch {}
Write-Host "   - System RAM: Detected $totalRamGb GB RAM" -ForegroundColor Gray
Write-Host "   - Gradle Optimizations: Active in android/gradle.properties (6GB heap, 16 parallel workers, build cache)" -ForegroundColor $SuccessColor

# 3. Check ADB Device Connectivity
$adb = "$AndroidHome\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
    $adbCmd = Get-Command "adb.exe" -ErrorAction SilentlyContinue
    if ($adbCmd) { $adb = $adbCmd.Source } else { $adb = "adb" }
}

$devices = @()
$unauthorized = @()
$adbOutput = try { & $adb devices 2>$null } catch { $null }
if ($adbOutput) {
    foreach ($line in $adbOutput) {
        if ($line -match '^(\S+)\s+device$') {
            $devices += $Matches[1]
        } elseif ($line -match '^(\S+)\s+(unauthorized|offline|connecting)$') {
            $unauthorized += [PSCustomObject]@{ Serial = $Matches[1]; Status = $Matches[2] }
        }
    }
}

if ($unauthorized.Count -gt 0) {
    Write-Host "   [WARN] Detected offline/unauthorized devices:" -ForegroundColor $WarningColor
    foreach ($u in $unauthorized) {
        Write-Host "      * $($u.Serial) [$($u.Status)]" -ForegroundColor $ErrorColor
    }
    Write-Host "      Please unlock phone screen and allow USB debugging." -ForegroundColor $WarningColor
}

$deviceConnected = $devices.Count -gt 0
$selectedDevice = $null
if ($deviceConnected) {
    Write-Host "   - Connected devices: $($devices.Count)" -ForegroundColor $SuccessColor
    # Auto-select physical device
    $physical = @($devices | Where-Object { $_ -notmatch '^emulator-' -and $_ -notmatch '^127\.' })
    if ($physical.Count -gt 0) {
        $selectedDevice = $physical[0]
    } else {
        $selectedDevice = $devices[0]
    }
} else {
    Write-Host "   - No ADB devices detected." -ForegroundColor Gray
}

# Parse Args
$AutoMode = $false
foreach ($arg in $args) {
    if ($arg -eq "--auto") { $AutoMode = $true }
}
if ($env:STRONGERN_AUTO -eq "1") { $AutoMode = $true }

# 4. Interactive Target Choice (Skip if auto or device connected)
$ArchFlag = "-PreactNativeArchitectures=arm64-v8a"
if ($AutoMode -or $deviceConnected) {
    Write-Host "`n[4/6] Target Architecture Auto-Selection:" -ForegroundColor $PrimaryColor
    if ($selectedDevice) {
        try {
            $deviceAbi = (& $adb -s $selectedDevice shell getprop ro.product.cpu.abi).Trim()
            if ($deviceAbi -match "x86_64") {
                $ArchFlag = "-PreactNativeArchitectures=x86_64"
                Write-Host "   - Detected connected device ($selectedDevice) ABI: x86_64 (Emulator target)" -ForegroundColor $SuccessColor
            } elseif ($deviceAbi -match "arm64") {
                $ArchFlag = "-PreactNativeArchitectures=arm64-v8a"
                Write-Host "   - Detected connected device ($selectedDevice) ABI: arm64-v8a (Physical device target)" -ForegroundColor $SuccessColor
            } else {
                $ArchFlag = "-PreactNativeArchitectures=arm64-v8a,x86_64"
                Write-Host "   - Detected connected device ($selectedDevice) ABI: $deviceAbi" -ForegroundColor $SuccessColor
            }
        } catch {
            $ArchFlag = "-PreactNativeArchitectures=arm64-v8a"
            Write-Host "   - Selected fallback: Physical Device (arm64-v8a)" -ForegroundColor $SuccessColor
        }
    } else {
        $ArchFlag = "-PreactNativeArchitectures=arm64-v8a"
        Write-Host "   - Selected default: Physical Device (arm64-v8a)" -ForegroundColor $SuccessColor
    }
} else {
    Write-Host "`n[4/6] Target Architecture Selection" -ForegroundColor $PrimaryColor
    Write-Host "   Restricting builds to target devices builds MUCH faster." -ForegroundColor Gray
    Write-Host "     [1] Universal APK (Slow - compiles all architectures)" -ForegroundColor Gray
    Write-Host "     [2] Physical Device (Fast - arm64-v8a) [DEFAULT]" -ForegroundColor $PrimaryColor
    Write-Host "     [3] Emulator (Fast - x86_64)" -ForegroundColor Gray
    Write-Host ""
    
    # Custom input timeout function
    function Read-InputWithTimeout {
        param(
            [string]$Prompt,
            [int]$TimeoutSeconds,
            [string]$DefaultValue
        )
        Write-Host "$Prompt (default is '$DefaultValue' in ${TimeoutSeconds}s): " -NoNewline
        $elapsed = 0
        $inputBuffer = ""
        try {
            while ($elapsed -lt $TimeoutSeconds) {
                if ([Console]::KeyAvailable) {
                    $key = [Console]::ReadKey($true)
                    if ($key.Key -eq [ConsoleKey]::Enter) {
                        Write-Host ""
                        return $inputBuffer
                    } elseif ($key.Key -eq [ConsoleKey]::Backspace) {
                        if ($inputBuffer.Length -gt 0) {
                            $inputBuffer = $inputBuffer.SubString(0, $inputBuffer.Length - 1)
                            Write-Host "`b `b" -NoNewline
                        }
                    } else {
                        $char = $key.KeyChar
                        $inputBuffer += $char
                        Write-Host $char -NoNewline
                    }
                }
                Start-Sleep -Milliseconds 100
                $elapsed += 0.1
            }
            Write-Host $DefaultValue
            return $DefaultValue
        } catch {
            Write-Host $DefaultValue
            return $DefaultValue
        }
    }

    $archChoice = Read-InputWithTimeout "   Select build target (1-3)" 5 "2"
    if ($archChoice -eq "1") {
        $ArchFlag = ""
        Write-Host "   Building for all architectures..." -ForegroundColor $WarningColor
    } elseif ($archChoice -eq "3") {
        $ArchFlag = "-PreactNativeArchitectures=x86_64"
        Write-Host "   Building for Emulator only (x86_64)..." -ForegroundColor $SuccessColor
    } else {
        $ArchFlag = "-PreactNativeArchitectures=arm64-v8a"
        Write-Host "   Building for Physical Device only (arm64-v8a)..." -ForegroundColor $SuccessColor
    }
}

# 5. Expo Prebuild & Build Execution
Write-Host "`n[5/6] Building Standalone APK..." -ForegroundColor $PrimaryColor

# Run prebuild if android directory doesn't exist
if (-not (Test-Path "android")) {
    Write-Host "[WARN] Android directory not found. Running Expo prebuild..." -ForegroundColor $WarningColor
    npx expo prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Expo prebuild failed."
        exit 1
    }
}

# Build parameters
$gradleArgs = @("assembleRelease", $ArchFlag)
$gradleArgs += "-x"
$gradleArgs += "lintVitalRelease"
$gradleArgs += "-x"
$gradleArgs += "lintVitalAnalyzeRelease"
$gradleArgs += "-x"
$gradleArgs += "lintVitalReportRelease"

Write-Host "   Running: gradlew.bat $($gradleArgs -join ' ')" -ForegroundColor Gray
Write-Host "   This compiles all local assets. Please wait...`n" -ForegroundColor $PrimaryColor

$gradlewPath = Join-Path $ProjectRoot "android\gradlew.bat"

# Start the build stopwatch
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

# Start the build process
$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = $gradlewPath
$pinfo.Arguments = $gradleArgs -join " "
$pinfo.WorkingDirectory = (Join-Path $ProjectRoot "android")
$pinfo.UseShellExecute = $false
$process = [System.Diagnostics.Process]::Start($pinfo)
$process.WaitForExit()

$stopwatch.Stop()
$buildTime = [Math]::Round($stopwatch.Elapsed.TotalSeconds, 1)

if ($process.ExitCode -ne 0) {
    Write-Host "`n[ERROR] Gradle compilation failed! (Took $buildTime seconds)" -ForegroundColor $ErrorColor
    exit 1
}

# Create APK destination
$apkSrc = "android\app\build\outputs\apk\release\app-release.apk"
$apkDest = "apk\strongerN.apk"
if (-not (Test-Path "apk")) {
    New-Item -ItemType Directory -Path "apk" | Out-Null
}

if (Test-Path $apkSrc) {
    Copy-Item $apkSrc $apkDest -Force
    Write-Host "`n[SUCCESS] Standalone APK successfully compiled: $apkDest (Took $buildTime seconds)" -ForegroundColor $SuccessColor

    # Run Automated Release APK Census & Assertions
    $inspectScript = Join-Path $PSScriptRoot "inspect-apk.ps1"
    if (Test-Path $inspectScript) {
        Write-Host "`n[CENSUS] Running Release APK Census & Quality Assertions..." -ForegroundColor $PrimaryColor
        & $inspectScript -ApkPath $apkDest -Assert
        if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) {
            Write-Error "Release APK Census assertion failed!"
            exit 1
        }
    }
} else {
    Write-Error "Compiled APK could not be found at: $apkSrc (Took $buildTime seconds)"
    exit 1
}

# 6. Post-Build Actions
Write-Host "`n[6/6] Post-Build Actions..." -ForegroundColor $PrimaryColor

# ADB Installation if connected
function Install-ADB {
    param([string]$device, [string]$apkPath)
    
    $manufacturer = "Unknown"
    $model = "Unknown"
    try {
        $manufacturer = (& $adb -s $device shell getprop ro.product.manufacturer).Trim().ToUpper()
        $model = (& $adb -s $device shell getprop ro.product.model).Trim()
    } catch {}

    $apkSizeMb = 0
    try {
        $apkSizeMb = [Math]::Round((Get-Item $apkPath).Length / 1MB, 2)
    } catch {}

    Write-Host "`n======================================================================" -ForegroundColor $PrimaryColor
    Write-Host "                 ADB Standalone App Installation" -ForegroundColor $PrimaryColor
    Write-Host "======================================================================" -ForegroundColor $PrimaryColor
    Write-Host "   - Device Model:  $manufacturer $model ($device)" -ForegroundColor Gray
    Write-Host "   - APK File:      $apkPath ($apkSizeMb MB)" -ForegroundColor Gray
    Write-Host "   - Instructions:  Please keep your phone screen UNLOCKED and awake." -ForegroundColor Gray
    Write-Host "                    Press 'C' at any time to cancel/abort installation." -ForegroundColor $WarningColor
    Write-Host "======================================================================" -ForegroundColor $PrimaryColor

    if ($manufacturer -match "OPPO|REALME|ONEPLUS|VIVO") {
        Write-Host "`n[ColorOS/FuntouchOS Warning]" -ForegroundColor $WarningColor
        Write-Host "Oppo/Realme/OnePlus/Vivo require you to manually authorize USB installs." -ForegroundColor $WarningColor
        Write-Host "Please check your phone screen and tap 'Install' when prompted!" -ForegroundColor $WarningColor
    }

    Write-Host "`n   [ADB] Starting standard stream installation..." -ForegroundColor $PrimaryColor
    
    # Run in background (using -r -d to allow version downgrades)
    $p = Start-Process $adb -ArgumentList "-s", $device, "install", "-r", "-d", $apkPath -NoNewWindow -PassThru
    
    $elapsed = 0
    $aborted = $false
    
    while (-not $p.HasExited) {
        # Check key presses in a 1-second interval split into 10 checks
        for ($k = 0; $k -lt 10; $k++) {
            if ($p.HasExited) { break }
            try {
                if ([Console]::KeyAvailable) {
                    $key = [Console]::ReadKey($true)
                    if ($key.KeyChar -eq 'c' -or $key.KeyChar -eq 'C') {
                        $aborted = $true
                        break
                    }
                }
            } catch {}
            Start-Sleep -Milliseconds 100
        }
        
        if ($aborted -or $p.HasExited) { break }
        
        $elapsed++
        Write-Host -NoNewline "`r   [ADB] Status: Installing... ($($elapsed)s elapsed) [Press 'C' to Cancel]" -ForegroundColor $AccentColor
    }
    
    # Clear line
    Write-Host "`r                                                                                `r" -NoNewline

    if ($aborted) {
        try {
            $p | Stop-Process -Force
        } catch {}
        Write-Host "❌ Installation aborted/cancelled by user." -ForegroundColor $ErrorColor
        return $false
    }
    
    try { $p.Refresh() } catch {}
    $needFallback = $false
    if ($p.ExitCode -and $p.ExitCode -ne 0) {
        Write-Host "[WARN] Standard installation failed (Exit Code: $($p.ExitCode))." -ForegroundColor $WarningColor
        $needFallback = $true
    }

    if ($needFallback) {
        try {
            Write-Host "`n======================================================================" -ForegroundColor $WarningColor
            Write-Host "           Attempting Fallback Installation (Push + Local Install)" -ForegroundColor $WarningColor
            Write-Host "======================================================================" -ForegroundColor $WarningColor
            Write-Host "   1/3 Pushing APK to device /data/local/tmp/..." -ForegroundColor $PrimaryColor
            $pushArgs = @("-s", $device, "push", $apkPath, "/data/local/tmp/strongerN.apk")
            $pPush = Start-Process $adb -ArgumentList $pushArgs -NoNewWindow -PassThru -Wait
            if ($pPush.ExitCode -ne 0) {
                Write-Host "❌ Fallback push failed. Check USB connection mode (must be Transfer Files/MTP)." -ForegroundColor $ErrorColor
                return $false
            }

            Write-Host "   2/3 Running package manager installer on device..." -ForegroundColor $PrimaryColor
            Write-Host "       Check phone screen for the install authorization popup!" -ForegroundColor $WarningColor
            $installArgs = @("-s", $device, "shell", "pm", "install", "-r", "-d", "/data/local/tmp/strongerN.apk")
            
            # Start pm install in background to make it cancelable by C key as well!
            $pShell = Start-Process $adb -ArgumentList $installArgs -NoNewWindow -PassThru
            $elapsedFallback = 0
            $abortedFallback = $false
            while (-not $pShell.HasExited) {
                for ($k = 0; $k -lt 10; $k++) {
                    if ($pShell.HasExited) { break }
                    try {
                        if ([Console]::KeyAvailable) {
                            $key = [Console]::ReadKey($true)
                            if ($key.KeyChar -eq 'c' -or $key.KeyChar -eq 'C') {
                                $abortedFallback = $true
                                break
                            }
                        }
                    } catch {}
                    Start-Sleep -Milliseconds 100
                }
                if ($abortedFallback -or $pShell.HasExited) { break }
                $elapsedFallback++
                Write-Host -NoNewline "`r   [ADB] Status: Local Installing... ($($elapsedFallback)s elapsed) [Press 'C' to Cancel]" -ForegroundColor $AccentColor
            }
            Write-Host "`r                                                                                `r" -NoNewline
            
            if ($abortedFallback) {
                try { $pShell | Stop-Process -Force } catch {}
                # Clean up
                $cleanArgs = @("-s", $device, "shell", "rm", "/data/local/tmp/strongerN.apk")
                Start-Process $adb -ArgumentList $cleanArgs -NoNewWindow -PassThru -Wait | Out-Null
                Write-Host "❌ Fallback installation aborted by user." -ForegroundColor $ErrorColor
                return $false
            }

            Write-Host "   3/3 Cleaning up temporary file..." -ForegroundColor $PrimaryColor
            $cleanArgs = @("-s", $device, "shell", "rm", "/data/local/tmp/strongerN.apk")
            Start-Process $adb -ArgumentList $cleanArgs -NoNewWindow -PassThru -Wait | Out-Null
            
            try { $pShell.Refresh() } catch {}
            if ($pShell.ExitCode -and $pShell.ExitCode -ne 0) {
                Write-Host "❌ Fallback installation failed (Exit Code: $($pShell.ExitCode))." -ForegroundColor $ErrorColor
                return $false
            }
            
            Write-Host "[SUCCESS] Fallback installation completed successfully!" -ForegroundColor $SuccessColor
            return $true
        } catch {
            Write-Host "[ERROR] Fallback installation encountered an error: $_" -ForegroundColor $ErrorColor
            return $false
        }
    }
    
    Write-Host "[SUCCESS] App successfully installed on $device!" -ForegroundColor $SuccessColor
    return $true
}

# Web Server deployment
function Start-WebServer {
    param([string]$apkPath)
    # Get local IP
    $ip = "127.0.0.1"
    try {
        $ip = (Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Get-NetIPAddress | Where-Object { $_.AddressFamily -eq 'IPv4' } | Select-Object -ExpandProperty IPAddress -First 1)
    } catch {}
    
    $port = 8080
    Write-Host "`n======================================================================" -ForegroundColor $PrimaryColor
    Write-Host "                     LOCAL WI-FI APK SERVER" -ForegroundColor $PrimaryColor
    Write-Host "======================================================================" -ForegroundColor $ProjectRoot
    Write-Host "  1. Ensure your phone is connected to the same Wi-Fi network ($ip)." -ForegroundColor Gray
    Write-Host "  2. Access the download link on your phone:" -ForegroundColor Gray
    Write-Host "     http://$($ip):$($port)/strongerN.apk" -ForegroundColor $SuccessColor
    Write-Host "======================================================================" -ForegroundColor $PrimaryColor
    
    # Open QR Code URL
    try {
        $qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=http://' + $ip + ':' + $port + '/strongerN.apk'
        Start-Process $qrUrl
    } catch {}
    
    # Start pure .NET socket listener
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $port)
    try {
        $listener.Start()
    } catch {
        Write-Host "[ERROR] Failed to start TCP Listener on port $port. Port might be in use." -ForegroundColor $ErrorColor
        return
    }
    
    Write-Host "`n[SERVER] HTTP server listening on port $port. Press any key in this window to stop." -ForegroundColor $WarningColor
    
    $apkFull = Resolve-Path $apkPath
    
    while ($true) {
        if ([Console]::KeyAvailable) {
            $null = [Console]::ReadKey($true)
            break
        }
        if ($listener.Pending()) {
            $client = $listener.AcceptTcpClient()
            $stream = $client.GetStream()
            $reader = New-Object System.IO.StreamReader($stream)
            try {
                $line = $reader.ReadLine()
                if ($line -match "GET /strongerN.apk") {
                    Write-Host "   [SERVER] Sending APK to $($client.Client.RemoteEndPoint.Address)..." -ForegroundColor $SuccessColor
                    $apkBytes = [System.IO.File]::ReadAllBytes($apkFull)
                    $writer = New-Object System.IO.StreamWriter($stream)
                    $writer.WriteLine("HTTP/1.1 200 OK")
                    $writer.WriteLine("Content-Type: application/vnd.android.package-archive")
                    $writer.WriteLine("Content-Length: " + $apkBytes.Length)
                    $writer.WriteLine("Connection: close")
                    $writer.WriteLine("")
                    $writer.Flush()
                    $stream.Write($apkBytes, 0, $apkBytes.Length)
                    Write-Host "   [SERVER] Transfer completed successfully." -ForegroundColor $SuccessColor
                } else {
                    $writer = New-Object System.IO.StreamWriter($stream)
                    $writer.WriteLine("HTTP/1.1 200 OK")
                    $writer.WriteLine("Content-Type: text/html; charset=utf-8")
                    $writer.WriteLine("Connection: close")
                    $writer.WriteLine("")
                    $writer.WriteLine("<html><body><h1>strongerN APK Server</h1><p><a href='/strongerN.apk'>Download strongerN.apk</a></p></body></html>")
                    $writer.Flush()
                }
            } catch {
                Write-Host "   [SERVER] Connection closed unexpectedly." -ForegroundColor $WarningColor
            }
            $client.Close()
        }
        Start-Sleep -Milliseconds 50
    }
    $listener.Stop()
    Write-Host "[SERVER] Server stopped." -ForegroundColor $WarningColor
}

if ($AutoMode) {
    if ($selectedDevice) {
        $success = Install-ADB -device $selectedDevice -apkPath $apkDest
        if (-not $success) { exit 1 }
    } else {
        Write-Host "   - Auto Mode: No device connected. Exiting..." -ForegroundColor $WarningColor
    }
    exit 0
}

# Interactive post-build loop
while ($true) {
    if ($selectedDevice) {
        Write-Host "`n* Device connected. Automatically starting installation..." -ForegroundColor $SuccessColor
        $success = Install-ADB -device $selectedDevice -apkPath $apkDest
        # Clear selected device after one installation to prevent infinite loop or give options
        $selectedDevice = $null
        continue
    }
    
    Write-Host "`n======================================================================" -ForegroundColor $PrimaryColor
    Write-Host "                 strongerN - Installation Menu" -ForegroundColor $PrimaryColor
    Write-Host "======================================================================" -ForegroundColor $PrimaryColor
    Write-Host "  [1] Install via USB (requires phone with USB debugging)" -ForegroundColor $PrimaryColor
    Write-Host "  [2] Serve over Wi-Fi (starts local web server & QR code)" -ForegroundColor $PrimaryColor
    Write-Host "  [3] Open folder containing the APK" -ForegroundColor Gray
    Write-Host "  [4] Exit" -ForegroundColor Gray
    Write-Host "======================================================================" -ForegroundColor $PrimaryColor
    Write-Host ""
    
    $choice = Read-Host "   Enter option (1-4)"
    if ($choice -eq "1") {
        # Scan devices again
        $devices = @()
        $adbOutput = & $adb devices 2>$null
        if ($adbOutput) {
            foreach ($line in $adbOutput) {
                if ($line -match '^(\S+)\s+device$') { $devices += $Matches[1] }
            }
        }
        
        if ($devices.Count -eq 0) {
            Write-Host "[ERROR] No USB devices detected. Ensure USB Debugging is ON." -ForegroundColor $ErrorColor
        } elseif ($devices.Count -eq 1) {
            Install-ADB -device $devices[0] -apkPath $apkDest
        } else {
            # Let user select
            Write-Host "`nMultiple Devices Detected:" -ForegroundColor $WarningColor
            for ($i = 0; $i -lt $devices.Count; $i++) {
                $dev = $devices[$i]
                $model = "Unknown Model"
                try {
                    $model = (& $adb -s $dev shell getprop ro.product.model).Trim()
                } catch {}
                Write-Host "  [$($i+1)] $dev ($model)" -ForegroundColor $PrimaryColor
            }
            $devChoice = Read-Host "`nSelect device number (1-$($devices.Count)) [Default is 1]"
            $idx = 0
            if ([int]::TryParse($devChoice, [ref]$idx)) {
                if ($idx -ge 1 -and $idx -le $devices.Count) {
                    Install-ADB -device $devices[$idx-1] -apkPath $apkDest
                    continue
                }
            }
            Install-ADB -device $devices[0] -apkPath $apkDest
        }
    } elseif ($choice -eq "2") {
        Start-WebServer -apkPath $apkDest
    } elseif ($choice -eq "3") {
        explorer "apk"
    } elseif ($choice -eq "4") {
        Write-Host "`nThank you for using strongerN! Happy training.`n" -ForegroundColor $PrimaryColor
        break
    } else {
        Write-Host "[ERROR] Invalid choice: $choice" -ForegroundColor $ErrorColor
    }
}
