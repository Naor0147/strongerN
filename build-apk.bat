@echo off
title strongerN - Standalone APK Builder and Server
cls

:: Navigate to project directory
cd /d "%~dp0"

color 0B
echo ======================================================================
echo.
echo                 strongerN - AMOLED-First Fitness Tracker
echo                       Android Standalone APK Builder
echo.
echo ======================================================================
echo.

:: Set environment variables
set "ANDROID_HOME=C:\Users\NAORA\AppData\Local\Android\Sdk"
set "PATH=%PATH%;%ANDROID_HOME%\platform-tools"

:: Auto mode: pass --auto flag to skip all interactive prompts and exit after build
set "AUTO_MODE=false"
for %%a in (%*) do if /i "%%a"=="--auto" set "AUTO_MODE=true"
if defined STRONGERN_AUTO if /i "%STRONGERN_AUTO%"=="1" set "AUTO_MODE=true"

:: Check if ADB device is connected
set "DEVICE_CONNECTED=false"
for /f "tokens=1,2" %%A in ('adb.exe devices 2^>nul') do (
    if "%%B"=="device" set "DEVICE_CONNECTED=true"
)
if "%DEVICE_CONNECTED%"=="true" (
    echo [SYSTEM] USB Device detected! Enabling automatic installation mode.
    echo.
)

set "JAVA_HOME="
if exist "C:\Program Files\Java\jdk-19" (
    set "JAVA_HOME=C:\Program Files\Java\jdk-19"
    echo [SYSTEM] Using compatible JDK 19 at C:\Program Files\Java\jdk-19
) else (
    echo [SYSTEM] JDK 19 not found at default location. Attempting default JAVA_HOME.
)

echo [SYSTEM] Android SDK: %ANDROID_HOME%
echo.

set "APK_SRC=android\app\build\outputs\apk\release\app-release.apk"
set "APK_DEST=apk\strongerN.apk"

:: Check if APK already exists to offer skipping build
if exist "%APK_DEST%" (
    if "%DEVICE_CONNECTED%"=="true" (
        echo [INFO] USB Device connected. Automatically rebuilding and installing...
        echo.
        goto skip_rebuild_prompt
    )
    if "%AUTO_MODE%"=="true" (
        echo [INFO] Auto mode. Rebuilding...
        echo.
        goto skip_rebuild_prompt
    )
    color 0E
    echo ======================================================================
    echo [INFO] An existing compiled APK was found at: %APK_DEST%
    echo ======================================================================
    echo.
    set /p rebuild="Do you want to recompile/build a new APK? (y/n): "
    if /i "%rebuild%"=="n" goto post_build_menu
    if /i "%rebuild%"=="no" goto post_build_menu
    echo.
)
:skip_rebuild_prompt

:: Run prebuild if android folder is missing
if not exist "android" (
    color 0E
    echo [PREBUILD] Android directory not found. Running Expo prebuild...
    call npx expo prebuild --platform android --no-install
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo.
        echo [ERROR] Expo prebuild failed. Please check dependencies.
        echo.
        if not "%AUTO_MODE%"=="true" pause
        exit /b 1
    )
    color 0B
)

:: Select Build Target Architecture to optimize build speed
if "%DEVICE_CONNECTED%"=="true" goto auto_arch
if "%AUTO_MODE%"=="true" goto auto_arch
goto show_arch_menu

:auto_arch
set "ARCH_FLAG=-PreactNativeArchitectures=arm64-v8a"
echo [BUILD] USB Device connected. Automatically compiling for Physical Device [arm64-v8a]...
echo.
goto skip_arch_prompt

:show_arch_menu
color 0E
echo ======================================================================
echo [OPTIMIZATION] Select Build Target Architecture
echo ======================================================================
echo React Native compiles native C++ code for each target architecture.
echo Restricting the build to your target device is MUCH faster.
echo.
echo  [1] Universal APK (Slow - compiles arm64-v8a, armeabi-v7a, x86, x86_64)
echo  [2] Physical Device ONLY (Fastest - compiles arm64-v8a for modern phones)
echo  [3] Emulator ONLY (Fastest - compiles x86_64 for Android Studio emulators)
echo.
set /p arch_choice="Select build target (1-3) [Default is 2]: "

set "ARCH_FLAG="
if "%arch_choice%"=="1" (
    set "ARCH_FLAG="
    echo [BUILD] Building for all architectures...
) else if "%arch_choice%"=="3" (
    set "ARCH_FLAG=-PreactNativeArchitectures=x86_64"
    echo [BUILD] Building for Emulator [x86_64] only...
) else (
    set "ARCH_FLAG=-PreactNativeArchitectures=arm64-v8a"
    echo [BUILD] Building for Physical Device [arm64-v8a] only...
)
echo.
:skip_arch_prompt

:: Build the standalone APK
echo ======================================================================
echo [BUILD] Compiling Standalone Android APK (Release Variant)
echo This compiles all assets locally. Please wait...
echo ======================================================================
echo.

cd android
call gradlew.bat assembleRelease %ARCH_FLAG%
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] Gradle compilation failed. Please verify build configuration or Java version.
    echo.
    cd ..
    if not "%AUTO_MODE%"=="true" pause
    exit /b 1
)

cd ..

:: Locate compiled APK
if not exist "%APK_SRC%" (
    color 0C
    echo.
    echo [ERROR] Compiled APK not found at: %APK_SRC%
    echo.
    if not "%AUTO_MODE%"=="true" pause
    exit /b 1
)

:: Create apk folder and copy
if not exist "apk" mkdir apk
copy /y "%APK_SRC%" "%APK_DEST%" >nul

