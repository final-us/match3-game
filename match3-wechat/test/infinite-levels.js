const assert = require('assert');
const data = require('../js/core/level');
const { getMoveBudget } = require('../js/core/level-budgets');
const { syncContentRevision } = require('../js/core/strategy-feedback');
const base = [76,72,68,60,78,64,70,58,50,42];
const peak = [48,44,38,30,58,36,42,28,26,22];
const keys = o => Object.keys(o || {});
function mask(l) { return (keys(l.underlays).length ? 1 : 0) | (keys(l.obstacles).length ? 2 : 0) | (l.yarn ? 4 : 0) | ((l.moonbuds || []).length ? 8 : 0) | ((l.parcels || []).length ? 16 : 0); }
function bits(m) { return m.toString(2).replace(/0/g,'').length; }
function signature(l) { return JSON.stringify([l.recipeKind,keys(l.underlays).length,Object.values(l.underlays),keys(l.obstacles).length,l.yarn && l.yarn.health,(l.moonbuds || []).length,(l.parcels || []).map(p=>p.row),l.layoutFamily, mask(l) ? null : l.goals.map(g => [g.type,g.target])]); }
// Compare actual geometry under mirrors/rotations, so family labels cannot fake variety.
function geometry(level) {
    const cells = [];
    for (const [key, layers] of Object.entries(level.underlays)) cells.push([...key.split(':').map(Number), 'J' + layers]);
    for (const key of keys(level.obstacles)) cells.push([...key.split(':').map(Number), 'I']);
    for (const key of level.moonbuds || []) cells.push([...key.split(':').map(Number), 'B']);
    if (level.yarn) cells.push([...level.yarn.source.split(':').map(Number), 'Y']);
    for (const p of level.parcels || []) cells.push([p.row, p.column, 'P']);
    if (!cells.length) return null;
    const versions = [];
    for (let variant = 0; variant < (level.parcels ? 2 : 8); variant++) {
        const positions = cells.map(([r, c, type]) => {
            if (variant >= 4 || level.parcels && variant === 1) c = 7 - c;
            if (!level.parcels) for (let i = 0; i < variant % 4; i++) [r, c] = [c, 7 - r];
            return r + ':' + c + ':' + type;
        });
        versions.push(positions.sort().join(','));
    }
    return versions.sort()[0];
}
function check(id) {
    const l = data.getLevel(id);
    assert.deepStrictEqual(l,data.getLevel(id));
    assert.strictEqual(l.colorCount, id <= 4 ? 4 : 5);
    assert.strictEqual(l.trackingPaw,id>=3); assert.strictEqual(l.colorBell,id>=4);
    assert.strictEqual(l.targetWinRate,data.getTargetWinRate(id));
    assert(l.contentRevision.includes('v8')); assert(l.goals.length<=3);
    assert(l.moveCount >= (id <= 10 ? 18 : 6) && l.moveCount <= (id <= 10 ? 24 : 30));
    if (id >= 11) {
        assert.strictEqual(l.moveCount, getMoveBudget(id));
        const deliveryRevision = id >= 91 && l.recipeKind === 'PJ' && l.layoutFamily === '边缘开口' ? '-edge-delivery-v1' : '';
        assert.strictEqual(l.contentRevision, 'infinite-v8-century-moves-v1' + deliveryRevision + '-specials-v3' + ((l.moonbuds || []).length || l.yarn ? '-obstacles-v2' : ''));
    } else assert.strictEqual(l.contentRevision, 'curated-v8-century-specials-v3' + ((l.moonbuds || []).length || l.yarn ? '-obstacles-v2' : ''));
    assert.strictEqual(l.timeLimitSec,id<=4?0:id<=10?180:l.timeLimitSec);
    if(id>=11) {
        const slot=(id-11)%10,c=Math.floor((id-11)/10);
        assert.strictEqual(l.targetWinRate,Math.round(base[slot]+(peak[slot]-base[slot])*Math.min(1,c/8)));
        assert([165,180].includes(l.timeLimitSec));
        assert(bits(mask(l)) <= (id>=30 && slot===9?3:2));
        if(slot===4)assert.strictEqual(mask(l),0);
        else assert(mask(l));
    }
    const locked=keys(l.underlays).concat(keys(l.obstacles),l.yarn?[l.yarn.source]:[],l.moonbuds||[]);
    const occupied=locked.concat((l.parcels||[]).map(p=>p.row+':'+p.column));
    assert.strictEqual(new Set(occupied).size,occupied.length,'overlap '+id);
    assert(occupied.every(k=>/^[0-7]:[0-7]$/.test(k)));
    assert(locked.length <= (id<=40?10:id<=60?12:14));
    for(let row=0;row<8;row++) assert(locked.filter(k=>k.startsWith(row+':')).length<=5);
    assert(keys(l.underlays).length<=12); assert(keys(l.obstacles).length<=6);
    assert((l.moonbuds||[]).length<=8); assert((l.parcels||[]).length<=3);
    const doubles=Object.values(l.underlays).filter(v=>v===2).length;
    assert(doubles<=2);
    if(doubles) assert(['JC','JI'].includes(l.recipeKind));
    if(l.yarn) {assert(!l.moonbuds&&!l.parcels);assert.deepStrictEqual([l.yarn.health,l.yarn.spreadEvery,l.yarn.maxVines],[3,2,3]);}
    for(const [type,count] of [['jelly',Object.values(l.underlays).reduce((a,b)=>a+b,0)],['ice',keys(l.obstacles).length],['yarn',l.yarn?3:0],['moonbud',(l.moonbuds||[]).length],['parcel',(l.parcels||[]).length]]) {
        const g=l.goals.find(g=>g.type===type); if(count)assert(g&&g.target===count,id+' '+type);else assert(!g);
    }
    for(const g of l.goals)if(g.type==='collect')assert(g.pieceType>=1&&g.pieceType<=l.colorCount);
    if(id>=11 && bits(mask(l))===1) {
        const minimum=[6,3,1,3,2][Math.log2(mask(l))];
        const actual=mask(l)===1?keys(l.underlays).length:mask(l)===2?keys(l.obstacles).length:mask(l)===4?1:mask(l)===8?l.moonbuds.length:l.parcels.length;
        assert(actual>=minimum); assert(l.goals.some(g=>g.type==='collect'&&g.target>=18&&g.target<=26));
    }
    if(l.parcels) {
        assert.strictEqual(new Set(l.parcelExits).size,l.parcels.length);
        for(const p of l.parcels) {assert(l.parcelExits.includes(p.column));assert(p.row<7);}
        assert((l.moonbuds||[]).every(k=>!l.parcelExits.includes(Number(k.split(':')[1]))));
        if (keys(l.underlays).length || keys(l.obstacles).length || l.yarn) for (const p of l.parcels) {
            assert(locked.some(k => { const [r,c] = k.split(':').map(Number); return c === p.column && r > p.row; }), 'delivery must involve clearing its route ' + id);
        }
    }
    return l;
}
function cadence(start,count) {
    const history=[];
    for(let id=start;id<start+count;id++) {
        const l=check(id),m=mask(l);
        if(history.length) assert(l.recipeKind!==history.at(-1).recipeKind,'adjacent '+id);
        if(history.length>=2)assert(!(m&mask(history.at(-1))&mask(history.at(-2))),'three '+id);
        assert(!history.slice(-30).some(old=>signature(old)===signature(l)),'recent '+id);
        const shape = geometry(l);
        if (shape) assert(!history.slice(-30).some(old => old.recipeKind === l.recipeKind && geometry(old) === shape), 'mirror-only variety ' + id);
        history.push(l);
        for(const [n,min] of [[10,4],[20,5]])if(history.length>=n)assert(bits(history.slice(-n).reduce((v,x)=>v|mask(x),0))>=min,'coverage '+id);
    }
}
for(let id=1;id<=10;id++)check(id);
cadence(11,1000); cadence(1000001,520); cadence(Number.MAX_SAFE_INTEGER-600,601);
// A fresh module and reversed lookups expose visitation-dependent generation.
const ids=[11,20,30,91,100,101,250,251,100000000001,Number.MAX_SAFE_INTEGER];
const expected=ids.map(id=>data.getLevel(id));
delete require.cache[require.resolve('../js/core/level')];
const fresh=require('../js/core/level');
for(let i=ids.length-1;i>=0;i--)assert.deepStrictEqual(fresh.getLevel(ids[i]),expected[i]);
expected[0].goals[0].target=999; assert.notDeepStrictEqual(data.getLevel(11),expected[0],'caller mutations must not poison future lookups');
for(const invalid of [0,-1,1.2,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'wat'])assert.strictEqual(data.getLevel(invalid),null);
assert.strictEqual(data.getLevel('2').id,2);
const before=performance.now();for(let i=0;i<1000;i++)data.getLevel(Number.MAX_SAFE_INTEGER-i);
assert(performance.now()-before<2000,'remote lookup must stay bounded');

