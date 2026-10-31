#!/bin/bash
# fresh data for this harness: sixfold-data, sixfold-private, traverse-shared from ptest-1030 (the base every agent copied); mock state cleared
SP="/c/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad"
P="$(cd "$(dirname "$0")" && pwd)"; cd "$P"
for x in sixfold-data sixfold-private traverse-shared; do rm -rf "${P:?}/${x:?}"; cp -r "$SP/ptest-1030/$x" "$P/$x"; done
rm -f "$P/crmsync-mock-state.json" "$P/crmsync-mock.log" "$P/mail-mock.log" "$P/fbmock/state.json" "$P/fbmock/calls.log" "$P/stripe-mock.json" "$P/care-mock.log" "$P/smtp-mock-"*.log
rm -rf "${P:?}/sixfold-data/ratelimit" "${P:?}/www/api/.ratelimit"
echo '{}' > "$P/stripe-mock.json"
echo "fresh data in place"
