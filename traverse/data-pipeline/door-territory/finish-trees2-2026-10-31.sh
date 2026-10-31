#!/bin/bash
# Stage trees2 of the cloud machine's coverage-fill queue (2026-10-31, overnight/fill1031/trees2.sh): run by traverse/ops/run-cloud-finishers.sh
# once ~/run/fill1031/trees2.vmdone exists. The work is in fill1031-finish.sh (one section per stage). By hand:
#   bash finish-trees2-2026-10-31.sh > logs-finish-trees2.log 2>&1
exec bash "$(dirname "$0")/fill1031-finish.sh" trees2
