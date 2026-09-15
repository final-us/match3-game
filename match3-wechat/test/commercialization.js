/** 商业化基础设施最小回归测试。 */

const assert = require('assert');

const storage = {};
let interstitialClose = null;
let interstitialShowCount = 0;
let rewardedClose = null;
const reportedEvents = [];
const reportedMonitors = [];
let remoteShouldFail = false;

global.wx = {
    getStorageSync: function (key) { return storage[key]; },
    setStorageSync: function (key, value) { storage[key] = value; },
    createRewardedVideoAd: function () {
        return {
            onClose: function (fn) { rewardedClose = fn; },
            onError: function () {},
            show: function () { return Promise.resolve(); },
            load: function () { return Promise.resolve(); }
        };
    },
    createInterstitialAd: function () {
        return {
            onClose: function (fn) { interstitialClose = fn; },
            onError: function () {},
            show: function () {
                interstitialShowCount++;
                return Promise.resolve();
            }
        };
    },
    reportEvent: function (eventId, params) {
        if (remoteShouldFail) throw new Error('remote failure');
        reportedEvents.push({ eventId: eventId, params: params });
    },
    reportMonitor: function (name, value) {
        if (remoteShouldFail) throw new Error('remote failure');
        reportedMonitors.push({ name: name, value: value });
    }
};

const config = require('../js/core/config');
const analytics = require('../js/core/analytics');
const ad = require('../js/core/ad');

async function checkAdFailureRecovery() {
    const oldWx = global.wx;
    const adPath = require.resolve('../js/core/ad');
    const oldModule = require.cache[adPath];
    const unhandled = [];
    const onUnhandled = function (error) { unhandled.push(error); };
    process.on('unhandledRejection', onUnhandled);
    const flush = function () { return new Promise(function (resolve) { setImmediate(resolve); }); };
    try {
        for (const format of ['rewarded', 'interstitial']) {
            for (const failure of ['event_then_reject', 'show_throw', 'load_throw']) {
                if (format === 'interstitial' && failure === 'load_throw') continue;
                const instances = [];
                const store = {};
                global.wx = {
                    getStorageSync: function (key) { return store[key]; },
                    setStorageSync: function (key, value) { store[key] = value; }
                };
                global.wx[format === 'rewarded' ? 'createRewardedVideoAd' : 'createInterstitialAd'] = function () {
                    const first = instances.length === 0;
                    const instance = {
                        onClose: function (fn) { this.close = fn; },
                        onError: function (fn) { this.error = fn; },
                        show: function () {
                            if (!first) return Promise.resolve();
                            if (failure === 'show_throw') throw new Error('show unavailable');
                            if (failure === 'event_then_reject') this.error({ errCode: 1003 });
                            return Promise.reject(new Error('show failed'));
                        },
                        load: function () { throw new Error('load failed'); }
                    };
                    instances.push(instance);
                    return instance;
                };
                delete require.cache[adPath];
                const isolatedAd = require('../js/core/ad');
                const show = function () {
                    if (format === 'rewarded') return isolatedAd.showRewarded('revive');
                    store[isolatedAd.INTERSTITIAL_STORAGE_KEY] = { completedGames: 2, lastShownAt: 0 };
                    return isolatedAd.onSoloResultExit();
                };
                let outcome = 'pending';
                show().then(function (value) { outcome = value; }, function () { outcome = 'rejected'; });
                await flush();
                assert.strictEqual(outcome, false, format + '/' + failure + '应安全返回失败而非抛错或挂起');
                assert.strictEqual(unhandled.length, 0, format + '/' + failure + '不得产生未处理拒绝');
                const next = show();
                let nextOutcome = 'pending';
                next.then(function (value) { nextOutcome = value; });
                instances[0].close({ isEnded: true });
                instances[0].error({ errCode: 1003 });
                await flush();
                assert.strictEqual(nextOutcome, 'pending', format + '旧广告回调不得结算新请求');
                instances[1].close({ isEnded: true });
                assert.strictEqual(await next, true, format + '失败后下一次请求应可恢复');
            }
        }
    } finally {
        global.wx = oldWx;
        require.cache[adPath] = oldModule;
        process.removeListener('unhandledRejection', onUnhandled);
    }
}

