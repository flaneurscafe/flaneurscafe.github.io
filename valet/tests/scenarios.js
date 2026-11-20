/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — rule scenarios: precise outfits and the notes that should or should not appear.
   Run with Node from the project folder: node tests/scenarios.js (VERBOSE=1 lists each). Exits 1 on failure.
   When a rule changes on purpose, change its scenario with it. */
global.window={}; const path=require('path'); const ROOT=path.join(__dirname,'..');
for (const f of ['colour','vision','patterns','data','garments', 'rules', 'engine', 'suggest','body','proportion']) require(path.join(ROOT,'js',f+'.js'));
const E=window.VENGINE, G=window.VGARM, D=window.VDATA;
const aW=E.analyseProfile(Object.assign({},D.demo,{season:'winter'})), aS=E.analyseProfile(Object.assign({},D.demo,{season:'summer'}));
const P=(hex,kind,cloth,extra)=>Object.assign({hex,name:hex,kind,cloth,pat:{type:'solid'}},extra||{});
function base(over){
  const o={hat:null,shirt:P('#c3d7ee','shirt','poplin'),tie:null,scarf:null,mid:null,jacket:P('#1d2a44','jacket','hopsack'),coat:null,square:null,
    trousers:P('#8e9196','trousers','flannel'),socks:P('#1d2a44','socks'),shoes:P('#4a3326','loafer','calf'),gloves:null,
    occasion:'smart',propOn:false,body:{},shape:{},m:{},acc:{watch:{on:false},buckle:{on:false},cufflinks:{on:false},tiebar:{on:false},ring:{on:false},earring:{on:false}}};
  return Object.assign(o, over||{});
}
let fails=0;
let count=0;
function T(name, o, expect, a){ count++;
  const checks=E.checkOutfit(o, a||aW), txt=checks.filter(c=>c.score<0.85).map(c=>c.id+': '+c.text);
  const res=expect.map(([re,should])=>{ const hit=txt.some(t=>re.test(t)); return hit===should?null:(should?'MISSING '+re:'UNEXPECTED '+re+' -> '+txt.filter(t=>re.test(t))[0].slice(0,130)); }).filter(Boolean);
  if (res.length){ fails++; console.log('✗', name, '\n   ', res.join('\n    ')); } else if (process.env.VERBOSE) console.log('✓', name);
}
// ---- coat ----
T('parka over business dress is noted', base({occasion:'business',coat:P('#2d3b2a','parka','nylonmatte')}), [[/^coat:/,true]]);
T('parka on a casual day is fine', base({occasion:'casual',coat:P('#2d3b2a','parka','nylonmatte')}), [[/^coat:/,false]]);
T('overcoat at business is fine', base({occasion:'business',coat:P('#3d4045','overcoat','melton')}), [[/^coat:/,false]]);
T('a coat with lapels over a tee frames the face', base({shirt:P('#f7f6f2','tee','jersey'),jacket:null,coat:P('#3d4045','overcoat','melton')}), [[/^frame:/,false]]);
// ---- gloves ----
T('brown gloves with brown shoes', base({gloves:P('#4a3326','leather','gloveleather')}), [[/^gloves:/,false]]);
T('knitted gloves at evening', base({occasion:'evening',gloves:P('#3d4045','knit','lambswool')}), [[/Knitted gloves/,true]]);
// ---- spectators ----
T('spectators, summer, smart casual: no notes about them', base({jacket:P('#1d2a44','jacket','linen'),trousers:P('#c9b99a','trousers','linen'),shoes:P('#4a3326','spectator','calf',{hex2:'#f2efe6'})}), [[/^spectator:/,false]], aS);
// ---- blazer buttons ----
const W=(o,acc)=>{o.acc=Object.assign(o.acc,acc);return o;};
T('gold buttons and a steel watch: mixed metals', W(base({jacket:P('#1d2a44','blazer','hopsack',{buttons:'gold'})}),{watch:{on:true,metal:'silver',size:38,strap:'bracelet'}}), [[/Mixed metals.*blazer buttons/,true]]);
T('gold buttons and a gold watch: one metal', W(base({jacket:P('#1d2a44','blazer','hopsack',{buttons:'gold'})}),{watch:{on:true,metal:'gold',size:38,strap:'bracelet'}}), [[/Mixed metals/,false]]);
T('horn buttons and a steel watch: no mix', W(base({jacket:P('#1d2a44','blazer','hopsack',{buttons:'horn'})}),{watch:{on:true,metal:'silver',size:38,strap:'bracelet'}}), [[/Mixed metals/,false]]);
// ---- watch ----
const WT=(occ,w,extra)=>W(base(Object.assign({occasion:occ},extra||{})),{watch:Object.assign({on:true,metal:'silver',size:38,strap:'leather',strapHex:'#3b2417',dial:'#f2f0ea',display:'analogue'},w)});
T('digital at business', WT('business',{display:'digital'}), [[/digital display/,true]]);
T('digital, casual', WT('casual',{display:'digital'}), [[/digital display/,false]]);
T('rubber at business', WT('business',{strap:'rubber',strapHex:'#151515'}), [[/rubber strap/,true]]);
T('brown strap, brown shoes', WT('smart',{strapHex:'#6e4227'}), [[/strap with/,false]]);
T('navy strap, brown shoes: no claim', WT('smart',{strapHex:'#1d2a44'}), [[/strap with/,false]]);
T('bracelet: no strap colour rule', WT('smart',{strap:'bracelet',strapHex:'#151515'}), [[/strap with/,false]]);
T('black case is not counted as a mixed metal', W(base({}),{watch:{on:true,metal:'black',size:38,strap:'rubber'},buckle:{on:true,metal:'silver'}}), [[/Mixed metals/,false]]);
// ---- hats and formality ----
T('homburg with a tee and trainers (casual)', base({occasion:'casual',hat:P('#3d4045','homburg','felt'),shirt:P('#f7f6f2','tee','jersey'),jacket:null,shoes:P('#f7f6f2','trainer','canvas')}), [[/^hatf:/,true]]);
T('baseball cap with business dress', base({occasion:'business',hat:P('#1d2a44','cap','cotton'),tie:P('#5e1f2c','tie','grenadine')}), [[/^hatf:/,true]]);
T('fedora at smart casual: fine', base({hat:P('#3d4045','fedora','felt')}), [[/^hatf:/,false]]);
// ---- jackets ----
T('waxed jacket with a tie at business', base({occasion:'business',jacket:P('#2d3b2a','waxed','waxed'),tie:P('#5e1f2c','tie','grenadine')}), [[/formal|casual|business/i,true]]);
T('pocket square in a blazer: allowed', base({jacket:P('#1d2a44','blazer','hopsack'),square:P('#f7f6f2','square','linen')}), [[/needs a jacket with a breast pocket/,false]]);
T('pocket square in a waxed jacket: refused', base({jacket:P('#2d3b2a','waxed','waxed'),square:P('#f7f6f2','square','linen')}), [[/needs a breast pocket/,true]]);

