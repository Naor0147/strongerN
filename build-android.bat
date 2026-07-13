@echo off
title strongerN - Android Dev Client Builder/Runner
setlocal
cd /d "%~dp0"

:: Set compatible JDK 19 environment and Android SDK
set "ANDROID_HOME=C:\Users\NAORA\AppData\Local\Android\Sdk"
set "PATH=%PATH%;%ANDROID_HOME%\platform-tools"

set "JAVA_HOME="
if exist "C:\Program Files\Java\jdk-19" (
    set "JAVA_HOME=C:\Program Files\Java\jdk-19"
    echo [INFO] Java: Using compatible JDK 19 at C:\Program Files\Java\jdk-19
)

echo ===================================================
echo  strongerN - Android Dev Client Builder/Runner
echo ===================================================
echo.
echo Make sure you have an Android device connected via USB with USB Debugging enabled,
echo or an emulator currently running.
echo.
echo Starting Android compilation and deployment...
echo.
call npx expo run:android
echo.
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Build/Run failed! Please check if your Android SDK is configured
    echo and if a device or emulator is connected/running.
) else (
    echo.
    echo [SUCCESS] Build completed and installed successfully!
)
echo.
pause
