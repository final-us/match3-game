'use strict';

// Real Main + runtime adapter, mocked WeChat only; no cloud/account/storage access.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { createRequire } = require('module');
const mainFile = require.resolve('../js/main');
const runtimeFile = require.resolve('../js/core/runtime');
const realRequire = createRequire(mainFile);
const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(open, battleClient, environment) {
    const events = [];
    const toasts = [];
    const diagnostics = [];
    const timers = new Map();
    let nextTimer = 0;
    const wx = { showToast: options => toasts.push(options.title) };
    if (environment) {
        wx.getAccountInfoSync = () => ({ miniProgram: { envVersion: environment.channel } });
        wx.getDeviceInfo = () => ({ platform: environment.platform });
    }
    if (open) wx.openPrivacyContract = open;
    const analytics = { track: (event, properties) => events.push({ event, properties }) };
    const runtimeModule = { exports: {} };
    vm.runInNewContext(fs.readFileSync(runtimeFile, 'utf8'), {
        module: runtimeModule, wx, require: () => analytics,
        console: { info: text => diagnostics.push(text) },
        setTimeout: (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
        clearTimeout: id => timers.delete(id)
    }, { filename: runtimeFile });
    const mainModule = { exports: {} };
    vm.runInNewContext(fs.readFileSync(mainFile, 'utf8'), {
        module: mainModule, wx, Date,
        require(name) {
            if (name === './core/runtime') return runtimeModule.exports;
            if (name === './core/analytics') return analytics;
            if (name === './audio') return { unlock() {}, click() {}, invalid() {} };
            if (name === './net/cloud-battle' && battleClient) return battleClient;
            return realRequire(name);
        }
    }, { filename: mainFile });
    const app = Object.create(mainModule.exports.prototype);
    Object.assign(app, { state: 'settings', guide: null, battleCreating: false,
        privacyRequest: null, privacyOffset: 120, privacyTouch: {}, privacyButtons: {},
        settingsButtons: { privacy: { x: 0, y: 0, w: 44, h: 44 }, back: { x: 60, y: 0, w: 44, h: 44 } } });
    const tap = key => {
        const rect = app.settingsButtons[key];
        app.handleTouchStart({ touches: [{ clientX: rect.x + 22, clientY: 22 }] });
    };
    const expire = () => {
        for (const [id, timer] of [...timers]) { timers.delete(id); timer.fn(); }
    };
    return { app, events, toasts, wx, tap, timers, expire, diagnostics, runtime: runtimeModule.exports };
}

(async () => {
    {
        const requests = [];
        const f = fixture(options => { requests.push(options); });
        f.tap('privacy');
        assert.strictEqual(f.timers.size, 1, '无回调必须有有限等待保护');
        assert.strictEqual([...f.timers.values()][0].ms, 5000);
        assert(f.app.privacyRequest);
        f.expire();
        assert.strictEqual(f.app.state, 'privacy', '无回调超时后必须可以阅读本地协议');
        assert.strictEqual(f.app.privacyRequest, null, '超时释放点击锁');
        assert.strictEqual(f.events[0].properties.category, 'timeout');
        f.app.state = 'settings'; f.tap('privacy');
        requests[0].success(); requests[0].fail();
        assert(f.app.privacyRequest, '超时后的迟到回调不能干扰新请求');
        requests[1].success();
        assert.strictEqual(f.timers.size, 0, '成功清理超时任务');
    }
    {
        const f = fixture(() => {});
        f.tap('privacy'); f.tap('back'); f.expire();
        assert.strictEqual(f.app.state, 'menu', '离开页面后的超时不能切页');
    }
    for (const open of [undefined, () => { throw new Error('private failure'); },
        options => options.fail({ errMsg: 'private failure' }),
        () => Promise.reject(new Error('private failure'))]) {
        const f = fixture(open);
        f.tap('privacy');
        await flush();
        assert.strictEqual(f.app.state, 'privacy');
        assert.strictEqual(f.app.privacyOffset, 0);
        assert.strictEqual(f.app.privacyRequest, null);
        assert.strictEqual(f.app.privacyTouch, null);
        assert.strictEqual(f.app.privacyButtons, null);
        assert.strictEqual(f.toasts.length, 0, '回退可阅读页面，不显示不可用死路提示');
        assert.strictEqual(f.events.length, 1);
        assert.strictEqual(f.timers.size, 0, '失败清理超时任务');
        assert(!JSON.stringify(f.events).includes('private failure'));
    }
    for (const open of [options => options.success(), options => { options.success(); return Promise.resolve(); }]) {
        const f = fixture(open);
        f.tap('privacy'); await flush();
        assert.strictEqual(f.app.state, 'settings', '官方打开成功不进入本地页');
        assert.strictEqual(f.app.privacyRequest, null);
        assert.strictEqual(f.events[0].event, 'privacy_opened');
        assert.strictEqual(f.timers.size, 0, '成功清理超时任务');
    }
    {
        const f = fixture(() => Promise.resolve());
        f.tap('privacy'); await flush();
        assert(f.app.privacyRequest, '非官方Promise完成不能冒充打开成功');
        assert.strictEqual(f.events.length, 0);
        f.expire();
        assert.strictEqual(f.app.state, 'privacy');
        assert.strictEqual(f.events[0].properties.category, 'timeout');
    }
    for (const environment of [
        { channel: 'develop', platform: 'ios', enabled: true },
        { channel: '', platform: 'devtools', enabled: true },
        { channel: 'release', platform: 'devtools', enabled: false },
        { channel: 'trial', platform: 'devtools', enabled: false },
        { channel: '', platform: 'ios', enabled: false }
    ]) {
        const f = fixture(options => options.fail({ errMsg: 'private detail' }), undefined, environment);
        f.runtime.init('settings'); f.tap('privacy');
        assert.strictEqual(f.diagnostics.length > 0, environment.enabled);
        if (environment.enabled) assert.deepStrictEqual(f.diagnostics, [
            '[privacy-P3] loaded', '[privacy-P3] settings_touch', '[privacy-P3] button_hit',
            '[privacy-P3] request', '[privacy-P3] callback_fail', '[privacy-P3] local_fallback'
        ]);
        assert(!f.diagnostics.join('').includes('private detail'));
    }
    {
        const requests = [];
        const f = fixture(options => { requests.push(options); });
        f.tap('privacy'); f.tap('privacy');
        assert.strictEqual(requests.length, 1, '等待期间不能重复打开');
        requests[0].success(); requests[0].fail();
        assert.strictEqual(f.app.state, 'settings');
        assert.strictEqual(f.events.length, 1, '重复回调只结算一次');
        f.tap('privacy');
        assert.strictEqual(requests.length, 2, '完成后允许再次阅读');
    }
    {
        let pending;
        const f = fixture(options => { pending = options; options.success(); return Promise.reject(new Error('late')); });
        f.tap('privacy'); await flush(); pending.fail();
        assert.strictEqual(f.app.state, 'settings');
        assert.strictEqual(f.events.length, 1, 'callback与Promise竞态不反转结果');
    }
    {
        const requests = [];
        const f = fixture(options => { requests.push(options); });
        f.tap('privacy'); f.tap('back');
        assert.strictEqual(f.app.state, 'menu');
        f.app.state = 'settings'; f.tap('privacy');
        requests[0].fail();
        assert.strictEqual(f.app.state, 'settings');
        assert(f.app.privacyRequest, '旧失败不能清掉新的请求');
        requests[1].fail();
        assert.strictEqual(f.app.state, 'privacy');
    }
    for (const scenario of ['other-page', 'joining']) {
        let pending;
        const f = fixture(options => { pending = options; });
        f.tap('privacy');
        if (scenario === 'other-page') f.app.state = 'battle_wait';
        else f.app.battleCreating = true;
        pending.fail();
        assert.strictEqual(f.app.state, scenario === 'other-page' ? 'battle_wait' : 'settings');
        assert.strictEqual(f.app.privacyRequest, null);
    }
    for (const outcome of ['invalid', 'failure', 'rejection']) {
        let pending;
        const f = fixture(options => { pending = options; }, {
            isValidRoomId: () => outcome !== 'invalid',
            call: () => outcome === 'rejection' ? Promise.reject(new Error('network')) :
                Promise.resolve({ ok: false, err: '房间不存在' })
        });
        const notices = [];
        f.app.showBattleNotice = message => notices.push(message);
        f.tap('privacy');
        f.app.joinBattle('test-invite');
        await flush();
        assert.strictEqual(notices.length, 1, '真实入房失败流程应保留提示');
        assert.strictEqual(f.app.battleCreating, false);
        pending.fail();
        assert.strictEqual(f.app.state, 'settings', '入房失败后的旧协议回调不能切换页面');
        assert.strictEqual(f.app.privacyRequest, null);
        f.tap('privacy'); pending.fail();
        assert.strictEqual(f.app.state, 'privacy', '邀请结束后仍可重新打开协议');
    }
    console.log('privacy entry: official success, offline fallback, throw/rejection, dedup, stale callback and invite safety passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
