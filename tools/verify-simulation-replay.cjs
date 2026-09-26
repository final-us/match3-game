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
 const cases=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:420,height:1150}});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base.href+'?preview=content&width=375&replay=1');
  await page.waitForFunction(()=>window.replayBegin&&previewApp.board);
  for(const levelId of [1,6,10,11,16,19,20,21,23,26,30,100,121,130,421])for(const index of [0,1]){
   const seed=(0x7312ab01+levelId*1009+index*65537)>>>0;
   const options={level:levels.getLevel(levelId),seed,strategy:index?'goal':'special',thinkMs:index?20000:3000,trace:true,reduceEffects:!!index};
   const expected=await sim.play(options);
   await page.evaluate(options=>replayBegin(options),{levelId,seed,reduceEffects:!!index});
   assert.deepStrictEqual(await page.evaluate(()=>replaySnapshot()),expected.initial,'initial '+levelId);
   for(const [stepIndex,step] of expected.steps.entries()){
    await page.evaluate(ms=>{replayWaits=[];window.replayPending=null;replayAdvance(ms);},step.thinkMs);
    if(step.move){
     const coords=await page.evaluate(([a,b])=>({from:previewApp.board.pieceCenter(a.row,a.column),to:previewApp.board.pieceCenter(b.row,b.column)}),step.move);
     const canvas=await page.locator('canvas').boundingBox();
     await page.mouse.move(canvas.x+coords.from.x,canvas.y+coords.from.y);await page.mouse.down();
     await page.mouse.move(canvas.x+coords.to.x,canvas.y+coords.to.y,{steps:3});await page.mouse.up();
     assert(await page.evaluate(()=>!!replayPending),'pointer must start swap');
     await page.evaluate(async()=>{await replayPending;});
    }
    const actual=await page.evaluate(()=>({waits:replayWaits,state:replaySnapshot()}));
    try{assert.deepStrictEqual(actual.waits,step.waits);assert.deepStrictEqual(actual.state,step.state);}
    catch(e){fs.writeFileSync(output+'.failure.json',JSON.stringify({levelId,seed,stepIndex,expected:step,actual},null,2));throw e;}
   }
   assert.strictEqual(await page.evaluate(()=>previewApp.state),'result');
   const item={levelId,seed,strategy:options.strategy,thinkMs:options.thinkMs,reduceEffects:!!index,steps:expected.steps.length,win:expected.win,reason:expected.reason};
   cases.push(item);console.log(JSON.stringify(item));
  }
  assert.deepStrictEqual(errors,[]);
  fs.writeFileSync(output,JSON.stringify({version:'replay-v1',cases,errors,passed:true},null,2));
  console.log('Exact replay PASS: initial + every move + settlement + renderer timing + board RNG draw counts');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
