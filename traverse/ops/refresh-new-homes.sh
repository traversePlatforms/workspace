#!/bin/bash
# Windows task "Traverse new homes refresh" (15 Feb, 15 May, 15 Aug, 15 Nov, 02:00; added 15 Nov 2026): the quarterly new-construction
# refresh, data-pipeline/door-territory/every1115/refresh-quarterly.sh. Log: door-territory/logs-refresh-quarterly.log.
cd "/c/Users/Surge Inc/Desktop/claude test 2/traverse/data-pipeline/door-territory" || exit 1
bash every1115/refresh-quarterly.sh >> logs-refresh-quarterly.log 2>&1
