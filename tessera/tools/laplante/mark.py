import json,re,sys,os
log={}
for line in open('seg_all.log'):
    m=re.match(r'(\d+) \(.*?\) \d+ cands (.*)',line)
    if m: log[m.group(1)]={k:(int(x),int(y)) for k,x,y in re.findall(r'(\S)\((\d+), (\d+)\)',m.group(2))}
ov=json.load(open('overrides.json')) if os.path.exists('overrides.json') else {}
for a in sys.argv[1:]:
    pl,labs=a.split(':'); g=ov.setdefault(pl,{}).setdefault('gaps',[])
    for l in labs.split(','):
        p=list(log[pl][l]);
        if p not in g: g.append(p)
json.dump(ov,open('overrides.json','w'),indent=0)
