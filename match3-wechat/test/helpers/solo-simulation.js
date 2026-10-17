'use strict';
// Test-only deterministic adapter: production Core/Grid sources, independent board/policy RNGs.
const fs = require('fs');
const path = require('path');
const config = require('../../js/core/config');
const createClock = require('./virtual-animation-clock');
const boardPath = path.join(__dirname, '../../js/render/board-render.js');
const boardModule = {exports:{}};
// Cosmetic timers/particles do not drive Core or animation waits.
new Function('require','module','exports','setTimeout',fs.readFileSync(boardPath,'utf8'))(
    require('module').createRequire(boardPath),boardModule,boardModule.exports,()=>{});
const BoardRenderer = boardModule.exports;
const factory = name => new Function('require','module','exports','Math',fs.readFileSync(path.join(__dirname,'../../js/core',name+'.js'),'utf8'));
const gridFactory=factory('grid'), coreFactory=factory('game-core');
function random(seed) {
    let state=seed>>>0;
    return () => {state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
function environment(seed) {
    const rng=random(seed); let draws=0;
    const math=Object.create(Math); math.random=()=>{draws++;return rng();};
    const grid={exports:{}}; gridFactory(require('module').createRequire(path.join(__dirname,'../../js/core/grid.js')),grid,grid.exports,math);
    const core={exports:{}};coreFactory(name=>name==='./grid'?grid.exports:require(path.join(__dirname,'../../js/core',name)),core,core.exports,Math);
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
    const matches=grid.getMatches(copy),base=matches.reduce((sum,group)=>sum+group.length*group.length,0);
    if(strategy!=='goal')return base;
    const view=Object.create(core);view.grid=copy;
    // Reuse Core's reservation rules: a newly generated special is not collected.
    const hits=view.collectWithSpecials(matches,[b,a]).removed;
    const removed=hits.filter(p=>!view.isParcel(p)&&!core.isYarnRoot(p)&&!core.isYarnVine(p)&&
        !core.jellyGrid[p.row][p.column]&&!core.iceGrid[p.row][p.column]);
    const ice=new Set(),colors={};let bonus=0;
    for(const p of hits){
        if(core.isYarnRoot(p)||core.isYarnVine(p)||view.isParcel(p))continue;
        if(core.jellyGrid[p.row][p.column])bonus+=25;
        else if(core.iceGrid[p.row][p.column])ice.add(p.row+':'+p.column);
    }
    for(const p of removed){
        for(const n of [{row:p.row-1,column:p.column},{row:p.row+1,column:p.column},
            {row:p.row,column:p.column-1},{row:p.row,column:p.column+1}]){
            if(core.iceGrid[n.row]&&core.iceGrid[n.row][n.column])ice.add(n.row+':'+n.column);
        }
        if(core.moonbudOpen&&core.moonbudCells[p.row+':'+p.column])bonus+=50;
        if(core.parcels.some(parcel=>parcel.column===p.column&&p.row>parcel.row))bonus+=30;
        const type=copy[p.row][p.column];colors[type]=(colors[type]||0)+1;
    }
    if(core.getYarnHealth()>0&&hits.some(p=>
        Math.abs(p.row-core.yarnSource.row)+Math.abs(p.column-core.yarnSource.column)<=1))bonus+=25;
    for(const goal of core.level.goals){
        if(goal.type==='collect')bonus+=20*Math.min(colors[goal.pieceType]||0,
            Math.max(0,goal.target-(core.collectedCounts[goal.pieceType]||0)));
    }
    return base+bonus+ice.size*25;
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
        collected:core.collectedCounts,cascade:core.maxCascade,combos:core.specialComboCount,
        moonbuds:core.moonbudCells,moonbudOpen:core.moonbudOpen,parcels:core.parcels,parcelDelivered:core.parcelDelivered,
        draws,result:result||null}));
}
async function play({level,seed,strategy='goal',thinkMs=6000,trace=false,reduceEffects=false,animationTime=true,selectMove,onMatch,finalState=false}) {
    const env=environment(seed),policy=random((seed^0x9e3779b9)>>>0);let core,result=null,elapsed=0,animationMs=0;
    function advance(ms){for(let left=ms;left>0;){const dt=Math.min(16,left);core.updateTime(dt);left-=dt;}elapsed+=ms;}
    const clock=createClock(ms=>{animationMs+=ms;if(animationTime)advance(ms);});
    const board=new BoardRenderer({}, {width:375,height:812,reduceEffects});
    board.wait=clock.wait;
    board.spawnBurst=()=>{};
    core=new env.Core(level,{onSwap:(a,b)=>board.animateSwap(a,b),
        onMatch:data=>{if(onMatch)onMatch(data,core);return board.animateMatch(data);},
        onGravity:data=>board.animateGravity(data),onFill:data=>board.animateFill(data),
        onMoonbudPhase:data=>board.animateMoonbudPhase(data),onParcelDelivered:data=>board.animateParcelDelivered(data),
        onYarnSpread:pos=>board.animateYarnSpread(pos),onReshuffle:()=>board.animateReshuffle(),
        onInvalidSwap:(a,b)=>board.animateInvalidSwap(a,b),onLevelEnd:r=>{result=r;}});
    board.setGame(core);
    const initial=trace?snapshot(core,env.draws(),result):null,steps=[];
    let actions=0;
    while(!core.ended){
        if(actions>=100)throw new Error('Run exceeded bounded move budget');
        advance(thinkMs);clock.reset();
        let move=null;
        if(!core.ended){move=selectMove?selectMove(core,env.grid,policy):select(core,env.grid,strategy,policy);const pending=core.trySwap(...move);await clock.drain(pending);if(!await pending)throw new Error('Selected move rejected');actions++;}
        if(trace)steps.push({thinkMs,move,waits:clock.tape.slice(),animationMs:clock.now,state:snapshot(core,env.draws(),result)});
    }
    if(!result)throw new Error('Missing settlement');
    return {win:core.won,reason:result.reason,score:core.score,actions,timeLeftMs:core.timeLeftMs,elapsed,animationMs,
        ...(finalState?{finalState:snapshot(core,env.draws(),result)}:{}),
        ...(trace?{levelId:level.id,seed,strategy,reduceEffects,initial,steps}:{} )};
}
module.exports={random,environment,moves,priority,select,snapshot,play};
