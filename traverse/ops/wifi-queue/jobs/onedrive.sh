#!/bin/bash
# Wi-Fi queue job: finish the OneDrive move (Matthew 2026-10-22). The work is in onedrive.ps1; this stops for the hotspot like every other job.
# Not through step(): step() fails on any exit but 0, and onedrive.ps1 exits 3 after each folder when more are left (3 Nov: that parked it
# after the first folder copied fine). Its exit passes straight through: 0 every folder done, 3 more left, 1 stopped.
source "$(dirname "$0")/_common.sh"
if on_hotspot; then echo "$(date +%T) on the hotspot before onedrive - stopping"; exit 4; fi
echo "$(date +%T) start onedrive"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\Surge Inc\Desktop\claude test 2\traverse\ops\wifi-queue\jobs\onedrive.ps1" > "$Q/logs/step-onedrive.log" 2>&1; rc=$?
echo "$(date +%T) end   onedrive (exit $rc) $(tail -1 "$Q/logs/step-onedrive.log" | tr -d '\r' | cut -c1-160)"
case $rc in 0|3) exit $rc;; *) exit 1;; esac
