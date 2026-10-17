'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const root=require('path').resolve(__dirname,'../js'), mainFile=root+'/main.js';
const realRequire=require('module').createRequire(mainFile);
const Core=require('../js/core/game-core'),levels=require('../js/core/level'),snapshot=require('../js/core/solo-snapshot');
const coin=require('../js/core/coin'),heart=require('../js/core/heart'),journal=require('../js/core/solo-resume');
const retentionClient=require('../js/platform/retention-client');
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
let disk, fault, adShows=0, closeAd, modal, foreignStorage=false, bridgeStorage=false;
function bridgeClone(value) {
 if(!value||typeof value!=='object')return value;
 const out=Array.isArray(value)?new Array(value.length):{};
 for(const key of Object.keys(value))Object.defineProperty(out,key,{enumerable:true,get:()=>bridgeClone(value[key])});
 return out;
}
const audio=new Proxy({}, {get:()=>()=>{}});
const ad={isBusy:()=>false,isRewardedAvailable:()=>true,isRealRewardedAvailable:()=>true,onShow(){},onHide(){},markRewardGranted(){},onSoloResultExit:()=>Promise.resolve(false),
 showRewarded(){adShows++;return new Promise(r=>{closeAd=r;});}};
global.wx={getStorageSync:k=>k in disk?(bridgeStorage?bridgeClone(disk[k]):foreignStorage?vm.runInNewContext('JSON.parse(input)',{input:JSON.stringify(disk[k])}):clone(disk[k])):'',setStorageSync(k,v){
 const mode=fault&&fault(k,v);if(mode==='before')throw Error('write');disk[k]=clone(v);if(mode==='after')throw Error('after');
},showModal(options){modal=options;},showToast(){}};
const moduleMain={exports:{}};
vm.runInNewContext(fs.readFileSync(mainFile,'utf8'),{module:moduleMain,wx:global.wx,
 require:n=>n==='./audio'?audio:n==='./core/ad'?ad:realRequire(n)}, {filename:mainFile});
const createClock=require('./helpers/virtual-animation-clock');
function app(state='menu'){const value=Object.assign(Object.create(moduleMain.exports.prototype),{state,screen:{width:375,height:667},ctx:{},
 progress:clone(disk.match3_progress_infinite_v1)||{unlockedLevel:11,stars:{},failures:{11:1}},
 guide:null,guideQueue:[],soloReviveCount:0,soloFailureRecorded:true,soloCompletionTracked:true,retentionSolo:null,
 core:null,result:null,lastTime:Date.now(),notices:[],showBattleNotice(t){this.notices.push(t);}});
 value.createSoloBoard=function(...args){moduleMain.exports.prototype.createSoloBoard.apply(this,args);const board=this.board;this.animationClock=createClock(dt=>board.update(dt));board.wait=this.animationClock.wait;};
 return value;}

function setup(){disk={match3_coin_v1:0,match3_items_v1:{hammer:3,bomb:2,color:1},match3_heart_v1:{count:2,lastLossTime:Date.now(),refundPending:true}};fault=null;adShows=0;modal=null;}
function failed(){const a=app('result');a.core=new Core(levels.getLevel(11),{},snapshot.random(13));a.core.movesLeft=0;a.core.ended=true;a.core.timeLeftMs=0;
 a.result={win:false,score:a.core.score,canRevive:true};return a;}
async function flush(){for(let i=0;i<18;i++)await Promise.resolve();}
async function watch(a){const p=a.reviveGame();await flush();closeAd(true);await p;return a;}
async function pump(a,p){await a.animationClock.drain(p);return p;}
function move(c){for(let r=0;r<c.grid.length;r++)for(let col=0;col<c.grid[0].length;col++)for(const[dr,dc]of[[0,1],[1,0]]){
 const a={row:r,column:col},b={row:r+dr,column:col+dc};if(b.row<c.grid.length&&b.column<c.grid[0].length&&!c.isBlocked(a)&&!c.isBlocked(b)&&c.validateMove(a,b))return[a,b];
}throw Error('no move');}

