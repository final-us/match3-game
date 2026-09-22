'use strict';

// Real Main + platform adapters; fake clock/SDK only. No account, network or real saves.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.resolve(__dirname, '../js');
const mainRequire = require('module').createRequire(path.join(root, 'main.js'));
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(profileMode) {
    const requests = [], events = [], notices = [], timers = new Map(), seen = new Set();
    const stats = { frames: 0, buttons: 0, guides: 0, destroys: 0 };
    let timerId = 0, tap;
    const analytics = {
        track(event, data) { events.push({ event, data }); },
        trackOnce(event, data, key) { if (!seen.has(key)) { seen.add(key); this.track(event, data); } }
    };
    const wx = {
        getAccountInfoSync: () => ({ miniProgram: { envVersion: 'release' } }),
        getStorageSync() { if (profileMode === 'read') throw new Error('PRIVATE'); return null; },
        setStorageSync() { if (profileMode === 'write') throw new Error('PRIVATE'); },
        createImage() { if (profileMode === 'image') throw new Error('PRIVATE'); return {}; },
        createUserInfoButton() {
            stats.buttons++;
            if (profileMode === 'create') throw new Error('PRIVATE');
            if (profileMode === 'empty') return null;
            return {
                onTap(handler) { if (profileMode === 'tap') throw new Error('PRIVATE'); tap = handler; },
                destroy() { stats.destroys++; if (profileMode === 'destroy') throw new Error('PRIVATE'); }
            };
        },
        showToast: options => notices.push(options.title),
        cloud: { callFunction: options => requests.push(options) }
    };
    const overrides = { './core/analytics': analytics, '../core/analytics': analytics,
        './audio': new Proxy({}, { get: () => () => {} }),
        './core/runtime': { maybePromptUpdate() {} },
        './render/battle-ui': { drawWait: () => ({ avatar: { x: 10, y: 10, w: 60, h: 60 } }) },
        './render/onboarding': { draw() { stats.guides++; return { confirm: {} }; }, hitTest: () => true }
    };
    function load(file) {
        const module = { exports: {} };
        vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), {
            module, wx, Date,
            setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
            clearTimeout: id => timers.delete(id), clearInterval() {},
            requestAnimationFrame() { stats.frames++; },
            require: name => overrides[name] || mainRequire(name)
        }, { filename: file });
        return module.exports;
    }
    const cloud = overrides['./net/cloud-battle'] = load('net/cloud-battle.js');
    const profile = overrides['./platform/user-profile'] = load('platform/user-profile.js');
    const Main = load('main.js');
    const app = Object.create(Main.prototype);
    Object.assign(app, { state: 'battle_wait', runtimeState: 'battle_wait', audioScene: 'battle',
        lastTime: Date.now(), guide: null, guideQueue: [], effectSeen: 0, castSeen: 0 });
    app.battle = app.newBattleState(true);
    app.battle.roomId = 'R12345678abcdef0123';
    return { app, cloud, profile, requests, events, notices, timers, stats, wx,
        tap: result => tap(result),
        timeout() {
            const [id, timer] = timers.entries().next().value;
            assert.strictEqual(timer.ms, 8000);
            timers.delete(id); timer.fn();
        },
        success(index, result) { requests[index].success({ result }); },
        fail(index) { requests[index].fail({ errMsg: 'network PRIVATE', openid: 'PRIVATE' }); }
    };
}

