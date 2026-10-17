/** 微信广告适配层。配置关闭时不创建实例；本地恢复不推断观看成功。 */
const config = require('./config');
const analytics = require('./analytics');
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
    for (const pair of [['offClose', 'close'], ['offError', 'error']]) {
        if (typeof request.ad[pair[0]] === 'function') {
            try { request.ad[pair[0]](request[pair[1]]); } catch (error) { /* request identity still rejects stale listeners */ }
        }
    }
}
function clearTimer(request) { clearTimeout(request.timer); request.timer = null; }
function finish(request, completed, reason, uncertain) {
    if (pending !== request) return;
    clearTimer(request);
    pending = null;
    if (uncertain) abandoned = request; else detach(request);
    track(completed ? 'ad_complete' : reason === 'cancel' ? 'ad_cancel' : 'ad_fail', request.placement, {
        reason: reason || 'completed'
    });
    request.resolve(!!completed);
}
function arm(request, delay) {
    clearTimer(request);
    request.timer = setTimeout(function () {
        if (pending !== request) return;
        // Background time cannot be used as evidence that the overlay has closed.
        if (hidden) { request.expired = true; return; }
        finish(request, false, 'callback_timeout', !!request.displayStarted);
    }, delay);
    if (request.timer && request.timer.unref) request.timer.unref();
}
function terminal(request, completed, reason) {
    if (abandoned === request) {
        abandoned = null;
        detach(request);
        return; // A late terminal event releases quarantine, never grants a reward.
    }
    finish(request, completed, reason, false);
}
function show(format, placement) {
    if (pending || abandoned || hidden) {
        track('ad_frequency_blocked', placement, { reason: pending ? 'pending' : abandoned ? 'awaiting_terminal' : 'backgrounded' });
        return Promise.resolve(false);
    }
    const store = getStore();
    let instance;
    try {
        instance = format === 'rewarded'
            ? store.createRewardedVideoAd({ adUnitId: config.AD_CONFIG.rewardedAdUnitId, disableFallbackSharePage: true })
            : store.createInterstitialAd({ adUnitId: config.AD_CONFIG.interstitialAdUnitId });
    } catch (error) {
        track('ad_fail', placement, { reason: 'create_failed' });
        return Promise.resolve(false);
    }
    if (!instance) return Promise.resolve(false);
    return new Promise(function (resolve) {
        const request = pending = { ad: instance, placement: placement, resolve: resolve, shown: false };
        request.close = function (res) {
            if (!request.displayStarted) return;
            terminal(request, format === 'interstitial' || !!(res && res.isEnded === true),
                format === 'rewarded' && !(res && res.isEnded === true) ? 'cancel' : 'completed');
        };
        request.error = function (err) {
            terminal(request, false, err && err.errCode ? String(err.errCode) : 'runtime_error');
        };
        try {
            instance.onClose(request.close);
            instance.onError(request.error);
        } catch (error) { finish(request, false, 'listener_failed', false); return; }
        arm(request, REQUEST_TIMEOUT_MS);
        const display = function () {
            if (pending !== request) return;
            if (hidden || request.loadInterrupted) { finish(request, false, 'backgrounded_before_show', false); return; }
            request.displayStarted = true;
            return call(instance, 'show');
        };
        // Load before presenting. Never retry a failed native presentation automatically.
        const attempt = format === 'rewarded' ? call(instance, 'load').then(display) : display();
        Promise.resolve(attempt).then(function () {
            if (pending !== request) return;
            request.shown = true;
            track('ad_show', placement);
            arm(request, CLOSE_TIMEOUT_MS);
        }).catch(function () { finish(request, false, request.displayStarted ? 'show_failed' : 'load_failed', false); });
    });
}
/** 完整观看才返回true，其他终态均返回false。两种格式共享一个请求锁。 */
function showRewarded(placement, options) {
    placement = placement || 'unknown';
    track('ad_request', placement);
    if (pending || abandoned) return Promise.resolve(false);
    if (config.AD_CONFIG.debugMockAds && (!options || options.allowMock !== false)) {
        track('ad_show', placement, { source: 'debug_mock' });
        track('ad_complete', placement, { source: 'debug_mock' });
        return Promise.resolve(true);
    }
    if (!hasReal('rewarded')) {
        track('ad_frequency_blocked', placement, { reason: 'unavailable' });
        return Promise.resolve(false);
    }
    return show('rewarded', placement);
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
    if (pending) { pending.wasHidden = true; if (!pending.displayStarted) pending.loadInterrupted = true; }
}
function onShow() {
    hidden = false;
    if (pending && pending.wasHidden) {
        pending.wasHidden = false;
        arm(pending, RETURN_GRACE_MS);
    }
}
module.exports = { INTERSTITIAL_STORAGE_KEY: INTERSTITIAL_STORAGE_KEY,
    REQUEST_TIMEOUT_MS: REQUEST_TIMEOUT_MS, CLOSE_TIMEOUT_MS: CLOSE_TIMEOUT_MS, RETURN_GRACE_MS: RETURN_GRACE_MS,
    isRewardedAvailable: isRewardedAvailable, isRealRewardedAvailable: isRealRewardedAvailable,
    isBusy: isBusy, showRewarded: showRewarded, markRewardGranted: markRewardGranted,
    onSoloResultExit: onSoloResultExit, onHide: onHide, onShow: onShow };
