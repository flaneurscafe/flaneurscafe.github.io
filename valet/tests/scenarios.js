/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — rule scenarios: precise outfits and the notes that should or should not appear.
   Run with Node from the project folder: node tests/scenarios.js (VERBOSE=1 lists each). Exits 1 on failure.
   When a rule changes on purpose, change its scenario with it. */
global.window={}; const path=require('path'); const ROOT=path.join(__dirname,'..');
for (const f of ['colour','vision','patterns','data','garments', 'rules', 'engine', 'suggest','body','proportion','chart']) require(path.join(ROOT,'js',f+'.js'));
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
// ---- white near a very fair skin (1.11.2): close by CIEDE2000, but never failed at the face ----
const aFair=E.analyseProfile({samples:{white:null,skin:'#f0d3c3',hair:'#7a5c4a',eyes:'#6d8293'},manual:{skin:true,hair:true,eyes:true},useWhite:true,hairStyle:'none',grey:0,underEye:'deep',redness:'mild'});
T('white shirt under a navy jacket, very fair skin: passes at the face', base({shirt:P('#f7f6f2','shirt','poplin'),occasion:'business'}), [[/^face:/,false]], aFair);
T('light grey shirt, very fair skin: still too close to the skin', base({shirt:P('#c9cbcd','shirt','poplin')}), [[/^face:/,true]], aFair);
// ---- a patterned suit is one cloth (1.11.7) ----
const WP=()=>({type:'windowpane',hex2:'#c9cbcd',scale:7});
T('windowpane suit: jacket and trousers are one medium pattern', base({occasion:'business',jacket:P('#8e9196','jacket','flannel',{pat:WP()}),trousers:P('#8e9196','trousers','flannel',{pat:WP()})}), [[/^pmed:/,false]]);
T('windowpane jacket over glen trousers: two medium patterns', base({jacket:P('#8e9196','jacket','flannel',{pat:WP()}),trousers:P('#3d4045','trousers','flannel',{pat:{type:'glen',hex2:'#8e9196',scale:6}})}), [[/^pmed:/,true]]);
// ---- tweed trousers (1.11.8) ----
const HB=()=>({type:'herringbone',hex2:'#8a6a4a',scale:1});
T('tweed suit in winter: one pattern, right season', base({occasion:'smart',jacket:P('#6b4f36','jacket','tweed',{pat:HB()}),trousers:P('#6b4f36','trousers','tweed',{pat:HB()})}), [[/^pmed:/,false],[/^season:/,false]]);
T('tweed trousers in summer: the season check notes them', base({jacket:P('#1d2a44','jacket','linen'),trousers:P('#6b4f36','trousers','tweed')}), [[/^season:/,true]], aS);
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

// ---- 1.14: four rules eased after the Gentleman's Gazette test ----
{
  const chk = (name, o, a, fn) => { const cs = E.checkOutfit(o, a), ok = fn(cs); count++; if (!ok) { fails++; console.log('✗', name, cs.filter(c=>c.score<0.85).map(c=>c.id+' '+c.score+': '+c.text.slice(0,100))); } else if (process.env.VERBOSE) console.log('✓', name); };
  // season: the pocket square's cloth does not count
  T('linen square with a tweed jacket in winter: no season note', base({jacket:P('#6b4f36','jacket','tweed'),square:P(col('White'),'square','linen')}), [[/^season:/,false]]);
  T('linen trousers with a tweed jacket: still a season note', base({jacket:P('#6b4f36','jacket','tweed'),trousers:P('#d8cfbd','trousers','linen')}), [[/^season:/,true]]);
  // near match: leather shoes are not compared with the trousers
  T('black calf boots with black jeans: no near match', base({trousers:P('#1e1c23','trousers','denim'),shoes:P('#222125','chelsea','calf'),socks:P('#1e1c23','socks')}), [[/^near:/,false]]);
  T('canvas trainers almost the trousers\' colour: still a near match', base({trousers:P('#c8b89a','trousers','cotton'),shoes:P('#c2b08f','trainer','canvas'),socks:P('#c8b89a','socks')}), [[/^near:/,true]]);
  T('navy jacket with midnight trousers: still a near match', base({jacket:P(col('Navy'),'jacket','hopsack'),trousers:P(col('Midnight')||col('Ink'),'trousers','flannel')}), [[/^near:/,true]]);
  // light-dark step: a little short is a note, well short a failure
  { const lo = aW.band[0], grey = L => window.VC.labToHex([L, 0, 0]);
    const shirtL = 92, sh = grey(shirtL);
    const o1 = base({shirt:P(sh,'shirt','poplin'), jacket:P(grey(shirtL - lo * 0.9),'jacket','hopsack')});
    const o2 = base({shirt:P(sh,'shirt','poplin'), jacket:P(grey(shirtL - lo * 0.5),'jacket','hopsack')});
    chk('a step at 90% of the bound: a note', o1, aW, cs => cs.some(c => c.id === 'step' && c.score === 0.65));
    chk('a step at half the bound: a failure', o2, aW, cs => cs.some(c => c.id === 'step' && c.score === 0.35)); }
  // temperature: with a low-confidence reading, a clash of temperature alone is a note
  { const skin = { white:null, skin:'#814c35', hair:'#1a1412', eyes:'#2a1c14' };
    const low = E.analyseProfile({ samples: skin, manual: { skin:true, hair:true, eyes:true }, useWhite:true, hairStyle:'none', season:'winter' });
    const good = E.analyseProfile({ samples: Object.assign({}, skin, { white:'#f2f2f2' }), manual: {}, useWhite:true, hairStyle:'none', season:'winter' });
    const gold = base({shirt:P(col('White'),'shirt','poplin'), tie:P('#d0bc87','tie','repsilk')});
    chk('the reading is cool in both, low and trustworthy confidence', gold, low, () => low.tempLevel === 'cool' && good.tempLevel === 'cool' && low.confidence === 'low' && good.confidence !== 'low');
    chk('gold tie, cool skin, low confidence: a note that says why', gold, low, cs => cs.some(c => c.id === 'face' && c.score === 0.6 && /low confidence/.test(c.text)));
    chk('gold tie, cool skin, trustworthy reading: a failure', gold, good, cs => cs.some(c => c.id === 'face' && c.score === 0.3));
    const flat = base({shirt:P('#7a5a48','shirt','poplin'), tie:P('#d0bc87','tie','repsilk')});   // a shirt that merges with the skin, besides the tie
    chk('temperature plus another clash, low confidence: still a failure', flat, low, cs => cs.some(c => c.id === 'face' && c.score === 0.3)); }
}

