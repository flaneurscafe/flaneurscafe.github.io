import cv2, numpy as np, json, os, sys
SRC=os.path.expanduser('~/tmpimg')
OUT=sys.argv[1]; DBG=sys.argv[2]
os.makedirs(OUT+'/ornaments',exist_ok=True); os.makedirs(OUT+'/othumbs',exist_ok=True); os.makedirs(DBG,exist_ok=True)
plates=[int(x) for x in sys.argv[3].split(',')] if len(sys.argv)>3 else list(range(1,61))
S=800
manifest=[]
os.makedirs(OUT+'/plates',exist_ok=True); os.makedirs(OUT+'/thumbs',exist_ok=True)
def _fit(coords,vals):
    coords=np.asarray(coords,float);vals=np.asarray(vals,float)
    if len(coords)<60: return None
    rng=np.random.default_rng(0); best=None;bn=0; tmax=np.tan(np.radians(4))
    for _ in range(400):
        i,j=rng.choice(len(coords),2,replace=False)
        if abs(coords[i]-coords[j])<len(coords)*0.2: continue
        a_=(vals[j]-vals[i])/(coords[j]-coords[i])
        if abs(a_)>tmax: continue
        b_=vals[i]-a_*coords[i]; n_=(np.abs(vals-(a_*coords+b_))<2.5).sum()
        if n_>bn: bn=n_; best=(a_,b_)
    if best is None or bn<0.3*len(coords): return None
    k=np.abs(vals-(best[0]*coords+best[1]))<2.5
    return np.polyfit(coords[k],vals[k],1)
def frame_lines(img):
    h,w=img.shape[:2]
    f=img.astype(np.float32); ref=np.percentile(f.reshape(-1,3),75,axis=0)
    nrm=np.clip(f/ref*255,0,255); ink=((255-nrm.min(-1))>60).astype(np.uint8)
    ink=ink&(1-cv2.morphologyEx(ink,cv2.MORPH_OPEN,np.ones((9,9),np.uint8)))   # thin strokes only
    m=int(0.025*min(h,w)); ink[:m]=0; ink[-m:]=0; ink[:,:m]=0; ink[:,-m:]=0
    ink=ink.astype(bool)
    bh=int(.2*h); bw=int(.2*w); out={}
    def first(band):  # first True index along axis 0, per column; -1 if none
        any_=band.any(0); idx=band.argmax(0); return np.where(any_,idx,-1)
    c0,c1=int(.25*w),int(.75*w); cols=np.arange(c0,c1)
    t=first(ink[:bh,c0:c1]); bt=first(ink[::-1][:bh,c0:c1])
    out['top']=_fit(cols[t>=0],t[t>=0]); out['bottom']=_fit(cols[bt>=0],h-1-bt[bt>=0])
    r0,r1=int(.25*h),int(.75*h); rows=np.arange(r0,r1)
    l=first(ink[r0:r1,:bw].T); rr=first(ink[r0:r1,::-1][:,:bw].T)
    out['left']=_fit(rows[l>=0],l[l>=0]); out['right']=_fit(rows[rr>=0],w-1-rr[rr>=0])
    return out
