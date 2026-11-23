/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — rule scenarios: precise outfits and the notes that should or should not appear.
   Run with Node from the project folder: node tests/scenarios.js (VERBOSE=1 lists each). Exits 1 on failure.
   When a rule changes on purpose, change its scenario with it. */
global.window={}; const path=require('path'); const ROOT=path.join(__dirname,'..');
require('./load')(['colour','vision','patterns','data','garments', 'rules', 'engine', 'suggest','body','proportion','chart']);
const E=window.VENGINE, G=window.VGARM, D=window.VDATA;
const aW=E.analyseProfile(Object.assign({},D.demo,{season:'winter'})), aS=E.analyseProfile(Object.assign({},D.demo,{season:'summer'}));
const P=(hex,kind,cloth,extra)=>Object.assign({hex,name:hex,kind,cloth,pat:{type:'solid'}},extra||{});
function base(over){
  const o={hat:null,shirt:P('#c3d7ee','shirt','poplin'),tie:null,scarf:null,mid:null,jacket:P('#1d2a44','jacket','hopsack'),coat:null,square:null,
    trousers:P('#8e9196','trousers','flannel'),socks:P('#1d2a44','socks'),shoes:P('#4a3326','loafer','calf'),gloves:null,
    occasion:'smart',propOn:false,body:{},shape:{},m:{},acc:{watch:{on:false},buckle:{on:false},cufflinks:{on:false},tiebar:{on:false},ring:{on:false}}};
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
    chk('gold tie, skin typed in: a note that says the skin was entered by hand (1.16)', gold, low, cs => cs.some(c => c.id === 'face' && c.score === 0.6 && /entered by hand/.test(c.text)));
    chk('gold tie, cool skin, trustworthy reading: also a note since 1.15 (temperature alone never fails)', gold, good, cs => cs.some(c => c.id === 'face' && c.score === 0.6 && !/low confidence/.test(c.text)));
    const flat = base({shirt:P('#7a5a48','shirt','poplin'), tie:P('#d0bc87','tie','repsilk')});   // a shirt that merges with the skin, besides the tie
    chk('temperature plus another clash, measured skin: still a failure', flat, good, cs => cs.some(c => c.id === 'face' && c.score === 0.3));
    chk('the same with the skin typed in: a note (1.16)', flat, low, cs => cs.some(c => c.id === 'face' && c.score === 0.6 && /entered by hand/.test(c.text))); }
}

