@echo off
title strongerN - AMOLED-First Fitness Tracker Launcher
cls

:: Navigate to the directory where the batch file is located
cd /d "%~dp0"

:menu
cls
color 0B
echo ======================================================================
echo.
echo                 strongerN - AMOLED-First Fitness Tracker
echo                       Development Launcher Control
echo.
echo ======================================================================
echo.
echo  [1] Start Metro Bundler Server (expo start)
echo  [2] Run on Android Emulator/Device (expo start --android)
echo  [3] Run on iOS Simulator (expo start --ios)
echo  [4] Run on Web Browser (expo start --web)
echo  [5] Clear Expo Cache and Start (expo start -c)
echo  [6] Install Dependencies (npm install)
echo  [7] Exit
echo.
echo ======================================================================
echo.
set /p choice="Enter your choice (1-7): "

if "%choice%"=="1" goto run_start
if "%choice%"=="2" goto run_android
if "%choice%"=="3" goto run_ios
if "%choice%"=="4" goto run_web
if "%choice%"=="5" goto run_clear
if "%choice%"=="6" goto run_install
if "%choice%"=="7" goto exit_script

echo.
color 0C
echo [ERROR] Invalid selection "%choice%". Please enter a number between 1 and 7.
echo.
pause
goto menu

:run_start
cls
color 0A
echo ======================================================================
echo  Starting Metro Bundler Server...
echo ======================================================================
echo.
call npm run start
goto check_error

:run_android
cls
color 0A
echo ======================================================================
echo  Starting on Android Emulator/Device...
echo ======================================================================
echo.
call npm run android
goto check_error

:run_ios
cls
color 0A
echo ======================================================================
echo  Starting on iOS Simulator...
echo ======================================================================
echo.
call npm run ios
goto check_error

:run_web
cls
color 0A
echo ======================================================================
echo  Starting on Web Browser...
echo ======================================================================
echo.
call npm run web
goto check_error

:run_clear
cls
color 0A
echo ======================================================================
echo  Clearing Expo Cache and Starting Metro...
echo ======================================================================
echo.
call npx expo start --clear
goto check_error

:run_install
cls
color 0E
echo ======================================================================
echo  Installing Dependencies (npm install)...
echo ======================================================================
echo.
call npm install
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] npm install failed with error code %ERRORLEVEL%
    echo.
    pause
    goto menu
)
color 0A
echo.
echo [SUCCESS] Dependencies installed successfully!
echo.
pause
goto menu

:check_error
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo ======================================================================
    echo  [ERROR] Dev server / task exited with an error code: %ERRORLEVEL%
    echo  Make sure you have run "npm install" and have Node.js / Expo CLI set up.
    echo ======================================================================
    echo.
    pause
)
goto exit_script

:exit_script
cls
color 0F
echo.
echo Thank you for using strongerN! Happy developing.
echo.
timeout /t 2 >nul
exit /b
