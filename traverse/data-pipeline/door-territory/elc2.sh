B0=https://traverseplatforms.com/api
while read -r inst code town; do
  B="$B0/$inst-rounds.php"; J=/tmp/ec2.$$.$inst
  curl -s -c $J -b $J -H 'Content-Type: application/json' -d "{\"code\":\"$code\"}" "$B?action=signin" > /dev/null
  curl -s -b $J "$B?action=regions" > $J.r
  A=$(python3 -c "import json;j=json.load(open('$J.r'));r=[r for r in j['regions'] if r['key']=='$town'][0];a=[x for x in r['areas'] if isinstance(x,dict)];print(a[len(a)//2]['name'])")
  curl -s -b $J -G --data-urlencode "region=$town" --data-urlencode "area=$A" "$B?action=area" > $J.a
  python3 -c "
import json;j=json.load(open('$J.a'));ds=j.get('doors',[]);from collections import Counter
c=Counter();[c.update(k for k,v in d.items() if v not in (None,[],{},'',0,False)) for d in ds]
print('$inst $town', repr('$A'), len(ds), 'doors |', ' '.join(f'{k}:{n}' for k,n in sorted(c.items()) if k not in ('id','address','lat','lon','acres','owner')))"
  curl -s -b $J -X POST "$B?action=signout" > /dev/null; rm -f $J $J.r $J.a
done
