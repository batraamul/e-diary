@echo off
rem Puts an E-Diary icon on the Desktop and in the Start menu. Run it again if you move this folder.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\windows\shortcut.ps1"
