#!/bin/bash
# Wi-Fi queue job: DRCOG 2020 turf for every Highlands Ranch house (Matthew 2026-10-21: "schedule to run DRCOG turf scans over highlands
# ranch tonight"). Lot lines from the state parcel map by area, DRCOG land cover inside each. 45 minutes per unit; resumes where it stopped.
# Writes lawn-trial/drcog-turf/turf-highlands-ranch.json only: nothing goes to the app or the server until it is checked.
source "$(dirname "$0")/_common.sh"
step drcogturf-hr bash -c 'cd lawn-trial && node drcog-turf-town.mjs --town=highlands-ranch --mins=45; rc=$?; [ $rc -eq 3 ] && { echo "more left"; exit 0; }; [ $rc -eq 0 ] && { touch drcog-turf/highlands-ranch.finished; exit 0; }; exit $rc'
[ -f "$DT/lawn-trial/drcog-turf/highlands-ranch.finished" ] && exit 0 || exit 3
