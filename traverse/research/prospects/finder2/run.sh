#!/bin/bash
cd ~/prospects/finder2
echo "$(date -Is) finder start" >> run.log
node finder.mjs in.csv found-sites.csv >> finder.out 2>&1
echo "$(date -Is) finder done" >> run.log
node mkemailin.mjs >> run.log 2>&1
cp ~/prospects/email2/site-emails2.mjs .
ln -sfn ~/prospects/email2/node_modules node_modules
nice -n 10 node site-emails2.mjs sites.csv email-raw.csv >> email.log 2>&1
node mkemailout.mjs >> run.log 2>&1
echo "$(date -Is) all done" >> run.log
