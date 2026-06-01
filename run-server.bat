@echo off
title strongerN Expo Dev Server
cls

:: Navigate to the directory where the batch file is located
cd /d "%~dp0"

echo ======================================================================
echo                 strongerN - AMOLED-First Fitness Tracker
echo                     Expo Dev Server Control Script
echo ======================================================================
echo.
echo  [System Info]
echo  - Project Path:  %cd%
echo  - Expo Version:  SDK 56
echo  - Action:        Starting Metro Bundler Server (expo start)
echo.
echo ======================================================================
echo.

:: Run the Expo dev server
call npm run start

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Dev server exited with an error code: %ERRORLEVEL%
    echo Make sure you have run "npm install" and have Node.js installed.
    echo.
    pause
)
