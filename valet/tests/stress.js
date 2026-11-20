/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — stress test: thousands of random outfits through every rule, across colourings, seasons and
   glasses. Nothing may crash, every score must lie in 0..1, no text may show undefined or NaN, and no
   check may name a piece that is not worn. Run: node tests/stress.js. Exits 1 on failure. */
global.window={}; const path=require('path'); const ROOT=path.join(__dirname,'..');
for (const f of ['colour','vision','patterns','data','garments','engine','body','proportion']) require(path.join(ROOT,'js',f+'.js'));
const E=window.VENGINE, G=window.VGARM, VP=window.VPAT, D=window.VDATA;
let seed=1; const rnd=()=>{seed=(seed*16807)%2147483647; return seed/2147483647;}; const pick=a=>a[Math.floor(rnd()*a.length)];
const hexes=D.colours.map(c=>c.hex).concat(['#f2efe6','#161616','#3b2417']);
const profiles={demo:D.demo, low:{samples:{skin:'#f0d6c8',hair:'#c9a978',eyes:'#8fa6b8'},manual:{skin:true,hair:true,eyes:true},named:{},hairStyle:'short'},
  deep:{samples:{skin:'#5b3a29',hair:'#1c1614',eyes:'#2a1c14'},manual:{skin:true,hair:true,eyes:true},named:{},hairStyle:'none'}};
const A={}; for (const [k,p] of Object.entries(profiles)) for (const se of ['winter','summer']) for (const gl of ['none','gold','silver','acetate','clear'])
  A[k+se+gl]=E.analyseProfile(Object.assign({},p,{season:se,glasses:gl,glassesHex:'#5b3a24'}));
const aList=Object.values(A).filter(Boolean);
function randomOutfit(){
  const o={};
  G.POSITIONS.forEach(pos=>{
    if (pos.optional && rnd()<0.45){ o[pos.key]=null; return; }
    const kd=pick(pos.kinds), cloth=kd.cloths&&kd.cloths.length?pick(kd.cloths):undefined;
    let pat={type:'solid'};
    const ok=kd.pats.filter(t=>t==='solid'||!cloth||G.patOK(cloth,t));
    const t=pick(ok); if(t!=='solid'){ const ty=VP.byId[t]; pat={type:t, scale: ty.min+(ty.max-ty.min)*rnd(), hex2: pick(hexes)}; }
    o[pos.key]={hex:pick(hexes), name:'X', kind:kd.id, cloth:cloth, pat:pat, rise:pick(['high','mid','low']), length:pick(['short','regular','long']),
      hex2: kd.twoTone? pick(['#f2efe6','#161616','#a8733f']):undefined, buttons: kd.buttons? pick(G.BUTTONS.map(b=>b[0])):undefined, brim: kd.brim? pick(G.BRIMS.map(b=>b.id||b[0]||b)) : undefined};
  });
  o.occasion=pick(G.OCCASIONS.map(x=>x.id)); o.propOn=true; o.body={}; o.frame=null; o.shape={}; o.hairStyle='short'; o.m={};
  o.acc={}; G.ACCESSORIES.forEach(d=>{ o.acc[d.key]={on:rnd()<0.5, metal:pick(d.metals), stone:d.stone?pick(G.STONES).id:undefined, size: d.size? Math.round(d.size.min+(d.size.max-d.size.min)*rnd()):undefined,
     strap: pick(G.STRAPS).id, strapHex: (G.STRAP_COLOURS? pick(G.STRAP_COLOURS)[1] : '#3b2417'), dial: (G.DIALS? pick(G.DIALS)[1] : '#f2f0ea'), display: pick(['analogue','digital'])}; });
  o.acc.wrist = rnd()<0.5? 16+Math.round(rnd()*4):null;
  return o;
}
const problems={}; const bad=(k,msg)=>{ (problems[k]=problems[k]||[]).length<3 && problems[k].push(msg); problems[k].n=(problems[k].n||0)+1; };
let n=0, checksTotal=0;
for (let i=0;i<6000;i++){
  const o=randomOutfit(), a=pick(aList); let checks, v;
  try { checks=E.checkOutfit(o,a); v=E.verdict(checks); E.skinClashes(o,a); } catch(e){ bad('EXCEPTION', e.message+' | '+(e.stack||'').split('\n')[1]); continue; }
  n++; checksTotal+=checks.length;
  if (!v || !v.title || !v.level) bad('verdict shape', JSON.stringify(v));
  checks.forEach(c=>{
    if (typeof c.score!=='number' || isNaN(c.score) || c.score<0 || c.score>1) bad('score out of range', c.id+' '+c.score);
    if (typeof c.text!=='string' || !c.text.trim()) bad('empty text', c.id);
    else if (/undefined|NaN|null|\[object|\bfunction\b/.test(c.text)) bad('broken text', c.id+': '+c.text.slice(0,160));
    else if (/\s{2,}|\.\.(?!\.)|\s[.,;:]/.test(c.text)) bad('typography', c.id+': '+c.text.slice(0,160));
    (c.slots||[]).forEach(s=>{ if (G.SLOTS.indexOf(s)<0) bad('unknown slot', c.id+' '+s); else if (!o[s]) bad('check names an absent piece', c.id+' -> '+s+': '+c.text.slice(0,100)); });
    if (!E.sectionOf(c)) bad('no section', c.id);
  });
}
console.log('outfits checked:', n, '| checks:', checksTotal);
for (const [k,v] of Object.entries(problems)) { console.log('\n##', k, '×'+v.n); v.forEach(m=>console.log('  -', m)); }
if (!Object.keys(problems).length) console.log('stress: no problems found'); else process.exit(1);
