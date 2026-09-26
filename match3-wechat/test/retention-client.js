'use strict';
const assert=require('assert');
const client=require('../js/platform/retention-client');
const coin=require('../js/core/coin');
const copy=x=>x==null?x:JSON.parse(JSON.stringify(x));
const now=Date.UTC(2026,8,23,5);
const state={date:'2026-09-23',week:'2026-09-21',serverNow:now,weekEndsAt:Date.UTC(2026,8,27,16),
    signDay:7,signed:false,taskProgress:[0,0,0],activity:0,claimed:[false,false,false]};
const reward={id:'retention:signin:2026-09-23',coins:200,items:{hammer:1},kind:'signin',date:state.date};
function fixture() {
    const values={match3_coin_v1:500,match3_items_v1:{hammer:2,bomb:1,color:1}};
    let failKey='',when='before',once=false,offline=false,loseResponse='',signed=false,ack=false;
    const calls=[],notices=[];
    const api={getStorageSync:k=>copy(values[k]),setStorageSync(k,v){
        const fails=once&&k===failKey;if(fails)once=false;
        if(fails&&when==='before')throw Error('disk');
        values[k]=copy(v);if(fails)throw Error('disk');
    }};
    global.wx=api;
    async function call(action,input,options){
        calls.push({action,input:copy(input)});assert.equal(options.timeoutMs,12000);
        if(offline)throw Error('network');
        if(action==='retentionSign') {assert.equal(input.date,state.date);signed=true;}
        if(action==='retentionAck')ack=input.receiptIds.includes(reward.id)||ack;
        if(loseResponse===action){loseResponse='';throw Error('lost response after commit');}
        return {ok:true,state:{...state,signed},receipts:signed&&!ack?[reward]:[]};
    }
    const make=()=>client.create(api,call,coin,m=>notices.push(m),()=>now);
    return {api,values,calls,notices,make,fail(k,t){failKey=k;when=t;once=true;},offline(v){offline=v;},lose(a){loseResponse=a;}};
}
(async()=>{
    let f=fixture(),c=f.make();await c.sync();assert.equal(c.model.status,'ready');
    f.lose('retentionSign');c.activate('primary');await c.sync();
    assert.equal(c.model.status,'offline');assert.equal(f.values.match3_coin_v1,500);
    assert.equal(f.values[client.KEY].pending.length,1,'unconfirmed request remains durable');
    c=f.make();await c.sync();assert.equal(c.model.signed,true);assert.equal(f.values.match3_coin_v1,700);
    assert.equal(f.values.match3_items_v1.hammer,3);assert.equal(f.values[client.KEY].pending.length,0);
    await c.sync();assert.equal(f.values.match3_coin_v1,700);
    assert.equal(f.calls.filter(c=>c.action==='retentionSign').length,2,'retry retains original request');

    f=fixture();c=f.make();await c.sync();f.lose('retentionAck');c.activate('primary');await c.sync();
    assert.equal(f.values.match3_coin_v1,700);assert.equal(c.model.status,'offline');
    c=f.make();await c.sync();assert.equal(f.values.match3_coin_v1,700);assert.equal(f.values.match3_items_v1.hammer,3);
    assert.equal(f.values[client.KEY].acks.length,0,'lost ACK safely retries');

    for(const timing of ['before','after']) {
        f=fixture();c=f.make();await c.sync();f.fail('match3_coin_v1',timing);
        c.activate('primary');await c.sync();assert.equal(c.model.status,'error');
        assert.equal(f.values[client.KEY].receipts.length,1,'response persisted before reward application');
        c=f.make();await c.sync();assert.equal(f.values.match3_coin_v1,700);assert.equal(f.values.match3_items_v1.hammer,3);
    }
    f=fixture();c=f.make();await c.sync();f.fail(client.KEY,'before');c.activate('primary');
    assert.equal(f.calls.filter(c=>c.action==='retentionSign').length,0,'do not send an unsaved claim');
    await c.sync();assert.equal(f.values.match3_coin_v1,700,'same in-memory intent can recover failed enqueue');

    f=fixture();c=f.make();await c.sync();f.offline(true);
    const solo=c.startSolo(1);solo.validMove=true;solo.cleared=43;solo.date=c.date();
    c.saveSolo(solo,true);await c.sync();assert(!f.calls.some(c=>c.action==='retentionRecord'),'failed result can still revive');
    c.saveSolo(solo,false);c=f.make();f.offline(false);await c.sync();
    assert(!f.calls.some(c=>c.action==='retentionRecord'),'unfinished revived game never counts after restart');
    solo.cleared=92;c.saveSolo(solo,true);c=f.make();await c.sync();
    assert.equal(f.calls.filter(c=>c.action==='retentionRecord').length,1,'completed draft recovers after restart');
    assert.equal(f.calls.find(c=>c.action==='retentionRecord').input.event.cleared,92);

    f=fixture();c=f.make();await c.sync();f.fail(client.KEY,'before');
    const unsavedRun=c.startSolo(3);assert(unsavedRun&&unsavedRun.id,'retain in-memory identity on failed allocation');
    unsavedRun.validMove=true;unsavedRun.cleared=41;unsavedRun.completed=true;
    assert(c.finishSolo(unsavedRun).ok);await c.sync();
    assert.equal(f.calls.filter(c=>c.action==='retentionRecord').length,1,'later healthy storage saves completed run');

    f=fixture();c=f.make();f.values[client.KEY]={garbage:true};await c.sync();
    assert.equal(c.model.status,'error');assert.deepEqual(f.values[client.KEY],{garbage:true},'corrupt storage must not reset');
    assert.equal(f.calls.length,0);
    assert(!client.validReceipt({...reward,coins:999999}));assert(!client.validReceipt({...reward,items:{hammer:7}}));
    assert(!client.validState({...state,activity:900}));
    console.log('retention client: durable claims, lost response/ACK, wallet interruption, solo revival/restart, validation passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
