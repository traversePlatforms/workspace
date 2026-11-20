#!/bin/bash
# The cloud J.A.R.V.I.S. machine's server wrapper (2026-11-19, TASKS X-15), installed as ~/jarvis/bin/sg.sh by jarvis-cloud.sh deploy.
# Same use as the laptop's ~/.ssh/sg.sh, but only the Traverse account, with this machine's own key (~/jarvis/secrets/traverse_sg_cloud,
# revoke it alone in SiteGround: SSH Keys Manager, jarvis-cloud). Sixfold's site (six), Surge (surge) and 365 Aeration (a365) have no key
# here: those jobs go to the laptop (laptop-job.sh).
#   bash ~/jarvis/bin/sg.sh trav '<remote command>'
S="${JARVIS_HOME:-$HOME/jarvis}/secrets"
case "${1:-}" in
  trav) ;;
  six|surge|a365) echo "sg.sh: no $1 key on the cloud machine: that job is the laptop's (queue it with laptop-job.sh)" >&2; exit 2;;
  *) echo "sg.sh trav '<command>' (only the Traverse account on this machine)" >&2; exit 2;;
esac
shift
exec ssh -F /dev/null -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=30 -o StrictHostKeyChecking=yes \
  -o "UserKnownHostsFile=$S/known_hosts" -o IdentitiesOnly=yes -i "$S/traverse_sg_cloud" -p 18765 u3233-r4fz9nguryw0@giowm1063.siteground.biz "$@"
