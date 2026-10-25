'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const config = require('../js/core/config');
const source = fs.readFileSync(require.resolve('../js/core/ad'), 'utf8');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const diagnosticSource = fs.readFileSync(require.resolve('../js/core/ad-diagnostics'), 'utf8');
const analyticsSource = fs.readFileSync(require.resolve('../js/core/analytics'), 'utf8');
function fixture(environment) {
    let now = 1000000, nextTimer = 0, broken = false;
    const timers = new Map(), storage = {}, events = [];
    const cfg = { AD_CONFIG: Object.assign({}, config.AD_CONFIG, { enabled: true, rewardedAdUnitId: 'fixture', interstitialAdUnitId: 'fixture' }) };
    const makeAd = () => ({
        closes: new Set(), errors: new Set(), loads: new Set(), calls: 0,
        onLoad(fn) { this.loads.add(fn); }, offLoad(fn) { this.loads.delete(fn); },
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
    let nativeQueries = 0;
    if (environment) {
        wx.getAccountInfoSync = () => { nativeQueries++; return { miniProgram: { envVersion: environment.channel } }; };
        wx.getDeviceInfo = () => { nativeQueries++; return { platform: environment.platform }; };
    }
    const diagnosticModule = { exports: {} }, analyticsModule = { exports: {} };
    vm.runInNewContext(diagnosticSource, { module: diagnosticModule, Date: { now: () => now } });
    let reports = 0;
    wx.reportEvent = () => { reports++; };
    wx.reportMonitor = () => { reports++; };
    cfg.REPORTING_CONFIG = { enabled: true, eventIds: { ad_fail: 'fixture_fail' } };
    vm.runInNewContext(analyticsSource, { module: analyticsModule, wx, Date: { now: () => now }, require: () => cfg });
    const module = { exports: {} };
    vm.runInNewContext(source, { module, wx, Date: { now: () => now },
        setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, at: now + ms }); return id; },
        clearTimeout(id) { timers.delete(id); },
        require(name) {
            if (name === './config') return cfg;
            if (name === './ad-diagnostics') return diagnosticModule.exports;
            return { track(e,p) { events.push({e,p}); return analyticsModule.exports.track(e,p); } };
        }
    });
    return { ad: module.exports, cfg, reward, interstitial, storage, events, wx, analytics: analyticsModule.exports,
        reports: () => reports, nativeQueries: () => nativeQueries,
        failStorage(v) { broken = v; },
        advance(ms) { now += ms; for (const [id,t] of [...timers]) if (t.at <= now) { timers.delete(id); t.fn(); } }
    };
}
const watchdog = setTimeout(() => { console.error("ad lifecycle test hung"); process.exit(1); }, 2000);
(async function () {
    {
        const f=fixture({channel:'develop'});let loaded,loads=0;
        f.reward.load=()=>{loads++;return new Promise(resolve=>{loaded=resolve;});};
        const p=f.ad.showRewarded('revive');await flush();
        [...f.reward.loads].forEach(fn=>fn());await flush();
        assert.strictEqual(f.reward.calls,0,'onLoad observes only; must finish loading before native presentation');
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
    // D2 preflight summaries remain tied to the displayed request after close.
    {
        const f=fixture({channel:'develop'});
        const context={music:false,sfx:true,audioPausedAt:999980,modalSuccessAt:999995,toastAt:999000,raw:'SECRET'};
        const p=f.ad.showRewarded('solo_item',{diagnosticContext:context});await flush();
        context.modalCompleteAt=1000015;
        f.reward.close({isEnded:false});await p;
        const rows=f.ad.getDiagnosticLines();
        assert(rows[0].includes('music=0 sfx=1 audio=20ms'));
        assert(rows[1].includes('modal S=5ms C=-15ms toast=1000ms'));
        assert(!JSON.stringify(rows).includes('SECRET'));
        const newer={music:true,sfx:false,audioPausedAt:1000000};
        const q=f.ad.showRewarded('shop_item',{diagnosticContext:newer});await flush();
        context.modalCompleteAt=1234567;
        assert(f.ad.getDiagnosticLines()[1].includes('modal S=- C=- toast=-'));
        f.reward.close({isEnded:true});await q;
        assert(f.ad.getDiagnosticLines().length<=40);
    }
    // A caller owns each result; SDK codes survive the actual analytics sanitizer.
    {
        const f=fixture({channel:'develop'});
        for(let i=0;i<2;i++) {
            const outcome={},p=f.ad.showRewarded('revive',{outcome});await flush();
            f.reward.close({isEnded:false});assert.strictEqual(await p,false);
            assert.deepStrictEqual(outcome,{reason:'cancel',code:null,stage:'close'});
        }
        f.reward.load=()=>Promise.reject({errCode:1004,errMsg:'PRIVATE',adUnitId:'SECRET'});
        const outcome={};assert.strictEqual(await f.ad.showRewarded('shop_item',{outcome}),false);
        assert.deepStrictEqual(outcome,{reason:'load_failed',code:1004,stage:'load'});
        assert.strictEqual(f.analytics.getEvents().filter(e=>e.event==='ad_fail').pop().reason,'sdk_1004');
        assert.strictEqual(f.ad.failureMessage(outcome),'暂无广告，请稍后再试');
        assert(f.ad.isRealRewardedAvailable());assert.strictEqual(f.ad.getRewardedBlockReason(),null);
        f.reward.load=()=>Promise.resolve();const recovered={};
        const p=f.ad.showRewarded('revive',{outcome:recovered});await flush();f.reward.close({isEnded:true});
        assert.strictEqual(await p,true);assert.deepStrictEqual(recovered,{reason:'completed',code:null,stage:'close'});
        assert.deepStrictEqual(outcome,{reason:'load_failed',code:1004,stage:'load'});
        assert.strictEqual(f.reward.loads.size,0,'onLoad must be detached');
        assert(!JSON.stringify(f.storage).includes('PRIVATE'));assert(!JSON.stringify(f.ad.getDiagnosticLines()).includes('SECRET'));
    }
    for(const method of ['create','load','show','listener','onError']) {
        const f=fixture({channel:'develop'}),outcome={};
        if(method==='create')f.wx.createRewardedVideoAd=()=>{throw {errCode:1004};};
        if(method==='load'||method==='show')f.reward[method]=()=>{throw {errCode:1004};};
        if(method==='listener')f.reward.onClose=()=>{throw {errCode:1004};};
        if(method==='onError')f.reward.show=function(){this.error();return Promise.reject({errCode:1005});};
        assert.strictEqual(await f.ad.showRewarded('revive',{outcome}),false);
        assert.strictEqual(outcome.code,1004);assert.strictEqual(outcome.stage,method);
        assert.strictEqual(f.analytics.getEvents().filter(e=>e.event==='ad_fail').pop().source,method.toLowerCase());
        assert.strictEqual(f.ad.getDiagnosticLines().filter(row=>row.includes('end_'+outcome.reason+'/1004')).length,1);
        assert.strictEqual(f.analytics.getEvents().filter(e=>e.event==='ad_fail').pop().reason,'sdk_1004');
        assert.strictEqual(f.events.filter(e=>e.e==='ad_fail').length,1,'event plus reject settles once');
        const before=JSON.stringify(outcome);f.reward.close({isEnded:true});await flush();assert.strictEqual(JSON.stringify(outcome),before);
    }
    {
        const f=fixture({channel:'develop'}),outcome={};
        f.reward.load=function(){this.error();return Promise.reject({errCode:1005});};
        assert.strictEqual(await f.ad.showRewarded('revive',{outcome}),false);await flush();
        assert.deepStrictEqual(outcome,{reason:'load_failed',code:1004,stage:'onError'});
        assert.strictEqual(f.reward.calls,0);assert.strictEqual(f.events.filter(e=>e.e==='ad_fail').length,1);
        assert(f.ad.getDiagnosticLines().some(row=>row.includes('onError/1004')));
    }
    for(const code of ['1004',NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1,0,-1004,Number.MAX_SAFE_INTEGER]) {
        const f=fixture(),outcome={};f.reward.load=()=>Promise.reject({errCode:code});
        await f.ad.showRewarded('revive',{outcome});
        assert.strictEqual(outcome.code,Number.isSafeInteger(code)?code:null);
        assert.strictEqual(f.analytics.getEvents().filter(e=>e.event==='ad_fail').pop().reason,
            Number.isSafeInteger(code)?'sdk_'+code:'load_failed');
    }
    {
        const f=fixture({channel:'develop'}),first={},second={};
        const p=f.ad.showRewarded('revive',{outcome:first});await flush();
        const oldClose=[...f.reward.closes][0],oldError=[...f.reward.errors][0];
        assert.strictEqual(f.ad.getRewardedBlockReason(),'pending');
        const blocked={};assert.strictEqual(await f.ad.showRewarded('revive',{outcome:blocked}),false);
        assert.strictEqual(blocked.reason,'pending');
        assert(f.ad.getDiagnosticLines().some(row=>row.includes('#2 ')&&row.includes('end_pending/')));
        f.advance(f.ad.CLOSE_TIMEOUT_MS);assert.strictEqual(await p,false);
        assert.strictEqual(first.reason,'callback_timeout');assert.strictEqual(f.ad.getRewardedBlockReason(),'awaiting_terminal');
        assert(f.ad.getDiagnosticLines().some(row=>row.includes('timeout/')));
        assert(f.ad.getDiagnosticLines().some(row=>row.includes('quarantine/')));
        f.ad.onHide();f.ad.onShow();
        assert(f.ad.getDiagnosticLines().slice(-2).every(row=>row.includes('#1 ')),'abandoned lifecycle retains request identity');
        const quarantined={};await f.ad.showRewarded('revive',{outcome:quarantined});assert.strictEqual(quarantined.reason,'awaiting_terminal');
        assert(f.ad.getDiagnosticLines().some(row=>row.includes('end_awaiting_terminal/')));
        oldError({errCode:1004});const q=f.ad.showRewarded('revive',{outcome:second});await flush();
        oldClose({isEnded:true});oldError({errCode:1004});assert.deepStrictEqual(second,{});
        assert.strictEqual(first.reason,'callback_timeout');f.reward.close({isEnded:false});await q;
        assert.strictEqual(second.reason,'cancel');
        assert.strictEqual(f.ad.getDiagnosticLines().filter(row=>row.includes('#4 ')&&row.includes('end_cancel/')).length,1);
        oldClose({isEnded:true});oldError({errCode:1004});
        assert.strictEqual(f.ad.getDiagnosticLines().filter(row=>row.includes('#4 ')&&row.includes('end_')).length,1);
        f.ad.onHide();assert.strictEqual(f.ad.getRewardedBlockReason(),'backgrounded');
        const hidden={};await f.ad.showRewarded('revive',{outcome:hidden});assert.strictEqual(hidden.reason,'backgrounded');
        assert(f.ad.getDiagnosticLines().some(row=>row.includes('end_backgrounded/')));f.ad.onShow();
        f.cfg.AD_CONFIG.enabled=false;assert.strictEqual(f.ad.getRewardedBlockReason(),'unavailable');
        const unavailable={};await f.ad.showRewarded('revive',{outcome:unavailable});assert.strictEqual(unavailable.reason,'unavailable');
        assert(f.ad.getDiagnosticLines().some(row=>row.includes('end_unavailable/')));
        f.cfg.AD_CONFIG.debugMockAds=true;const mock={};assert.strictEqual(await f.ad.showRewarded('revive',{outcome:mock}),true);
        assert.deepStrictEqual(mock,{reason:'debug_mock',code:null,stage:'mock'});
        assert(f.ad.getDiagnosticLines().some(row=>row.includes('end_debug_mock/')));
    }
    // Optional SDK observation must not affect the load/show lifecycle, even if registration throws.
    for(const mode of ['throw','missing','missing_off','release','trial','unknown']) {
        const f=fixture({channel:['release','trial'].includes(mode)?mode:mode==='unknown'?'unknown':'develop',platform:'ios'});
        let registered=0,detached=0;
        const off=f.reward.offLoad;
        f.reward.onLoad=function(fn){registered++;this.loads.add(fn);if(mode==='throw')throw Error('PRIVATE_OBSERVER');};
        f.reward.offLoad=function(fn){detached++;off.call(this,fn);};
        if(mode==='missing')delete f.reward.onLoad;
        if(mode==='missing_off')delete f.reward.offLoad;
        assert.strictEqual(f.ad.getDiagnosticLines().length,0);assert.strictEqual(f.nativeQueries(),0,'initial gate is closed without native calls');
        f.ad.onHide();f.ad.onShow();assert.strictEqual(f.nativeQueries(),0,'idle lifecycle needs no environment query');
        const outcome={},p=f.ad.showRewarded('revive',{outcome});await flush();
        assert.strictEqual(f.reward.calls,1,'observation never blocks presentation');
        assert.strictEqual(registered,mode==='throw'?1:0);
        f.reward.close({isEnded:true});assert.strictEqual(await p,true);
        assert.strictEqual(detached,mode==='throw'?1:0,'detach only attempted onLoad registrations');
        assert.strictEqual(f.reward.loads.size,0);assert(!f.events.some(e=>e.e==='ad_fail'));
        if(mode==='throw') {
            assert(f.ad.getDiagnosticLines().some(row=>row.includes('observe_failed/-')));
            assert(f.ad.getDiagnosticLines().some(row=>row.includes('end_completed/-')));
            assert(!JSON.stringify(f.ad.getDiagnosticLines()).includes('PRIVATE_OBSERVER'));
        }
        const terminal=f.analytics.getEvents().filter(e=>e.event==='ad_complete').pop();
        assert.strictEqual(terminal.source,'close');
    }
    {
        const f=fixture({channel:'develop'});let loaded;
        f.reward.load=()=>new Promise(resolve=>{loaded=resolve;});
        const outcome={},p=f.ad.showRewarded('revive',{outcome});
        f.ad.onHide();f.ad.onShow();loaded();await flush();assert.strictEqual(await p,false);
        assert(f.ad.getDiagnosticLines().some(row=>row.includes('end_backgrounded_before_show/')));
        assert.strictEqual(f.analytics.getEvents().filter(e=>e.event==='ad_fail').pop().source,'load');
    }
    for(const environment of [null,{channel:'release',platform:'devtools'},{channel:'trial',platform:'devtools'},
        {channel:'unknown',platform:'ios'},{channel:'develop',platform:'ios'},{platform:'devtools'}]) {
        const f=fixture(environment),enabled=environment&&(environment.channel==='develop'||!environment.channel&&environment.platform==='devtools');
        for(let i=0;i<10;i++) {
            const p=f.ad.showRewarded('PRIVATE_AD_ID');await flush();
            [...f.reward.loads].forEach(fn=>fn());f.ad.onHide();f.ad.onShow();f.reward.close({isEnded:false});await p;
        }
        const rows=f.ad.getDiagnosticLines();assert.strictEqual(rows.length,enabled?40:0);
        const queries=f.nativeQueries();for(let i=0;i<120;i++)f.ad.getDiagnosticLines();
        assert.strictEqual(f.nativeQueries(),queries);
        assert.strictEqual(f.reports(),0,'diagnostic stages do not report even when ad_fail mapping is enabled');
        assert.strictEqual(f.events.length,30,'diagnostics add no analytics stages');
        assert(!JSON.stringify(f.storage).includes('D2 #'),'diagnostics never persist');
        if(enabled) {
            assert(rows.every(row=>/^D2 #\d+ \d+ms unknown [a-zA-Z_]+\/-$/.test(row)));
            assert(rows.some(row=>row.includes('onLoad/')));assert(rows.some(row=>row.includes('hide/')));assert(rows.some(row=>row.includes('show/')));
            rows.length=0;assert.strictEqual(f.ad.getDiagnosticLines().length,40,'returned arrays are copies');
            const before=f.nativeQueries();for(let i=0;i<120;i++)f.ad.getDiagnosticLines();
            assert.strictEqual(f.nativeQueries(),before,'render reads must not call native environment APIs');
            f.wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'release'}});
            const p=f.ad.showRewarded('revive');await flush();
            assert.strictEqual(f.ad.getDiagnosticLines().length,0,'next request refreshes environment gate');
            assert.strictEqual(f.reward.loads.size,0,'release requests do not register onLoad');
            f.reward.close({isEnded:true});assert.strictEqual(await p,true);
        }
    }
    {
        const f=fixture();delete f.reward.onLoad;delete f.reward.offLoad;
        const p=f.ad.showRewarded('revive');await flush();f.reward.close({isEnded:true});assert.strictEqual(await p,true);
        const cases=[{reason:'cancel'},{code:1004},{reason:'load_failed'},{reason:'show_failed'},
            {reason:'callback_timeout'},{reason:'awaiting_terminal'},{reason:'backgrounded'}, {reason:'unavailable'}];
        assert.strictEqual(new Set(cases.map(value=>f.ad.failureMessage(value))).size,cases.length);
        assert(!f.ad.failureMessage({reason:'load_failed'}).includes('未看完'));
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
