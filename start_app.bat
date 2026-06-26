@echo off
title Face Recognition Attendance System
echo =======================================================
echo   Starting Face Recognition Attendance System...
echo =======================================================
echo.
echo Opening browser to http://localhost:3000...
start http://localhost:3000
echo.
echo Starting local web server...
node server.js
pause