// ---- 1.14.1: the review of 1.14 ----
{
  const chk = (name, ok) => { count++; if (!ok) { fails++; console.log('✗', name); } else if (process.env.VERBOSE) console.log('✓', name); };
  const skin = { white:null, skin:'#814c35', hair:'#1a1412', eyes:'#2a1c14' };
  const low = E.analyseProfile({ samples: Object.assign({}, skin, { white: '#f2f2f2' }), manual: {}, useWhite: true, hairStyle: 'none', season: 'winter' });   // measured since 1.16: a typed skin makes every clash a note
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

// ---- 1.15: Flusser's rules (Dressing the Man): patterns by what is seen, contrast, build, squares, echo ----
{
  const chk = (name, ok, why) => { count++; if (!ok) { fails++; console.log('✗', name, why ? '\n   ' + why : ''); } else if (process.env.VERBOSE) console.log('✓', name); };
  const VP = window.VPAT, VC = window.VC, O = null;
  const prof = (skin, hair, eyes, style) => E.analyseProfile({ samples: { white: null, skin, hair, eyes }, manual: { skin: true, hair: true, eyes: true }, useWhite: true, hairStyle: style || 'short', season: 'winter' });
  const low = prof('#e8c4a8', '#c8a878', '#7a8a6a'), high = prof('#f0d0bc', '#1a1412', '#2a1c14');
  const ids = (cs, id) => cs.filter(c => c.id === id);
  const notes = (cs, id) => cs.filter(c => c.id === id && c.score < 0.85);
  const txt = cs => cs.filter(c => c.score < 0.85).map(c => c.id + ' ' + c.score + ': ' + c.text.slice(0, 120)).join('\n   ');

  // the share of the second colour
  const f0 = VP.mean('#f7e8d8', { type: 'foulard', hex2: '#6b3a24' }), f5 = VP.mean('#f7e8d8', { type: 'foulard', hex2: '#6b3a24', cover: 0.5 });
  chk('share: a half-and-half foulard adds up darker than the usual one', VC.hexToLab(f5)[0] < VC.hexToLab(f0)[0] - 15);
  chk('share: kept by norm, rounded', VP.norm({ type: 'foulard', hex2: '#6b3a24', cover: 0.333 }).cover === 0.33);
  chk('share: out of range or nonsense is dropped', VP.norm({ type: 'foulard', cover: 0.99 }).cover === undefined && VP.norm({ type: 'foulard', cover: 'x' }).cover === undefined && VP.norm({ type: 'foulard', cover: 0.01 }).cover === undefined);
  chk('share: the default is the drawing\'s', VP.coverOf({ type: 'gingham' }) === VP.byId.gingham.cover && VP.coverOf({ type: 'solid' }) === 0);
  chk('checks on neckwear: gingham and tattersall for ties, bow ties and cravats, in silk twill and wool', ['tie', 'bowtie', 'cravat'].every(k => G.byKey.tie.kinds.find(x => x.id === k).pats.indexOf('gingham') >= 0) && G.patOK('silktwill', 'tattersall') && G.patOK('woolchallis', 'gingham'));

  // a pattern that reads at 3 m is judged by its main colours
  const grid = P('#fbe6d6', 'cravat', 'silktwill', { pat: { type: 'gingham', scale: 1.2, hex2: '#7a4a32', cover: 0.5 } });
  const lk = E.look(grid);
  chk('seen colours: a half-and-half grid that reads at 3 m shows both its colours', lk.visible && E.seenColours(lk).length === 2);
  const thin = E.look(P('#1d2a44', 'tie', 'silktwill', { pat: { type: 'foulard', scale: 1.5, hex2: '#f7f6f2' } }));
  chk('seen colours: a navy foulard with small white motifs is seen as its navy ground', E.seenColours(thin).length === 1 && E.seenColours(thin)[0] === '#1d2a44');
  const tex = E.look(P('#1d2a44', 'jacket', 'worsted', { pat: { type: 'birdseye', scale: 0.3, hex2: '#3a4a64' } }));
  chk('seen colours: a pattern that reads as texture is its average', !tex.visible && E.seenColours(tex)[0] === tex.mean);
  const cream = base({ shirt: P('#ede4d6', 'shirt', 'poplin'), tie: grid });
  chk('tie against shirt: a cream-and-rust grid stands clear of a cream shirt by its rust', !notes(E.checkOutfit(cream, aW), 'tie').length, txt(E.checkOutfit(cream, aW)));
  const creamAvg = base({ shirt: P('#ede4d6', 'shirt', 'poplin'), tie: P('#fbe6d6', 'cravat', 'silktwill', { pat: { type: 'foulard', scale: 1.2, hex2: '#7a4a32' } }) });
  chk('tie against shirt: a sparse foulard on the same cream ground still merges with the shirt', notes(E.checkOutfit(creamAvg, aW), 'tie').length === 1);

  // temperature alone never fails
  const kyle = E.analyseProfile({ samples: { white: '#f2f2f2', skin: '#814c35', hair: '#1a1412', eyes: '#2a1c14' }, manual: {}, useWhite: true, hairStyle: 'short', season: 'winter' });
  const goldTie = base({ shirt: P('#f7f6f2', 'shirt', 'poplin'), tie: P('#d0bc87', 'tie', 'repsilk') });
  const fg = E.checkOutfit(goldTie, kyle).find(c => c.id === 'face');
  chk('temperature alone: a note with a measured skin too', fg && fg.score === 0.6 && /temperature alone is a note/.test(fg.text), fg && fg.text);

  // the outfit's contrast against the face's
  const stark = base({ jacket: P('#161616', 'jacket', 'worsted'), shirt: P('#f7f6f2', 'shirt', 'poplin'), trousers: P('#161616', 'trousers', 'worsted') });
  const cs1 = E.checkOutfit(stark, low);
  chk('outfit contrast: black and white on a muted face is noted (or the collar step says it)', notes(cs1, 'ocontrast').length === 1 || notes(cs1, 'step').length === 1, txt(cs1));
  const soft = base({ jacket: P('#8a7a68', 'jacket', 'linen'), shirt: P('#cdbfa8', 'shirt', 'poplin'), trousers: P('#a89880', 'trousers', 'cotton') });
  chk('outfit contrast: soft tones on a muted face are fine', !notes(E.checkOutfit(soft, low), 'ocontrast').length);
  const tonal = base({ jacket: null, shirt: P('#8e8a84', 'polo', 'pique'), trousers: P('#7f7b75', 'trousers', 'cotton'), socks: P('#7f7b75', 'socks'), shoes: P('#6a6058', 'loafer', 'suede') });
  const cs2 = E.checkOutfit(tonal, high);
  chk('outfit contrast: a tonal outfit with one layer on a high-contrast face is noted', notes(cs2, 'ocontrast').length === 1, txt(cs2));
  chk('outfit contrast: a medium-contrast face is never noted', !notes(E.checkOutfit(tonal, aW), 'ocontrast').length && !notes(E.checkOutfit(stark, aW), 'ocontrast').length);
  const boldTie = base({ tie: P('#161616', 'tie', 'repsilk', { pat: { type: 'repp', scale: 2.2, hex2: '#f7f6f2', cover: 0.5 } }) });
  chk('pattern contrast (existing rule): a bold black-and-white tie on a muted face is noted once', notes(E.checkOutfit(boldTie, low), 'pcontrast').length === 1);

  // top and trousers, by build
  const close = base({ jacket: P(col('Charcoal'), 'jacket', 'flannel'), trousers: P('#55575b', 'trousers', 'flannel') });
  const csA = E.checkOutfit(close, aW);
  chk('halves: close in lightness, no height known: a note about you that never counts', ids(csA, 'halves').length === 1 && E.kindOf(ids(csA, 'halves')[0]) === 'context' && !ids(csA, 'blur').length, txt(csA));
  const withH = h => Object.assign({}, close, { propOn: true, m: { height: h }, body: {} });
  chk('halves: the verdict does not change with or without that note', E.verdict(csA).title === E.verdict(csA.filter(c => c.id !== 'halves')).title);
  chk('halves: a tall frame gets a note to break the line', notes(E.checkOutfit(withH(190), aW), 'phalves').length === 1 && !ids(E.checkOutfit(withH(190), aW), 'halves').length);
  chk('halves: a short frame gets a tick', ids(E.checkOutfit(withH(165), aW), 'phalves').some(c => c.score === 1));
  chk('halves: an average frame gets a tick', ids(E.checkOutfit(withH(178), aW), 'phalves').some(c => c.score === 1));
  const strong = Object.assign(base({ jacket: P('#1d2a44', 'blazer', 'hopsack'), trousers: P('#e8e0d0', 'trousers', 'cotton') }), { propOn: true, m: { height: 165 }, body: {} });
  chk('halves: a strong step on a short frame is noted', notes(E.checkOutfit(strong, aW), 'phalves').length === 1);
  const suitO = Object.assign(base({ jacket: P(col('Charcoal'), 'jacket', 'flannel'), trousers: P(col('Charcoal'), 'trousers', 'flannel') }), { propOn: true, m: { height: 190 }, body: {} });
  chk('halves: a suit is one block, not judged', !ids(E.checkOutfit(suitO, aW), 'phalves').length && !ids(E.checkOutfit(suitO, aW), 'halves').length);

  // the pocket square with the tie (Flusser pp. 216-217)
  const sqBase = o => base(Object.assign({ jacket: P('#1d2a44', 'blazer', 'hopsack') }, o));
  const plainPlain = sqBase({ tie: P('#5e1f2c', 'tie', 'grenadine'), square: P('#c8a24a', 'square', 'silktwill') });
  chk('square: a plain square with a plain tie is noted', notes(E.checkOutfit(plainPlain, aW), 'hank').some(c => /patterned tie/.test(c.text)));
  const ground = sqBase({ tie: P('#5e1f2c', 'tie', 'silktwill', { pat: { type: 'foulard', scale: 1.2, hex2: '#c8a24a' } }), square: P('#5f202d', 'square', 'linen') });
  chk('square: a plain square in the tie\'s ground colour is noted', notes(E.checkOutfit(ground, aW), 'hank').some(c => /ground colour/.test(c.text)));
  const goodSq = sqBase({ tie: P('#5e1f2c', 'tie', 'silktwill', { pat: { type: 'foulard', scale: 1.2, hex2: '#c8a24a' } }), square: P('#c8a24a', 'square', 'linen') });
  const csG = E.checkOutfit(goodSq, aW);
  chk('square: a matte square echoing the tie\'s figure, with a silk patterned tie: a tick, no note', ids(csG, 'hank').some(c => c.score === 1) && !notes(csG, 'hank').length, txt(csG));
  const silkSilk = sqBase({ tie: P('#5e1f2c', 'tie', 'silktwill', { pat: { type: 'foulard', scale: 1.2, hex2: '#c8a24a' } }), square: P('#c8a24a', 'square', 'silktwill') });
  chk('square: a silk square with a silk tie is noted for the surface', notes(E.checkOutfit(silkSilk, aW), 'hank').some(c => /lustre/.test(c.text)));
  const woolLinen = sqBase({ tie: P('#5e1f2c', 'tie', 'woolchallis', { pat: { type: 'paisley', scale: 2.5, hex2: '#c8a24a' } }), square: P('#c8a24a', 'square', 'linen') });
  chk('square: a linen square with a wool tie is noted for the surface', notes(E.checkOutfit(woolLinen, aW), 'hank').some(c => /silk square/.test(c.text)));
  const whiteSq = sqBase({ tie: P('#5e1f2c', 'tie', 'grenadine'), square: P('#f7f6f2', 'square', 'linen') });
  chk('square: white linen is exempt from all of it', !ids(E.checkOutfit(whiteSq, aW), 'hank').length);
  const noEcho = sqBase({ tie: P('#5e1f2c', 'tie', 'silktwill', { pat: { type: 'foulard', scale: 1.2, hex2: '#c8a24a' } }), square: P('#2f6b3d', 'square', 'linen') });
  const csN = E.checkOutfit(noEcho, aW);
  chk('square: a square that echoes nothing gets a hint that never changes the verdict', ids(csN, 'hank').some(c => c.score === 0.9) && E.verdict(csN).title === E.verdict(csN.filter(c => c.id !== 'hank')).title);

  // your own colours echoed
  const auburn = prof('#f0cdb8', '#7a3a22', '#5a6a7a');
  const echoTie = base({ tie: P('#7d3b26', 'tie', 'grenadine') });
  chk('echo: a tie in the colour of auburn hair is a tick', ids(E.checkOutfit(echoTie, auburn), 'echo').some(c => c.score === 1 && /hair/.test(c.text)));
  const greyOnly = base({ jacket: P('#3d4045', 'jacket', 'flannel'), shirt: P('#f7f6f2', 'shirt', 'poplin'), tie: P('#8e9196', 'tie', 'grenadine'), trousers: P('#8e9196', 'trousers', 'flannel') });
  const csE = E.checkOutfit(greyOnly, auburn);
  chk('echo: nothing repeated gets a hint that never changes the verdict', ids(csE, 'echo').some(c => c.score === 0.9) && E.verdict(csE).title === E.verdict(csE.filter(c => c.id !== 'echo')).title);
  chk('echo: black hair and dark brown eyes, nothing to echo, no check', !ids(E.checkOutfit(echoTie, high), 'echo').length || ids(E.checkOutfit(echoTie, high), 'echo').every(c => !/hair/.test(c.text)));
}

// ---- 1.16: a skin colour typed in, accents echoing the tie ----
{
  const chk = (name, ok, why) => { count++; if (!ok) { fails++; console.log('✗', name, why ? '\n   ' + why : ''); } else if (process.env.VERBOSE) console.log('✓', name); };
  const samples = { skin: '#ecc9bd', hair: '#3b322c', eyes: '#8a9aa6' };
  const typed = E.analyseProfile({ samples: Object.assign({ white: null }, samples), manual: { skin: true, hair: true, eyes: true }, useWhite: true, hairStyle: 'short', season: 'winter' });
  const measured = E.analyseProfile({ samples: Object.assign({ white: '#f2f2f2' }, samples), manual: {}, useWhite: true, hairStyle: 'short', season: 'winter' });
  const pale = base({ shirt: P('#ead8cc', 'shirt', 'poplin') });   // a shirt very close to this skin
  const fT = E.checkOutfit(pale, typed).find(c => c.id === 'face'), fM = E.checkOutfit(pale, measured).find(c => c.id === 'face');
  chk('skin typed in: a clash with it is a note, and says why', typed.skinMeasured === false && fT && fT.score === 0.6 && /entered by hand/.test(fT.text), fT && fT.text);
  chk('skin measured with white paper: the same clash fails', measured.skinMeasured === true && fM && fM.score === 0.3, fM && fM.text);
  // a flower close to the tie: no near match; the same colour exactly: a note
  const fl = (h) => base({ jacket: P('#1d2a44', 'blazer', 'hopsack'), tie: P('#c17eac', 'tie', 'grenadine'), boutonniere: P(h, 'flower') });
  const csN = E.checkOutfit(fl('#ce97d2'), aW);
  chk('a flower in a similar shade to the tie is not a near match', !csN.some(c => c.id === 'near' && c.slots.indexOf('boutonniere') >= 0) && !csN.some(c => c.id === 'accentmatch'));
  const csE = E.checkOutfit(fl('#c17eac'), aW);
  chk('a flower in the tie\'s exact colour is a note', csE.some(c => c.id === 'accentmatch' && c.score === 0.8));
  chk('near matches between cloths still fail (navy and midnight)', E.checkOutfit(base({ jacket: P(col('Navy'), 'jacket', 'hopsack'), trousers: P(col('Midnight') || col('Ink'), 'trousers', 'flannel') }), aW).some(c => c.id === 'near'));
}

// ---- 1.16.1: a tie and square cut from one cloth fail (Flusser pp. 216-217); outfit contrast is judged at the face ----
{
  const sq = (cloth) => base({ occasion: 'business', tie: P('#555045', 'tie', 'woolchallis'), square: P('#565243', 'square', cloth) });
  const one = E.checkOutfit(sq('woolchallis'), aW), other = E.checkOutfit(sq('silktwill'), aW);
  count++; if (!one.some(c => c.id === 'sqmatch' && c.score < 0.5)) { fails++; console.log('✗ a tie and square of one cloth, one colour, should fail'); }
  count++; if (other.some(c => c.id === 'sqmatch')) { fails++; console.log('✗ the same colour in another cloth is tone on tone, not an exact match'); }
  // a high-contrast face, a pale top: dark trousers far below no longer count as contrast at the face
  const hi = E.analyseProfile({ samples: { skin: '#e8c8b0', hair: '#1a1410', eyes: '#3a2a20' }, manual: { skin: true, hair: true, eyes: true }, named: {}, hairStyle: 'short', season: 'winter' });
  hi.confidence = 'medium'; hi.skinMeasured = true;
  const tonal = base({ shirt: P('#f1f1f1', 'shirt', 'poplin'), jacket: P('#9c9288', 'jacket', 'worsted'), trousers: P('#3d4045', 'trousers', 'worsted') });
  count++; if (hi.contrastLevel !== 'high') { fails++; console.log('✗ the test face should read as high contrast, read ' + hi.contrastLevel); }
  // noted once: by the light-dark step at the collar if it is short, otherwise by the outfit's contrast
  else if (!E.checkOutfit(tonal, hi).some(c => (c.id === 'ocontrast' || c.id === 'step') && c.score < 0.85)) { fails++; console.log('✗ a pale tonal top on a high-contrast face should be noted, whatever the trousers'); }
}

// ---- 1.16.1: the belt, braces and the waistcoat ----
{
  const vest = (acc) => base({ occasion: 'business', mid: P('#3d4045', 'waistcoat', 'worsted'), acc: acc });
  const fl = (o, id) => E.checkOutfit(o, aW).some(c => c.id === id && c.score < 0.5);
  const tst = (name, ok) => { count++; if (!ok) { fails_++; console.log('✗ ' + name); } };
  var fails_ = 0;
  tst('a belt with a waistcoat fails', fl(vest({ buckle: { on: true, metal: 'silver' }, braces: { on: false } }), 'beltvest'));
  tst('braces with a waistcoat pass', !fl(vest({ buckle: { on: false, metal: 'silver' }, braces: { on: true } }), 'beltvest'));
  tst('a belt and braces together fail', fl(base({ acc: { buckle: { on: true, metal: 'silver' }, braces: { on: true } } }), 'beltbraces'));
  tst('a belt without a waistcoat is fine', !fl(base({ acc: { buckle: { on: true, metal: 'silver' }, braces: { on: false } } }), 'beltvest'));
  fails += fails_;
}
// ---- 1.17: the shirt's collar (style, band, contrast colour) ----
{
  const sh = (extra, hex) => P(hex || '#c3d7ee', 'shirt', 'poplin', extra);
  const tie = P('#5e1f2c', 'tie', 'grenadine'), bow = P('#5e1f2c', 'bowtie', 'silktwill'), cravat = P('#5e1f2c', 'cravat', 'silktwill');
  const face = (cls, extra) => base({ shirt: sh(extra), propOn: true, body: { faceClass: cls } });
  const suit = (extra, over) => base(Object.assign({ occasion: 'smart', shirt: sh(extra), jacket: P('#3d4045', 'jacket', 'worsted'), trousers: P('#3d4045', 'trousers', 'worsted') }, over || {}));
  // the default is read exactly as before: no collar rule speaks for a semi-spread self collar
  T('a shirt with no collar recorded: no collar rule fires', base({ tie: tie }), [[/^collar(tie|open|formal|face):/, false]]);
  T('a semi-spread collar open under a jacket: nothing said', base(), [[/^collaropen:/, false]]);
  // against the face (Flusser pp. 124, 126)
  T('a broad face in a cutaway collar: noted', face('broad', { collar: 'cutaway' }), [[/^collarface: Your face is broad/, true]]);
  T('a broad face in a point collar: fine', face('broad', { collar: 'point' }), [[/^collarface:/, false]]);
  T('a long face in a point collar: noted', face('long', { collar: 'point' }), [[/^collarface: Your face is long/, true]]);
  T('a long face in a spread collar: fine', face('long', { collar: 'spread' }), [[/^collarface:/, false]]);
  T('a middle face: the collar is not judged against it', face('middle', { collar: 'cutaway' }), [[/^collarface:/, false]]);
  { const ck = E.checkOutfit(face('broad', {}), aW); count++; if (ck.some(c => c.id === 'collarface') || !ck.some(c => c.id === 'pcollar' && /broad/.test(c.text))) { fails++; console.log('✗ a shirt with no collar chosen gets the advice, not a judgement'); } }
  // open under a jacket (Flusser p. 273)
  T('a camp collar open under a jacket: noted', base({ shirt: sh({ collar: 'camp' }), occasion: 'casual' }), [[/^collaropen: A camp collar/, true]]);
  T('a camp collar with a cravat under a jacket: the cravat fills the neck', base({ shirt: sh({ collar: 'camp' }), tie: cravat, occasion: 'casual' }), [[/^collaropen:/, false], [/^collartie:/, false]]);
  T('a camp collar without a jacket: nothing about the jacket', base({ shirt: sh({ collar: 'camp' }), jacket: null, occasion: 'casual' }), [[/^collaropen:/, false]]);
  // a tie and the collar
  T('a tie with a camp collar fails', base({ shirt: sh({ collar: 'camp' }), tie: tie }), [[/^collartie: A tie with a camp collar/, true]]);
  T('a bow tie with a camp collar fails', base({ shirt: sh({ collar: 'camp' }), tie: bow }), [[/^collartie:/, true]]);
  T('a tab collar worn open fails', base({ shirt: sh({ collar: 'tab' }) }), [[/^collartie: A tab collar worn open/, true]]);
  T('a tab collar with a tie is fine', base({ shirt: sh({ collar: 'tab' }), tie: tie }), [[/^collartie:/, false]]);
  // formality (Gentleman's Gazette)
  T('a button-down with a suit: noted', suit({ collar: 'buttondown' }), [[/^collarformal: A button-down with a suit/, true]]);
  T('a button-down with a blazer and odd trousers: fine', base({ shirt: sh({ collar: 'buttondown' }), jacket: P('#1d2a44', 'blazer', 'hopsack') }), [[/^collarformal:/, false]]);
  T('a button-down at a business occasion: the occasion rule names the collar', suit({ collar: 'buttondown' }, { occasion: 'business', tie: tie }), [[/^occasion: .*button-down shirt/, true], [/^collarformal:/, false]]);
  T('a camp collar with a suit: too casual for it', suit({ collar: 'camp' }), [[/^formal: .*camp shirt/, true]]);
  T('a contrast collar on a casual day: noted', base({ shirt: sh({ collarHex: '#f7f6f2' }), occasion: 'casual' }), [[/^collarformal: A contrast collar/, true]]);
  T('a contrast collar with a tie at business: fine', suit({ collarHex: '#f7f6f2' }, { occasion: 'business', tie: tie }), [[/^collarformal:/, false]]);
  T('a collar colour equal to the body is no contrast collar', base({ shirt: sh({ collarHex: '#c3d7ee' }), occasion: 'casual' }), [[/^collarformal:/, false]]);
}
{
  // a contrast collar is what meets the jacket at the neck: a white collar on a mid-grey body under a
  // mid-grey jacket rescues a flat step, and the step's text names the collar
  const flat = base({ shirt: P('#8e9196', 'shirt', 'poplin'), jacket: P('#8a8d92', 'jacket', 'flannel') });
  const white = base({ shirt: P('#8e9196', 'shirt', 'poplin', { collarHex: '#f7f6f2' }), jacket: P('#8a8d92', 'jacket', 'flannel') });
  const st = o => E.checkOutfit(o, aW).find(c => c.id === 'step');
  count++; if (!(st(flat).score < 0.5 && st(white).score >= 0.85 && /\(#f7f6f2 collar\)/.test(st(white).text))) { fails++; console.log('✗ a white collar sets the step at the neck', st(flat), st(white)); }
  // the skin is checked against the collar as well as the body: a collar in a clashing colour is named
  const bad = base({ shirt: P('#f7f6f2', 'shirt', 'poplin', { collarHex: '#c8a24a' }) });
  const f = E.checkOutfit(bad, aW).find(c => c.id === 'face');
  count++; if (!(f && f.score < 0.85 && /collar/.test(f.text))) { fails++; console.log('✗ a clashing collar colour is named at the face', f); }
  count++; if (!E.skinClashes(bad, aW).some(x => x.piece === 'shirt collar')) { fails++; console.log('✗ skinClashes lists the collar'); }
  // the formality ceiling: a button-down poplin shirt is smart casual, a camp shirt relaxed
  count++; if (!(G.formality('shirt', { kind: 'shirt', cloth: 'poplin', collar: 'buttondown' }) === 3 && G.formality('shirt', { kind: 'shirt', cloth: 'poplin', collar: 'camp' }) === 2 && G.formality('shirt', { kind: 'shirt', cloth: 'poplin' }) === 5)) { fails++; console.log('✗ the collar formality ceiling'); }
  // what Valet cannot see is said as advice (collarhint), never counted, and only for a chosen collar
  const hints = o => E.checkOutfit(o, aW).filter(c => c.id === 'collarhint');
  const hb = (extra, over) => base(Object.assign({ shirt: P('#c3d7ee', 'shirt', 'poplin', extra), propOn: true }, over || {}));
  const tie2 = P('#5e1f2c', 'tie', 'grenadine');
  count++; if (!hints(hb({ collar: 'cutaway' })).some(c => /^Not judged: no source says how a cutaway/.test(c.text))) { fails++; console.log('✗ a cutaway worn open: the mirror test, said as not judged'); }
  count++; if (hints(hb({ collar: 'buttondown' })).some(c => /behaves worn open/.test(c.text))) { fails++; console.log('✗ a button-down worn open is judged, so no hint'); }
  count++; if (hints(hb({ collar: 'cutaway' }, { tie: tie2 })).some(c => /knot/.test(c.text))) { fails++; console.log('✗ the knot advice is in How it works, not on every outfit (1.18)'); }
  count++; if (!hints(hb({ collar: 'point' })).some(c => /face width and length/.test(c.text))) { fails++; console.log('✗ no face measurements: said so'); }
  count++; if (!hints(hb({ collar: 'point' }, { body: { faceClass: 'middle' } })).some(c => /neither clearly broad/.test(c.text))) { fails++; console.log('✗ a middle face: no collar has to counterbalance it'); }
  count++; if (!hints(hb({ collarHex: '#f7f6f2', collar: 'spread' }, { jacket: null })).some(c => /no source covers a contrast collar worn without a tie.*jacket kept on/.test(c.text))) { fails++; console.log('✗ a contrast collar open, no jacket'); }
  count++; if (!hints(hb({ collarHex: '#f7f6f2', collar: 'spread' }, { tie: tie2, occasion: 'business' })).some(c => /Permanent Style: a tie dark or colourful/.test(c.text))) { fails++; console.log('✗ a contrast collar with a tie: the tie advice'); }
  count++; if (hints(hb({}, { tie: tie2 })).length) { fails++; console.log('✗ no collar chosen: no hints'); }
  { const a = E.checkOutfit(hb({ collar: 'cutaway' }, { tie: tie2 }), aW), b = a.filter(c => c.id !== 'collarhint'); count++; if (E.verdict(a).title !== E.verdict(b).title) { fails++; console.log('✗ hints never change the verdict'); } }
  // a polo records no collar: the fields are ignored
  count++; if (G.contrastCollar('shirt', { kind: 'polo', hex: '#1d2a44', collarHex: '#f7f6f2' }) !== null) { fails++; console.log('✗ a polo has no contrast collar'); }
}
// ---- 1.18: a tall frame with short legs gets one message about a contrasting jacket, not a tick and a note ----
{
  const legs = (legRatio, height) => base({ jacket: P('#1d2a44', 'jacket', 'hopsack'), trousers: P('#8e9196', 'trousers', 'flannel'), propOn: true, body: { legRatio }, m: { height } });
  const ids = o => E.checkOutfit(o, aW).filter(c => /^p(line|halves)$/.test(c.id));
  const both = ids(legs(10, 190));
  count++; if (both.some(c => c.id === 'phalves' && c.score >= 0.85) || !both.some(c => c.id === 'pline' && /Your height takes a contrast/.test(c.text))) { fails++; console.log('✗ tall and short-legged: one message', both); }
  const tallLong = ids(legs(60, 190));
  count++; if (!tallLong.some(c => c.id === 'phalves' && /tall frame/.test(c.text)) || tallLong.some(c => /Your height takes/.test(c.text))) { fails++; console.log('✗ tall with ordinary legs: the tick stays', tallLong); }
  const shortLegsOnly = ids(legs(10, 172));
  count++; if (shortLegsOnly.some(c => /Your height takes/.test(c.text))) { fails++; console.log('✗ not tall: no height clause', shortLegsOnly); }
}
console.log((fails ? fails + ' scenario(s) failed' : 'all scenarios pass') + ' (' + count + ' run)');
if (fails) process.exit(1);
