#!/bin/bash
# Stage epa (fill1031, 8 Nov; GAP-PLAN-2026-11-08.md): El Paso door lists from the county assessor file + the state layer's El Paso
# shapes (state/el-paso.tsv.gz, written by stage gapcount), clipped against our doors -> ~/run/gap1108/ep/ (summary.tsv: counts).
# No parcel service is called: both inputs are already on this machine. Nothing leaves the machine.
. "$HOME/run/fill1031/lib.sh"
G="$HOME/run/gap1108"
[ -s "$G/state/el-paso.tsv.gz" ] && [ -f "$G/state/el-paso.done" ] || { st "epa: no El Paso shapes yet (stage gapcount)"; exit 1; }
st "epa: El Paso door lists from the assessor file"
cd "$G" && nice -n 10 node --max-old-space-size=9000 code/build-walklist-epc.mjs epc-parcel-data.txt state/el-paso.tsv.gz door-points.tsv "$HOME/run/group1" ep || exit 1
st "epa: done (counts in ~/run/gap1108/ep/summary.tsv)"
