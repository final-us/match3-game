'use strict';
// Real Main/core/resume consumer; only native I/O, audio and transport are isolated.
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const mainFile = require.resolve('../js/main');
const realRequire = require('module').createRequire(mainFile);
const reports = require('../js/platform/level-analytics');
const resume = require('../js/core/solo-resume');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
let disk, events, now, failReport;
global.wx = {
    getStorageSync: key => key in disk ? clone(disk[key]) : '',
    setStorageSync: (key, value) => { disk[key] = clone(value); },
    getMiniReportManager: () => ({ report(payload) {
        if (failReport) { payload.fail({ secret: 'not-to-log' }); return; }
        events.push(clone(payload)); payload.success({});
    } }),
    showToast() {}, showModal() {}
};
const ad = {
    isBusy: () => false, isRewardedAvailable: () => true, isRealRewardedAvailable: () => true,
    markRewardGranted() {}, onShow() {}, onHide() {},
    onSoloResultExit: () => Promise.resolve(false), showRewarded: () => Promise.resolve(true)
};
let joinOk = true;
const cloud = Object.assign({}, realRequire('./net/cloud-battle'), {
    call: operation => Promise.resolve(operation === 'join' && !joinOk ? {ok: false, err: 'invalid'} :
        { ok: true, roomId: 'R12345678abcdef1234', roundId: 1, roundNumber: 1 })
});
const audio = new Proxy({}, { get: () => () => {} });
const loaded = { exports: {} };
vm.runInNewContext(fs.readFileSync(mainFile, 'utf8'), {
    module: loaded, wx: global.wx, Date: class extends Date { static now(){return now;} },
    require: name => name === './audio' ? audio : name === './core/ad' ? ad :
        name === './net/cloud-battle' ? cloud : realRequire(name)
}, { filename: mainFile });

function setup() {
    now = 1000; events = []; failReport = false; joinOk = true;
    disk = { match3_coin_v1: 0, match3_items_v1: { hammer: 2, bomb: 2, color: 2 },
        match3_heart_v1: { count: 5, lastLossTime: Date.now() } };
}
function app(enabled = true) {
    return Object.assign(Object.create(loaded.exports.prototype), {
        state: 'menu', screen: { width: 375, height: 667 }, ctx: {},
        progress: { unlockedLevel: 1, stars: {}, failures: {} },
        core: null, board: null, retention: null, retentionSolo: null,
        soloReviveCount: 0, soloCompletionTracked: false, guide: null, guideQueue: [],
        backgrounded: false, adFlow: false,
        levelReporter: reports.create(global.wx, { enabled, gameVersion: 20261020 }, () => now),
        showGuide: () => false, showBattleNotice() {}, startPolling() {}, stopPolling() {}
    });
}
function end(a, win) {
    a.core.ended = true; a.core.won = win;
    if (!win) a.core.movesLeft = 0;
    const result = { win, score: a.core.score, movesLeft: a.core.movesLeft,
        timeLeftMs: a.core.timeLeftMs, reason: win ? 'goal' : 'moves' };
    a.handleLevelEnd(result);
    return result;
}
const actions = () => events.map(event => event.levelResult);
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