:post_build_menu
if "%DEVICE_CONNECTED%"=="true" goto install_usb
if "%AUTO_MODE%"=="true" (
    echo [SYSTEM] Auto mode. Build complete. APK at: %APK_DEST%
    goto exit_script
)
cls
color 0B
echo ======================================================================
echo                 strongerN - APK Installation Menu
echo ======================================================================
echo.
echo  [1] Install via USB (requires phone connected with USB Debugging enabled)
echo  [2] Serve over Wi-Fi (starts local web server and shows QR code)
echo  [3] Open output folder containing the APK
echo  [4] Exit
echo.
echo ======================================================================
echo.
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" goto install_usb
if "%choice%"=="2" goto serve_wifi
if "%choice%"=="3" goto open_folder
if "%choice%"=="4" goto exit_script

echo.
color 0C
echo [ERROR] Invalid selection "%choice%".
pause
goto post_build_menu

:install_usb
cls
color 0E
echo ======================================================================
echo                 Installing strongerN via USB (ADB)
echo ======================================================================
echo.
echo [ADB] Checking for connected devices...
echo.

set "SELECTED_DEVICE="
set "TEMP_DEVICE_FILE=%TEMP%\selected_adb_device.txt"
if exist "%TEMP_DEVICE_FILE%" del /q "%TEMP_DEVICE_FILE%"

call powershell -NonInteractive -ExecutionPolicy Bypass -File "%~dp0scripts\select-device.ps1" "%AUTO_MODE%" <nul

if exist "%TEMP_DEVICE_FILE%" (
    for /f "usebackq tokens=*" %%a in ("%TEMP_DEVICE_FILE%") do (
        set "SELECTED_DEVICE=%%a"
    )
    del /q "%TEMP_DEVICE_FILE%"
)

if "%SELECTED_DEVICE%"=="" (
    color 0E
    echo [WARN] No active ADB devices found.
    if "%AUTO_MODE%"=="true" (
        echo [SYSTEM] Exiting auto build script since no devices are connected.
        goto exit_script
    )
    echo.
    echo If your device is connected, please ensure:
    echo  1. The phone is connected to this PC via USB.
    echo  2. USB Debugging is turned ON in Developer Options on your phone.
    echo  3. You accepted the "Allow USB debugging" prompt on your phone's screen.
    echo.
    set /p proceed="Retry installation? (y/n): "
    if /i "%proceed%"=="y" goto install_usb
    goto post_build_menu
)

:proceed_install
echo.
echo [ADB] Target device: %SELECTED_DEVICE%
echo.
echo ======================================================================
echo IMPORTANT: Please UNLOCK your phone screen and keep it awake!
echo Accept any "Install via USB" or "Play Protect" prompts on your phone.
echo ======================================================================
echo.
echo [ADB] Installing "%APK_DEST%" on device %SELECTED_DEVICE% (30s timeout)...
call powershell -NonInteractive -ExecutionPolicy Bypass -Command "$p = Start-Process adb.exe -ArgumentList '-s %SELECTED_DEVICE% install -r \"%APK_DEST%\"' -NoNewWindow -PassThru; if ($p) { if (-not $p.WaitForExit(30000)) { $p | Stop-Process -Force; Write-Host '[ERROR] Installation timed out! Please unlock your phone screen and allow install via USB.' -ForegroundColor Red; exit 1 } else { exit $p.ExitCode } }" <nul
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] ADB installation failed or timed out.
    echo.
    if "%AUTO_MODE%"=="true" (
        goto exit_script
    )
    pause
    goto post_build_menu
)

color 0A
echo.
echo [SUCCESS] App successfully installed on %SELECTED_DEVICE%!
echo.
if "%AUTO_MODE%"=="true" (
    goto exit_script
)
pause
goto post_build_menu

:serve_wifi
cls
color 0A
echo ======================================================================
echo                 strongerN - Local Wi-Fi Download Server
echo ======================================================================
echo.
echo [APK Path] C:\Antigravity\strongerN\%APK_DEST%
echo.

:: Get local IP address dynamically using PowerShell
for /f "usebackq tokens=*" %%a in (`powershell -Command "(Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Get-NetIPAddress | Where-Object { $_.AddressFamily -eq 'IPv4' } | Select-Object -ExpandProperty IPAddress -First 1)"`) do (
    set "IP=%%a"
)

if "%IP%"=="" (
    set "IP=127.0.0.1"
    echo [WARN] Active local IP address could not be resolved. Defaulting to localhost.
)

set "DOWNLOAD_URL=http://%IP%:8080/strongerN.apk"

echo ======================================================================
echo                      DOWNLOAD THE APP ON YOUR PHONE
echo ======================================================================
echo.
echo  1. Make sure your phone is connected to the same Wi-Fi network (%IP%).
echo  2. Open the QR Code generated in your browser or type the URL:
echo.
echo     %DOWNLOAD_URL%
echo.
echo  3. On your Android device, allow "Install from Unknown Sources".
echo.
echo ======================================================================
echo.

:: Open QR Code URL in default browser
echo [SYSTEM] Opening download QR Code in browser...
start https://api.qrserver.com/v1/create-qr-code/?size=300x300^&data=http://%IP%:8080/strongerN.apk

:: Run Local Server
echo [SERVER] Starting local HTTP Server on port 8080...
echo [SERVER] Press Ctrl+C to stop the server when done.
echo.

cd apk
python -m http.server 8080
cd ..
goto post_build_menu

:open_folder
explorer "apk"
goto post_build_menu

:exit_script
cls
color 0F
echo.
echo Thank you for using strongerN! Happy training.
echo.
if not "%AUTO_MODE%"=="true" timeout /t 2 >nul
exit /b 0
