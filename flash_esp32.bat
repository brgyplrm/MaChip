@echo off
title MAChip ESP32 Firmware Flasher
echo ==========================================================
echo        MAChip ESP32 One-Click Firmware Flasher
echo ==========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0flash_esp32.ps1"
echo.
pause
