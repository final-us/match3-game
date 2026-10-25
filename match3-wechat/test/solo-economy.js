'use strict';
// Real Main settlement + persistent wallet/heart; no accounts or network.
const assert = require('assert');
let store, failKey = '', failAfterWrite = false;
const copy = x => x == null ? x : JSON.parse(JSON.stringify(x));
global.wx = {
    getStorageSync: key => copy(store[key] == null ? '' : store[key]),
    setStorageSync: (key, value) => {
        if (failKey === key && !failAfterWrite) throw new Error('storage failed');
        store[key] = copy(value);
        if (failKey === key) throw new Error('ack lost');
    }
};
const Main = require('../js/main'), heart = require('../js/core/heart'), coin = require('../js/core/coin');
const ctx = new Proxy({}, {get:(_,key)=>key==='measureText'?()=>({width:0}):()=>{}});
function fixture(progress) {
    store = {match3_music_enabled_v1:false,match3_sfx_enabled_v1:false,match3_onboarding_v1:{solo_intro:true}};
    failKey = ''; failAfterWrite = false;
    const app = Object.create(Main.prototype);
    Object.assign(app,{ctx,screen:{width:375,height:812},guideQueue:[],progress:progress||{unlockedLevel:1,stars:{},failures:{}}});
    app.showGuide = ()=>{};
    return app;
}
const won = {win:true,score:5000,movesLeft:10};
let app = fixture();
app.startGame(1); assert.strictEqual(heart.getHeartState().count,4);
app.handleLevelEnd(won);
const reward=coin.getCoins(); assert(reward>0);
assert.strictEqual(heart.getHeartState().count,5);
app.handleLevelEnd(won); assert.strictEqual(coin.getCoins(),reward);
assert.strictEqual(heart.getHeartState().count,5);
app.startGame(1); app.handleLevelEnd(won);
assert.strictEqual(app.result.coinReward,0);assert.strictEqual(coin.getCoins(),reward);
assert.strictEqual(heart.getHeartState().count,5);
app.startGame(2);app.handleLevelEnd({...won,win:false,movesLeft:0});
assert.strictEqual(heart.getHeartState().count,4);
app.handleLevelEnd({...won,win:false}); assert.strictEqual(heart.getHeartState().count,4);
// Revival resets completion tracking, but does not consume another heart.
app.soloCompletionTracked=false;app.handleLevelEnd(won);
assert.strictEqual(heart.getHeartState().count,5);
app = fixture({unlockedLevel:42,stars:{6:2},failures:{}});
app.startGame(1);app.handleLevelEnd(won);assert.strictEqual(coin.getCoins(),0,'old unlocked earlier levels cannot re-earn');
app.startGame(6);app.handleLevelEnd(won);assert.strictEqual(coin.getCoins(),0,'old stars retain first-clear status');
app.startGame(21);app.backToMenu();assert.strictEqual(heart.getHeartState().count,4,'quit consumes only reserved heart');
// Reloading leaves an interrupted attempt consumed; there is no startup refund.
assert.strictEqual(require('../js/core/heart').getHeartState().count,4);
for (const key of ['match3_heart_v1','match3_coin_pending_credit_v1','match3_coin_v1','match3_coin_receipts_v1','match3_progress_infinite_v1']) {
    for (const after of [false,true]) {
        app=fixture();app.startGame(1);failKey=key;failAfterWrite=after;
        app.handleLevelEnd(won);assert(app.soloPendingResult,'failed settlement must offer retry');
        failKey='';failAfterWrite=false;app.handleLevelEnd(app.soloPendingResult);
        assert.strictEqual(heart.getHeartState().count,5,'refund once across pre/post-write failure');
        assert.strictEqual(coin.getCoins(),coin.calcWinCoins(10,coin.calcStars(10,app.core.level.moveCount)),'reward once across write failure');
        assert.strictEqual(app.progress.unlockedLevel,2);
        app.startGame(1);app.handleLevelEnd(won);assert.strictEqual(app.result.coinReward,0);
    }
}
// Result goals use actual core state, including layer counts and per-color collection.
const Core = require('../js/core/game-core');
app=fixture();
app.core=new Core({id:999,rows:8,columns:8,moveCount:10,goals:[
    {type:'score',target:1000},{type:'collect',pieceType:1,target:10},{type:'jelly',target:2},
    {type:'ice',target:1},{type:'yarn',target:3},{type:'moonbud',target:1},{type:'parcel',target:1}],
    underlays:{'2:2':2},obstacles:{'3:4':1},yarn:{source:'3:3',health:3,spreadEvery:2,maxVines:3},
    moonbuds:['4:3'],parcels:[{id:'result-parcel',row:5,column:4}],parcelExits:[4]},{});
app.core.score=420;app.core.collectedCounts[1]=4;app.core.yarnSource.health=1;
app.handleLevelEnd({win:false,score:420,movesLeft:0,reason:'moves'});
assert.strictEqual(app.state,'result');
assert.deepStrictEqual(app.result.remainingGoals.map(g=>[g.type,g.left,g.target]),[
    ['score',580,1000],['collect',6,10],['jelly',2,2],['ice',1,1],['yarn',1,3],['moonbud',1,1],['parcel',1,1]]);
const frozenGoals=copy(app.result.remainingGoals);
app.core.score=1000;app.core.collectedCounts[1]=10;app.core.jellyGrid.forEach(r=>r.fill(0));
app.core.iceGrid.forEach(r=>r.fill(0));app.core.yarnSource.health=0;app.core.moonbudCells={};app.core.parcels=[];
assert.deepStrictEqual(app.remainingSoloGoals(),[],'completed objectives are not presented as remaining');
assert.deepStrictEqual(copy(app.result.remainingGoals),frozenGoals,'result goal data is a detached snapshot');
app.core.level.goals=[];app.core.jellyGrid[2][2]=2;
assert.deepStrictEqual(app.remainingSoloGoals().map(g=>[g.type,g.left]),[['jelly',2]],'legacy implicit jelly goal');
app.core.jellyTotal=0;app.core.jellyGrid[2][2]=0;app.core.score=420;
assert.deepStrictEqual(app.remainingSoloGoals().map(g=>[g.type,g.left]),[['score',580]],'legacy default score goal');
console.log('solo economy: rewards/recovery and result objective snapshots PASS');
