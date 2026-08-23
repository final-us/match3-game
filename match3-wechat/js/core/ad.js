/**
 * 微信广告适配层：激励视频 + 单人结算插屏。
 * 未开通流量主时保持 enabled=false 且广告位 ID 为空，所有入口自动隐藏。
 */

const config = require('./config');
const analytics = require('./analytics');

const INTERSTITIAL_STORAGE_KEY = 'match3_interstitial_v1';

let rewardedAd = null;
let pendingReward = null;
let interstitialAd = null;
let pendingInterstitial = null;

function getStore() {
    if (typeof wx !== 'undefined') return wx;
    if (typeof global !== 'undefined' && global.wx) return global.wx;
    return null;
}

function track(event, placement, extra) {
    const data = { placement: placement, format: placement === 'solo_result' ? 'interstitial' : 'rewarded' };
    Object.keys(extra || {}).forEach(function (key) { data[key] = extra[key]; });
    analytics.track(event, data);
}

function hasRealRewarded() {
    const store = getStore();
    return !!(config.AD_CONFIG.enabled && config.AD_CONFIG.rewardedAdUnitId &&
        store && typeof store.createRewardedVideoAd === 'function');
}

function isRewardedAvailable() {
    return !!config.AD_CONFIG.debugMockAds || hasRealRewarded();
}

function hasRealInterstitial() {
    const store = getStore();
    return !!(config.AD_CONFIG.enabled && config.AD_CONFIG.interstitialAdUnitId &&
        store && typeof store.createInterstitialAd === 'function');
}

function finishReward(completed, reason) {
    if (!pendingReward) return;
    const current = pendingReward;
    pendingReward = null;
    track(completed ? 'ad_complete' : (reason === 'cancel' ? 'ad_cancel' : 'ad_fail'), current.placement, {
        reason: reason || (completed ? 'completed' : 'unknown')
    });
    current.resolve(!!completed);
}

function createRewardedAd() {
    if (!hasRealRewarded()) return null;
    try {
        const ad = getStore().createRewardedVideoAd({ adUnitId: config.AD_CONFIG.rewardedAdUnitId });
        ad.onClose(function (res) {
            finishReward(!!(res && res.isEnded), res && res.isEnded ? 'completed' : 'cancel');
        });
        ad.onError(function (err) {
            rewardedAd = null;
            finishReward(false, err && err.errCode ? String(err.errCode) : 'runtime_error');
        });
        return ad;
    } catch (e) {
        return null;
    }
}

/** 完整观看返回 true；取消、失败、未配置均返回 false。 */
function showRewarded(placement) {
    placement = placement || 'unknown';
    track('ad_request', placement);

    if (config.AD_CONFIG.debugMockAds) {
        track('ad_show', placement, { source: 'debug_mock' });
        track('ad_complete', placement, { source: 'debug_mock' });
        return Promise.resolve(true);
    }
    if (!hasRealRewarded()) {
        track('ad_frequency_blocked', placement, { reason: 'unavailable' });
        return Promise.resolve(false);
    }
    if (pendingReward) {
        track('ad_frequency_blocked', placement, { reason: 'pending' });
        return Promise.resolve(false);
    }
    if (!rewardedAd) rewardedAd = createRewardedAd();
    if (!rewardedAd) {
        track('ad_fail', placement, { reason: 'create_failed' });
        return Promise.resolve(false);
    }

    return new Promise(function (resolve) {
        pendingReward = { resolve: resolve, placement: placement };
        rewardedAd.show().then(function () {
            track('ad_show', placement);
        }).catch(function () {
            const load = typeof rewardedAd.load === 'function' ? rewardedAd.load() : Promise.reject(new Error('load_unavailable'));
            load.then(function () { return rewardedAd.show(); })
                .then(function () { track('ad_show', placement); })
                .catch(function () {
                    rewardedAd = null;
                    finishReward(false, 'show_failed');
                });
        });
    });
}

function markRewardGranted(placement) {
    track('ad_reward_granted', placement || 'unknown');
}

