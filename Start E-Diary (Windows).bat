@echo off
rem Opens E-Diary at http://localhost:47812 in its own window (keep this folder where it is).
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0tools\windows\start.ps1"
