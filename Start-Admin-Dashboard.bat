@echo off
title ADHI-IT Admin Dashboard Server
echo ===================================================
echo Starting ADHI-IT Backend Server...
echo ===================================================

cd /d "%~dp0backend"
start /b node index.js

echo.
echo Waiting for server to start...
timeout /t 3 /nobreak > nul

echo.
echo Opening Admin Dashboard in your browser...
start http://localhost:3001/admin

echo.
echo The server is running in the background. Keep this window open!
echo To stop the server, just close this window.
echo.
pause
