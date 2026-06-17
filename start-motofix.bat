@echo off
REM Double-click this whenever the apps show "Network error / cannot reach server".
REM It makes sure Docker and all the MOTOFIX backend services are up.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-motofix.ps1"