(async () => {
    for (const mode of ['create', 'tap', 'empty']) {
        const f = fixture(mode);
        f.app.guide = { key: 'pvp_wait' }; f.app.guideButtons = null;
        for (let i = 0; i < 60; i++) f.app.loop();
        assert.strictEqual(f.stats.frames, 60, mode + ': frame loop survives');
        assert.strictEqual(f.stats.guides, 60, mode + ': guide remains visible');
        assert(f.app.guideButtons.confirm);
        assert.strictEqual(f.stats.buttons, 1, 'no per-frame retries');
        assert.strictEqual(f.profile.canChangeAvatar(), false);
        assert.strictEqual(f.events.length, 1, 'bounded fixed diagnostic');
        assert(!JSON.stringify(f.events).includes('PRIVATE'));
        let dismissed = false;
        f.app.dismissGuide = () => { dismissed = true; };
        f.app.handleGuideTouch(10, 10);
        assert(dismissed, 'guide can be dismissed after avatar failure');
        f.app.battleAdjustItem('freeze', 1);
        f.success(0, { ok: true, items: { freeze: 2, disturb: 1 } }); await flush();
        assert.strictEqual(f.app.battle.items.freeze, 2, 'items still work after optional failure');
    }
    {
        const f = fixture('destroy'); f.app.loop();
        f.profile.destroyButton(); f.profile.destroyButton(); f.app.loop();
        assert.strictEqual(f.stats.destroys, 1);
        assert.strictEqual(f.stats.buttons, 1);
        assert.strictEqual(f.stats.frames, 2);
    }
    for (const mode of ['read', 'write', 'image']) {
        const f = fixture(mode); f.profile.init(); f.app.loop();
        f.tap({ userInfo: { avatarUrl: 'https://example.com/avatar.png' } });
        f.app.loop();
        assert.strictEqual(f.stats.frames, 2);
        assert(!JSON.stringify(f.events).includes('PRIVATE'));
    }
    {
        const f = fixture(); f.app.loop(); f.profile.destroyButton();
        f.wx.setStorageSync = () => { throw new Error('stale tap must not save'); };
        f.tap({ userInfo: { avatarUrl: 'https://example.com/avatar.png' } });
        assert.strictEqual(f.events.length, 0);
    }
    for (const action of ['items', 'ready']) {
        const f = fixture(), b = f.app.battle;
        const invoke = () => action === 'items' ? f.app.battleAdjustItem('freeze', 1) : f.app.battleReady();
        invoke(); invoke(); f.app.pollRoom();
        assert.strictEqual(f.requests.length, 1, 'one pending mutation, no overlapping query');
        assert.strictEqual(b.pendingAction, action);
        f.timeout(); await flush();
        assert.strictEqual(b.actionPending, false);
        assert.strictEqual(b.offline, true);
        assert(f.notices[0].includes('同步超时'));
        assert.strictEqual(b.items.freeze, 1, 'unconfirmed result must not be displayed');
        f.success(0, { ok: true, ready: true, items: { freeze: 3, disturb: 0 } }); await flush();
        assert.strictEqual(b.items.freeze, 1, 'late mutation callback ignored');
        assert.strictEqual(b.myReady, false);
        invoke();
        assert.strictEqual(f.requests[1].data.action, 'query', 'reconcile, never replay timed-out mutation');
        f.success(1, { ok: true, status: 'waiting', myReady: false, myItems: { freeze: 2, disturb: 1 } }); await flush();
        assert.strictEqual(b.offline, false);
        assert.strictEqual(b.items.freeze, 2);
        invoke();
        assert.strictEqual(f.requests[2].data.action, action === 'items' ? 'configureItems' : 'ready');
        f.success(2, { ok: true, ready: true, items: { freeze: 3, disturb: 0 } }); await flush();
        assert.strictEqual(b.actionPending, false);
        assert.strictEqual(f.timers.size, 0);
    }
    {
        const f = fixture(), b = f.app.battle;
        f.app.pollRoom(); f.timeout(); await flush();
        assert.strictEqual(b.pollPending, false); assert.strictEqual(b.offline, true);
        f.app.pollRoom();
        f.success(0, { ok: true, myItems: { freeze: 3, disturb: 0 } }); await flush();
        assert.strictEqual(b.pollPending, true, 'old callback cannot clear new query');
        f.success(1, { ok: true, status: 'waiting', myItems: { freeze: 1, disturb: 2 } }); await flush();
        assert.strictEqual(b.offline, false); assert.strictEqual(f.timers.size, 0);
    }
    {
        const f = fixture(); f.app.pollRoom(); f.app.battleAdjustItem('freeze', 1);
        f.success(1, { ok: true, items: { freeze: 2, disturb: 1 } }); await flush();
        f.fail(0); await flush();
        assert.strictEqual(f.app.battle.offline, false, 'old query failure cannot undo newer success');
    }
    for (const result of [null, { ok: false, err: '服务异常' }]) {
        const f = fixture(); f.app.battleAdjustItem('freeze', 1);
        if (result) f.success(0, result); else f.fail(0);
        await flush();
        assert.strictEqual(f.app.battle.actionPending, false);
        assert.strictEqual(f.app.battle.offline, true);
        assert(f.notices[0].includes('尚未确认'));
        assert.strictEqual(f.timers.size, 0);
        assert(!JSON.stringify(f.events).includes('PRIVATE'));
    }
    {
        const f = fixture(); f.app.battleAdjustItem('freeze', 1);
        f.app.battleCancel(); f.timeout(); await flush();
        assert.strictEqual(f.app.state, 'menu'); assert.strictEqual(f.app.battle, null);
        assert.strictEqual(f.notices.length, 0, 'no late room notice after leaving');
        f.success(0, { ok: true, items: { freeze: 3, disturb: 0 } });
        f.success(1, { ok: true }); await flush();
        assert.strictEqual(f.app.battle, null);
    }
    {
        const f = fixture(); f.wx.cloud.callFunction = () => { throw new Error('PRIVATE'); };
        const error = await f.cloud.call('query', {}, { timeoutMs: 8000 }).catch(e => e);
        assert(error.battleDiagnostic); assert.strictEqual(f.timers.size, 0);
        assert(!JSON.stringify(error).includes('PRIVATE'));
    }
    {
        const f = fixture();
        f.app.battleCancel();
        assert.strictEqual(f.timers.size, 1, 'leave is bounded too');
        f.app.battle = f.app.newBattleState(true); f.app.battle.roomId = 'R12345678bbbbbbbbbb';
        f.app.state = 'battle_wait'; f.app.battleCancel();
        f.success(1, { ok: true }); await flush();
        f.fail(0); await flush();
        assert.strictEqual(f.notices.length, 0, 'old exit cannot notify after a newer room exits');
        assert.strictEqual(f.timers.size, 0);
    }
    console.log('battle wait resilience: passed (avatar isolation, bounded waits, reconciliation, stale callbacks)');
})().catch(error => { console.error(error); process.exitCode = 1; });
