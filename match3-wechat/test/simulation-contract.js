'use strict';
const assert=require('assert');
const sim=require('./helpers/solo-simulation');
const levels=require('../js/core/level');
(async()=>{
 const options={level:levels.getLevel(21),seed:0x7a13f621,strategy:'goal',thinkMs:6000,trace:true};
 const first=await sim.play(options);
 const original=Math.random;let second;
 try{Math.random=()=>{throw new Error('Simulator must not consume global/cosmetic RNG');};second=await sim.play(options);}
 finally{Math.random=original;}
 assert.deepStrictEqual(second,first,'同种子/策略/计时必须完全复现');
 const other=await sim.play({...options,strategy:'random'});
 assert.deepStrictEqual(other.initial,first.initial,'策略不能改变初始棋盘或掉落流起点');
 assert.strictEqual(first.steps[0].state.time,options.level.timeLimitSec*1000,'首个有效交换结束前不计时');
 const expired=await sim.play({...options,thinkMs:200000});
 assert.strictEqual(expired.reason,'timeout');
 assert.strictEqual(expired.actions,1,'思考期超时必须阻止下一次交换');
 assert.strictEqual(expired.steps.at(-1).move,null);
 assert(first.steps.some(s=>s.waits.includes(200)&&s.waits.includes(300)),'模拟必须计入消除与补棋动画');
 assert(first.steps.at(-1).state.result,'必须有真实核心结算回调');
 const seeds=new Set();
 for(const base of [0x17a2c943,0x8db731e5,0xc406fa29])for(let i=0;i<200;i++)seeds.add((base+Math.imul(i,0x9e3779b1))>>>0);
 assert.strictEqual(seeds.size,600,'三个批次不能重复使用初始种子');
 console.log('simulation contract: independent RNG, deterministic trace, animation timing, first-move clock, timeout-before-input, unique batches PASS');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
