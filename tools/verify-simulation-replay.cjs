'use strict';
// Real browser Main/Board pointer replay vs headless Core, with identical seeds and virtual time.
const assert=require('assert'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const sim=require('../match3-wechat/test/helpers/solo-simulation');
const levels=require('../match3-wechat/js/core/level');
const base=new URL(process.argv[2]);assert(['127.0.0.1','localhost'].includes(base.hostname));
const output=process.argv[3]||'/private/tmp/match3-replay-result.json';
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 const cases=[],errors=[],parallelProbes=[];let lastStep=null;
 try{
  const page=await browser.newPage({viewport:{width:420,height:1150}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base.href+'?preview=content&width=375&replay=1');
  await page.waitForFunction(()=>window.replayBegin&&previewApp.board);
  // Independent timing oracle: paw arrival and bell dye run concurrently in real Board.
  // The synthetic event verifies the overlap, separate from the natural level replays.
  for(const reduceEffects of [false,true])for(const relay of [false,true]){
   const probe=await page.evaluate(async ({reduceEffects,relay})=>{
    replayBegin({levelId:5,seed:1,reduceEffects});
    const board=new previewApp.board.constructor({},previewApp.screen);board.setGame(previewApp.core);
    board.wait=replayClock.wait;board.spawnBurst=()=>{};
    const data={removed:[],triggeredSpecials:[
     {row:0,column:0,type:105,target:{row:0,column:3}},
     {row:0,column:3,type:106,color:1,colorChanges:[{row:0,column:4,previousType:2,type:1}]}]};
    if(relay){
     data.triggeredSpecials[0].target={row:0,column:2};
     data.triggeredSpecials[1].column=5;data.triggeredSpecials[1].colorChanges[0].column=6;
     data.triggeredSpecials.splice(1,0,{row:0,column:2,type:105,target:{row:0,column:5}});
    }
    await replayClock.drain(board.animateMatch(data));
    return {reduceEffects,relay,animationMs:replayClock.now,waits:replayClock.tape};
   },{reduceEffects,relay});
   assert.strictEqual(probe.animationMs,relay?(reduceEffects?536:1167):(reduceEffects?408:809),'parallel paw/bell wall duration');
   assert(probe.waits.reduce((n,w)=>n+w.duration,0)>probe.animationMs,'probe must contain overlapping waits');
   parallelProbes.push(probe);
  }
  const selectedLevels = process.argv.find(arg => arg.startsWith('--levels='));
  const replayLevels = selectedLevels ? selectedLevels.slice(9).split(',').map(Number) : [3,5,11,16,19,21,23,26,30,121,130,421];
  assert(replayLevels.every(id => Number.isInteger(id) && levels.getLevel(id)), 'valid replay levels');
  for(const levelId of (process.argv.includes('--probes-only')?[]:replayLevels))for(const index of [0,1]){
   const seed=(0x7312ab01+levelId*1009+index*65537)>>>0;
   const options={level:levels.getLevel(levelId),seed,strategy:index?'goal':'special',thinkMs:index?20000:3000,trace:true,reduceEffects:!!index};
   const expected=await sim.play(options);
   await page.evaluate(options=>replayBegin(options),{levelId,seed,reduceEffects:!!index});
   assert.deepStrictEqual(await page.evaluate(()=>replaySnapshot()),expected.initial,'initial '+levelId);
   for(const [stepIndex,step] of expected.steps.entries()){
    await page.evaluate(ms=>{replayReset();replayAdvance(ms);},step.thinkMs);
    if(step.move){
     const coords=await page.evaluate(([a,b])=>({from:previewApp.board.pieceCenter(a.row,a.column),to:previewApp.board.pieceCenter(b.row,b.column)}),step.move);
     const canvas=await page.locator('canvas').boundingBox();
     await page.mouse.move(canvas.x+coords.from.x,canvas.y+coords.from.y);await page.mouse.down();
     await page.mouse.move(canvas.x+coords.to.x,canvas.y+coords.to.y,{steps:3});await page.mouse.up();
     assert(await page.evaluate(()=>!!replayPending),'pointer must start swap');
     await page.evaluate(async()=>{await replayDrain();await replayPending;});
    }
    const actual=await page.evaluate(()=>({waits:replayWaits,animationMs:replayClock.now,state:replaySnapshot()}));
    try{assert.strictEqual(actual.animationMs,step.animationMs);assert.deepStrictEqual(actual.waits,step.waits);assert.deepStrictEqual(actual.state,step.state);}
    catch(e){fs.writeFileSync(output+'.failure.json',JSON.stringify({levelId,seed,stepIndex,expected:step,actual},null,2));throw e;}
   }
   assert.strictEqual(await page.evaluate(()=>previewApp.state),'result');
   const item={levelId,seed,strategy:options.strategy,thinkMs:options.thinkMs,reduceEffects:!!index,steps:expected.steps.length,win:expected.win,reason:expected.reason};
   cases.push(item);console.log(JSON.stringify(item));
  }
  if(!process.argv.includes('--probes-only')){
   // Actual Main success settlement after the final accepted swap, with frame time during onSwap.
   const reference=sim.environment(12345),core=new reference.Core(levels.getLevel(21),{});
   const move=sim.moves(core)[0];assert(move);
   await page.evaluate(()=>{
    replayBegin({levelId:21,seed:12345,reduceEffects:false});
    const core=previewApp.core;
    core.level={...core.level,moveCount:1,timeLimitSec:120,goals:[{type:'score',target:10}]};
    core.movesLeft=1;core.timeLimitMs=120000;core.timeLeftMs=120000;core.timerStarted=true;
    window.lastStepSwapCheckpoint=null;
    const wait=previewApp.board.wait;let first=true;
    previewApp.board.wait=ms=>wait(ms).then(()=>{
     if(first){first=false;window.lastStepSwapCheckpoint={ended:core.ended,result:replayResult,score:core.score,
      movesLeft:core.movesLeft,timeLeftMs:core.timeLeftMs,processing:core.processing};}
    });
   });
   const heartAtStart=await page.evaluate(()=>wx.getStorageSync('match3_heart_v1').count);
   assert.strictEqual(heartAtStart,4,'Main reserves one heart when starting');
   const coords=await page.evaluate(([a,b])=>({from:previewApp.board.pieceCenter(a.row,a.column),to:previewApp.board.pieceCenter(b.row,b.column)}),move);
   const canvas=await page.locator('canvas').boundingBox();
   await page.mouse.move(canvas.x+coords.from.x,canvas.y+coords.from.y);await page.mouse.down();
   await page.mouse.move(canvas.x+coords.to.x,canvas.y+coords.to.y,{steps:3});await page.mouse.up();
   assert(await page.evaluate(()=>!!replayPending),'last step pointer must start swap');
   await page.evaluate(async()=>{await replayDrain();await replayPending;});
   lastStep=await page.evaluate(()=>({swapCheckpoint:lastStepSwapCheckpoint,state:replaySnapshot(),
    mainState:previewApp.state,hearts:wx.getStorageSync('match3_heart_v1').count}));
   assert.deepStrictEqual(lastStep.swapCheckpoint,{ended:false,result:null,score:0,movesLeft:0,timeLeftMs:119780,processing:true});
   assert.strictEqual(lastStep.mainState,'result');assert.strictEqual(lastStep.state.won,true);
   assert.strictEqual(lastStep.state.result.reason,'goal');assert(lastStep.state.score>=10);
   assert.strictEqual(lastStep.hearts,5,'last-step success refunds reserved heart: net zero cost');
  }
  assert.deepStrictEqual(errors,[]);
  fs.writeFileSync(output,JSON.stringify({version:'replay-v2-wall-clock',cases,parallelProbes,lastStep,errors,coverage:cases.length?'level-replays-and-parallel-probes':'parallel-probes-only',passed:true},null,2));
  console.log(cases.length?'Exact replay PASS: initial + every move + settlement + renderer timing + board RNG draw counts':'Parallel renderer timing probes PASS');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
