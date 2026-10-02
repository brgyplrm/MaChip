<#
.SYNOPSIS
    MAChip ESP32 One-Click Firmware Flashing Utility
.DESCRIPTION
    Compiles and flashes the updated firmware to the ESP32 via USB Serial or direct esptool.
    Includes instant-cancellation endpoints, dual-reader enrollment, and ST7789 display sync.
.EXAMPLE
    .\flash_esp32.ps1
    .\flash_esp32.ps1 -Port COM10
    .\flash_esp32.ps1 -FastFlash
#>
[CmdletBinding()]
param(
    [string]$Port,
    [int]$Baud = 921600,
    [switch]$FastFlash
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   MAChip ESP32 Firmware Flasher (v2.6.0-UI-TESTING)      " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Resolve COM Port
if (-not $Port) {
    Write-Host "[*] Detecting connected serial devices..." -ForegroundColor Gray
    $devices = Get-PnpDevice -Class Ports -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -match '\(COM\d+\)' }
    $cp210x = $devices | Where-Object { $_.FriendlyName -match 'CP210|CH340|FTDI|USB to UART' }

    if ($cp210x) {
        $Port = ($cp210x.FriendlyName | Select-String -Pattern '\((COM\d+)\)').Matches.Groups[1].Value
        Write-Host "[+] Auto-detected ESP32 on: $Port ($($cp210x.FriendlyName))" -ForegroundColor Green
    } elseif ($devices) {
        $firstPort = ($devices[0].FriendlyName | Select-String -Pattern '\((COM\d+)\)').Matches.Groups[1].Value
        Write-Host "[!] Found active port: $firstPort ($($devices[0].FriendlyName))" -ForegroundColor Yellow
        $Port = $firstPort
    } else {
        Write-Host "[!] No active USB serial port detected." -ForegroundColor Yellow
        Write-Host "    Please ensure your ESP32 is plugged in with a USB data cable." -ForegroundColor Gray
        $Port = Read-Host "Enter ESP32 COM port (e.g. COM10) or press Enter to cancel"
    }
}

if (-not $Port) {
    Write-Host "[-] Flashing aborted: No COM port selected." -ForegroundColor Red
    exit 1
}

# 2. Locate Tools
$arduinoCli = "C:\Users\cydto\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe"
if (-not (Test-Path $arduinoCli)) {
    $cliCmd = Get-Command arduino-cli -ErrorAction SilentlyContinue
    if ($cliCmd) { $arduinoCli = $cliCmd.Source }
}

$esptool = "C:\Users\cydto\AppData\Local\Arduino15\packages\esp32\tools\esptool_py\5.3.1\esptool.exe"
if (-not (Test-Path $esptool)) {
    $foundEsptool = Get-ChildItem -Path "$env:LOCALAPPDATA\Arduino15\packages\esp32\tools\esptool_py" -Recurse -Filter "esptool.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($foundEsptool) { $esptool = $foundEsptool.FullName }
}

$sketchDir = "$PSScriptRoot\firmware\MaChip_Test"
$sketchFile = "$sketchDir\MaChip_Test.ino"
$buildDir = "$sketchDir\build"
$mergedBin = "$buildDir\MaChip_Test.ino.merged.bin"

# 3. Flashing Mode
if ($FastFlash -or (Test-Path $mergedBin)) {
    if (Test-Path $esptool) {
        Write-Host "`n[*] Fast-Flashing pre-compiled binary via esptool to $Port at ${Baud} baud..." -ForegroundColor Cyan
        & $esptool --chip esp32 --port $Port --baud $Baud --before default-reset --after hard-reset write-flash -z 0x0 $mergedBin
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n==========================================================" -ForegroundColor Green
            Write-Host "[+] ESP32 FLASHED SUCCESSFULLY!" -ForegroundColor Green
            Write-Host "[+] Hardware reset complete. The ESP32 is now running updated firmware." -ForegroundColor Green
            Write-Host "==========================================================" -ForegroundColor Green
            exit 0
        } else {
            Write-Host "[!] Fast flash encountered an issue, falling back to full compile & upload..." -ForegroundColor Yellow
        }
    }
}

# 4. Standard Arduino-CLI Compile & Upload
if (Test-Path $arduinoCli) {
    Write-Host "`n[*] Compiling sketch and uploading via Arduino CLI..." -ForegroundColor Cyan
    Write-Host "[*] Board: esp32:esp32:esp32 | Port: $Port" -ForegroundColor Gray
    
    & $arduinoCli compile --fqbn esp32:esp32:esp32 --output-dir $buildDir $sketchFile
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[-] Compilation failed. Check errors above." -ForegroundColor Red
        exit 1
    }

    Write-Host "[*] Uploading to ESP32 on $Port..." -ForegroundColor Cyan
    & $arduinoCli upload -p $Port --fqbn esp32:esp32:esp32 $sketchFile
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n==========================================================" -ForegroundColor Green
        Write-Host "[+] SUCCESS: ESP32 FIRMWARE UPDATED & READY!" -ForegroundColor Green
        Write-Host "==========================================================" -ForegroundColor Green
        Write-Host "[i] Instant cancellation endpoints (/api/cancel, /cancel) active." -ForegroundColor Gray
        Write-Host "[i] Dual RFID reader scanning (Front & Back) active." -ForegroundColor Gray
        Write-Host "[i] SPI frequency reset for ST7789 TFT display active." -ForegroundColor Gray
        exit 0
    } else {
        Write-Host "[-] Upload failed. Tip: Check if the Serial Monitor or another program is holding $Port open." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[-] Arduino CLI not found. Please flash via Arduino IDE GUI using the steps provided." -ForegroundColor Red
    exit 1
}
