'use strict';
// Actual Main + matching engine + retention adapter + service + wallet; all
// storage and identities are isolated fixtures. No wx cloud or accounts used.
const assert=require('assert'),crypto=require('crypto');
const {createRetentionDb,copy}=require('./helpers/retention-db');
const backend=require('../cloudfunctions/battle/retention');
const client=require('../js/platform/retention-client');
const coin=require('../js/core/coin');
const Main=require('../js/main');
let time=Date.UTC(2026,8,21,4);
const store={match3_coin_v1:1000,match3_music_enabled_v1:false,match3_sfx_enabled_v1:false,
    match3_items_v1:{hammer:0,bomb:0,color:0},match3_onboarding_v1:{solo_intro:true}};
global.wx={getStorageSync:k=>copy(store[k]===undefined?'':store[k]),setStorageSync:(k,v)=>{store[k]=copy(v);},showToast(){}};
const fixture=createRetentionDb(),service=backend.createService(fixture.db,crypto,()=>time);
const routes={retentionInfo:'info',retentionSign:'sign',retentionRecord:'record',retentionClaim:'claim',retentionAck:'ack'};
const requests=[];
let offline=false;
async function call(action,input){requests.push({action,input:copy(input)});if(offline)throw Error('offline');return service[routes[action]]('integration-cat',input);}
const notices=[];
const make=()=>client.create(global.wx,call,coin,m=>notices.push(m),()=>time);
const ctx=new Proxy({}, {get:(_,key)=>key==='measureText'?()=>({width:0}):()=>{}});
const app=Object.create(Main.prototype);
Object.assign(app,{ctx,screen:{width:390,height:844},guideQueue:[],progress:{unlockedLevel:99,stars:{},failures:{}},retention:make()});
app.retentionPreview=app.retention.model;app.showGuide=()=>{};
const nextMove=core=>{
    for(let row=0;row<core.grid.length;row++)for(let column=0;column<core.grid[row].length;column++) {
        const from={row,column};
        for(const to of [{row:row+1,column},{row,column:column+1}])
            if(to.row<core.grid.length&&to.column<core.grid[row].length&&!core.isBlocked(from)&&!core.isBlocked(to)&&core.validateMove(from,to))return {from,to};
    }
    throw Error('No valid move');
};
async function playOne() {
    app.startGame(1);
    assert.equal(app.state,'playing');
    for(const method of ['animateSwap','animateInvalidSwap','animateMatch','animateGravity','animateFill','animateColorChange','animateReshuffle'])app.board[method]=async()=>{};
    const identity=app.retentionSolo.id;let moves=0;
    while(!app.core.ended){const move=nextMove(app.core);assert(await app.core.trySwap(move.from,move.to));assert(++moves<100);}
    assert(app.retentionSolo.validMove);assert(app.retentionSolo.cleared>0);
    assert.equal(app.state,'result');
    // The final exit counts a loss; wins may already have been submitted.
    app.leaveSoloResult(()=>app.backToMenu());
    await new Promise(r=>setImmediate(r));await app.retention.sync();
    assert.equal(app.retention.model.status,'ready');
    assert(requests.some(r=>r.action==='retentionRecord'&&r.input.event.id===identity));
    return identity;
}
(async()=>{
    await app.retention.sync();app.retention.activate('primary');await app.retention.sync();
    assert.equal(coin.getCoins(),1100);assert.equal(app.retention.model.activity,20);
    const first=await playOne();const second=await playOne();assert.notEqual(first,second);
    assert.deepEqual(app.retention.model.taskProgress,[1,2,80]);assert.equal(coin.getCoins(),1260);
    assert.equal(app.retention.model.activity,100,'all task activity + sign');
    await app.retention.sync();assert.equal(coin.getCoins(),1260,'repeat refresh never grants again');
    const before=requests.filter(r=>r.action==='retentionRecord').length;
    app.startGame(1);app.backToMenu();await app.retention.sync();
    assert.equal(requests.filter(r=>r.action==='retentionRecord').length,before,'quit before completion is excluded');

    // Same adapter/service round trip supplies week eligibility over real dates.
    for(let day=1;day<=6;day++){
        time=Date.UTC(2026,8,21+day,4);await app.retention.sync();app.retention.activate('primary');await app.retention.sync();
        if(day<5) {
            for(let game=0;game<2;game++)app.retention.record({id:'solo:integration:'+day+':'+game,mode:'solo',levelId:1,
                date:app.retention.date(),validMove:true,completed:true,cleared:40});
            await app.retention.sync();
        }
    }
    assert.equal(coin.getItems().hammer,1);assert.equal(app.retention.model.signDay,7);assert(app.retention.model.signed);
    assert.equal(app.retention.model.activity,540);
    time=Date.UTC(2026,8,28,4);await app.retention.sync();assert.equal(app.retention.model.activity,0);
    assert.deepEqual(app.retention.model.previousWeek.available,[true,true,true]);
    const beforeChests=coin.getCoins();
    for(let index=0;index<3;index++){app.retention.activate('previous'+index);await app.retention.sync();}
    assert.equal(coin.getCoins(),beforeChests+1800);assert.equal(app.retention.model.activity,0);
    assert.deepEqual(app.retention.model.previousWeek.claimed,[true,true,true]);
    app.retention.activate('primary');await app.retention.sync();assert.equal(app.retention.model.signDay,1);

    offline=true;
    app.retention.record({id:'solo:offline:old',mode:'solo',levelId:1,date:app.retention.date(),validMove:true,completed:true,cleared:80});
    await app.retention.sync();assert.equal(app.retention.model.status,'offline');
    const beforeExpired=coin.getCoins();time+=86400000;offline=false;app.retention=make();await app.retention.sync();
    assert.equal(coin.getCoins(),beforeExpired);assert.deepEqual(app.retention.model.taskProgress,[0,0,0]);
    assert(notices.some(s=>s.includes('过期')),'expired unconfirmed events are explained');
    assert.equal(store[client.KEY].pending.length,0);
    console.log('retention integration: actual Main/core two games, repeated level reward boundary, sign cycle/hammer, week chests, quit and offline expiry passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