(async () => {
    setup(); const a = app();
    const create = a.createSoloBoard;
    a.createSoloBoard = function (...args) {
        assert.strictEqual(events.length, 0, 'cannot report entry before board creation');
        create.apply(this, args);
    };
    a.startGame(1); a.createSoloBoard = create;
    assert.strictEqual(a.state, 'playing'); assert.deepStrictEqual(actions(), [5]);
    assert.strictEqual(events[0].levelID, 1); assert.strictEqual(events[0].loginCount, 1);
    now += 10000; a.handleHide();
    assert.deepStrictEqual(actions(), [5], 'background is not a quit');
    now += 30000; a.handleShow({});
    let release;
    const advertising = a.runAdFlow(() => new Promise(resolve => { release = resolve; }));
    await flush(); now += 20000; release(false); await advertising;
    now += 5000; const win = end(a, true); a.handleLevelEnd(win);
    assert.deepStrictEqual(actions(), [5, 1]);
    assert.strictEqual(events[1].levelTime, 15, 'foreground clock excludes background/ad coverage');
    assert.strictEqual(events[1].levelProgress, 100);
    now += 90000;
    await a.leaveSoloResult(() => a.startGame(2));
    assert.deepStrictEqual(actions(), [5, 1, 5], 'next level is not retry or abandonment');
    assert.strictEqual(events[2].levelID, 2); assert.strictEqual(events[2].loginCount, 1);

    setup(); const b = app(); b.startGame(1);
    now += 4000; const loss = end(b, false); b.handleLevelEnd(loss);
    assert(!('levelTime' in events[1]), 'failure cannot report successful completion duration');
    now += 50000;
    assert.strictEqual(await b.reviveGame(), true);
    assert.deepStrictEqual(actions(), [5, 2, 4], 'revival resumes the same entry');
    const record = resume.read().record;
    b.installSoloResume(record);
    assert.deepStrictEqual(actions(), [5, 2, 4], 'same-process journal install does not duplicate revive');
    now += 6000; end(b, true);
    assert.strictEqual(events.at(-1).levelTime, 10, 'same-process revival retains pre-failure active time');
    b.backToMenu(); assert.strictEqual(events.at(-1).levelResult, 1, 'winning return is not abandonment');

    setup(); const c = app(); c.startGame(1); end(c, false);
    await c.leaveSoloResult(() => c.startGame(1));
    assert.deepStrictEqual(actions(), [5, 2, 3, 5]);
    assert.strictEqual(events.at(-1).loginCount, 2);
    c.backToMenu(); c.backToMenu();
    assert.deepStrictEqual(actions(), [5, 2, 3, 5, 6], 'explicit abandonment closes once');

    for (const method of ['joinBattle', 'startBattle']) {
        setup(); const switching = app(); switching.startGame(1); end(switching, false);
        if (method === 'joinBattle') {
            joinOk = false; switching.joinBattle('R12345678abcdef1234'); await flush();
            assert.deepStrictEqual(actions(), [5, 2], 'failed PvP takeover retains the ordinary result');
            joinOk = true;
        }
        switching[method]('R12345678abcdef1234'); await flush();
        assert.strictEqual(switching.state, 'battle_wait');
        assert.deepStrictEqual(actions(), [5, 2, 6], 'successful PvP takeover retires ordinary result');
        switching.battleCancel(); switching.startGame(1);
        assert.deepStrictEqual(actions(), [5, 2, 6, 5], 'later ordinary entry is not a stale retry');
    }

    setup(); const d = app(); d.startGame(1); now += 3000; end(d, false);
    await d.reviveGame(); now += 2000; d.handleHide();
    const saved = resume.read().record, before = events.length;
    now += 500000;
    const cold = app(); assert.strictEqual(await cold.restoreSoloResume(saved), true);
    assert.strictEqual(events.length, before, 'cold resume does not invent an entry or another revive');
    now += 7000; end(cold, true);
    assert.strictEqual(events.at(-1).levelResult, 1);
    assert(!('levelTime' in events.at(-1)), 'uncertain cross-process duration is omitted');

    setup(); const suspended = app(); suspended.startGame(1); end(suspended, false);
    await suspended.reviveGame(); end(suspended, false);
    const resumable = clone(resume.read().record);
    suspended.joinBattle('R12345678abcdef1234'); await flush(); suspended.battleCancel();
    assert.deepStrictEqual(resume.read().record, resumable, 'statistics cannot change recoverable gameplay journal');
    assert.deepStrictEqual(actions(), [5, 2, 4, 2], 'recoverable PvP detour is not permanent abandonment');
    assert.strictEqual(await suspended.restoreSoloResume(resume.read().record), true);
    await suspended.reviveGame(); end(suspended, true);
    assert.deepStrictEqual(actions(), [5, 2, 4, 2, 4, 1]);

    for(const enabled of [true,false]){
        setup();const paused=app(enabled);paused.startGame(1);
        const started=paused.soloRunStartedAt,core=paused.core;
        now+=5000;paused.openSoloSettings();now+=120000;paused.resumeSoloSettings();
        now+=5000;paused.openSoloSettings();
        let modal;global.wx.showModal=options=>{modal=options;};paused.exitSoloSettings();
        now+=60000;modal.success({confirm:false});modal.complete();
        assert.strictEqual(paused.core,core);assert.strictEqual(paused.soloRunStartedAt,started,'settings must retain the original run identity');
        now+=5000;end(paused,true);
        const local=disk.match3_analytics_v1.filter(e=>e.event==='solo_complete').at(-1);
        assert.strictEqual(local.durationBucket,'lt_30s','local diagnostics exclude repeated settings and cancelled-exit pause time');
        if(enabled)assert.strictEqual(events.at(-1).levelTime,15);
    }
    setup();const journal=app();journal.startGame(1);end(journal,false);await journal.reviveGame();
    const runId=resume.read().record.id;
    now+=5000;journal.openSoloSettings();now+=120000;journal.resumeSoloSettings();
    const savedPause=resume.read();assert(savedPause.ok);assert.strictEqual(savedPause.record.id,runId);
    assert.strictEqual(savedPause.record.meta.settingsPausedMs,120000,'pause accounting survives the real journal checkpoint');
    journal.installSoloResume(savedPause.record);now+=5000;end(journal,true);
    assert.strictEqual(disk.match3_analytics_v1.filter(e=>e.event==='solo_complete').at(-1).durationBucket,'lt_30s');
    const invalidPause=clone(resume.read().record);invalidPause.meta.settingsPausedMs=-1;disk[resume.KEY]=invalidPause;
    assert.strictEqual(resume.read().ok,false,'invalid persisted pause duration cannot silently enter a run');
    for(const failAfterWrite of [false,true]){
        setup();const recovering=app();recovering.startGame(1);end(recovering,false);await recovering.reviveGame();
        const original=resume.read().record,startedAt=recovering.soloRunStartedAt;
        const hearts=clone(disk.match3_heart_v1),coins=disk.match3_coin_v1,items=clone(disk.match3_items_v1);
        now+=5000;recovering.openSoloSettings();now+=120000;
        const write=global.wx.setStorageSync;let failed=false;
        global.wx.setStorageSync=(key,value)=>{
            if(key===resume.KEY&&!failed){
                failed=true;if(failAfterWrite)write(key,value);
                throw new Error('test pause checkpoint failure');
            }
            write(key,value);
        };
        try { recovering.resumeSoloSettings(); } finally { global.wx.setStorageSync=write; }
        assert(failed);assert(recovering.soloResumeSaveFailed);assert.strictEqual(recovering.state,'solo_settings');
        assert(recovering.core.timerPaused,'failed save cannot resume gameplay');
        now+=5000;
        const restore=recovering.restoreSoloResume;let retried;
        recovering.restoreSoloResume=function(record){return retried=restore.call(this,record);};
        recovering.retrySoloResume();assert.strictEqual(await retried,true);
        const recovered=resume.read();assert(recovered.ok);assert.strictEqual(recovered.record.id,original.id);
        assert.strictEqual(recovering.soloRunStartedAt,startedAt);
        assert.strictEqual(recovered.record.meta.settingsPausedMs,125000,
            'same-run retry preserves unsaved pause time without double-counting a write-then-throw');
        assert.strictEqual(recovering.state,'playing');assert(!recovering.soloResumeSaveFailed);
        assert.deepStrictEqual(disk.match3_heart_v1,hearts);assert.strictEqual(disk.match3_coin_v1,coins);
        assert.deepStrictEqual(disk.match3_items_v1,items);
        now+=5000;end(recovering,true);
        assert.strictEqual(disk.match3_analytics_v1.filter(e=>e.event==='solo_complete').at(-1).durationBucket,'lt_30s',
            'pause checkpoint recovery must not turn settings wait into play duration');
        assert.strictEqual(events.at(-1).levelTime,10);
    }
    setup(); const disabled = app(false); disabled.startGame(1); end(disabled, false);
    await disabled.reviveGame(); end(disabled, true);
    assert.deepStrictEqual(events, []);
    assert(!Object.keys(disk).some(key => key.startsWith('match3_level_analytics_')));
    setup(); failReport = true; const failing = app(); failing.startGame(1); end(failing, true);
    assert.strictEqual(failing.state, 'result'); assert.strictEqual(failing.result.win, true);
    assert(failing.progress.unlockedLevel >= 2, 'SDK failure cannot interrupt progression/rewards');
    assert.strictEqual(failing.levelReporter.diagnostics().failed, 2);
    console.log('PASS real Main level analytics: board entry, timing, repeat results, revive/retry, journal restore, navigation, disabled and SDK failure');
})().catch(error => { console.error(error); process.exitCode = 1; });