async function run() {
    const originalNow = Date.now;
    let now = 1000000;
    Date.now = function () { return now; };

    try {
        config.REPORTING_CONFIG.enabled = false;
        config.REPORTING_CONFIG.eventIds = {};
        config.REPORTING_CONFIG.monitorNames = {};
        analytics.clear();
        config.AD_CONFIG.enabled = false;
        config.AD_CONFIG.debugMockAds = false;
        config.AD_CONFIG.rewardedAdUnitId = '';
        config.AD_CONFIG.interstitialAdUnitId = '';

        assert.strictEqual(ad.isRewardedAvailable(), false, '空 ID 时广告入口必须隐藏');
        assert.strictEqual(await ad.showRewarded('revive'), false, '空 ID 时不得模拟完成或发奖励');

        config.AD_CONFIG.debugMockAds = true;
        assert.strictEqual(ad.isRewardedAvailable(), true, '显式 debug 开关应允许联调');
        assert.strictEqual(ad.isRealRewardedAvailable(), false, 'debug mock 不得被视为真实激励广告');
        assert.strictEqual(await ad.showRewarded('shop_item', { allowMock: false }), false,
            '商店禁止 mock 时不得模拟完成或发奖');
        assert.strictEqual(await ad.showRewarded('revive'), true, 'debug 模拟应完成激励视频');
        ad.markRewardGranted('revive');
        assert(analytics.getEvents().some(function (item) { return item.event === 'ad_reward_granted'; }));

        config.AD_CONFIG.debugMockAds = false;
        config.AD_CONFIG.enabled = true;
        config.AD_CONFIG.rewardedAdUnitId = 'test-rewarded';
        assert.strictEqual(ad.isRealRewardedAvailable(), true, '真实广告配置且运行时可创建时应可用');
        const cancelled = ad.showRewarded('revive');
        rewardedClose({ isEnded: false });
        assert.strictEqual(await cancelled, false, '提前关闭激励视频不得发奖励');
        const completed = ad.showRewarded('revive');
        rewardedClose({ isEnded: true });
        assert.strictEqual(await completed, true, '完整观看激励视频应允许发奖励');

        assert.strictEqual(Object.prototype.hasOwnProperty.call(config.AD_CONFIG, 'reviveLimitPerGame'), false, '复活不应有单局上限');
        assert.strictEqual(Object.keys(config.AD_CONFIG).some(function (key) { return /banner/i.test(key); }), false, '不得保留 Banner 配置');

        config.AD_CONFIG.interstitialAdUnitId = 'test-interstitial';
        storage[ad.INTERSTITIAL_STORAGE_KEY] = { completedGames: 0, lastShownAt: 0 };

        assert.strictEqual(await ad.onSoloResultExit(), false, '第1局不应展示插屏');
        assert.strictEqual(await ad.onSoloResultExit(), false, '第2局不应展示插屏');
        const third = ad.onSoloResultExit();
        assert.strictEqual(interstitialShowCount, 1, '第3局应尝试展示插屏');
        interstitialClose();
        assert.strictEqual(await third, true, '关闭插屏后应恢复导航');

        await ad.onSoloResultExit();
        await ad.onSoloResultExit();
        assert.strictEqual(await ad.onSoloResultExit(), false, '120秒内应被频控');
        assert.strictEqual(interstitialShowCount, 1, '频控期间不得再次展示');

        now += config.AD_CONFIG.interstitialCooldownMs + 1;
        const afterCooldown = ad.onSoloResultExit();
        assert.strictEqual(interstitialShowCount, 2, '冷却后应重新展示到期插屏');
        interstitialClose();
        await afterCooldown;

        analytics.clear();
        for (let i = 0; i < analytics.MAX_EVENTS + 5; i++) {
            analytics.track('test_event', { count: i, nickname: '不得保存', deviceId: '不得保存' });
        }
        const capped = analytics.getEvents();
        assert.strictEqual(capped.length, analytics.MAX_EVENTS, '本地事件必须裁剪为200条');
        assert.strictEqual(Object.prototype.hasOwnProperty.call(capped[0], 'nickname'), false, '不得保存昵称');
        assert.strictEqual(Object.prototype.hasOwnProperty.call(capped[0], 'deviceId'), false, '不得保存设备标识');

        storage[analytics.STORAGE_KEY] = [
            { event: 'old_event', timestamp: now - analytics.RETENTION_MS - 1 },
            { event: 'recent_event', timestamp: now }
        ];
        assert.deepStrictEqual(analytics.getEvents().map(function (item) { return item.event; }), ['recent_event'], '必须清理7天前事件');

        reportedEvents.length = 0;
        reportedMonitors.length = 0;
        remoteShouldFail = false;
        analytics.clear();
        analytics.track('test_event', { count: 1, nickname: '不得上传', deviceId: '不得上传' });
        assert.strictEqual(reportedEvents.length, 0, '默认配置不得远程上报');

        config.REPORTING_CONFIG.enabled = true;
        config.REPORTING_CONFIG.eventIds = { test_event: 'event_test' };
        config.REPORTING_CONFIG.monitorNames = { runtime_error: 'monitor_runtime_error' };
        const tracked = analytics.track('test_event', {
            count: 2,
            nickname: '不得上传',
            deviceId: '不得上传'
        });
        assert(tracked && reportedEvents.length === 1, '显式启用且存在映射才上报');
        assert.strictEqual(reportedEvents[0].eventId, 'event_test');
        assert.strictEqual(Object.prototype.hasOwnProperty.call(reportedEvents[0].params, 'nickname'), false, '远程不得带昵称');
        assert.strictEqual(Object.prototype.hasOwnProperty.call(reportedEvents[0].params, 'deviceId'), false, '远程不得带设备标识');
        assert.strictEqual(analytics.reportMonitor('runtime_error', 3), true);
        assert.deepStrictEqual(reportedMonitors[0], { name: 'monitor_runtime_error', value: 3 });

        remoteShouldFail = true;
        assert(analytics.track('test_event', { count: 4 }), '远程失败不得影响本地 track');

        await checkAdFailureRecovery();
        console.log('商业化基础设施测试通过');
    } finally {
        config.REPORTING_CONFIG.enabled = false;
        config.REPORTING_CONFIG.eventIds = {};
        config.REPORTING_CONFIG.monitorNames = {};
        Date.now = originalNow;
        delete global.wx;
    }
}

run().catch(function (err) {
    console.error(err);
    process.exit(1);
});
