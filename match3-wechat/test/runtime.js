'use strict';

/** 运行时适配最小回归：错误脱敏、更新时机/去重与官方隐私入口。 */

const assert = require('assert');
const config = require('../js/core/config');
const RUNTIME_MODULE = require.resolve('../js/core/runtime');

function resetReporting() {
    config.REPORTING_CONFIG.enabled = false;
    config.REPORTING_CONFIG.eventIds = {};
    config.REPORTING_CONFIG.monitorNames = {};
}

function makeWx() {
    const storage = {};
    const manager = {
        handlers: { ready: [], failed: [] },
        applyCount: 0,
        onUpdateReady: function (fn) { this.handlers.ready.push(fn); },
        onUpdateFailed: function (fn) { this.handlers.failed.push(fn); },
        applyUpdate: function () { this.applyCount++; }
    };
    const store = {
        manager: manager,
        handlers: { error: null, rejection: null },
        modals: [],
        toasts: [],
        getStorageSync: function (key) { return storage[key]; },
        setStorageSync: function (key, value) { storage[key] = value; },
        onError: function (fn) { this.handlers.error = fn; },
        onUnhandledRejection: function (fn) { this.handlers.rejection = fn; },
        getUpdateManager: function () { return manager; },
        showModal: function (options) { this.modals.push(options); },
        showToast: function (options) { this.toasts.push(options); }
    };
    return store;
}

function loadRuntime(store) {
    global.wx = store;
    delete require.cache[RUNTIME_MODULE];
    return require('../js/core/runtime');
}

let allOk = true;
function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
    } catch (e) {
        allOk = false;
        console.log('❌ ' + name + ' → ' + e.message);
    }
}

const oldWx = global.wx;
try {
    resetReporting();

    test('更新在安全场景提示，进行中延迟且取消只提示一次', function () {
        const store = makeWx();
        const runtime = loadRuntime(store);
        runtime.init('playing');
        store.manager.handlers.ready[0]();
        assert.strictEqual(store.modals.length, 0, 'playing 不得打断');
        runtime.maybePromptUpdate('battle_wait');
        assert.strictEqual(store.modals.length, 0, 'battle_wait 不得打断');
        runtime.maybePromptUpdate('menu');
        assert.strictEqual(store.modals.length, 1, '安全场景应提示更新');
        store.modals[0].success({ confirm: false });
        runtime.maybePromptUpdate('settings');
        assert.strictEqual(store.modals.length, 1, '取消后本次会话不得重复提示');
    });

    test('确认更新才 applyUpdate，失败有 toast 和本地事件', function () {
        const store = makeWx();
        const runtime = loadRuntime(store);
        runtime.init('menu');
        store.manager.handlers.ready[0]();
        assert.strictEqual(store.modals.length, 1);
        store.modals[0].success({ confirm: true });
        assert.strictEqual(store.manager.applyCount, 1, '确认后才应用更新');
        runtime.maybePromptUpdate('result');
        assert.strictEqual(store.modals.length, 1, '确认后不得重复提示');
        store.manager.handlers.failed[0]();
        assert(store.toasts.some(function (item) { return item.title.indexOf('下载失败') >= 0; }));
        assert(require('../js/core/analytics').getEvents().some(function (item) {
            return item.event === 'update_failed' && item.category === 'download';
        }));
    });

    test('分享入口优先应用已下载的新包', function () {
        const store = makeWx();
        const runtime = loadRuntime(store);
        runtime.init('menu');
        store.manager.handlers.ready[0]();
        assert.strictEqual(runtime.applyReadyUpdate(), true);
        assert.strictEqual(store.manager.applyCount, 1);
        assert.strictEqual(runtime.applyReadyUpdate(), false, '更新应用中不得重复触发');
    });

    test('分享更新以当前场景为准，不打断单人和对战', function () {
        for (const state of ['playing', 'battle_wait', 'battle_playing']) {
            const store = makeWx();
            const runtime = loadRuntime(store);
            runtime.init('menu');
            store.manager.handlers.ready[0]();
            assert.strictEqual(runtime.applyReadyUpdate(state), false, state + '不得强制重启');
            assert.strictEqual(store.manager.applyCount, 0);
        }
    });

    test('分享更新同步失败返回false，允许继续处理邀请', function () {
        const store = makeWx();
        const runtime = loadRuntime(store);
        runtime.init('menu');
        store.manager.handlers.ready[0]();
        store.manager.applyUpdate = function () { throw new Error('update unavailable'); };
        assert.strictEqual(runtime.applyReadyUpdate('menu'), false);
        assert(store.toasts.some(function (item) { return item.title.indexOf('无法应用') >= 0; }));
    });

    test('全局错误只记录类别和计数', function () {
        const store = makeWx();
        const runtime = loadRuntime(store);
        runtime.init('menu');
        store.handlers.error('原始 message', '原始 stack');
        store.handlers.rejection({ reason: '原始 reason' });
        const events = require('../js/core/analytics').getEvents().filter(function (item) {
            return item.event === 'runtime_error';
        });
        assert.strictEqual(events.length, 2);
        assert.deepStrictEqual(events.map(function (item) { return item.category; }), ['on_error', 'unhandled_rejection']);
        assert.strictEqual(events[0].count, 1);
        assert.strictEqual(JSON.stringify(events).indexOf('原始') >= 0, false, '不得保存原始错误内容');
    });

    test('隐私入口支持成功、失败和不可用提示', function () {
        const store = makeWx();
        const runtime = loadRuntime(store);
        runtime.init('settings');
        let calls = 0;
        store.openPrivacyContract = function (options) {
            calls++;
            options.success();
        };
        assert.strictEqual(runtime.openPrivacyContract(), true);
        assert.strictEqual(calls, 1);

        store.openPrivacyContract = function (options) { options.fail(); };
        assert.strictEqual(runtime.openPrivacyContract(), true);
        assert(store.toasts.length > 0, '失败时应友好提示');

        delete store.openPrivacyContract;
        assert.strictEqual(runtime.openPrivacyContract(), false);
    });
} finally {
    resetReporting();
    if (oldWx === undefined) delete global.wx; else global.wx = oldWx;
}

console.log('========================================');
console.log('运行时回归: ' + (allOk ? '全部通过 ✅' : '存在失败 ❌'));
process.exit(allOk ? 0 : 1);