function readInterstitialState() {
    const store = getStore();
    if (!store || typeof store.getStorageSync !== 'function') return { completedGames: 0, lastShownAt: 0 };
    try {
        const state = store.getStorageSync(INTERSTITIAL_STORAGE_KEY);
        if (state && typeof state.completedGames === 'number' && typeof state.lastShownAt === 'number') return state;
    } catch (e) {}
    return { completedGames: 0, lastShownAt: 0 };
}

function saveInterstitialState(state) {
    const store = getStore();
    if (!store || typeof store.setStorageSync !== 'function') return;
    try { store.setStorageSync(INTERSTITIAL_STORAGE_KEY, state); } catch (e) {}
}

function finishInterstitial(shown, reason) {
    if (!pendingInterstitial) return;
    const current = pendingInterstitial;
    pendingInterstitial = null;
    if (shown) {
        track('ad_complete', current.placement, { status: 'closed' });
    } else {
        track('ad_fail', current.placement, { reason: reason || 'runtime_error' });
    }
    current.resolve(!!shown);
}

function createInterstitialAd() {
    if (!hasRealInterstitial()) return null;
    try {
        const ad = getStore().createInterstitialAd({ adUnitId: config.AD_CONFIG.interstitialAdUnitId });
        ad.onClose(function () { finishInterstitial(true, 'closed'); });
        ad.onError(function (err) {
            interstitialAd = null;
            finishInterstitial(false, err && err.errCode ? String(err.errCode) : 'runtime_error');
        });
        return ad;
    } catch (e) {
        return null;
    }
}

function showInterstitial() {
    const placement = 'solo_result';
    track('ad_request', placement);
    if (!hasRealInterstitial()) {
        track('ad_frequency_blocked', placement, { reason: 'unavailable' });
        return Promise.resolve(false);
    }
    if (pendingInterstitial) {
        track('ad_frequency_blocked', placement, { reason: 'pending' });
        return Promise.resolve(false);
    }
    if (!interstitialAd) interstitialAd = createInterstitialAd();
    if (!interstitialAd) {
        track('ad_fail', placement, { reason: 'create_failed' });
        return Promise.resolve(false);
    }
    return new Promise(function (resolve) {
        pendingInterstitial = { resolve: resolve, placement: placement };
        interstitialAd.show().then(function () {
            track('ad_show', placement);
        }).catch(function () {
            interstitialAd = null;
            finishInterstitial(false, 'show_failed');
        });
    });
}

/** 单人一局最终离开结算时调用；广告关闭或失败后 Promise 均会结束。 */
function onSoloResultExit() {
    if (!hasRealInterstitial()) {
        track('ad_frequency_blocked', 'solo_result', { reason: 'unavailable' });
        return Promise.resolve(false);
    }

    const now = Date.now();
    const state = readInterstitialState();
    state.completedGames += 1;
    saveInterstitialState(state);

    if (state.completedGames < config.AD_CONFIG.interstitialEveryGames) {
        track('ad_frequency_blocked', 'solo_result', { reason: 'game_count', completedGames: state.completedGames });
        return Promise.resolve(false);
    }
    if (state.lastShownAt && now - state.lastShownAt < config.AD_CONFIG.interstitialCooldownMs) {
        track('ad_frequency_blocked', 'solo_result', {
            reason: 'cooldown', cooldownMs: config.AD_CONFIG.interstitialCooldownMs
        });
        return Promise.resolve(false);
    }

    return showInterstitial().then(function (shown) {
        if (shown) {
            state.completedGames = 0;
            state.lastShownAt = Date.now();
            saveInterstitialState(state);
        }
        return shown;
    });
}

module.exports = {
    INTERSTITIAL_STORAGE_KEY: INTERSTITIAL_STORAGE_KEY,
    isRewardedAvailable: isRewardedAvailable,
    showRewarded: showRewarded,
    markRewardGranted: markRewardGranted,
    onSoloResultExit: onSoloResultExit
};
