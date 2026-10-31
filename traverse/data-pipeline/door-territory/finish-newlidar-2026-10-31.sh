#!/bin/bash
# Stage newlidar of the cloud machine's coverage-fill queue (2026-10-31, overnight/fill1031/newlidar.sh): run by traverse/ops/run-cloud-finishers.sh
# once ~/run/fill1031/newlidar.vmdone exists. The work is in fill1031-finish.sh (one section per stage). By hand:
#   bash finish-newlidar-2026-10-31.sh > logs-finish-newlidar.log 2>&1
exec bash "$(dirname "$0")/fill1031-finish.sh" newlidar
