#!/bin/bash
# The cloud J.A.R.V.I.S. machine's server wrapper (2026-11-19, TASKS X-15), installed as ~/jarvis/bin/sg.sh by jarvis-cloud.sh deploy.
# Same use as the laptop's ~/.ssh/sg.sh, but only the Traverse account, with this machine's own key (~/jarvis/secrets/traverse_sg_cloud,
# revoke it alone in SiteGround: SSH Keys Manager, jarvis-cloud). Sixfold's site (six), Surge (surge) and 365 Aeration (a365) have no key
# here: those jobs go to the laptop (laptop-job.sh).
#   bash ~/jarvis/bin/sg.sh trav '<remote command>'
S="${JARVIS_HOME:-$HOME/jarvis}/secrets"
# 23 Nov 2026 (Matthew: everything on the cloud computer): six, surge and a365 too, with the laptop's keys (moved to ~/.ssh by
# vm-move-private.sh). Same rules as on the laptop: Sixfold's site only changes Matthew asks for; Surge live changes need his go.
K="$HOME/.ssh"
case "${1:-}" in
  trav)  KEY="$S/traverse_sg_cloud"; DEST=u3233-r4fz9nguryw0@giowm1063.siteground.biz ;;
  six)   KEY="$K/sixfold_sg";        DEST=u2902-ue60jmub66uu@giowm1162.siteground.biz ;;
  surge) KEY="$K/surge_sg";          DEST=u3357-ckie3zyvu8h8@ssh.surgeftw.com ;;
  a365)  KEY="$K/aeration365_sg";    DEST=u3135-tyad4dai2l0w@giowm1232.siteground.biz ;;
  *) echo "sg.sh trav|six|surge|a365 '<command>'" >&2; exit 2;;
esac
[ -f "$KEY" ] || { echo "sg.sh: no key for $1 on this machine ($KEY)" >&2; exit 2; }
shift
exec ssh -F /dev/null -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=30 -o StrictHostKeyChecking=accept-new \
  -o "UserKnownHostsFile=$S/known_hosts" -o IdentitiesOnly=yes -i "$KEY" -p 18765 "$DEST" "$@"
