@echo off
title strongerN - Standalone APK Builder and Server
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-apk.ps1" %*
exit /b %ERRORLEVEL%
