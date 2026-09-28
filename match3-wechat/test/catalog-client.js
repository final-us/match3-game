'use strict';
const assert=require('assert'),crypto=require('crypto');
const {createRetentionDb,copy}=require('./helpers/retention-db');
const backend=require('../cloudfunctions/battle/retention');
const client=require('../js/platform/catalog-client');
const catalog=require('../js/platform/catalog-preview');
const features=require('../js/core/release-features');
const f=createRetentionDb(),store={};let time=Date.UTC(2026,8,27,4),owner='client-a',drop=false,offline=false,failWrite=false;
const service=backend.createService(f.db,crypto,()=>time),calls=[];
const api={getStorageSync:k=>copy(store[k]||''),setStorageSync:(k,v)=>{if(failWrite)return false;store[k]=copy(v);}};
async function call(action,input){calls.push({action,input:copy(input)});if(offline)throw Error('offline');
    const r=await service.catalogRequest(owner,{catalogInfo:'info',catalogAdopt:'adopt',catalogFeed:'feed'}[action],input);
    if(drop){drop=false;throw Error('lost reply');}return r;}
const make=()=>client.create(api,call);
async function earn(day){time=Date.UTC(2026,8,27+day,4);for(let i=0;i<3;i++)await service.record(owner,{event:{id:'solo:client:'+day+':'+i,mode:'solo',date:backend.beijingDate(time),completed:true,validMove:true,cleared:80,levelId:1}});}
function choose(c,id){c.activate('cat:'+id);}
async function feed(c){c.activate('feed');c.activate('confirm-feed');return c.sync();}
(async()=>{
    for(const version of ['develop','trial','release'])assert(features.enabled({getAccountInfoSync:()=>({miniProgram:{envVersion:version}})}));
    assert(!features.enabled({}));
    let c=make();await c.sync();assert.equal(c.model.fish,0);choose(c,'calico');
    c.activate('adopt');await c.sync();assert.equal(c.model.owned.length,0);
    for(let day=0;day<7;day++)await earn(day);
    await c.sync();assert.equal(catalog.statusFor(c.model,'calico'),'adoptable');
    drop=true;c.activate('adopt');await c.sync();assert.equal(c.model.status,'offline');
    const pending=copy(store[client.KEY].pending);assert(pending);c=make();await c.sync();
    assert.deepEqual(c.model.owned,['calico']);assert.equal(store[client.KEY].pending,null);
    assert.equal(calls.filter(r=>r.action==='catalogAdopt').slice(-1)[0].input.requestId,pending.input.requestId);
    choose(c,'calico');let before=c.model.fish;drop=true;await feed(c);assert.equal(c.model.status,'offline');
    c=make();await c.sync();assert.equal(c.model.fish,before-1);assert.equal(c.model.affection.calico,1);
    choose(c,'calico');before=c.model.fish;failWrite=true;c.activate('feed');c.activate('confirm-feed');
    assert.equal(c.model.status,'error');failWrite=false;await c.sync();assert.equal(c.model.fish,before,'unsaved input never sent');
    // Server commits but local pending acknowledgement fails; keep original request.
    let failAfter=true;const special=client.create(api,async(a,i)=>{const r=await call(a,i);if(a==='catalogFeed'&&failAfter){failAfter=false;failWrite=true;}return r;});
    await special.sync();choose(special,'calico');await feed(special);assert.equal(special.model.status,'error');
    failWrite=false;c=make();await c.sync();assert.equal(c.model.fish,before-1);
    choose(c,'calico');c.activate('feed');offline=true;c.activate('confirm-feed');await c.sync();
    owner='client-b';offline=false;await c.sync();assert.equal(c.model.status,'ready');assert.deepEqual(c.model.owned,[]);
    assert.equal(store[client.KEY].pending,null,'foreign-account pending resolved without mutation');
    assert.equal((await service.catalogRequest('client-a','info')).state.fish,before-1);
    // Production view helper cannot grant assets or advance dates locally.
    const snap=copy(c.model);catalog.completeRound(c.model,true);catalog.nextDay(c.model);catalog.activate(c.model,'adopt');assert.deepEqual(c.model,snap);
    assert(!client.validState({...c.model,fish:9999}));
    // A feed reply arriving after navigation must update assets, not reopen detail.
    owner='client-a';let releaseReply;
    const delayed=client.create(api,async(a,i)=>{const r=await call(a,i);if(a==='catalogFeed')await new Promise(resolve=>{releaseReply=resolve;});return r;});
    await delayed.sync();choose(delayed,'calico');before=delayed.model.fish;
    delayed.activate('feed');delayed.activate('confirm-feed');const waiting=delayed.sync();
    // Wait only for the in-memory server fixture to reach its controlled reply point.
    for(let turn=0;!releaseReply&&turn<100;turn++)await new Promise(resolve=>setImmediate(resolve));
    assert(releaseReply,'fixture failed to reach delayed reply');
    delayed.activate('back');assert.equal(delayed.model.view,'list');releaseReply();await waiting;
    assert.equal(delayed.model.view,'list');assert.equal(delayed.model.overlay,null);
    assert.equal(delayed.model.fish,before-1);
    // Invalid replies cannot acknowledge a pending mutation. A later retry uses the same id.
    const badReply=client.create(api,async(a,i)=>{const r=await call(a,i);return a==='catalogFeed'?{...r,state:{...r.state,fish:-1}}:r;});
    await badReply.sync();choose(badReply,'calico');before=badReply.model.fish;await feed(badReply);
    assert.equal(badReply.model.status,'error');assert(store[client.KEY].pending);
    const retryId=store[client.KEY].pending.input.requestId;c=make();await c.sync();
    assert.equal(c.model.fish,before-1);assert.equal(store[client.KEY].pending,null);
    assert.equal(calls.filter(r=>r.action==='catalogFeed').slice(-1)[0].input.requestId,retryId);
    store[client.KEY]={version:1,pending:{bad:true}};c=make();await c.sync();assert.equal(c.model.status,'error');assert(store[client.KEY].pending.bad);
    console.log('catalog client: production channels, loss/restart, disk failure, id reuse, account binding, no sample grants passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