def deskew(full):
    H0,W0=full.shape[:2]; f=1200/W0
    sm=cv2.resize(full,(1200,int(H0*f)),interpolation=cv2.INTER_AREA)
    L=frame_lines(sm)
    ang={k:(None if v is None else float(np.degrees(np.arctan(v[0])))) for k,v in L.items()}
    ok=all(v is not None and abs(v)<3.5 for v in ang.values())
    if ok: ok=abs(ang['top']-ang['bottom'])<2.5 and abs(ang['left']-ang['right'])<2.5
    if ok:
        def X(hl,vl):  # intersect y=a x+b (horizontal) with x=c y+d (vertical)
            a,b=hl; c,d=vl; y=(a*d+b)/(1-a*c); return (c*y+d, y)
        tl=X(L['top'],L['left']); tr=X(L['top'],L['right']); bl=X(L['bottom'],L['left']); br=X(L['bottom'],L['right'])
        src=np.float32([tl,tr,br,bl])
        wd=(np.hypot(*np.subtract(tr,tl))+np.hypot(*np.subtract(br,bl)))/2
        ht=(np.hypot(*np.subtract(bl,tl))+np.hypot(*np.subtract(br,tr)))/2
        if wd<0.5*sm.shape[1] or ht<0.45*sm.shape[0]: ok=False
    if ok:
        cx,cy=src.mean(0)
        dst=np.float32([[cx-wd/2,cy-ht/2],[cx+wd/2,cy-ht/2],[cx+wd/2,cy+ht/2],[cx-wd/2,cy+ht/2]])
        Hm=cv2.getPerspectiveTransform(src/f,dst/f)
        full=cv2.warpPerspective(full,Hm,(W0,H0),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
        tag='quad'
    else:
        good=sorted(v for v in [ang['top'],ang['bottom'],None if ang['left'] is None else -ang['left'],None if ang['right'] is None else -ang['right']] if v is not None and abs(v)<3)
        a0=0.0
        for i in range(len(good)):   # need >=3 sides agreeing within 0.6 deg
            cl=[g for g in good if abs(g-good[i])<=0.6]
            if len(cl)>=3: a0=float(np.median(cl)); break
        if abs(a0)>0.05:
            M=cv2.getRotationMatrix2D((W0/2,H0/2),a0,1.0)
            full=cv2.warpAffine(full,M,(W0,H0),flags=cv2.INTER_CUBIC,borderMode=cv2.BORDER_REPLICATE)
        tag=f'rot{a0:+.2f}'
    # blank dark scanner-bed / shadow regions touching the image edge
    g=cv2.cvtColor(full,cv2.COLOR_BGR2GRAY)
    paperL=np.percentile(g,70)
    dark=(g<paperL-45).astype(np.uint8)
    band=np.zeros_like(dark); b=int(0.05*min(H0,W0)); band[:b]=1;band[-b:]=1;band[:,:b]=1;band[:,-b:]=1
    dark=dark&band
    dark=cv2.morphologyEx(dark,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
    n,lb,st,_=cv2.connectedComponentsWithStats(dark,8)
    kill=np.zeros_like(dark)
    for i in range(1,n):
        x,y,w,h,a=st[i]
        touches=x<=2 or y<=2 or x+w>=W0-3 or y+h>=H0-3
        if touches: kill[lb==i]=1
    kill=cv2.dilate(kill,np.ones((15,15),np.uint8))
    paper=np.median(full[g>=paperL],axis=0)
    full[kill>0]=paper.astype(np.uint8)
    return full, tag
def whiten(full):
    H0,W0=full.shape[:2]; f=400/W0
    small=cv2.resize(full,(400,int(H0*f)),interpolation=cv2.INTER_AREA).astype(np.float32)
    lab=cv2.cvtColor(small.astype(np.uint8),cv2.COLOR_BGR2LAB).astype(np.float32)
    L=lab[...,0]; paper=np.median(lab[L>=np.percentile(L,40)],axis=0)
    d=np.sqrt(((lab-paper)**2*np.array([0.6,1.4,1.4])).sum(-1))
    m=(d<12).astype(np.float32); m=cv2.erode(m,np.ones((3,3),np.uint8))
    bg=np.zeros_like(small)
    num=cv2.GaussianBlur(small*m[...,None],(0,0),12); den=cv2.GaussianBlur(m,(0,0),12)[...,None]
    bg=num/np.maximum(den,1e-3)
    glob=np.median(small[m>0],axis=0); bg=np.where(den<0.05,glob,bg)
    bg=cv2.resize(bg,(W0,H0),interpolation=cv2.INTER_LINEAR)
    img=full.astype(np.float32)
    blur=cv2.GaussianBlur(img,(0,0),1.4); img=img+0.7*(img-blur)   # gentle unsharp mask
    out=np.clip(img/np.maximum(bg,1)*255*1.02,0,255)
    # 1) flatten near-white paper tones (shading, curl shadows) to pure white
    d=255-out.min(-1)
    t=np.clip((d-16)/(30-16),0,1)[...,None]
    out=255*(1-t)+out*t
    # 2) clear everything outside the printed area (frame + margin)
    f=500/W0; sm=cv2.resize(out.astype(np.uint8),(500,int(H0*f)),interpolation=cv2.INTER_AREA)
    ink=((255-sm.min(-1))>45).astype(np.uint8)
    ink=cv2.morphologyEx(ink,cv2.MORPH_OPEN,np.ones((2,2),np.uint8))
    n,lb,st,_=cv2.connectedComponentsWithStats(ink,8)
    hh,ww=ink.shape; xs=[];ys=[];xe=[];ye=[]
    for i in range(1,n):
        x,y,w,h,a=st[i]
        if a<12: continue
        if x<=1 or y<=1 or x+w>=ww-2 or y+h>=hh-2:
            if a<0.002*ww*hh: continue   # small junk touching the scan edge
        xs.append(x);ys.append(y);xe.append(x+w);ye.append(y+h)
    if xs:
        m=int(0.018*ww)
        x0=max(0,min(xs)-m);y0=max(0,min(ys)-m);x1=min(ww,max(xe)+m);y1=min(hh,max(ye)+m)
        X0,Y0,X1,Y1=int(x0/f),int(y0/f),int(x1/f),int(y1/f)
        keep=np.zeros((H0,W0),np.float32); keep[Y0:Y1,X0:X1]=1
        keep=cv2.GaussianBlur(keep,(0,0),6)[...,None]
        out=255*(1-keep)+out*keep
    return np.clip(out,0,255).astype(np.uint8)
for n in plates:
    full=cv2.imread(f'{SRC}/p-{n-1:03d}.jpg'); H0,W0=full.shape[:2]
    full,ang=deskew(full)
    wb=whiten(full)
    pw=cv2.resize(wb,(1600,int(H0*1600/W0)),interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{OUT}/plates/plate_{n:02d}.jpg',pw,[cv2.IMWRITE_JPEG_QUALITY,86])
    th=cv2.resize(wb,(220,int(H0*220/W0)),interpolation=cv2.INTER_AREA)
    cv2.imwrite(f'{OUT}/thumbs/plate_{n:02d}.jpg',th,[cv2.IMWRITE_JPEG_QUALITY,80])
    k=S/W0; img=cv2.resize(full,(S,int(H0*k)),interpolation=cv2.INTER_AREA); h,w=img.shape[:2]
    lab=cv2.cvtColor(img,cv2.COLOR_BGR2LAB).astype(np.float32)
    # paper = mode-ish: median of the brightest 60% pixels
    L=lab[...,0]; thr=np.percentile(L,40); paper=np.median(lab[L>=thr],axis=0)
    d=np.sqrt(((lab-paper)**2*np.array([0.6,1.4,1.4])).sum(-1))
    ink=(d>28).astype(np.uint8)
    ink=cv2.morphologyEx(ink,cv2.MORPH_OPEN,np.ones((2,2),np.uint8))
    # remove page edge darkening: ignore 1.2% margin
    m=int(0.012*w); ink[:m]=0; ink[-m:]=0; ink[:,:m]=0; ink[:,-m:]=0
    # frame lines: long thin lines in outer margin band (short kernels tolerate tilt)
    lines=np.zeros_like(ink)
    for ker in [np.ones((1,int(w*0.07)),np.uint8),np.ones((int(h*0.07),1),np.uint8)]:
        lines|=cv2.morphologyEx(ink,cv2.MORPH_OPEN,ker)
    band=np.zeros_like(ink); b=int(0.13*min(w,h)); band[:b]=1;band[-b:]=1;band[:,:b]=1;band[:,-b:]=1
    lines=lines&band
    # whole-frame components: span most of the page but sparse
    inkc=cv2.morphologyEx(ink,cv2.MORPH_CLOSE,np.ones((3,3),np.uint8))
    nc0,lab0,st0,_=cv2.connectedComponentsWithStats(inkc,8); frames=[]
    for i in range(1,nc0):
        x,y,bw,bh,a=st0[i]
        if (bw>0.6*w and bh>0.45*h) or (bw>0.85*w) or (bh>0.8*h):
            if a/(bw*bh)<0.12: lines[lab0==i]=1; frames.append(i)
    lines=cv2.dilate(lines,np.ones((5,5),np.uint8))
    ink2=ink&(1-lines)
    r=int(0.012*w)|1
    grp=cv2.morphologyEx(ink2,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2*r+1,2*r+1)))
    grp=cv2.dilate(grp,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(r,r)))
    nc,labels,stats,_=cv2.connectedComponentsWithStats(grp,8)
    dbg=img.copy(); kept=0
    comps=[]
    for i in range(1,nc):
        x,y,bw,bh,a=stats[i]
        inkcount=int(ink2[labels==i].sum())
        if max(bw,bh)<0.045*w or inkcount<160: continue
        comps.append((x,y,bw,bh,i,inkcount))
    comps.sort(key=lambda c:(c[1]//40,c[0]))
    comps=[(x,y,bw,bh,i,ic,labels,False) for (x,y,bw,bh,i,ic) in comps]
    for i in frames:
        x,y,bw,bh,a=st0[i]
        if a>1500: comps.append((x,y,bw,bh,i,a,lab0,True))
    for (x,y,bw,bh,i,ic,LB,isf) in comps:
        kept+=1; oid=f'p{n:02d}_{kept:02d}'
        pad=3
        x0,y0,x1,y1=max(0,x-pad),max(0,y-pad),min(w,x+bw+pad),min(h,y+bh+pad)
        X0,Y0,X1,Y1=[int(round(v/k)) for v in (x0,y0,x1,y1)]
        crop=wb[Y0:Y1,X0:X1]
        # alpha at full res: ink distance, restricted to this component region (upsampled)
        reg=(LB[y0:y1,x0:x1]==i).astype(np.uint8)
        reg=cv2.resize(reg,(X1-X0,Y1-Y0),interpolation=cv2.INTER_NEAREST)
        reg=cv2.dilate(reg,np.ones((9,9) if not isf else (15,15),np.uint8))
        cf=crop.astype(np.float32)
        d2=255-cf.min(-1)
        lin2=cv2.resize(lines[y0:y1,x0:x1],(X1-X0,Y1-Y0),interpolation=cv2.INTER_NEAREST)
        t=np.clip((d2-14)/(52-14),0,1); a=t*t*(3-2*t)
        a=a*reg*((1-lin2) if not isf else 1)
        # drop paper specks: tiny isolated blobs
        core=(a>0.35).astype(np.uint8)
        ncs,lb,stt,_=cv2.connectedComponentsWithStats(core,8)
        small_ids=np.where(stt[:,4]<30)[0]; small_ids=small_ids[small_ids>0]
        if len(small_ids):
            kill=np.isin(lb,small_ids); kill=cv2.dilate(kill.astype(np.uint8),np.ones((3,3),np.uint8))>0
            a[kill]=0
        a[(a<0.35)&(cv2.dilate(core,np.ones((3,3),np.uint8))==0)]=0
        # un-premultiply against white: remove the pale fringe so edges take the ink colour
        ad=np.maximum(a,0.08)[...,None]
        col=255-(255-cf)/ad
        crop=np.clip(np.where(a[...,None]>0,col,cf),0,255).astype(np.uint8)
        a=(a*255).astype(np.uint8)
        rgba=cv2.cvtColor(crop,cv2.COLOR_BGR2BGRA); rgba[...,3]=a
        s=min(1.0,820/max(rgba.shape[:2]))
        if s<1: rgba=cv2.resize(rgba,None,fx=s,fy=s,interpolation=cv2.INTER_AREA)
        cv2.imwrite(f'{OUT}/ornaments/{oid}.webp',rgba,[cv2.IMWRITE_WEBP_QUALITY,82])
        t=min(1.0,180/max(rgba.shape[:2])); th=cv2.resize(rgba,None,fx=t,fy=t,interpolation=cv2.INTER_AREA)
        cv2.imwrite(f'{OUT}/othumbs/{oid}.webp',th,[cv2.IMWRITE_WEBP_QUALITY,80])
        manifest.append({'id':oid,'plate':n,'w':rgba.shape[1],'h':rgba.shape[0],'box':[X0,Y0,X1-X0,Y1-Y0],'frame':bool(isf)})
        cv2.rectangle(dbg,(x,y),(x+bw,y+bh),(255,0,0) if isf else (0,0,255),2); cv2.putText(dbg,str(kept),(x+3,y+16),cv2.FONT_HERSHEY_SIMPLEX,0.55,(0,0,255),2)
    dbg[lines>0]=(255,0,255)
    cv2.imwrite(f'{DBG}/d{n:02d}.jpg',dbg,[cv2.IMWRITE_JPEG_QUALITY,70])
    print(n,kept,ang,flush=True)
json.dump(manifest,open(f'{OUT}/ornaments_{plates[0]}_{plates[-1]}.json','w'))
