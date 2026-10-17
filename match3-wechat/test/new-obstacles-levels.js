const assert = require('assert');
const data = require('../js/core/level');
const Core = require('../js/core/game-core');
const grid = require('../js/core/grid');
const config = require('../js/core/config');
function random(seed) { let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;}; }
const originalRandom=Math.random;
async function check() {
    let starts=0,swaps=0;
    const ids=Array.from({length:250},(_,i)=>i+1).concat(Array.from({length:240},(_,i)=>100001+i),[Number.MAX_SAFE_INTEGER]);
    for(const id of ids)for(let seed=1;seed<=8;seed++) {
        Math.random=random(seed);
        const level=data.getLevel(id),core=new Core(level,{});
        assert.strictEqual(grid.getMatches(core.grid).length,0,id+'/'+seed+' initial match');
        assert(core.hasValidMoves(),id+'/'+seed+' no move');
        assert(!core.ended);
        assert.strictEqual(core.getMoonbudsLeft(),(level.moonbuds||[]).length);
        assert.strictEqual(core.getParcelsLeft(),(level.parcels||[]).length);
        assert.strictEqual(core.getIceLeft(),Object.keys(level.obstacles).length);
        assert.strictEqual(core.jellyTotal,Object.values(level.underlays).reduce((a,b)=>a+b,0));
        for(const p of core.parcels)assert.strictEqual(core.grid[p.row][p.column],config.OBJECT_TYPES.PARCEL);
        starts++;
        // Actual Core calls, retaining the naturally generated board; invalid probes consume no turns.
        if(seed===1) {
            let moved=false;
            for(let r=0;r<8&&!moved;r++)for(let c=0;c<8&&!moved;c++)for(const [dr,dc] of [[0,1],[1,0]]) {
                if(r+dr>=8||c+dc>=8)continue;
                const before=core.movesLeft;
                await core.trySwap({row:r,column:c},{row:r+dr,column:c+dc});
                if(core.movesLeft<before){moved=true;swaps++;break;}
            }
            assert(moved,id+' advertised legal move must execute');
        }
    }
    console.log('new-obstacles-levels: '+starts+' seeded natural Core starts / '+swaps+' actual legal swaps PASS');
}
check().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{Math.random=originalRandom;});
