'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const levels=require('../match3-wechat/js/core/level');
const {play}=require('../match3-wechat/test/helpers/solo-simulation');
const strategies=['random','special','goal'];
const strategy=process.argv[2];assert(strategies.includes(strategy));
const output=process.argv[3]||'/private/tmp/match3-stability-'+strategy+'.json';
const ids=[6,10,20,21,30,121,130,421,430],speeds=[3000,6000,10000];
const batchSeeds=[0x17a2c943,0x8db731e5,0xc406fa29],rounds=200;
function wilson(w,n){const z=1.959963984540054,p=w/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,r=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [c-r,c+r];}
(async()=>{
 const cells=[];
 for(const id of ids)for(const thinkMs of speeds){
  const batches=[];
  for(const [batch,base] of batchSeeds.entries()){
   let wins=0,timeouts=0,moves=0,score=0,elapsed=0,animationMs=0;
   for(let i=0;i<rounds;i++){
    // Same indexed board seeds across levels/policies/speeds for paired comparisons.
    const seed=(base+Math.imul(i,0x9e3779b1))>>>0;
    const result=await play({level:levels.getLevel(id),seed,strategy,thinkMs});
    wins+=+result.win;timeouts+=+(result.reason==='timeout');moves+=+(result.reason==='moves');score+=result.score;elapsed+=result.elapsed;animationMs+=result.animationMs;
   }
   batches.push({batch,baseSeed:base,n:rounds,wins,timeouts,moveFailures:moves,scoreSum:score,elapsedSum:elapsed,animationMsSum:animationMs});
  }
  const n=rounds*batches.length,wins=batches.reduce((n,b)=>n+b.wins,0),rate=wins/n;
  const chiSquare=rate===0||rate===1?0:batches.reduce((sum,b)=>sum+(b.wins-b.n*rate)**2/(b.n*rate)+(b.n-b.wins-b.n*(1-rate))**2/(b.n*(1-rate)),0);
  // df=2, Bonferroni familywise alpha .01 for all 81 policy/level/speed cells.
  const sparse=rounds*Math.min(rate,1-rate)<5;
  const item={levelId:id,strategy,thinkMs,n,wins,rate,ci95:wilson(wins,n),timeouts:batches.reduce((s,b)=>s+b.timeouts,0),moveFailures:batches.reduce((s,b)=>s+b.moveFailures,0),
   batchRates:batches.map(b=>b.wins/b.n),chiSquare,stability:sparse?'sparse-descriptive':chiSquare>-2*Math.log(.01/(ids.length*speeds.length*strategies.length))?'flag':'no-detected-batch-difference',batches};
  cells.push(item);
  fs.writeFileSync(output,JSON.stringify({version:'simulation-validation-v1',complete:false,strategy,rounds,batchSeeds,cells},null,2));
  console.log(JSON.stringify({level:id,strategy,thinkMs,rate,ci95:item.ci95,stability:item.stability}));
 }
 fs.writeFileSync(output,JSON.stringify({version:'simulation-validation-v1',complete:true,strategy,rounds,batchSeeds,generator:levels.generatorVersion,
  clock:'thinking before input; renderer animation waits tick at 16ms; first move starts timer only after animation',policyRng:'separate from board RNG',
  configs:ids.map(id=>levels.getLevel(id)),cells},null,2));
 console.log(strategy+': complete '+cells.reduce((n,c)=>n+c.n,0)+' games');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
