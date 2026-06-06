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
        pause
        exit /b 1
    )
    color 0B
)

:: Build the standalone APK
echo ======================================================================
echo [BUILD] Compiling Standalone Android APK (Release Variant)
echo This compiles all assets locally. Please wait...
echo ======================================================================
echo.

cd android
call gradlew.bat assembleRelease
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] Gradle compilation failed. Please verify build configuration or Java version.
    echo.
    cd ..
    pause
    exit /b 1
)

cd ..

:: Locate compiled APK
if not exist "%APK_SRC%" (
    color 0C
    echo.
    echo [ERROR] Compiled APK not found at: %APK_SRC%
    echo.
    pause
    exit /b 1
)

:: Create apk folder and copy
if not exist "apk" mkdir apk
copy /y "%APK_SRC%" "%APK_DEST%" >nul

:post_build_menu
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
call adb.exe devices
echo.
echo If your device is not listed above as "device", please ensure:
echo  1. The phone is connected to this PC via USB.
echo  2. USB Debugging is turned ON in Developer Options on your phone.
echo  3. You accepted the "Allow USB debugging" prompt on your phone's screen.
echo.
set /p proceed="Attempt installation? (y/n): "
if /i "%proceed%" neq "y" goto post_build_menu

echo.
echo [ADB] Installing "%APK_DEST%" on your device...
call adb.exe install -r "%APK_DEST%"
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] ADB installation failed. Please check the error message above.
    echo.
    pause
    goto post_build_menu
)

color 0A
echo.
echo [SUCCESS] App successfully installed on your device!
echo.
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
timeout /t 2 >nul
exit /b 0
