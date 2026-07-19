@echo off
title CampusOS — Starting Backend
color 1F

echo.
echo  ================================================
echo   CampusOS Admin — Adhi-IT
echo  ================================================
echo.

cd /d "%~dp0backend"

:: Kill any existing process using port 3001
echo  Clearing port 3001...
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":3001 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Start backend server in a separate window (stays open, shows logs)
echo  Starting backend server...
start "CampusOS Backend (Keep Open)" cmd /k "cd /d "%~dp0backend" && node index.js"

:: Wait for server to be ready
echo  Waiting for server...
timeout /t 4 /nobreak >nul

:: Open the admin dashboard HTML file directly
echo  Opening Admin Dashboard...
start "" "%~dp0backend\public\admin\index.html"

echo.
echo  Done.
echo  - Backend running in the other window.
echo  - Admin Dashboard opened as local file.
echo  - Do NOT close the backend window.
echo.
timeout /t 4 /nobreak >nul
