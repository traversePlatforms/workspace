#!/bin/bash
# Wi-Fi queue job: finish the OneDrive move (Matthew 2026-10-22). The work is in onedrive.ps1; this stops for the hotspot like every other job.
source "$(dirname "$0")/_common.sh"
step onedrive powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Surge Inc\Desktop\claude test 2\traverse\ops\wifi-queue\jobs\onedrive.ps1"
grep -q "every folder done" "$Q/logs/step-onedrive.log" && exit 0 || exit 3
