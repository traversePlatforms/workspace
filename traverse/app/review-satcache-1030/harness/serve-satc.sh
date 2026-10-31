#!/bin/bash
# the timing setup: main harness server on 8840, six tile workers 8841-8846, node front on 8814 (satc-front.cjs). Live memory limit.
P="C:/Users/SURGEI~1/AppData/Local/Temp/claude/c--Users-Surge-Inc-Desktop-claude-test-2/db3e1153-072f-46a3-b860-134f689b5a09/scratchpad/ptest-satcache"
cd "$P" || exit 1
[ -f stripe-mock.json ] || echo '{}' > stripe-mock.json
export SIXFOLD_BILLING_MOCK="$P/stripe-mock.json"
export TRAV_MAIL_MOCK="$P/mail-mock.log"
php -d memory_limit=768M -S 127.0.0.1:8840 -t www > php-8840.log 2>&1 &
for p in 8841 8842 8843 8844 8845 8846; do php -d memory_limit=768M -S 127.0.0.1:$p -t www > php-$p.log 2>&1 & done
exec node satc-front.cjs > front-8814.log 2>&1
