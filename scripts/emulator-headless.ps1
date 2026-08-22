# scripts/emulator-headless.ps1 — Headless Pixel emulator for CI / no-screen testing
$ErrorActionPreference = "Stop"
$AVD = if ($args.Count -gt 0) { $args[0] } else { "Pixel_8_API_34" }
$AndroidHome = $env:ANDROID_HOME; if ([string]::IsNullOrEmpty($AndroidHome)) { $AndroidHome = "C:\Users\NAORA\AppData\Local\Android\Sdk"; $env:ANDROID_HOME=$AndroidHome }
$emulator = Join-Path $AndroidHome "emulator\emulator.exe"
$adb = Join-Path $AndroidHome "platform-tools\adb.exe"
if (-not (Test-Path $emulator)) { $emulator="emulator" }
if (-not (Test-Path $adb)) { $adb="adb" }
Write-Host "[emulator-headless] Starting AVD $AVD headless (-no-window)..." -ForegroundColor Cyan
$proc = Start-Process -FilePath $emulator -ArgumentList "-avd",$AVD,"-no-window","-no-audio","-gpu","swiftshader_indirect","-memory","2048","-no-snapshot-save" -PassThru
Write-Host "[emulator-headless] Waiting for boot..." -ForegroundColor Yellow
& $adb wait-for-device
$timeout=120; $elapsed=0
while ($elapsed -lt $timeout) {
  $boot = (& $adb shell getprop sys.boot_completed 2>$null).Trim()
  if ($boot -eq "1") { break }
  Start-Sleep -Seconds 2; $elapsed+=2
  Write-Host "[emulator-headless] boot wait ${elapsed}s..." -ForegroundColor Gray
}
if ($elapsed -ge $timeout) { Write-Host "[emulator-headless] TIMEOUT" -ForegroundColor Red; exit 1 }
& $adb shell settings put global window_animation_scale 0 2>$null
& $adb shell settings put global transition_animation_scale 0 2>$null
& $adb shell settings put global animator_duration_scale 0 2>$null
Write-Host "[emulator-headless] Ready: $(& $adb shell getprop ro.product.model)" -ForegroundColor Green
# Keep alive until key press or CI kill
if ($env:CI -eq "true") { exit 0 }
Write-Host "[emulator-headless] Press any key to stop emulator (or kill PID $($proc.Id))" -ForegroundColor Yellow
try { [Console]::ReadKey($true) | Out-Null } catch {}
try { Stop-Process -Id $proc.Id -Force } catch {}