// ---- 1.14.1: the review of 1.14 ----
{
  const chk = (name, ok) => { count++; if (!ok) { fails++; console.log('✗', name); } else if (process.env.VERBOSE) console.log('✓', name); };
  const skin = { white:null, skin:'#814c35', hair:'#1a1412', eyes:'#2a1c14' };
  const low = E.analyseProfile({ samples: skin, manual: { skin:true, hair:true, eyes:true }, useWhite:true, hairStyle:'none', season:'winter' });
  // a failing face check with one temperature-only piece: that piece is marked, the "is a note" sentence is not added
  const mixed = E.checkOutfit(base({shirt:P('#7a5a48','shirt','poplin'), tie:P('#d0bc87','tie','repsilk')}), low).find(c => c.id === 'face');
  chk('mixed clash: fails, marks the temperature-only piece, no "is a note" sentence', mixed && mixed.score === 0.3 && /temperature only, a note on its own/.test(mixed.text) && !/check it in daylight/.test(mixed.text));
  // temperature that tips a colour already weaker on another rule is not "temperature alone"
  const raph = E.analyseProfile({ samples: { white:null, skin:'#b88f78', hair:'#2a2018', eyes:'#3b2618' }, manual: { skin:true, hair:true, eyes:true }, useWhite:true, hairStyle:'short', season:'winter' });
  const orange = E.scoreColour('#c76b2f', raph);
  chk('a colour weaker on merge than on temperature is not temperature-only', orange.tier > 2 && orange.tempOnly === false);
  const gold = E.scoreColour('#d0bc87', low);
  chk('a gold tie against a cool reading is temperature-only', gold.tier > 2 && gold.tempOnly === true);
  // suede is leather: exempt from the near match with the trousers, like calf (a decision, 1.14.1)
  T('brown suede loafers with brown corduroy trousers: no near match', base({trousers:P('#5a3e2b','trousers','corduroy'),shoes:P('#5e412c','loafer','suede'),socks:P('#5a3e2b','socks')}), [[/^near:/,false]]);
  // the chart judges the light-dark step on the same pair as the Dresser
  const C = window.VCHART;
  const pair = (o) => { const has = k => !!o[k], Lk = k => window.VC.hexToLab(o[k])[0]; return E.stepOver(has, Lk); };
  const o1 = { shirt:'#8a8a8a', jacket:'#2a2a2e', tie:'#f4f4f2', trousers:'#8e9196', shoes:'#4a3326' };   // dark jacket, mid shirt, white tie
  const o2 = { shirt:'#f4f4f2', scarf:'#e8e8e8', jacket:'#2a2a2e', trousers:'#8e9196', shoes:'#4a3326' };  // white scarf over a white shirt, dark jacket
  chk('step pair: the jacket, not the tie', pair(o1) === 'jacket');
  chk('step pair: a scarf gives way to the jacket beside it', pair(o2) === 'jacket');
  [o1, o2].forEach((o, i) => {
    const r = C.build({ analysis: aW, outfit: o, skin: D.demo.samples.skin, names: {}, kinds: {} });
    const t = r.label;
    chk('chart ' + (i + 1) + ': the bracket names the shirt (next to the neck) and the jacket', /next to the neck against jacket/i.test(t) && !/against tie|tie against/i.test(t) && !/against scarf|scarf against/i.test(t));
  });
}
console.log((fails ? fails + ' scenario(s) failed' : 'all scenarios pass') + ' (' + count + ' run)');
if (fails) process.exit(1);
