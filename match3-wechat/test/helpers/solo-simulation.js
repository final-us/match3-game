'use strict';
// Test-only deterministic adapter: production Core/Grid sources, independent board/policy RNGs.
const fs = require('fs');
const path = require('path');
const config = require('../../js/core/config');
const factory = name => new Function('require','module','exports','Math',fs.readFileSync(path.join(__dirname,'../../js/core',name+'.js'),'utf8'));
const gridFactory=factory('grid'), coreFactory=factory('game-core');
function random(seed) {
    let state=seed>>>0;
    return () => {state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
function environment(seed) {
    const rng=random(seed); let draws=0;
    const math=Object.create(Math); math.random=()=>{draws++;return rng();};
    const grid={exports:{}}; gridFactory(require,grid,grid.exports,math);
    const core={exports:{}};coreFactory(name=>name==='./grid'?grid.exports:config,core,core.exports,Math);
    return {Core:core.exports,grid:grid.exports,draws:()=>draws};
}
function moves(core) {
    const out=[];
    for(let r=0;r<core.grid.length;r++)for(let c=0;c<core.grid[0].length;c++){
        const a={row:r,column:c};
        for(const b of [{row:r,column:c+1},{row:r+1,column:c}])
            if(b.row<core.grid.length&&b.column<core.grid[0].length&&!core.isBlocked(a)&&!core.isBlocked(b)&&core.validateMove(a,b))out.push([a,b]);
    }
    return out;
}
function priority(core,move,grid,strategy) {
    const [a,b]=move,ta=core.grid[a.row][a.column],tb=core.grid[b.row][b.column];
    if(config.isSpecialType(ta)&&config.isSpecialType(tb))return 1000;
    if(ta===104||tb===104)return 500;
    if(config.isSpecialType(ta)||config.isSpecialType(tb))return 80;
    const copy=grid.cloneGrid(core.grid);grid.swapTypeInGrid(copy,a,b);
    return grid.getMatches(copy).reduce((sum,group)=>sum+group.length*group.length+
        (strategy==='goal'&&core.getYarnHealth()>0&&group.some(p=>
            Math.abs(p.row-core.yarnSource.row)+Math.abs(p.column-core.yarnSource.column)<=1)?25:0)+
        (strategy==='goal'?group.reduce((n,p)=>n+(core.jellyGrid[p.row][p.column]?25:0)+
            (core.level.goals.some(g=>g.type==='collect'&&g.pieceType===copy[p.row][p.column]&&(core.collectedCounts[g.pieceType]||0)<g.target)?20:0),0):0),0);
}
function select(core,grid,strategy,rng) {
    const choices=moves(core);if(!choices.length)throw new Error('No legal moves on settled board');
    if(strategy==='random')return choices[Math.floor(rng()*choices.length)];
    let best=-Infinity,candidates=[];
    for(const move of choices){const score=priority(core,move,grid,strategy);if(score>best){best=score;candidates=[move];}else if(score===best)candidates.push(move);}
    return candidates[Math.floor(rng()*candidates.length)];
}
function snapshot(core,draws,result) {
    return JSON.parse(JSON.stringify({grid:core.grid,jelly:core.jellyGrid,ice:core.iceGrid,yarn:core.yarnSource,vines:core.yarnVines,yarnTurns:core.yarnTurns,bases:core.specialBases,
        score:core.score,moves:core.movesLeft,time:core.timeLeftMs,started:core.timerStarted,ended:core.ended,won:core.won,
        collected:core.collectedCounts,cascade:core.maxCascade,combos:core.specialComboCount,draws,result:result||null}));
}
async function play({level,seed,strategy='goal',thinkMs=6000,trace=false,reduceEffects=false,animationTime=true}) {
    const env=environment(seed),policy=random((seed^0x9e3779b9)>>>0);let core,result=null,waits=[],elapsed=0,animationMs=0;
    function advance(ms){for(let left=ms;left>0;){const dt=Math.min(16,left);core.updateTime(dt);left-=dt;}elapsed+=ms;}
    const wait=async ms=>{waits.push(ms);animationMs+=ms;if(animationTime)advance(ms);};
    // Normal-device waits are checked against real BoardRenderer.wait by verify-simulation-replay.cjs.
    core=new env.Core(level,{onSwap:()=>wait(220),onMatch:()=>wait(200),onGravity:()=>wait(260),onFill:()=>wait(300),
        onYarnSpread:()=>wait(reduceEffects?0:130),
        onReshuffle:()=>wait(reduceEffects?100:220),onInvalidSwap:()=>wait(reduceEffects?180:240),onLevelEnd:r=>{result=r;}});
    const initial=trace?snapshot(core,env.draws(),result):null,steps=[];
    let actions=0;
    while(!core.ended){
        if(actions>=100)throw new Error('Run exceeded bounded move budget');
        advance(thinkMs);waits=[];
        let move=null;
        if(!core.ended){move=select(core,env.grid,strategy,policy);if(!await core.trySwap(...move))throw new Error('Selected move rejected');actions++;}
        if(trace)steps.push({thinkMs,move,waits:waits.slice(),state:snapshot(core,env.draws(),result)});
    }
    if(!result)throw new Error('Missing settlement');
    return {win:core.won,reason:result.reason,score:core.score,actions,timeLeftMs:core.timeLeftMs,elapsed,animationMs,
        ...(trace?{levelId:level.id,seed,strategy,reduceEffects,initial,steps}:{} )};
}
module.exports={random,environment,moves,select,snapshot,play};
