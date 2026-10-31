#!/bin/bash
# Stage dougmat of the cloud machine's coverage-fill queue (2026-10-31, overnight/fill1031/dougmat.sh): run by traverse/ops/run-cloud-finishers.sh
# once ~/run/fill1031/dougmat.vmdone exists. The work is in fill1031-finish.sh (one section per stage). By hand:
#   bash finish-dougmat-2026-10-31.sh > logs-finish-dougmat.log 2>&1
exec bash "$(dirname "$0")/fill1031-finish.sh" dougmat