T('flat cap at evening: allowed (one step of grace)', base({occasion:'evening',hat:P('#3d4045','flatcap','tweed')}), [[/^hatf:/,false]]);
T('bowler at business: fine', base({occasion:'business',hat:P('#161616','bowler','felt')}), [[/^hatf:/,false]]);
T('beanie at business', base({occasion:'business',hat:P('#3d4045','beanie','lambswool')}), [[/^hatf:/,true]]);
T('black gloves with a black coat and brown shoes: tone with the coat', base({gloves:P('#161616','leather','gloveleather'),coat:P('#1b1b1d','overcoat','melton')}), [[/Gloves usually follow/,false]]);
T('tan suede gloves with brown shoes', base({gloves:P('#8a6a4a','suede','suede')}), [[/Gloves usually follow/,false]]);
// ---- buttonhole and accents ----
const B=(x,over)=>Object.assign(base(over||{}),{boutonniere:x});
T('flower on a waxed jacket: needs a lapel', B(P('#f2efe6','flower'),{jacket:P('#2d3b2a','waxed','waxed')}), [[/needs lapels/,true]]);
T('flower on a knit, no jacket, lapelled coat: allowed', B(P('#f2efe6','flower'),{jacket:null,coat:P('#3d4045','overcoat','melton')}), [[/needs lapels/,false]]);
T('lapel pin on a casual day: no occasion note', B(P('#b9bcc0','pin',undefined,{metal:'silver'}),{occasion:'casual'}), [[/for an occasion/,false]]);
T('red flower and white square: fine', B(P('#a51e34','flower'),{square:P('#f7f6f2','square','linen')}), [[/^bout:/,false]]);
T('gold pin and steel watch: mixed metals', W(B(P('#c9a54a','pin',undefined,{metal:'gold'})),{watch:{on:true,metal:'silver',size:38,strap:'bracelet'}}), [[/Mixed metals.*[Ll]apel pin/,true]]);
T('gold pin: no skin clash, judged as metal', B(P('#c9a54a','pin',undefined,{metal:'gold'})), [[/^face: Clashes/,false]]);
T('square + cufflinks at business: fine', W(base({occasion:'business',square:P('#f7f6f2','square','linen')}),{cufflinks:{on:true,metal:'silver',size:15,stone:'none'}}), [[/^accents:/,false]]);
T('square + flower + cufflinks in the evening: fine (the black-tie trio)', W(B(P('#a51e34','flower'),{occasion:'evening',square:P('#f7f6f2','square','linen')}),{cufflinks:{on:true,metal:'silver',size:15,stone:'none'}}), [[/^accents:/,false]]);
T('watch and buckle do not count as accents', W(base({occasion:'business',square:P('#f7f6f2','square','linen')}),{watch:{on:true,metal:'silver',size:38,strap:'leather',strapHex:'#3b2417'},buckle:{on:true,metal:'silver'},cufflinks:{on:true,metal:'silver',size:15,stone:'none'}}), [[/^accents:/,false]]);

