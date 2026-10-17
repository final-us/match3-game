'use strict';
const assert=require('assert');
const sim=require('./helpers/solo-simulation');
const levels=require('../js/core/level');
const createClock=require('./helpers/virtual-animation-clock');
(async()=>{
 const wall=[];const clock=createClock(ms=>wall.push(ms));
 const parallel=Promise.all([clock.wait(359),(async()=>{await clock.wait(359);await clock.wait(100);await clock.wait(150);})()]).then(()=>clock.wait(200));
 await clock.drain(parallel);
 assert.strictEqual(clock.now,809,'并行impact与分时染色取墙钟时间，不能累计等待');
 assert.deepStrictEqual(wall,[359,100,150,200]);
 assert.deepStrictEqual(clock.tape.map(w=>w.start),[0,0,359,459,609]);
 const options={level:levels.getLevel(21),seed:0x7a13f621,strategy:'goal',thinkMs:6000,trace:true};
 const first=await sim.play(options);
 const original=Math.random;let second;
 try{Math.random=()=>{throw new Error('Simulator must not consume global/cosmetic RNG');};second=await sim.play(options);}
 finally{Math.random=original;}
 assert.deepStrictEqual(second,first,'同种子/策略/计时必须完全复现');
 let observed=0;
 const injected=await sim.play({...options,finalState:true,
  selectMove:(core,grid,rng)=>sim.select(core,grid,'goal',rng),onMatch:(data,core)=>{assert(data.removed);assert(core.grid);observed++;}});
 assert(observed>0);
 assert.deepStrictEqual(injected.steps,first.steps,'observer与注入同策略不能改变规则/随机流');
 assert.deepStrictEqual(injected.finalState,first.steps.at(-1).state);
 const other=await sim.play({...options,strategy:'random'});
 assert.deepStrictEqual(other.initial,first.initial,'策略不能改变初始棋盘或掉落流起点');
 assert.strictEqual(first.steps[0].state.time,options.level.timeLimitSec*1000,'首个有效交换结束前不计时');
 const expired=await sim.play({...options,thinkMs:200000});
 assert.strictEqual(expired.reason,'timeout');
 assert.strictEqual(expired.actions,1,'思考期超时必须阻止下一次交换');
 assert.strictEqual(expired.steps.at(-1).move,null);
 assert(first.steps.some(s=>s.waits.some(w=>w.duration===200)&&s.waits.some(w=>w.duration===300)),'模拟必须计入消除与补棋动画');
 assert(first.steps.at(-1).state.result,'必须有真实核心结算回调');
 const seeds=new Set();
 for(const base of [0x17a2c943,0x8db731e5,0xc406fa29])for(let i=0;i<200;i++)seeds.add((base+Math.imul(i,0x9e3779b1))>>>0);
 assert.strictEqual(seeds.size,600,'三个批次不能重复使用初始种子');
 const env=sim.environment(0x1ce),fixture=(extra={})=>{
  const core=new env.Core({rows:6,columns:6,colorCount:5,moveCount:5,
   goals:[{type:'collect',pieceType:1,target:6},{type:'collect',pieceType:2,target:6}],...extra});
  core.grid=Array.from({length:6},(_,r)=>Array.from({length:6},(_,c)=>(r*2+c)%5+1));
  core.grid[1][0]=1;core.grid[1][1]=1;core.grid[1][2]=2;core.grid[1][3]=4;core.grid[0][2]=1;
  core.grid[4][3]=2;core.grid[4][4]=2;core.grid[4][5]=3;core.grid[3][5]=2;
  for(const parcel of core.parcels)core.grid[parcel.row][parcel.column]=201;
  return core;
 };
 const red=[{row:0,column:2},{row:1,column:2}],blue=[{row:3,column:5},{row:4,column:5}];
 const colors=fixture();
 const bonus=move=>sim.priority(colors,move,env.grid,'goal')-sim.priority(colors,move,env.grid,'greedy');
 assert.strictEqual(bonus(red),60);assert.strictEqual(bonus(blue),60,'second collect goal must be observed');
 colors.collectedCounts[1]=5;assert.strictEqual(bonus(red),20,'only remaining requested cats carry value');
 colors.collectedCounts[1]=6;assert.strictEqual(bonus(red),0);assert.strictEqual(bonus(blue),60);
 const selected=sim.select(colors,env.grid,'goal',()=>0);
 assert.strictEqual(sim.priority(colors,selected,env.grid,'goal'),
  Math.max(...sim.moves(colors).map(move=>sim.priority(colors,move,env.grid,'goal'))));
 assert(sim.priority(colors,selected,env.grid,'goal')>sim.priority(colors,selected,env.grid,'greedy'),
  'selection rewards the still-unmet second color after the first color completes');
 assert(sim.priority(colors,blue,env.grid,'goal')>sim.priority(colors,red,env.grid,'goal'));
 const ice=fixture({obstacles:{'2:1':1},goals:[{type:'ice',target:1}]});
 const before=sim.snapshot(ice,env.draws());
 assert.strictEqual(sim.priority(ice,red,env.grid,'goal')-sim.priority(ice,red,env.grid,'greedy'),25,
  'actual adjacent removals reward one unique ice cell');
 assert.deepStrictEqual(sim.snapshot(ice,env.draws()),before,'policy inspection must not mutate Core');
 let iceHit=false;ice.callbacks.onMatch=data=>{iceHit ||= data.iceHits.some(p=>p.row===2&&p.column===1);};
 await ice.trySwap(...red);assert(iceHit&&ice.won&&ice.getIceLeft()===0,'real Core confirms adjacency and ice goal');
 const blocked=fixture({underlays:{'1:0':1,'1:1':1,'1:2':1},obstacles:{'2:1':1},
  goals:[{type:'collect',pieceType:1,target:6}]});
 assert.strictEqual(sim.priority(blocked,red,env.grid,'goal')-sim.priority(blocked,red,env.grid,'greedy'),75,
  'covered cats are retained: no collection or adjacent ice reward');
 const bud=fixture({moonbuds:['1:0'],goals:[{type:'moonbud',target:1}]});
 assert.strictEqual(sim.priority(bud,red,env.grid,'goal')-sim.priority(bud,red,env.grid,'greedy'),50);
 bud.moonbudOpen=false;
 assert.strictEqual(sim.priority(bud,red,env.grid,'goal')-sim.priority(bud,red,env.grid,'greedy'),0,
  'closed flower phase has no immediate collection value');
 for(const row of [0,3]){
  const parcel=fixture({parcels:[{id:'p1',row,column:1}],parcelExits:[1],goals:[{type:'parcel',target:1}]});
  assert.strictEqual(sim.priority(parcel,red,env.grid,'goal')-sim.priority(parcel,red,env.grid,'greedy'),row===0?30:0,
   'parcel value requires removal below its current row in the exit column');
 }
 const pawRun=await sim.play({level:{id:0,rows:6,columns:6,colorCount:5,moveCount:1,
  goals:[{type:'score',target:999999}],initialSpecials:[{row:0,column:0,type:105}]},seed:0x1ce,
  thinkMs:3000,trace:true,selectMove:()=>[{row:0,column:0},{row:0,column:1}]});
 assert(pawRun.steps[0].waits.some(wait=>wait.duration===359),'real paw arrival wait is included');
 console.log('simulation contract: independent RNG, deterministic trace, animation timing, first-move clock, timeout-before-input, unique batches PASS');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
