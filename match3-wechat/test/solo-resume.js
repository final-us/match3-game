'use strict';
const assert = require('assert');
const Core = require('../js/core/game-core'), levels = require('../js/core/level');
const snapshots = require('../js/core/solo-snapshot');
const resumePath = require.resolve('../js/core/solo-resume'), coinPath = require.resolve('../js/core/coin');
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
const originalNow = Date.now; let now = 10000000;
Date.now = () => now;
let storage, writes, fail, after, journal, coin;
function reload() { delete require.cache[resumePath];delete require.cache[coinPath];coin=require(coinPath);journal=require(resumePath); }
function setup() {
    storage={match3_items_v1:{hammer:3,bomb:2,color:1}};writes=0;fail=0;after=false;
    global.wx={getStorageSync:k=>k in storage?clone(storage[k]):'',setStorageSync(k,v){
        writes++;if(writes===fail&&!after)throw Error('write');storage[k]=clone(v);if(writes===fail&&after)throw Error('after write');
    }};reload();
}
function failedCore(id=11) {
    const core=new Core(levels.getLevel(id),{},snapshots.random(123));core.ended=true;core.won=false;core.movesLeft=0;core.timeLeftMs=0;
    return core;
}
function meta() { return {reviveCount:0,failureRecorded:true,completionTracked:true,retentionSolo:null,startedAt:now,result:{win:false,score:0},guide:null,guideQueue:[]}; }
function revived(id=11) {const prepared=journal.prepare(failedCore(id),meta());assert(prepared.ok);const ready=journal.complete(prepared.record);assert(ready.ok);return ready.record;}
function validMove(core){for(let r=0;r<core.grid.length;r++)for(let c=0;c<core.grid[0].length;c++)for(const [dr,dc]of[[0,1],[1,0]]){
 const a={row:r,column:c},b={row:r+dr,column:c+dc};if(b.row<core.grid.length&&b.column<core.grid[0].length&&!core.isBlocked(a)&&!core.isBlocked(b)&&core.validateMove(a,b))return[a,b];
}throw Error('no move');}
let checks=0;
const watchdog=setTimeout(()=>{console.error('solo resume test hung');process.exit(1);},5000);
(async()=>{
 setup();let core=failedCore();const before=snapshots.capture(core);let prepared=journal.prepare(core,meta());assert(prepared.ok);assert(!journal.eligible(journal.read().record));
 let ready=journal.complete(prepared.record);assert(ready.ok);assert(journal.complete(prepared.record).ok);
 let restored=snapshots.restore(journal.read().record.snapshot,{});
 assert.strictEqual(restored.movesLeft,5);assert.strictEqual(restored.timeLeftMs,30000);assert.deepStrictEqual(restored.grid,before.state.grid);
 assert.strictEqual(journal.read().record.meta.reviveCount,1);checks++;
 for(const mode of ['before','after']) {
  setup();prepared=journal.prepare(failedCore(),meta());writes=0;fail=1;after=mode==='after';assert(!journal.complete(prepared.record).ok);
  fail=0;reload();assert.strictEqual(journal.eligible(journal.read().record),mode==='after');
  const completed=journal.complete(prepared.record);assert(completed.ok);assert.strictEqual(completed.record.snapshot.state.movesLeft,5);checks++;
 }
 for(const mode of ['before','after']) {
  setup();const r=revived();core=snapshots.restore(r.snapshot,{});core.resumeTimer();const move=validMove(core);
  const begun=journal.begin(r,core,'swap',move,r.meta);assert(begun.ok);
  const expected=snapshots.restore(begun.record.snapshot,{});expected.random=snapshots.random(begun.record.op.seed);
  await expected.trySwap(...move);expected.pauseTimer();
  writes=0;fail=1;after=mode==='after';assert(!journal.checkpoint(begun.record,expected,begun.record.meta).ok);
  fail=0;reload();const recovered=await journal.recover(journal.read().record);assert(recovered.ok);
  assert.deepStrictEqual(recovered.record.snapshot.state, snapshots.capture(expected).state);
  const again=await journal.recover(journal.read().record);assert.deepStrictEqual(again.record.snapshot,recovered.record.snapshot);checks++;
 }
 // Every tool debit/WAL/checkpoint failure, including writes that committed then threw.
 setup();let r=revived();core=snapshots.restore(r.snapshot,{});let pos=validMove(core)[0];
 let begun=journal.begin(r,core,'tool',['hammer',pos],r.meta);writes=0;assert((await journal.recover(begun.record)).ok);const count=writes;
 for(let point=1;point<=count;point++)for(const committed of [false,true]) {
  setup();r=revived();core=snapshots.restore(r.snapshot,{});pos=validMove(core)[0];begun=journal.begin(r,core,'tool',['hammer',pos],r.meta);
  const inputDisk=clone(storage);writes=0;fail=point;after=committed;assert(!(await journal.recover(begun.record)).ok);
  fail=0;reload();const recovered=await journal.recover(journal.read().record);assert(recovered.ok);assert.strictEqual(coin.getItems().hammer,2);
  await journal.recover(journal.read().record);assert.strictEqual(coin.getItems().hammer,2);
  const actual=clone(recovered.record.snapshot);
  storage=inputDisk;reload();const reference=await journal.recover(journal.read().record);assert.deepStrictEqual(actual,reference.record.snapshot);checks++;
 }
 setup();r=revived();core=snapshots.restore(r.snapshot,{});core.timerStarted=true;core.resumeTimer();
 begun=journal.begin(r,core,'swap',validMove(core),r.meta);now+=5000;const paused=journal.clock(begun.record,false);assert(paused.ok);now+=3600000;
 let recovery=await journal.recover(journal.read().record);assert(recovery.ok);assert.strictEqual(recovery.record.snapshot.state.timeLeftMs,25000);
 assert.strictEqual(recovery.record.snapshot.state.timerPaused,true);checks++;
 setup();r=revived();core=snapshots.restore(r.snapshot,{});core.resumeTimer();journal.checkpoint(r,core,r.meta);now+=5000;
 recovery=await journal.recover(journal.read().record);assert.strictEqual(recovery.record.snapshot.state.timeLeftMs,25000,'unclean restart cannot reset active timer');checks++;
 setup();r=revived();writes=0;fail=1;assert(!journal.close(r).ok);fail=0;assert(journal.eligible(journal.read().record));assert(journal.close(r).ok);reload();assert.strictEqual(journal.read().record,null);checks++;
 // Old versions cannot replace a newer checkpoint or a different run, including after an await.
 setup();r=revived();const old=clone(r);core=snapshots.restore(r.snapshot,{});core.score+=10;
 const newer=journal.checkpoint(r,core,r.meta);assert(newer.ok);
 assert.strictEqual((await journal.recover(old)).reason,'stale_run');assert.strictEqual(journal.close(old).reason,'stale_run');
 assert.strictEqual(journal.read().record.snapshot.state.score,core.score);checks++;
 const pending=journal.begin(newer.record,core,'swap',validMove(core),r.meta);assert(pending.ok);
 const replay=journal.recover(pending.record);const changed=journal.clock(pending.record,false);assert(changed.ok);
 assert.strictEqual((await replay).reason,'stale_run');assert.strictEqual(journal.read().record.revision,changed.record.revision);checks++;
 journal.close(changed.record);const other=revived();assert.strictEqual((await journal.recover(old)).reason,'stale_run');
 assert.strictEqual(journal.read().record.id,other.id);checks++;
 // Legacy rule rejection must occur before replay, inventory mutation or revival.
 for(const id of [8,9])for(const stage of ['prepared','ready','action']) {
  setup();let record;
  if(stage==='prepared') {const made=journal.prepare(failedCore(id),meta());assert(made.ok);record=made.record;}
  else {record=revived(id);if(stage==='action') {
   core=snapshots.restore(record.snapshot,{});const started=journal.begin(record,core,'tool',['hammer',validMove(core)[0]],record.meta);
   assert(started.ok);record=started.record;
  }}
  record.snapshot.schema=1;storage[journal.KEY]=clone(record);
  assert(journal.read().ok, 'legacy schema does not block journal reads');
  const originalDisk=clone(storage);
  assert.strictEqual((await journal.recover(record)).reason,'incompatible_rules');
  assert.strictEqual(journal.complete(record).reason,'incompatible_rules');
  assert.deepStrictEqual(storage,originalDisk,'old action/revival must leave board, items and receipts untouched');
  checks++;
 }
 setup();prepared=journal.prepare(failedCore(1),meta());assert(prepared.ok);
 prepared.record.snapshot.schema=1;storage[journal.KEY]=clone(prepared.record);
 let legacyRevived=journal.complete(prepared.record);assert(legacyRevived.ok);
 assert.strictEqual(legacyRevived.record.snapshot.schema,2);
 assert(journal.complete(prepared.record).ok);assert.strictEqual(journal.read().record.meta.reviveCount,1);
 assert.strictEqual(journal.read().record.snapshot.state.movesLeft,5);checks++;
 setup();r=revived(1);r.snapshot.schema=1;storage[journal.KEY]=clone(r);
 recovery=await journal.recover(journal.read().record);assert(recovery.ok);
 assert.strictEqual(recovery.record.snapshot.schema,2);assert.strictEqual(recovery.record.meta.reviveCount,1);
 const legacyMoves=recovery.record.snapshot.state.movesLeft;
 recovery=await journal.recover(recovery.record);assert(recovery.ok);
 assert.strictEqual(recovery.record.snapshot.state.movesLeft,legacyMoves);assert.strictEqual(recovery.record.meta.reviveCount,1);checks++;
 storage[journal.KEY]={version:1,stage:'ready'};assert(!journal.read().ok);checks++;
 console.log('solo resume journal: '+checks+' fault/restart/replay/clock cases passed');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{clearTimeout(watchdog);Date.now=originalNow;delete global.wx;});