async function liveApp(){
 setup();const a=failed();a.retentionSolo={id:'original-run',cleared:0,validMove:false};a.soloRunStartedAt=Date.now();
 await watch(a);return a;
}
async function holdHammer(a){
 const board=a.board, core=a.core, clock=a.animationClock, animate=board.animateMatch.bind(board);
 let release,reject;
 board.animateMatch=()=>{board.animateMatch=animate;return new Promise((resolve,fail)=>{release=resolve;reject=fail;});};
 const pending=core.useTool('hammer',move(core)[0]);await flush();assert(release,'real core reached animation');
 return {core,board,pending,release,reject,async finish(error){if(error)reject(Error('late animation'));else release();await clock.drain(pending);return pending;}};
}
function nextRun(a){
 assert(journal.close(journal.read().record).ok);
 const meta=a.soloResumeMeta();meta.retentionSolo={id:'next-run',cleared:0,validMove:false};meta.startedAt++;
 const prepared=journal.prepare(failed().core,meta);assert(prepared.ok);
 const completed=journal.complete(prepared.record);assert(completed.ok);return completed.record;
}
async function liveOperationBoundaries(){
 for(const change of ['checkpoint','new-id','adopted-record']){
  const a=await liveApp(),held=await holdHammer(a),run=clone(a.retentionSolo);
  let newer;
  if(change==='new-id')newer=nextRun(a);
  else{
   const action=journal.read().record,c=snapshot.restore(action.snapshot,{});c.score=99;c.movesLeft=2;
   const saved=journal.checkpoint(action,c,action.meta);assert(saved.ok);newer=saved.record;
   if(change==='adopted-record')a.soloResumeRecord=newer;
  }
  assert.strictEqual(await held.finish(),false,change);
  assert.deepStrictEqual(journal.read().record,newer,change+' preserves disk');
  assert.strictEqual(coin.getItems().hammer,3,change+' must not debit');
  assert.deepStrictEqual(a.retentionSolo,run,change+' must not change task metadata after suspension');
  assert.strictEqual(a.state,'playing');assert.strictEqual(a.soloOperationBusy,false);
 }
 for(const change of ['core','run','run-start']){
  const a=await liveApp(),held=await holdHammer(a),saved=journal.read().record;
  if(change==='core')a.core=new Core(levels.getLevel(11),{},snapshot.random(19));
  if(change==='run')a.retentionSolo={id:'replacement-run',cleared:0,validMove:false};
  if(change==='run-start')a.soloRunStartedAt++;
  const run=clone(a.retentionSolo),notices=a.notices.length;
  assert.strictEqual(await held.finish(),false,change);
  assert.strictEqual(coin.getItems().hammer,3);assert.deepStrictEqual(journal.read().record,saved);
  assert.deepStrictEqual(a.retentionSolo,run);assert.strictEqual(a.core.timerPaused,false);
  assert.strictEqual(a.soloResumeSaveFailed,false);assert.strictEqual(a.notices.length,notices);assert.strictEqual(a.state,'playing');
 }
 for(const lateError of [false,true]){
  const a=await liveApp(),old=await holdHammer(a);a.installSoloResume(nextRun(a));
  const fresh=await holdHammer(a),token=a.soloOperationBusy,saved=journal.read().record,run=clone(a.retentionSolo);
  const deferred={owner:'new-operation'};a.soloDeferredResult=deferred;
  // Old callback references must neither target the new board/run nor overwrite its pending result.
  old.core.callbacks.onSwap({row:0,column:0},{row:0,column:1});
  old.core.callbacks.onMatch({removed:[{}],generated:[{}]});
  old.core.callbacks.onLevelEnd({win:true,score:999999});old.board.onToolUsed('hammer');old.core.updateTime(60000);
  assert.strictEqual(await old.finish(lateError),false);
  assert.strictEqual(a.soloOperationBusy,token);assert.strictEqual(a.soloDeferredResult,deferred);
  assert.deepStrictEqual(journal.read().record,saved);assert.deepStrictEqual(a.retentionSolo,run);
  assert.strictEqual(coin.getItems().hammer,3);assert.strictEqual(a.core.timerPaused,false);
  assert.strictEqual(a.soloResumeSaveFailed,false);assert.strictEqual(a.state,'playing');
  a.soloDeferredResult=null;assert.strictEqual(await fresh.finish(),true);
  assert.strictEqual(coin.getItems().hammer,2);assert.strictEqual(a.soloOperationBusy,false);
 }
 const a=await liveApp(),held=await holdHammer(a),revision=journal.read().record.revision;
 a.handleHide();a.handleShow({});
 a.showGuide(require('../js/core/onboarding').GUIDE_KEYS.SPECIAL);assert(a.guide);a.dismissGuide();
 assert(journal.read().record.revision>revision);assert.strictEqual(a.soloOperationBusy.record,a.soloResumeRecord);
 assert.strictEqual(await held.finish(),true);assert.strictEqual(coin.getItems().hammer,2);
 held.board.onToolUsed('hammer');assert.strictEqual(coin.getItems().hammer,2,'UI callback must not debit twice');
 assert((await journal.recover(journal.read().record)).ok);assert.strictEqual(coin.getItems().hammer,2);
 console.log('PASS live Main ownership: disk revision/id/adoption, core/run, late success/error, pending isolation, background/guide clock and debit once');
}
async function restoreBoundaries(){
 for(const change of ['scene','core','run','request','disk']){
  await liveApp();const a=app(),pending=a.restoreSoloResume(journal.read().record);
  // Ready recovery commits synchronously, but Main installation resumes in the next microtask.
  if(change==='scene')a.state='daily_detail';
  if(change==='core')a.core=new Core(levels.getLevel(11),{},snapshot.random(21));
  if(change==='run')a.retentionSolo={id:'another-run'};
  const replacement={kind:'restore',owner:'new-request'};
  if(change==='request')a.soloOperationBusy=replacement;
  if(change==='disk')assert(journal.clock(journal.read().record,false).ok);
  const core=a.core,state=a.state,run=a.retentionSolo,saved=journal.read().record;
  assert.strictEqual(await pending,false,change+' prevents late install');
  assert.strictEqual(a.core,core);assert.strictEqual(a.state,state);assert.strictEqual(a.retentionSolo,run);
  assert.deepStrictEqual(journal.read().record,saved);assert.strictEqual(coin.getItems().hammer,3);
  if(core)assert.strictEqual(core.timerPaused,false);
  if(change==='request')assert.strictEqual(a.soloOperationBusy,replacement);
  else assert.strictEqual(a.soloOperationBusy,false);
  if(change!=='disk')assert(!a.soloResumeSaveFailed);
 }
 await liveApp();const a=app();let joined=0;a.joinBattle=()=>{joined++;a.state='battle_wait';};
 const roomId='R12345678abcdef1234';assert(require('../js/net/cloud-battle').isValidRoomId(roomId));
 const pending=a.restoreSoloResume(journal.read().record);a.handleShow({query:{invite:'1',roomId}});
 assert.strictEqual(joined,0);assert.strictEqual(a.state,'menu');assert(await pending);assert.strictEqual(a.state,'playing');
 console.log('PASS restore ownership: scene/core/run/request/disk changes reject late install; onShow preserves pending restore');
}
const guard=setTimeout(()=>{console.error('Main resume hung');process.exit(1);},10000);
(async()=>{
 for(const encoding of ['realm','bridge'])for(const route of ['menu','retry'])for(const seen of [false,true]){
  setup();foreignStorage=encoding==='realm';bridgeStorage=encoding==='bridge';const a=failed();
  if(seen){const p=a.reviveGame();await flush();closeAd(false);assert.strictEqual(await p,false);}
  const beforeHearts=heart.getHeartState().count;
  assert(await a.leaveSoloResult(()=>route==='menu'?a.backToMenu():a.startGame(11)),route+' foreign-storage result exit');
  assert.strictEqual(a.state,route==='menu'?'menu':'playing');assert.strictEqual(journal.read().record,null);
  assert.strictEqual(heart.getHeartState().count,beforeHearts-(route==='retry'?1:0));
  foreignStorage=false;bridgeStorage=false;
 }
 setup();let cleared=failed();let cancelled=cleared.reviveGame();await flush();closeAd(false);await cancelled;
 fault=(k,v)=>k===journal.KEY&&v===null?'after':null;
 assert.strictEqual(await cleared.leaveSoloResult(()=>assert.fail('write error must be visible')),false);
 assert.strictEqual(disk[journal.KEY],null);fault=null;
 assert(await cleared.leaveSoloResult(()=>cleared.backToMenu()),'already committed close is retryable');
 assert.strictEqual(cleared.state,'menu');
 await liveOperationBoundaries();
 await restoreBoundaries();
 setup();let a=failed();fault=(k)=>k===journal.KEY?'before':null;assert.strictEqual(await a.reviveGame(),false);assert.strictEqual(adShows,0,'must save before showing ad');
 setup();a=failed();const original=clone(a.core.grid);await watch(a);assert.strictEqual(a.core.movesLeft,5);assert.strictEqual(a.core.timeLeftMs,30000);
 assert.strictEqual(heart.getHeartState().count,2);assert.deepStrictEqual(a.core.grid,original);
 let b=app();assert(b.offerSoloResume(false));assert(modal&&modal.confirmText==='恢复原局');assert.strictEqual(b.core,null);
 modal.success({confirm:false});assert.strictEqual(b.soloResumePrompt,false);assert.strictEqual(b.core,null);
 assert(b.offerSoloResume(true));modal.success({confirm:true});await flush();assert(b.core);
 assert.strictEqual(b.soloReviveCount,1);assert.strictEqual(b.core.movesLeft,5);assert.strictEqual(heart.getHeartState().count,2);
 b.guide=null;b.guideQueue=[];
 let sawIntent=false;fault=(k,v)=>{if(k===journal.KEY&&v){if(v.stage==='action')sawIntent=true;else if(sawIntent&&v.stage==='ready')return'before';}return null;};
 const pos=move(b.core)[0];assert.strictEqual(await pump(b,b.core.useTool('hammer',pos)),false);assert(b.soloResumeSaveFailed);
 const expected=clone(b.core.grid);assert.strictEqual(coin.getItems().hammer,2);fault=null;
 const restarted=app();assert(await restarted.restoreSoloResume(journal.read().record));assert.deepStrictEqual(restarted.core.grid,expected);assert.strictEqual(coin.getItems().hammer,2);
 const repeated=app();assert(await repeated.restoreSoloResume(journal.read().record));assert.strictEqual(coin.getItems().hammer,2);assert.strictEqual(repeated.soloReviveCount,1);
 // Persist terminal core state before any settlement side effects; restart retries the same settlement.
 setup();a=failed();await watch(a);a.core.score=999999;a.core.iceGrid=a.core.iceGrid.map(row=>row.map(()=>0));
 a.core.moonbudCells={};a.core.moonbudTotal=levels.getLevel(11).moonbuds.length;a.core.ended=true;a.core.won=true;
 const win={win:true,score:a.core.score,movesLeft:a.core.movesLeft,timeLeftMs:a.core.timeLeftMs};
 // Force persistence failure at coin receipt intent after the heart refund commits.
 fault=k=>k==='match3_coin_pending_credit_v1'?'before':null;a.handleLevelEnd(win);assert(a.soloPendingResult);assert.strictEqual(heart.getHeartState().count,3);
 fault=null;b=app();assert(await b.restoreSoloResume(journal.read().record));const total=coin.getCoins();assert(total>0);assert.strictEqual(heart.getHeartState().count,3);
 const c=app();assert(await c.restoreSoloResume(journal.read().record));assert.strictEqual(coin.getCoins(),total);assert.strictEqual(heart.getHeartState().count,3);
 assert.strictEqual(c.state,'result');let left=0;assert(await c.leaveSoloResult(()=>left++));assert.strictEqual(left,1);assert.strictEqual(journal.read().record,null);
 setup();a=failed();await watch(a);a.core.ended=true;a.core.won=false;a.core.movesLeft=0;a.state='result';a.result={win:false,canRevive:true};assert(a.saveSoloResume(a.result));
 let watching=a.reviveGame();await flush();closeAd(false);await watching;assert.strictEqual(a.core.movesLeft,0);
 watching=a.reviveGame();await flush();closeAd(true);await watching;assert.strictEqual(a.core.movesLeft,5);assert.strictEqual(a.soloReviveCount,2);assert.strictEqual(adShows,3);
 setup();a=failed();await watch(a);const mismatch=journal.read().record;mismatch.snapshot.level.contentRevision+='-mismatch';disk[journal.KEY]=mismatch;
 b=app();assert.strictEqual(await b.restoreSoloResume(mismatch),false);assert(disk[journal.KEY]);assert(b.notices.some(t=>t.includes('版本')));
 // Updated levels offer explicit opt-in restart; cancel and failed close preserve the old run.
 for(const legacyRules of [false,true]) {
  setup();a=failed();
  if(legacyRules) {a.core=new Core(levels.getLevel(9),{},snapshot.random(13));a.core.movesLeft=0;a.core.ended=true;}
  await watch(a);const oldRun=journal.read().record;
  if(legacyRules)oldRun.snapshot.schema=1;else oldRun.snapshot.level.contentRevision+='-old';
  disk[journal.KEY]=clone(oldRun);const originalDisk=clone(disk);
  b=app();assert.strictEqual(await b.restoreSoloResume(oldRun),false);
  assert.deepStrictEqual(disk,originalDisk,'direct mismatch rejection preserves original record');
  assert(b.offerSoloResume(true));assert.strictEqual(modal.title,'关卡已更新');
  assert.strictEqual(modal.confirmText,'重新开始');assert.strictEqual(modal.cancelText,'稍后');
  modal.success({confirm:false});assert.deepStrictEqual(disk,originalDisk);assert.strictEqual(b.core,null);
  assert(b.offerSoloResume(true));fault=k=>k===journal.KEY?'before':null;
  modal.success({confirm:true});fault=null;
  assert.deepStrictEqual(disk,originalDisk,'failed close preserves old run and inventory');assert.strictEqual(b.core,null);
  assert(b.offerSoloResume(true));modal.success({confirm:true});
  assert.strictEqual(b.state,'playing');assert.strictEqual(b.core.level.id,oldRun.snapshot.level.id);
  assert.deepStrictEqual(b.core.level,levels.getLevel(oldRun.snapshot.level.id));
  assert.strictEqual(b.soloReviveCount,0,'normal new run does not inherit revival');
  assert.strictEqual(heart.getHeartState().count,1,'explicit new run uses normal stamina cost');
  assert.strictEqual(journal.read().record,null);assert.strictEqual(coin.getItems().hammer,3);
 }
 setup();a=failed();a.core=new Core(levels.getLevel(1),{},snapshot.random(13));a.core.movesLeft=0;a.core.ended=true;
 await watch(a);const unaffected=journal.read().record;unaffected.snapshot.schema=1;disk[journal.KEY]=clone(unaffected);
 b=app();assert(await b.restoreSoloResume(unaffected),'unaffected legacy run restores through Main');
 assert.strictEqual(journal.read().record.snapshot.schema,2);
 assert.strictEqual(b.soloReviveCount,1);assert.strictEqual(b.core.movesLeft,5);
 assert.strictEqual(heart.getHeartState().count,2);assert.strictEqual(coin.getItems().hammer,3);
 assert.deepStrictEqual(b.core.grid,unaffected.snapshot.state.grid);
 // A timer expiry during color feedback must replay as the same loss, not a later goal win.
 for(const failCheckpoint of [false,true]){
 setup();a=app('result');a.core=new Core({id:1,rows:8,columns:8,moveCount:20,timeLimitSec:60,goals:[{type:'score',target:10}]},{},snapshot.random(123));
 a.core.ended=true;a.core.movesLeft=0;a.result={win:false,score:0};await watch(a);
 a.core.timeLeftMs=1;a.core.timerStarted=true;a.core.resumeTimer();a.saveSoloResume();
 let colorPos;for(let row=0;row<8&&!colorPos;row++)for(let column=0;column<8&&!colorPos;column++)if(a.core.getSmartColorChoice({row,column}))colorPos={row,column};
 let release;a.core.callbacks.onColorChange=()=>new Promise(r=>release=r);
 const changing=a.core.useTool('color',colorPos);await flush();assert(release);a.core.updateTime(2);
 assert.strictEqual(journal.read().record.op.timeoutBeforeResolve,true);
 if(failCheckpoint)fault=(k,v)=>k===journal.KEY&&v&&v.stage!=='action'?'before':null;
 release();assert.strictEqual(await pump(a,changing),!failCheckpoint);assert.strictEqual(a.core.won,false);const colorGrid=clone(a.core.grid);fault=null;
 assert.strictEqual(coin.getItems().color,0,'legal timeout revision still debits once');
 const colorRecovery=await journal.recover(journal.read().record);assert(colorRecovery.ok);
 assert.strictEqual(colorRecovery.record.snapshot.state.won,false);assert.strictEqual(colorRecovery.record.snapshot.state.timeLeftMs,0);
 assert.deepStrictEqual(colorRecovery.record.snapshot.state.grid,colorGrid);
 assert.strictEqual(coin.getItems().color,0);assert((await journal.recover(colorRecovery.record)).ok);assert.strictEqual(coin.getItems().color,0);
 }
 // Retention startup must not enqueue a run that is still eligible for ad-revival recovery.
 setup();let calls=0;const transport=()=>{calls++;return Promise.resolve({ok:false});};
 const first=retentionClient.create(global.wx,transport,coin);const event=first.startSolo(11);event.validMove=true;first.saveSolo(event,true);
 retentionClient.create(global.wx,transport,coin,null,undefined,event.id);
 assert.strictEqual(disk.match3_retention_v1.solo.recoverable,false);assert.strictEqual(calls,0);
 console.log('solo resume Main: pre-ad persistence, real board replay, tool debit, terminal settlement, restore prompt/version and retention boundaries passed');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{clearTimeout(guard);delete global.wx;});