// ---- the logic critiques (1.7): each case that was wrong before, and stays fixed ----
const col=n=>D.colours.find(c=>c.name===n).hex;
T('royal blue socks with grey flannel for business: outside the family, not deep', base({socks:P(col('Royal blue'),'socks'),occasion:'business'}), [[/^socks: .*outside the trousers' colour family/,true]]);
T('light blue socks with navy trousers for business: a distinct tone, passes (GG)', base({socks:P(col('Light blue'),'socks'),trousers:P(col('Navy'),'trousers','worsted'),occasion:'business'}), [[/^socks:/,false]]);
T('socks that match brown shoes, not grey trousers: fails', base({socks:P(col('Chocolate'),'socks')}), [[/^socks: .*match the shoes/,true]]);
T('muted green socks with grey flannel, smart casual: passes', base({socks:P(col('Olive'),'socks')}), [[/^socks:/,false]]);
T('a tie with jeans: neckwear clash (GG)', base({tie:P(col('Burgundy'),'tie','grenadine'),trousers:P('#2b3a55','trousers','denim')}), [[/^denimtie: /,true]]);
T('neon green socks: electric, noted', base({socks:P('#39ff14','socks')}), [[/^socks: /,true]]);
T('burgundy socks with black trousers pass as a deep colour', base({socks:P(col('Burgundy'),'socks'),trousers:P(col('Black'),'trousers','worsted')}), [[/^socks:/,false]]);
T('pinstripe jacket, plain trousers: not a suit', base({jacket:P(col('Navy'),'jacket','worsted',{pat:{type:'pinstripe',scale:1.2,hex2:'#1f2c47'}}),trousers:P(col('Navy'),'trousers','worsted')}), [[/^orphan: .*not one pattern/,true]]);
T('stripes of 1.0 and 1.8 cm are not one suit, and are not called one', base({jacket:P(col('Navy'),'jacket','worsted',{pat:{type:'pinstripe',scale:1.0,hex2:'#f7f6f2'}}),trousers:P(col('Navy'),'trousers','worsted',{pat:{type:'pinstripe',scale:1.8,hex2:'#f7f6f2'}}),shoes:P(col('White'),'trainer','canvas')}), [[/^orphan:/,true],[/^shoe: A suit with trainers/,false]]);
T('white shirt + white scarf + charcoal jacket: the jacket frames', base({shirt:P(col('White'),'shirt','poplin'),scarf:P(col('White'),'scarf','cashmere'),jacket:P(col('Charcoal'),'jacket','flannel')}), [[/^step:/,false]]);
T('an impossible cloth pattern is flagged', base({jacket:P(col('Navy'),'overshirt','denim',{pat:{type:'glen',scale:6,hex2:'#8e9196'}})}), [[/^ptype:/,true]]);
T('a pocket square in an overcoat is allowed', base({jacket:null,mid:P(col('Charcoal'),'crew','merino'),coat:P(col('Charcoal'),'overcoat','melton'),square:P(col('White'),'square','linen')}), [[/^square:/,false]]);
T('a strong flower is a note, like a square', B(P(col('Orange'),'flower')), [[/^face: .*/,true]]);
T('jacket and shoes are not compared as a near match', base({jacket:P('#4f3428','jacket','corduroy'),shoes:P(col('Chocolate'),'loafer','calf')}), [[/^near:/,false]]);
T('open-collar shirt, chinos and trainers: a wide mix, not a mistake', base({shirt:P(col('White'),'shirt','poplin'),jacket:null,trousers:P(col('Khaki'),'trousers','cotton'),shoes:P(col('White'),'trainer','canvas'),socks:null}), [[/^formal: .*too far apart/,false]]);
T('jeans and a blazer suit smart casual', base({shirt:P(col('Light blue'),'shirt','oxford'),jacket:P(col('Navy'),'blazer','hopsack'),trousers:P(col('Ink'),'trousers','denim'),shoes:P(col('Chocolate'),'derby','calf')}), [[/^(formal|occasion):/,false]]);
T('striped jacket and trousers at one scale clash at the hips', base({jacket:P(col('Navy'),'jacket','worsted',{pat:{type:'pinstripe',scale:1.2,hex2:'#f7f6f2'}}),trousers:P(col('Mid grey'),'trousers','worsted',{pat:{type:'pinstripe',scale:1.2,hex2:'#a51e34'}})}), [[/^phip:/,true]]);
T('the pocket square counts among patterns near the face', base({shirt:P(col('Light blue'),'shirt','poplin',{pat:{type:'bengal',scale:1.1,hex2:'#f7f6f2'}}),tie:P(col('Burgundy'),'tie','repsilk',{pat:{type:'repp',scale:2.2,hex2:'#c8a24a'}}),square:P(col('White'),'square','silktwill',{pat:{type:'paisley',scale:2.5,hex2:'#5e1f2c'}})}), [[/^pcount:/,true],[/^anchor:/,false]]);
T('gold frames + warm scarf on a cool face: one note, no advice to change frames', W(base({scarf:P('#c19a6b','scarf','cashmere')}),{glasses:{on:true,frame:'gold'}}), [[/^glasses: .*second warm note/,true],[/silver frames/,false]]);
T('an impossible combination is its own verdict', base({jacket:P('#2d3b2a','waxed','waxed'),square:P(col('White'),'square','linen')}), []);
{ const v=E.verdict(E.checkOutfit(base({jacket:P('#2d3b2a','waxed','waxed'),square:P(col('White'),'square','linen')}),aW));
  if (v.title!=='Not possible as set') { fails++; console.log('✗ verdict for an impossible combination:', v.title); } }

// ---- patterns and colour (sources checked November 2026): echo is a hint, never a penalty ----
{
  const chk = (name, o, fn) => { const cs = E.checkOutfit(o, aW), ok = fn(cs, E.verdict(cs)); count++; if (!ok) { fails++; console.log('✗', name, cs.filter(c=>/^(pecho|pscale|pshare)$/.test(c.id)).map(c=>c.id+' '+c.score+': '+c.text.slice(0,90))); } else if (process.env.VERBOSE) console.log('✓', name); };
  const tie = (hex2) => P(col('Navy'),'tie','repsilk',{pat:{type:'repp',scale:2.2,hex2:hex2}});
  chk('a pattern colour picked up by the socks: a tick', base({tie:tie(col('Burgundy')),socks:P(col('Burgundy'),'socks')}),
      cs => cs.some(c=>c.id==='pecho'&&c.score===1&&/picked up by/.test(c.text)));
  const loose = base({tie:tie('#d98e04')}), noTie = base({});
  chk('a pattern colour picked up nowhere: a hint that does not change the verdict', loose,
      (cs,v) => { const w = E.verdict(cs.filter(c=>c.id!=='pecho')); return cs.some(c=>c.id==='pecho'&&c.score===0.9) && v.fails===w.fails && v.warns===w.warns && v.title===w.title; });
  chk('the shared-colour penalty is gone', base({shirt:P(col('Light blue'),'shirt','poplin',{pat:{type:'bengal',scale:1.1,hex2:'#f7f6f2'}}),tie:tie('#d98e04')}),
      cs => !cs.some(c=>c.id==='pshare'));
  chk('a stripe and a check of one scale, different colours: a note, not a failure', base({shirt:P(col('Light blue'),'shirt','poplin',{pat:{type:'bengal',scale:1.1,hex2:'#f7f6f2'}}),tie:P(col('Burgundy'),'tie','silktwill',{pat:{type:'houndstooth',scale:1.0,hex2:'#c8a24a'}})}),
      cs => cs.some(c=>c.id==='pscale'&&c.score===0.6));
  chk('two stripes of one scale: still a failure', base({shirt:P(col('Light blue'),'shirt','poplin',{pat:{type:'bengal',scale:1.1,hex2:'#f7f6f2'}}),jacket:P(col('Navy'),'jacket','worsted',{pat:{type:'pinstripe',scale:1.2,hex2:'#f7f6f2'}})}),
      cs => cs.some(c=>c.id==='pscale'&&c.score===0.4));
}
console.log((fails ? fails + ' scenario(s) failed' : 'all scenarios pass') + ' (' + count + ' run)');
if (fails) process.exit(1);