// Fixed diagnostic boundary samples catch offsets between the early and peak books.
for (const [id, expected] of [[11,11],[12,10],[90,21],[91,12],[250,28],[251,13],[330,24],[331,12]]) {
    assert.strictEqual(getMoveBudget(id), expected, 'budget index ' + id);
}
for (let id = 91; id <= 330; id++) {
    assert.strictEqual(getMoveBudget(id + 240), getMoveBudget(id), 'peak budget plateau ' + id);
}
for (const id of [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 239]) {
    assert.strictEqual(getMoveBudget(id), getMoveBudget(251 + (id - 11) % 240));
}
for (const invalid of [1,10,0,11.5,Infinity,Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => getMoveBudget(invalid), RangeError);
assert.deepStrictEqual(Array.from({ length: 10 }, (_, i) => data.getLevel(i + 1).moveCount), [18,20,22,22,22,24,24,24,24,24]);
const progress = {
    unlockedLevel: 121, stars: { 1: 3, 11: 2, 91: 3 }, coins: 999, stamina: 4,
    failures: { 1: 2, 11: 4, 91: 3 },
    contentRevisions: { 1: data.getLevel(1).contentRevision, 11: 'infinite-v8-century-specials-v3', 91: 'infinite-v8-century-specials-v3' }
};
const preserved = JSON.parse(JSON.stringify(progress));
assert.strictEqual(syncContentRevision(progress, data.getLevel(1)), false);
assert.strictEqual(syncContentRevision(progress, data.getLevel(11)), true);
assert.strictEqual(progress.failures[11], undefined);
assert.strictEqual(progress.failures[91], 3, 'other levels migrate when entered');
progress.failures[11] = 1;
assert.strictEqual(syncContentRevision(progress, data.getLevel(11)), false);
assert.strictEqual(progress.failures[11], 1, 'current budget revision retains its own assistance');
for (const field of ['unlockedLevel','stars','coins','stamina']) assert.deepStrictEqual(progress[field], preserved[field]);
assert.strictEqual(progress.failures[1], 2);

// Only revised edge-delivery levels retire stale assistance; all player assets survive.
const edgeProgress = {
    unlockedLevel: 240, stars: { 104: 2, 194: 3 }, coins: 777, stamina: 3,
    failures: { 19: 1, 62: 2, 104: 3, 149: 4, 193: 2, 194: 5, 195: 1 },
    contentRevisions: Object.fromEntries([19,62,104,149,193,194,195].map(id => [id, 'infinite-v8-century-moves-v1-specials-v3']))
};
const edgeBefore = JSON.parse(JSON.stringify(edgeProgress));
for (const id of [19,62,193,195]) assert.strictEqual(syncContentRevision(edgeProgress, data.getLevel(id)), false);
assert.strictEqual(syncContentRevision(edgeProgress, data.getLevel(194)), true);
assert.deepStrictEqual(edgeProgress.failures, { 19: 1, 62: 2, 104: 3, 149: 4, 193: 2, 195: 1 });
edgeProgress.failures[194] = 1;
assert.strictEqual(syncContentRevision(edgeProgress, data.getLevel(194)), false);
assert.strictEqual(edgeProgress.failures[194], 1);
for (const field of ['unlockedLevel','stars','coins','stamina']) assert.deepStrictEqual(edgeProgress[field], edgeBefore[field]);
for (const [id, count] of [[19,1],[62,2],[104,1],[149,1],[194,1],[259,1],[302,1],[434,1]]) {
    const level = data.getLevel(id);
    assert.strictEqual(level.parcels.length, count, 'edge delivery count ' + id);
    if (id >= 91) {
        assert.strictEqual(level.parcels[0].row, 0);
        assert([0,7].includes(level.parcels[0].column));
    }
}

console.log('infinite-levels: intro, 2121 near/far configs, rolling diversity, cyclic seam, order independence and bounded lookup PASS');
