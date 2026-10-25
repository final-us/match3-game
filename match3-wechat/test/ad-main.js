'use strict';
// Real Main consumer + actual ad, wallet, heart and completed-view journal.
// Only native transport, audio outputs and storage are isolated; no user data/network.
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const mainFile = require.resolve('../js/main');
const realRequire = require('module').createRequire(mainFile);
const config = require('../js/core/config');
const baseline = Object.assign({}, config.AD_CONFIG);
const storage = { match3_heart_v1: {count:0,lastLossTime:Date.now()} };
let failKey = '', showCount = 0, interCount = 0;
const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));
function nativeAd(interstitial) {
    return {closes:new Set(),errors:new Set(),
        onClose(fn){this.closes.add(fn);},offClose(fn){this.closes.delete(fn);},
        onError(fn){this.errors.add(fn);},offError(fn){this.errors.delete(fn);},
        show(){if(interstitial)interCount++;else showCount++;return Promise.resolve();},load(){return Promise.resolve();},
        close(done){[...this.closes].forEach(fn=>fn({isEnded:done}));},error(){[...this.errors].forEach(fn=>fn({errCode:1004}));}
    };
}
const reward = nativeAd(false), interstitial = nativeAd(true);
global.wx={
    getStorageSync(k){return k in storage ? clone(storage[k]) : '';},
    setStorageSync(k,v){if(k===failKey)throw Error('storage unavailable');storage[k]=clone(v);},
    createRewardedVideoAd(){return reward;},createInterstitialAd(){return interstitial;},showToast(){}
};
Object.assign(config.AD_CONFIG,{enabled:true,rewardedAdUnitId:'isolated',interstitialAdUnitId:'isolated'});
const coin=require('../js/core/coin'),heart=require('../js/core/heart'),journal=require('../js/core/ad-rewards');
const Core=require('../js/core/game-core');
const audio={isMusicEnabled:()=>true,isSfxEnabled:()=>true,active:false,setAdActive(v){this.active=v;},reward(){},invalid(){},click(){},unlock(){}};
const mainModule={exports:{}};
vm.runInNewContext(fs.readFileSync(mainFile,'utf8'),{module:mainModule,require:n=>n==='./audio'?audio:realRequire(n),wx:global.wx},{filename:mainFile});
const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
function app(state){return Object.assign(Object.create(mainModule.exports.prototype),{
    state,screen:{width:375,height:667},ctx:{},notice:'',showBattleNotice(text){this.notice=text;},lastTime:0,soloReviveCount:0,
    core:null,retentionSolo:null,result:null,guide:null,adFlow:false,
    shopRewardPending:false,heartAdPending:false,resultLeaving:false,progress:{unlockedLevel:1}
});}
const watchdog=setTimeout(()=>{console.error('ad Main test hung');process.exit(1);},3000);
(async()=>{
    // Route-level gestures: every non-board rewarded button waits for release.
    const rect={x:10,y:10,w:44,h:44};
    const point=(x=20,id=7)=>({clientX:x,clientY:20,identifier:id});
    const down={touches:[point()]},up={touches:[],changedTouches:[point()]};
    const routes=[
        ['shop','shopButtons','buy_hammer','buy:hammer'],
        ['shop','shopButtons','buy_heart','buy:heart'],
        ['shop','shopButtons','reward_hammer','shop:hammer'],
        ['shop','shopButtons','reward_bomb','shop:bomb'],
        ['shop','shopButtons','reward_color','shop:color'],
        ['shop','shopButtons','reward_heart','heart:shop'],
        ['menu','menuButtons','addHeart','heart:undefined'],
        ['menu','staminaDialogButtons','ad','heart:dialog'],
        ['result','resultButtons','revive','revive']
    ];
    let gestureCases=0;
    for(const [state,buttons,key,expected] of routes){
        function routed(){
            const a=app(state);a[buttons]={[key]:rect};a.core={};a.result={win:false};
            a.staminaDialog=buttons==='staminaDialogButtons';a.calls=[];
            a.buyItem=k=>a.calls.push('buy:'+k);a.buyHeart=()=>a.calls.push('buy:heart');
            a.claimShopAdItem=k=>a.calls.push('shop:'+k);
            a.handleAddHeart=k=>a.calls.push('heart:'+k);a.reviveGame=()=>a.calls.push('revive');
            return a;
        }
        let a=routed();a.handleTouchStart(down);assert.deepStrictEqual(a.calls,[]);
        a.handleTouchEnd(up);a.handleTouchEnd(up);assert.deepStrictEqual(a.calls,[expected]);gestureCases++;
        for(const interrupt of [
            a=>{a.handleTouchMove({touches:[point(60)]});a.handleTouchMove(down);},
            a=>a.handleTouchCancel(),
            a=>a.handleTouchStart({touches:[point(),point(20,8)]}),
            a=>a.handleTouchMove({touches:[point(20,8)]}),
            a=>{a.state='settings';},a=>{a.core={};},a=>{a.result={};},
            a=>{a.staminaDialog=!a.staminaDialog;},a=>{a.backgrounded=true;},
            a=>{a.adFlow=true;},a=>{a.guide={};},a=>{a.soloOperationBusy=true;},
            a=>{a.soloResumeSaveFailed=true;},a=>{a.soloPendingResult={};}
        ]){
            a=routed();a.handleTouchStart(down);interrupt(a);a.handleTouchEnd(up);
            assert.deepStrictEqual(a.calls,[],expected+' canceled gesture');gestureCases++;
        }
        a=routed();a.handleTouchStart(down);a.handleTouchEnd({touches:[],changedTouches:[point(20,8)]});
        assert.deepStrictEqual(a.calls,[]);gestureCases++;
    }
    // Real shop layout + Main gesture path: scrolling through an action must
    // never buy or show an ad, and a later deliberate tap may run exactly once.
    for(const key of ['buy_hammer','reward_hammer']){
        const a=app('shop');a.shopOffset=0;a.calls=[];
        a.shopButtons={viewport:{x:0,y:0,w:200,h:200},maxScroll:160,[key]:{x:80,y:60,w:86,h:44}};
        a.buyItem=k=>a.calls.push('buy:'+k);a.claimShopAdItem=k=>a.calls.push('ad:'+k);
        const p=(y,id=9)=>({clientX:100,clientY:y,identifier:id});
        a.handleTouchStart({touches:[p(80)]});
        a.handleTouchMove({touches:[p(40)]});
        assert.equal(a.shopOffset,40,'drag beginning on action scrolls the list');
        a.handleTouchMove({touches:[p(80)]});
        a.handleTouchEnd({touches:[],changedTouches:[p(80)]});
        assert.deepStrictEqual(a.calls,[],'returning to start never resurrects a canceled action');
        a.handleTouchStart({touches:[p(80)]});a.handleTouchEnd({touches:[],changedTouches:[p(80)]});a.handleTouchEnd({touches:[],changedTouches:[p(80)]});
        assert.deepStrictEqual(a.calls,[key==='buy_hammer'?'buy:hammer':'ad:hammer']);
    }
    // Actual SDK/consumer: a shop press cannot present until release, then only once.
    const tapped=app('shop');tapped.shopButtons={reward_hammer:rect};
    const beforeTap=showCount;tapped.handleTouchStart(down);await flush();assert.strictEqual(showCount,beforeTap);
    tapped.handleTouchEnd(up);tapped.handleTouchEnd(up);await flush();assert.strictEqual(showCount,beforeTap+1);
    reward.close(false);await flush();assert(!tapped.adFlow&&!tapped.shopRewardPending);
    assert.strictEqual(tapped.notice,'广告已提前关闭，未获得奖励');
    let cancelAgain=tapped.claimShopAdItem('hammer');await flush();reward.close(false);
    assert.strictEqual(await cancelAgain,false);assert.strictEqual(tapped.notice,'广告已提前关闭，未获得奖励');
    const loaded=reward.load,shown=showCount;
    reward.load=()=>Promise.reject({errCode:1004,errMsg:'not for display'});
    assert.strictEqual(await tapped.claimShopAdItem('hammer'),false);
    assert.strictEqual(tapped.notice,'暂无广告，请稍后再试');
    assert.strictEqual(showCount,shown);assert(!tapped.shopRewardPending&&!tapped.adFlow&&!journal.hasPending());
    assert.strictEqual(coin.getRewardedItemState().count,0,'cancels/failure cannot consume shop quota');
    assert.strictEqual(require('../js/core/analytics').getEvents().filter(e=>e.event==='ad_fail').pop().reason,'sdk_1004');
    reward.load=loaded;
    console.log('rewarded entry gestures: '+gestureCases+' route cases + real shop single-show passed');
    const shop=app('shop');
    let task=shop.claimShopAdItem('hammer');await flush();assert(shop.adFlow&&audio.active);
    failKey='match3_items_v1';reward.close(true);assert.strictEqual(await task,false);
    assert(journal.hasPending());assert(!shop.adFlow&&!shop.shopRewardPending&&!audio.active);
    const seen=showCount;failKey='';await shop.claimShopAdItem('hammer');
    assert.strictEqual(showCount,seen,'saving retry does not request another ad');
    assert.strictEqual(coin.getItems().hammer,1);assert.strictEqual(coin.getRewardedItemState().count,1);
    task=shop.claimShopAdItem('bomb');await flush();reward.close(false);assert.strictEqual(await task,false);
    assert.strictEqual(coin.getItems().bomb,0);assert.strictEqual(coin.getRewardedItemState().count,1);
    assert(!journal.hasPending());

    const home=app('menu');home.staminaDialog=true;
    const beforeFallback=showCount, beforeFallbackItems=JSON.stringify(coin.getItems());
    home.handleShow({query:{wxad_fallback_share:'1'}});
    assert.strictEqual(showCount,beforeFallback);assert.strictEqual(heart.getHeartState().count,0);
    assert.strictEqual(JSON.stringify(coin.getItems()),beforeFallbackItems,'fallback launch query cannot grant a reward');
    task=home.handleAddHeart('dialog');await flush();failKey='match3_heart_v1';reward.close(true);
    assert.strictEqual(await task,false);assert(journal.hasPending());assert(!home.heartAdPending);
    const heartsSeen=showCount;failKey='';home.handleShow({});
    assert.strictEqual(heart.getHeartState().count,1);assert.strictEqual(showCount,heartsSeen);
    assert.strictEqual(coin.getRewardedItemState().count,1,'hearts do not consume item allowance');
    task=home.handleAddHeart('dialog');await flush();reward.close(true);assert(await task);
    assert.strictEqual(heart.getHeartState().count,2);assert.strictEqual(home.staminaDialog,false);

    const result=app('result');result.result={win:false,canRevive:true};result.retentionSolo={};
    let saveOK=false;
    result.retention={saveSolo(){return {ok:saveOK};}};
    result.core=new Core({id:1,rows:8,columns:8,moveCount:20,timeLimitSec:60,goals:[{type:'score',target:999999}]},{});
    result.core.ended=true;result.core.movesLeft=0;result.core.timeLeftMs=0;
    task=result.reviveGame();await flush();
    let joins=0;result.joinBattle=()=>joins++;result.handleShow({query:{invite:'1',roomId:'ignored'}});
    assert.strictEqual(joins,0);assert.strictEqual(await result.leaveSoloResult(()=>assert.fail('must not leave')),false);
    reward.close(true);assert.strictEqual(await task,false);assert(result.pendingRevive&&result.result.revivePending);
    const reviveSeen=showCount;saveOK=true;assert(await result.reviveGame());
    assert.strictEqual(showCount,reviveSeen);assert.strictEqual(result.core.movesLeft,5);assert.strictEqual(result.core.timeLeftMs,30000);
    assert.strictEqual(result.soloReviveCount,1);assert.strictEqual(result.state,'playing');assert.strictEqual(await result.reviveGame(),false);

    const old=app('result');old.result={win:false};old.core=result.core;old.retentionSolo={};
    task=old.reviveGame();await flush();old.state='battle_wait';reward.close(true);assert.strictEqual(await task,false);
    assert.strictEqual(old.soloReviveCount,0,'stale completed view cannot revive a different scene');
    for(const state of ['battle_wait','battle_playing','battle_result','daily_detail','daily_playing','daily_result']){
        const isolated=app(state),before=showCount;
        await isolated.handleAddHeart();await isolated.claimShopAdItem('hammer');await isolated.reviveGame();
        await isolated.claimSoloAdItem('hammer');
        assert.strictEqual(showCount,before,state+' must not request ads');
    }
    const exit=app('result');exit.result={win:true};let navigations=0;
    await exit.leaveSoloResult(()=>navigations++);await exit.leaveSoloResult(()=>navigations++);
    task=exit.leaveSoloResult(()=>navigations++);await flush();assert.strictEqual(interCount,1);
    assert.strictEqual(await exit.leaveSoloResult(()=>navigations++),false);
    interstitial.error();assert(await task);interstitial.close();await flush();
    assert.strictEqual(navigations,3);assert(!exit.adFlow&&!exit.resultLeaving);
    const solo=app('playing');
    solo.core=new Core({id:1,rows:8,columns:8,moveCount:20,timeLimitSec:60,goals:[{type:'score',target:999999}]},{});
    solo.core.timerStarted=true;
    solo.board={setTools(items){this.items=clone(items);}};
    const beforeItems=coin.getItems(), beforeQuota=coin.getRewardedItemState().count;
    const gridBefore=JSON.stringify(solo.core.grid),timeBefore=solo.core.timeLeftMs;
    task=solo.claimSoloAdItem('color');await flush();
    assert(solo.adFlow&&solo.soloItemAdPending&&solo.core.timerPaused&&audio.active);
    const requests=showCount;
    assert.strictEqual(await solo.claimSoloAdItem('color'),false);assert.strictEqual(showCount,requests);
    solo.core.updateTime(10000);assert.strictEqual(solo.core.timeLeftMs,timeBefore);
    reward.close(true);assert(await task);reward.close(true);await flush();
    assert.strictEqual(coin.getItems().color,beforeItems.color+1);
    assert.strictEqual(solo.board.items.color,beforeItems.color+1);
    assert.strictEqual(coin.getRewardedItemState().count,beforeQuota);
    assert.strictEqual(JSON.stringify(solo.core.grid),gridBefore);assert.strictEqual(solo.core.movesLeft,20);
    assert(!solo.core.timerPaused&&!solo.adFlow&&!audio.active&&!solo.soloItemAdPending);
    task=solo.claimSoloAdItem('bomb');await flush();reward.close(false);assert.strictEqual(await task,false);
    assert.strictEqual(coin.getItems().bomb,beforeItems.bomb);
    task=solo.claimSoloAdItem('bomb');await flush();failKey='match3_items_v1';reward.close(true);
    assert.strictEqual(await task,false);assert(journal.hasPending());failKey='';
    const pendingRequests=showCount;await solo.claimSoloAdItem('bomb');
    assert.strictEqual(showCount,pendingRequests);assert.strictEqual(solo.board.items.bomb,beforeItems.bomb+1);
    assert(!journal.hasPending());
    solo.core.processing=true;assert.strictEqual(await solo.claimSoloAdItem('hammer'),false);solo.core.processing=false;
    solo.guide={};assert.strictEqual(await solo.claimSoloAdItem('hammer'),false);solo.guide=null;
    assert.strictEqual(showCount,pendingRequests,'animation and guide cannot start ads');
    let consent;
    global.wx.showModal=options=>{consent=options;};
    task=solo.claimSoloAdItem('hammer',true);await flush();
    assert(consent.content.includes('锤子×1'));assert.strictEqual(showCount,pendingRequests);
    consent.success({confirm:false});assert.strictEqual(await task,false);assert(!solo.adFlow&&!solo.core.timerPaused);
    task=solo.claimSoloAdItem('hammer',true);await flush();solo.handleHide();
    consent.success({confirm:true});assert.strictEqual(await task,false);assert.strictEqual(showCount,pendingRequests);
    assert(solo.core.timerPaused,'background confirmation must not resume timer or show video');
    solo.handleShow({});assert(!solo.core.timerPaused);
    delete global.wx.showModal;
    // Earned inventory is global, but a stale completion must not touch another board/timer.
    task=solo.claimSoloAdItem('hammer');await flush();
    const replacement=new Core({id:2,rows:8,columns:8,moveCount:25,goals:[{type:'score',target:999999}]},{});
    replacement.pauseTimer();solo.core=replacement;solo.board={setTools(){assert.fail('stale UI update');}};
    reward.close(true);assert(await task);assert(replacement.timerPaused);
    // A full shop quota cannot block this placement or be reset by it.
    for(let i=beforeQuota;i<coin.REWARDED_ITEM_DAILY_LIMIT;i++)assert(coin.claimRewardedItem('hammer',Date.now(),'fill-shop-'+i).ok);
    solo.board={setTools(items){this.items=clone(items);}};replacement.resumeTimer();
    task=solo.claimSoloAdItem('hammer');await flush();reward.close(true);assert(await task);
    assert.strictEqual(coin.getRewardedItemState().remaining,0);
    assert.strictEqual(journal.createClaim('shop_item','hammer').ok,false);
    console.log('ad Main: real consumer persistence retry, cancel, revive, mode/scene isolation, audio lock and navigation passed');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{
    clearTimeout(watchdog);Object.assign(config.AD_CONFIG,baseline);delete global.wx;
});
