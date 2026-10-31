#!/bin/bash
# Stage outlinefix of the cloud machine's coverage-fill queue (2026-10-31, overnight/fill1031/outlinefix.sh): run by traverse/ops/run-cloud-finishers.sh
# once ~/run/fill1031/outlinefix.vmdone exists. The work is in fill1031-finish.sh (one section per stage). By hand:
#   bash finish-outlinefix-2026-10-31.sh > logs-finish-outlinefix.log 2>&1
exec bash "$(dirname "$0")/fill1031-finish.sh" outlinefix
