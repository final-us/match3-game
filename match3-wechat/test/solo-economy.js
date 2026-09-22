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
console.log('solo economy: first/repeat/legacy wins, loss/revival/quit, refund and wallet failure recovery PASS');
