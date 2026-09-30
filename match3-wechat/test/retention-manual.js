'use strict';
// Isolated real service/client: manual rewards, migration, rollover and recovery.
const assert=require('assert'),crypto=require('crypto');
const {createRetentionDb,copy}=require('./helpers/retention-db');
const backend=require('../cloudfunctions/battle/retention');
const client=require('../js/platform/retention-client');
const routes={retentionInfo:'info',retentionRecord:'record',retentionSign:'sign',retentionClaim:'claim',retentionClaimTask:'claimTask',retentionAck:'ack'};
(async()=>{
    let at=Date.UTC(2026,8,30,4);
    const f=createRetentionDb(),s=backend.createService(f.db,crypto,()=>at);
    const event=(id,cleared=40)=>({event:{id:'solo:'+id,mode:'solo',levelId:1,date:backend.beijingDate(at),validMove:true,completed:true,cleared}});
    await s.info('new',{taskClaimMode:'manual-v1'});
    assert.equal((await s.claimTask('new',{date:backend.beijingDate(at),index:0})).code,'NOT_ELIGIBLE');
    let r=await s.record('new',event('first',80));
    assert.deepEqual(r.state.taskProgress,[1,1,80]);assert.equal(r.state.activity,0);assert.equal(r.receipts.length,0);
    assert.equal((await s.catalogRequest('new','info')).state.fish,1,'fish still credited at first game');
    assert.equal((await s.claimTask('new',{date:r.state.date,index:3})).code,'INVALID_TASK_CLAIM');
    const date=r.state.date;
    const claims=await Promise.all([s.claimTask('new',{date,index:0}),s.claimTask('new',{date,index:0})]);
    assert.equal(claims[1].state.activity,20);assert.equal(claims[1].receipts.length,1);
    assert.deepEqual(claims[1].state.taskClaimed,[true,false,false]);
    assert.equal((await s.claimTask('other',{date,index:0,owner:s.ownerId('new')})).code,'NOT_ELIGIBLE','identity comes from trusted caller');
    await s.record('new',event('old-client-second')); // No opt-in input: sticky manual mode.
    r=await s.info('new');assert.equal(r.state.activity,20);assert.equal(r.receipts.length,1);
    await s.ack('new',{receiptIds:[r.receipts[0].id]});
    at+=86400000;
    r=await s.claimTask('new',{date,index:2});assert.equal(r.eventStatus,'expired');assert.equal(r.receipts.length,0);
    r=await s.claimTask('new',{date,index:0});assert.equal(r.eventStatus,'recorded','confirmed claim retry survives midnight');
    assert.equal(r.state.activity,20);assert.deepEqual(r.state.taskClaimed,[false,false,false]);

    // Genuine legacy shape: issued reward survives opt-in, not claimable twice.
    r=await s.record('legacy',event('legacy',80));assert.equal(r.receipts.length,2);assert.equal(r.state.activity,50);
    const profile=Object.values(f.docs.retention_profiles).find(p=>p.owner===s.ownerId('legacy'));
    delete profile.day.claimed;
    r=await s.info('legacy',{taskClaimMode:'manual-v1'});
    assert.deepEqual(r.state.taskClaimed,[true,false,true]);assert.equal(r.receipts.length,2);
    await s.claimTask('legacy',{date:r.state.date,index:0});
    r=await s.record('legacy',event('legacy-second'));assert.equal(r.state.activity,50);assert.equal(r.receipts.length,2);
    r=await s.claimTask('legacy',{date:r.state.date,index:1});assert.equal(r.state.activity,80);assert.equal(r.receipts.length,3);

    // Persisted pending claim recovers commit/lost-response, ACK and wallet errors.
    const values={},credited=new Set(),notices=[],calls=[];let balance=0,lose='',failWallet=false,offline=false;
    const api={getStorageSync:k=>copy(values[k]),setStorageSync:(k,v)=>{values[k]=copy(v);}};
    const wallet={creditRewardOnce(id,reward){if(failWallet)return {ok:false};if(credited.has(id))return {ok:true,credited:false};credited.add(id);balance+=reward.coins;return {ok:true,credited:true};}};
    const call=async(action,input)=>{calls.push(action);if(offline)throw Error('offline');const result=await s[routes[action]]('client',input);if(lose===action){lose='';throw Error('response lost');}return result;};
    const make=()=>client.create(api,call,wallet,m=>notices.push(m),()=>at);
    let c=make();await c.sync();
    c.record(event('client',80).event);await c.sync();assert.equal(balance,0);assert.equal(notices.length,0);
    c.activate('tasksTab');await c.sync();assert.equal(balance,0);
    lose='retentionClaimTask';c.activate('task0');await c.sync();assert.equal(c.model.status,'error');assert.equal(balance,0);
    at+=86400000;c=make();await c.sync();assert.equal(balance,40,'confirmed claim recovers after midnight');
    assert.equal(values[client.KEY].pending.length,0);
    c.record(event('client-next',80).event);await c.sync();
    failWallet=true;c.activate('task2');await c.sync();assert.equal(c.model.status,'error');assert.equal(balance,40);
    failWallet=false;c=make();await c.sync();assert.equal(balance,100);
    lose='retentionAck';c.activate('task0');await c.sync();assert.equal(balance,140);assert.equal(c.model.status,'error');
    c=make();await c.sync();assert.equal(balance,140);
    c.record(event('client-second',1).event);await c.sync();offline=true;c.activate('task1');await c.sync();
    at+=86400000;offline=false;c=make();await c.sync();assert.equal(balance,140,'unconfirmed claim expires');assert(notices.some(m=>m.includes('昨日任务奖励已过期')));

    // New client refuses to submit progress to an old auto-award cloud.
    const oldCalls=[],oldValues={};
    const old=client.create({getStorageSync:k=>oldValues[k],setStorageSync:(k,v)=>{oldValues[k]=copy(v);}},async(action)=>{
        oldCalls.push(action);const result=await s.info('old-cloud');delete result.state.taskClaimMode;delete result.state.taskClaimed;return result;
    },wallet,()=>{},()=>at);
    old.record(event('never-auto',80).event);await old.sync();
    assert.equal(old.model.status,'error');assert(old.model.message.includes('更新中'));assert.deepEqual(oldCalls,['retentionInfo']);
    assert.equal(oldValues[client.KEY].pending.length,1,'no loss while waiting for deployment');
    const damaged=Object.values(f.docs.retention_profiles).find(p=>p.owner===s.ownerId('new'));
    delete damaged.day.claimed;
    await assert.rejects(s.info('new'),/retention profile is corrupt/,'manual records cannot silently migrate as legacy paid tasks');
    console.log('retention manual: eligibility, dedupe, ownership, migration, midnight, lost response/ACK, wallet failure and old-cloud gate passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
