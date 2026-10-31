#!/bin/bash
# Stage values (fill1031, priority e: home value). The county appraised value for the Group 1 and Group 3 towns (values-extra.mjs: the
# statewide parcel composite's apprValTot, the same source as every other town's value; no owner fields). gis.colorado.gov, light (100
# parcels a request, one at a time), the only parcel job running. The house lists with parcel numbers are this machine's own
# <key>.csv files (door-territory/, from the Group 1 and Group 3 builds). Leaves value-extra.json for finish-values-2026-10-31.sh.
. "$HOME/run/fill1031/lib.sh"
st "values: Group 1 and Group 3 towns"
tries values node --max-old-space-size=4096 "$Q/values-extra.mjs" "$Q/values-towns.txt" "$DT" "$Q/value-extra.json"
