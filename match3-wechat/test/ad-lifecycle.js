'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const config = require('../js/core/config');
const source = fs.readFileSync(require.resolve('../js/core/ad'), 'utf8');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function fixture() {
    let now = 1000000, nextTimer = 0, broken = false;
    const timers = new Map(), storage = {}, events = [];
    const cfg = { AD_CONFIG: Object.assign({}, config.AD_CONFIG, { enabled: true, rewardedAdUnitId: 'fixture', interstitialAdUnitId: 'fixture' }) };
    const makeAd = () => ({
        closes: new Set(), errors: new Set(), calls: 0,
        onClose(fn) { this.closes.add(fn); }, offClose(fn) { this.closes.delete(fn); },
        onError(fn) { this.errors.add(fn); }, offError(fn) { this.errors.delete(fn); },
        show() { this.calls++; return Promise.resolve(); }, load() { return Promise.resolve(); },
        close(value) { [...this.closes].forEach(fn => fn(value)); }, error() { [...this.errors].forEach(fn => fn({ errCode: 1004 })); }
    });
    const reward = makeAd(), interstitial = makeAd();
    const wx = {
        getStorageSync(k) { return storage[k] == null ? '' : JSON.parse(JSON.stringify(storage[k])); },
        setStorageSync(k,v) { if (broken) throw Error('fixture storage'); storage[k] = JSON.parse(JSON.stringify(v)); },
        createRewardedVideoAd() { return reward; }, createInterstitialAd() { return interstitial; }
    };
    const module = { exports: {} };
    vm.runInNewContext(source, { module, wx, Date: { now: () => now },
        setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, at: now + ms }); return id; },
        clearTimeout(id) { timers.delete(id); },
        require(name) { return name === './config' ? cfg : { track(e,p) { events.push({e,p}); } }; }
    });
    return { ad: module.exports, cfg, reward, interstitial, storage, events, wx,
        failStorage(v) { broken = v; },
        advance(ms) { now += ms; for (const [id,t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); } }
    };
}
const watchdog = setTimeout(() => { console.error("ad lifecycle test hung"); process.exit(1); }, 2000);
(async function () {
    {
        const f=fixture();let loaded,loads=0;
        f.reward.load=()=>{loads++;return new Promise(resolve=>{loaded=resolve;});};
        const p=f.ad.showRewarded('revive');await flush();
        assert.strictEqual(f.reward.calls,0,'must finish loading before native presentation');
        f.reward.close({isEnded:true});assert(f.ad.isBusy(),'load-only stale close cannot grant reward');
        loaded();await flush();assert.strictEqual(loads,1);assert.strictEqual(f.reward.calls,1);
        f.reward.close({isEnded:true});assert.strictEqual(await p,true);
    }
    for(const fail of ['load','show']){
        const f=fixture();let loads=0;
        f.reward.load=()=>{loads++;return fail==='load'?Promise.reject(Error('load')):Promise.resolve();};
        f.reward.show=()=>{f.reward.calls++;return Promise.reject(Error('show'));};
        assert.strictEqual(await f.ad.showRewarded('heart_refill'),false);
        assert.strictEqual(loads,1);assert.strictEqual(f.reward.calls,fail==='load'?0:1,'no automatic second show');
        assert(f.ad.isRealRewardedAvailable());assert(!f.events.some(e=>e.e==='ad_complete'));
    }
    for(const returnBeforeLoad of [false,true]){
        const f=fixture();let loaded;f.reward.load=()=>new Promise(resolve=>{loaded=resolve;});
        const p=f.ad.showRewarded('solo_item');await flush();f.ad.onHide();
        if(returnBeforeLoad)f.ad.onShow();loaded();await flush();
        assert.strictEqual(await p,false);assert.strictEqual(f.reward.calls,0,'backgrounded request never pops up later');
        assert(!f.ad.isBusy());assert(f.ad.isRealRewardedAvailable());
    }
    {
        const f=fixture();let loaded;f.reward.load=()=>new Promise(resolve=>{loaded=resolve;});
        const p=f.ad.showRewarded('shop_item');await flush();f.advance(f.ad.REQUEST_TIMEOUT_MS);
        assert.strictEqual(await p,false);assert(f.ad.isRealRewardedAvailable(),'load timeout did not open an overlay');
        loaded();await flush();assert.strictEqual(f.reward.calls,0);
    }
    {
        const f = fixture();
        f.wx.createRewardedVideoAd = () => { throw Error('create'); };
        assert.strictEqual(await f.ad.showRewarded('shop_item'), false);
        f.wx.createRewardedVideoAd = () => f.reward;
        assert(f.ad.isRealRewardedAvailable(), 'creation failure must not hide the shop permanently');
        let first = f.ad.showRewarded('shop_item'); await flush();
        const oldClose = [...f.reward.closes][0], oldError = [...f.reward.errors][0];
        f.reward.error(); assert.strictEqual(await first, false);
        const next = f.ad.showRewarded('heart_refill'); await flush();
        oldClose({isEnded:true}); oldError({errCode:1004});
        assert(f.ad.isBusy(), 'old callback on reused singleton cannot finish a new request');
        f.reward.close({isEnded:true}); assert.strictEqual(await next, true);
        assert.strictEqual(f.reward.closes.size, 0, 'terminal listeners detached');
        oldClose({isEnded:true});
        assert.strictEqual(f.events.filter(x=>x.e==='ad_complete').length,1);
    }
    {
        const f = fixture();
        const p = f.ad.showRewarded('revive'); await flush();
        assert.strictEqual(await f.ad.showRewarded('heart_refill'), false);
        f.storage[f.ad.INTERSTITIAL_STORAGE_KEY] = {completedGames:2,lastShownAt:0};
        assert.strictEqual(await f.ad.onSoloResultExit(), false);
        assert.strictEqual(f.interstitial.calls,0);
        assert.strictEqual(f.storage[f.ad.INTERSTITIAL_STORAGE_KEY].completedGames,2);
        f.reward.close({isEnded:false}); assert.strictEqual(await p,false);
        const inter = f.ad.onSoloResultExit(); await flush();
        assert.strictEqual(await f.ad.showRewarded('revive'),false);
        f.interstitial.error(); assert.strictEqual(await inter,false);
        assert.strictEqual(f.storage[f.ad.INTERSTITIAL_STORAGE_KEY].lastShownAt,0, 'known failure restores original cooldown');
    }
    {
        const f=fixture();let options;
        f.wx.createRewardedVideoAd=value=>{options=value;return f.reward;};
        const incomplete=f.ad.showRewarded('revive');await flush();
        assert.strictEqual(options.disableFallbackSharePage,true,'video-only rewards must explicitly disable the native share fallback');
        f.reward.close({useFallbackSharePage:true});
        assert.strictEqual(await incomplete,false,'a fallback/share-shaped result is not proof of a completed video');
        assert.strictEqual(f.events.filter(x=>x.e==='ad_complete').length,0);
        const completed=f.ad.showRewarded('revive');await flush();
        assert.strictEqual(options.disableFallbackSharePage,true);
        f.reward.close({isEnded:true});assert.strictEqual(await completed,true);
    }
    for (const phase of ['request','display','return']) {
        const f=fixture();
        if (phase==='request') f.reward.show=()=>new Promise(()=>{});
        const p=f.ad.showRewarded('heart_refill'); await flush();
        if (phase==='return') { f.ad.onHide(); f.advance(f.ad.CLOSE_TIMEOUT_MS); assert(f.ad.isBusy()); f.ad.onShow(); }
        f.advance(phase==='request'?f.ad.REQUEST_TIMEOUT_MS:phase==='display'?f.ad.CLOSE_TIMEOUT_MS:f.ad.RETURN_GRACE_MS);
        assert.strictEqual(await p,false, phase+' resolves without awarding');
        assert.strictEqual(f.ad.isBusy(),false);
        assert.strictEqual(f.ad.isRewardedAvailable(),false, 'unresolved native overlay quarantined');
        assert.strictEqual(await f.ad.showRewarded('revive'),false);
        f.reward.close({isEnded:true});
        assert(f.ad.isRewardedAvailable(), 'late terminal restores retry eligibility without a grant');
        assert.strictEqual(f.events.filter(x=>x.e==='ad_complete').length,0);
        const q=f.ad.showRewarded('revive'); await flush();f.reward.close({isEnded:true});assert.strictEqual(await q,true);
    }
    {
        const f=fixture(); f.storage[f.ad.INTERSTITIAL_STORAGE_KEY]={completedGames:2,lastShownAt:0};
        const p=f.ad.onSoloResultExit();await flush();f.advance(f.ad.CLOSE_TIMEOUT_MS);
        assert.strictEqual(await p,false);assert(!f.ad.isBusy());
        const reserved=f.storage[f.ad.INTERSTITIAL_STORAGE_KEY].lastShownAt;assert(reserved>0);
        f.interstitial.close();
        assert.strictEqual(await f.ad.onSoloResultExit(),false,'ambiguous impression remains conservatively cooled');
        await f.ad.onSoloResultExit();await f.ad.onSoloResultExit();
        f.advance(120001);const q=f.ad.onSoloResultExit();await flush();f.interstitial.close();assert.strictEqual(await q,true);
        f.advance(119999);assert.strictEqual(await f.ad.onSoloResultExit(),false);
    }
    {
        const f=fixture(); f.storage[f.ad.INTERSTITIAL_STORAGE_KEY]={completedGames:2,lastShownAt:0};
        f.failStorage(true);assert.strictEqual(await f.ad.onSoloResultExit(),false);assert.strictEqual(f.interstitial.calls,0);
        f.failStorage(false);assert.strictEqual(await f.ad.onSoloResultExit(),false,'failed persistence disables interstitial for this run');
    }
    {
        const f=fixture();f.storage[f.ad.INTERSTITIAL_STORAGE_KEY]={completedGames:2,lastShownAt:0};
        const p=f.ad.onSoloResultExit();await flush();f.advance(30000);f.failStorage(true);f.interstitial.close();assert(await p);
        const reboot=fixture();Object.assign(reboot.storage,JSON.parse(JSON.stringify(f.storage)));
        reboot.advance(120001); // 90.001 seconds after the close in the prior process.
        assert.strictEqual(await reboot.ad.onSoloResultExit(),false,'unknown close must start a fresh recovery cooldown');
        await reboot.ad.onSoloResultExit();await reboot.ad.onSoloResultExit();
        reboot.advance(119999);assert.strictEqual(await reboot.ad.onSoloResultExit(),false);
        reboot.advance(1);const next=reboot.ad.onSoloResultExit();await flush();reboot.interstitial.close();assert(await next);
    }
    assert.strictEqual(config.AD_CONFIG.enabled,true);assert.strictEqual(config.AD_CONFIG.debugMockAds,false);
    assert.strictEqual(config.AD_CONFIG.rewardedAdUnitId,'adunit-035fb16fac04d21b');
    assert.strictEqual(config.AD_CONFIG.interstitialAdUnitId,'adunit-d4c3fac373ac66c1');
    {
        // Actual local IDs may be present; the master switch must still prevent SDK creation.
        const f=fixture();Object.assign(f.cfg.AD_CONFIG,config.AD_CONFIG,{enabled:false});
        let creations=0;
        f.wx.createRewardedVideoAd=()=>{creations++;return f.reward;};
        f.wx.createInterstitialAd=()=>{creations++;return f.interstitial;};
        assert.strictEqual(f.ad.isRewardedAvailable(),false);
        assert.strictEqual(f.ad.isRealRewardedAvailable(),false);
        for(const placement of ['revive','heart_refill','shop_item']) {
            assert.strictEqual(await f.ad.showRewarded(placement,{allowMock:false}),false);
        }
        for(let i=0;i<6;i++) assert.strictEqual(await f.ad.onSoloResultExit(),false);
        assert.strictEqual(creations,0,'filled IDs plus disabled switch must never create a native ad');
        assert.strictEqual(f.reward.calls+f.interstitial.calls,0);
        assert(!f.events.some(item=>['ad_show','ad_complete','ad_reward_granted'].includes(item.e)));
    }
    {
        const f=fixture();Object.assign(f.cfg.AD_CONFIG,config.AD_CONFIG);
        let creations=0;
        f.wx.createRewardedVideoAd=()=>{creations++;return f.reward;};
        f.wx.createInterstitialAd=()=>{creations++;return f.interstitial;};
        assert.strictEqual(f.ad.isRewardedAvailable(),true);
        assert.strictEqual(f.ad.isRealRewardedAvailable(),true);
        assert.strictEqual(creations,0,'enabling or checking availability must not eagerly create/request ads');
        assert.strictEqual(f.reward.calls+f.interstitial.calls,0);
    }
    assert.strictEqual(config.REPORTING_CONFIG.enabled,false);
    console.log('ad lifecycle: singleton identity, mutex, timeout/quarantine, foreground, storage and safe defaults passed');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>clearTimeout(watchdog));
