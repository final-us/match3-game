/** 微信广告适配层。配置关闭时不创建实例；本地恢复不推断观看成功。 */
const config = require('./config');
const analytics = require('./analytics');
const diagnostics = require('./ad-diagnostics')(getStore);
const INTERSTITIAL_STORAGE_KEY = 'match3_interstitial_v1';
const REQUEST_TIMEOUT_MS = 15000;
const CLOSE_TIMEOUT_MS = 180000;
const RETURN_GRACE_MS = 2000;
let pending = null;
let abandoned = null;
let hidden = false;
let interstitialMemory = null;
let interstitialStorageFailed = false;

function getStore() {
    return typeof wx !== 'undefined' ? wx : (typeof global !== 'undefined' ? global.wx : null);
}
function track(event, placement, extra) {
    analytics.track(event, Object.assign({ placement: placement,
        format: placement === 'solo_result' ? 'interstitial' : 'rewarded' }, extra));
}
function hasReal(format) {
    const store = getStore(), cfg = config.AD_CONFIG;
    return !!(cfg.enabled && store && (format === 'rewarded'
        ? cfg.rewardedAdUnitId && typeof store.createRewardedVideoAd === 'function'
        : cfg.interstitialAdUnitId && typeof store.createInterstitialAd === 'function'));
}
function isRealRewardedAvailable() { return hasReal('rewarded') && !abandoned; }
function isRewardedAvailable() { return !abandoned && (!!config.AD_CONFIG.debugMockAds || hasReal('rewarded')); }
function isBusy() { return !!pending; }
function call(instance, method) {
    try { return Promise.resolve(instance[method]()); } catch (error) { return Promise.reject(error); }
}
function detach(request) {
    for (const pair of [['offClose', 'close'], ['offError', 'error'], ['offLoad', 'loaded']]) {
        if (pair[0] === 'offLoad' && !request.loadObserved) continue;
        if (typeof request.ad[pair[0]] === 'function') {
            try { request.ad[pair[0]](request[pair[1]]); } catch (error) { /* request identity still rejects stale listeners */ }
        }
    }
}
function clearTimer(request) { clearTimeout(request.timer); request.timer = null; }
function errorCode(error) { return error && Number.isSafeInteger(error.errCode) ? error.errCode : null; }
function settle(request, reason, stage, code) {
    if (request.settled) return;
    request.settled = true;
    diagnostics.record(request, 'end_' + reason, code);
    if (request.outcome) Object.assign(request.outcome, { reason: reason, code: code == null ? null : code, stage: stage });
}
function finish(request, completed, reason, uncertain, stage, code) {
    if (pending !== request) return;
    clearTimer(request);
    pending = null;
    settle(request, reason, stage, code);
    if (uncertain) diagnostics.record(request, 'quarantine', code);
    if (uncertain) abandoned = request; else detach(request);
    track(completed ? 'ad_complete' : reason === 'cancel' ? 'ad_cancel' : 'ad_fail', request.placement, {
        reason: code == null ? reason || 'completed' : 'sdk_' + code, source: stage.toLowerCase()
    });
    request.resolve(!!completed);
}
function arm(request, delay) {
    clearTimer(request);
    request.timer = setTimeout(function () {
        if (pending !== request) return;
        // Background time cannot be used as evidence that the overlay has closed.
        if (hidden) { request.expired = true; return; }
        diagnostics.record(request, 'timeout');
        finish(request, false, 'callback_timeout', !!request.displayStarted, 'timeout');
    }, delay);
    if (request.timer && request.timer.unref) request.timer.unref();
}
function terminal(request, completed, reason, stage, code) {
    if (abandoned === request) {
        abandoned = null;
        detach(request);
        return; // A late terminal event releases quarantine, never grants a reward.
    }
    finish(request, completed, reason, false, stage, code);
}
function getRewardedBlockReason() {
    return pending ? 'pending' : abandoned ? 'awaiting_terminal' : hidden ? 'backgrounded' : !hasReal('rewarded') ? 'unavailable' : null;
}
function show(format, placement, request) {
    request = request || diagnostics.request(placement);
    const blocked = pending ? 'pending' : abandoned ? 'awaiting_terminal' : hidden ? 'backgrounded' : null;
    if (blocked) {
        settle(request, blocked, 'request');
        track('ad_frequency_blocked', placement, { reason: blocked, source: 'request' });
        return Promise.resolve(false);
    }
    const store = getStore();
    let instance;
    diagnostics.record(request, 'create');
    try {
        instance = format === 'rewarded'
            ? store.createRewardedVideoAd({ adUnitId: config.AD_CONFIG.rewardedAdUnitId, disableFallbackSharePage: true })
            : store.createInterstitialAd({ adUnitId: config.AD_CONFIG.interstitialAdUnitId });
    } catch (error) {
        const code = errorCode(error);
        settle(request, 'create_failed', 'create', code);
        diagnostics.record(request, 'create', code);
        track('ad_fail', placement, { reason: code == null ? 'create_failed' : 'sdk_' + code, source: 'create' });
        return Promise.resolve(false);
    }
    if (!instance) { settle(request, 'create_failed', 'create'); return Promise.resolve(false); }
    return new Promise(function (resolve) {
        Object.assign(request, { ad: instance, placement: placement, resolve: resolve, shown: false });
        pending = request;
        request.close = function (res) {
            if (pending !== request && abandoned !== request) return;
            diagnostics.record(request, 'close');
            if (!request.displayStarted) return;
            terminal(request, format === 'interstitial' || !!(res && res.isEnded === true),
                format === 'rewarded' && !(res && res.isEnded === true) ? 'cancel' : 'completed', 'close');
        };
        request.error = function (err) {
            if (pending !== request && abandoned !== request) return;
            const code = errorCode(err);
            diagnostics.record(request, 'onError', code);
            terminal(request, false, request.displayStarted ? 'show_failed' : 'load_failed', 'onError', code);
        };
        request.loaded = function () {
            if (pending === request || abandoned === request) diagnostics.record(request, 'onLoad');
        };
        try {
            instance.onClose(request.close);
            if (pending !== request) return;
            instance.onError(request.error);
            if (pending !== request) return;
        } catch (error) { finish(request, false, 'listener_failed', false, 'listener', errorCode(error)); return; }
        if (pending !== request) return;
        if (diagnostics.enabled()) {
            try {
                if (typeof instance.onLoad === 'function' && typeof instance.offLoad === 'function') {
                    request.loadObserved = true;
                    instance.onLoad(request.loaded);
                }
            } catch (error) { diagnostics.record(request, 'observe_failed'); }
        }
        if (pending !== request) return;
        arm(request, REQUEST_TIMEOUT_MS);
        const display = function () {
            if (pending !== request) return;
            if (format === 'rewarded') diagnostics.record(request, 'load_ok');
            if (hidden || request.loadInterrupted) { finish(request, false, 'backgrounded_before_show', false, 'load'); return; }
            request.displayStarted = true;
            diagnostics.record(request, 'show_call');
            return call(instance, 'show');
        };
        // Load before presenting. Never retry a failed native presentation automatically.
        if (format === 'rewarded') diagnostics.record(request, 'load_call');
        const attempt = format === 'rewarded' ? call(instance, 'load').then(display) : display();
        Promise.resolve(attempt).then(function () {
            if (pending !== request) return;
            request.shown = true;
            diagnostics.record(request, 'show_ok');
            track('ad_show', placement);
            arm(request, CLOSE_TIMEOUT_MS);
        }).catch(function (error) {
            if (pending !== request) return;
            const stage = request.displayStarted ? 'show' : 'load', code = errorCode(error);
            diagnostics.record(request, stage, code);
            finish(request, false, stage + '_failed', false, stage, code);
        });
    });
}
/** 完整观看才返回true，其他终态均返回false。两种格式共享一个请求锁。 */
function showRewarded(placement, options) {
    placement = placement || 'unknown';
    const request = diagnostics.request(placement);
    request.outcome = options && options.outcome;
    request.context = options && options.diagnosticContext;
    track('ad_request', placement);
    const blocked = pending ? 'pending' : abandoned ? 'awaiting_terminal' : hidden ? 'backgrounded' : null;
    if (blocked) { settle(request, blocked, 'request'); return Promise.resolve(false); }
    if (config.AD_CONFIG.debugMockAds && (!options || options.allowMock !== false)) {
        track('ad_show', placement, { source: 'debug_mock' });
        track('ad_complete', placement, { source: 'mock' });
        settle(request, 'debug_mock', 'mock');
        return Promise.resolve(true);
    }
    if (!hasReal('rewarded')) {
        track('ad_frequency_blocked', placement, { reason: 'unavailable', source: 'request' });
        settle(request, 'unavailable', 'request');
        return Promise.resolve(false);
    }
    return show('rewarded', placement, request);
}
function failureMessage(outcome) {
    outcome = outcome || {};
    const reason = outcome.reason;
    if (reason === 'cancel') return '广告已提前关闭，未获得奖励';
    if (reason === 'awaiting_terminal') return '正在等待广告关闭，请稍后再试';
    if (reason === 'pending') return '广告处理中，请稍候';
    if (reason === 'backgrounded' || reason === 'backgrounded_before_show') return '切到后台，广告已取消，请重试';
    if (reason === 'callback_timeout') return '广告回调超时，请关闭广告后重试';
    if (outcome.code === 1004) return '暂无广告，请稍后再试';
    if (reason === 'load_failed') return '广告加载失败，请稍后重试';
    if (reason === 'show_failed' || reason === 'runtime_error') return '广告展示失败，请稍后重试';
    return '广告暂不可用，请稍后再试';
}
function markRewardGranted(placement) { track('ad_reward_granted', placement || 'unknown'); }
function readInterstitialState() {
    const store = getStore();
    try {
        if (!store || !store.getStorageSync) return null;
        const value = store.getStorageSync(INTERSTITIAL_STORAGE_KEY);
        if (value == null || value === '') return interstitialMemory || { completedGames: 0, lastShownAt: 0 };
        if (!Number.isSafeInteger(value.completedGames) || value.completedGames < 0 ||
            !Number.isFinite(value.lastShownAt) || value.lastShownAt < 0) return null;
        return Object.assign({}, value);
    } catch (error) { return null; }
}
function saveInterstitialState(state) {
    interstitialMemory = Object.assign({}, state);
    try {
        const store = getStore();
        if (!store || !store.setStorageSync) return false;
        store.setStorageSync(INTERSTITIAL_STORAGE_KEY, state);
        return true;
    } catch (error) { return false; }
}
/** 频控无法可靠保存时本次会话停用插屏，但不阻断导航。 */
function onSoloResultExit() {
    if (!hasReal('interstitial') || pending || abandoned || interstitialStorageFailed) return Promise.resolve(false);
    const state = readInterstitialState();
    if (!state) return Promise.resolve(false);
    // A previous process may have closed the overlay without persisting its close time.
    // Start a conservative fresh cooldown on recovery; never reuse its start timestamp.
    if (state.awaitingClose) {
        if (!saveInterstitialState({ completedGames: 0, lastShownAt: Date.now() })) interstitialStorageFailed = true;
        return Promise.resolve(false);
    }
    state.completedGames += 1;
    if (!saveInterstitialState(state)) { interstitialStorageFailed = true; return Promise.resolve(false); }
    if (state.completedGames < config.AD_CONFIG.interstitialEveryGames ||
        (state.lastShownAt && Date.now() - state.lastShownAt < config.AD_CONFIG.interstitialCooldownMs)) return Promise.resolve(false);
    track('ad_request', 'solo_result');
    // Reserve the cooldown before showing: a crash cannot forget an outstanding impression.
    const reserved = { completedGames: state.completedGames, lastShownAt: Date.now(), awaitingClose: true };
    if (!saveInterstitialState(reserved)) { interstitialStorageFailed = true; return Promise.resolve(false); }
    return show('interstitial', 'solo_result').then(function (shown) {
        const next = shown ? { completedGames: 0, lastShownAt: Date.now() } : (abandoned ? { completedGames: state.completedGames, lastShownAt: Date.now(), awaitingClose: true } : state);
        if (!saveInterstitialState(next)) interstitialStorageFailed = true;
        return shown;
    });
}
function onHide() {
    hidden = true;
    if (pending || abandoned) diagnostics.record(pending || abandoned, 'hide');
    if (pending) { pending.wasHidden = true; if (!pending.displayStarted) pending.loadInterrupted = true; }
}
function onShow() {
    hidden = false;
    if (pending || abandoned) diagnostics.record(pending || abandoned, 'show');
    if (pending && pending.wasHidden) {
        pending.wasHidden = false;
        arm(pending, RETURN_GRACE_MS);
    }
}
module.exports = { INTERSTITIAL_STORAGE_KEY: INTERSTITIAL_STORAGE_KEY,
    REQUEST_TIMEOUT_MS: REQUEST_TIMEOUT_MS, CLOSE_TIMEOUT_MS: CLOSE_TIMEOUT_MS, RETURN_GRACE_MS: RETURN_GRACE_MS,
    isRewardedAvailable: isRewardedAvailable, isRealRewardedAvailable: isRealRewardedAvailable,
    failureMessage: failureMessage, getRewardedBlockReason: getRewardedBlockReason, getDiagnosticLines: diagnostics.getLines,
    isBusy: isBusy, showRewarded: showRewarded, markRewardGranted: markRewardGranted,
    onSoloResultExit: onSoloResultExit, onHide: onHide, onShow: onShow };
