/**
 * 微信小游戏运行时适配：错误分类、更新管理与官方隐私入口。
 * 所有平台 API 都做 feature detection；远程上报由 analytics/config 控制。
 */

const analytics = require('./analytics');

const SAFE_UPDATE_STATES = {
    menu: true,
    settings: true,
    levelselect: true,
    shop: true,
    result: true,
    battle_result: true
};

let initialized = false;
let currentState = 'menu';
let updateManager = null;
let updateReady = false;
let updatePrompted = false;
let updateDismissed = false;
let updateApplying = false;
let errorCounts = {};

function getWx() {
    if (typeof wx !== 'undefined') return wx;
    if (typeof global !== 'undefined' && global.wx) return global.wx;
    return null;
}

function showToast(title) {
    const store = getWx();
    if (!store) return false;
    try {
        if (typeof store.showToast === 'function') {
            store.showToast({ title: title, icon: 'none', duration: 1800 });
            return true;
        }
        if (typeof store.showModal === 'function') {
            store.showModal({ title: title, content: '', showCancel: false });
            return true;
        }
    } catch (e) {}
    return false;
}

function trackSafe(event, properties) {
    try {
        analytics.track(event, properties);
    } catch (e) {}
}

function recordError(category) {
    errorCounts[category] = (errorCounts[category] || 0) + 1;
    trackSafe('runtime_error', { category: category, count: errorCounts[category] });
    try {
        analytics.reportMonitor('runtime_error', errorCounts[category]);
    } catch (e) {}
}

function onUpdateFailed() {
    trackSafe('update_failed', { category: 'download' });
    showToast('新版本下载失败，请稍后重试');
}

function onUpdateApplyFailed() {
    updateApplying = false;
    trackSafe('update_apply_failed', { category: 'apply' });
    showToast('新版本暂时无法应用，请稍后重试');
}

function bindUpdateManager(manager) {
    if (!manager) return;
    if (typeof manager.onUpdateReady === 'function') {
        try {
            manager.onUpdateReady(function () {
                updateReady = true;
                trackSafe('update_ready', { category: 'download' });
                maybePromptUpdate(currentState);
            });
        } catch (e) {}
    }
    if (typeof manager.onUpdateFailed === 'function') {
        try { manager.onUpdateFailed(onUpdateFailed); } catch (e) {}
    }
}

function applyUpdate() {
    if (updateApplying || !updateManager || typeof updateManager.applyUpdate !== 'function') return;
    updateApplying = true;
    trackSafe('update_confirmed', { category: 'apply' });
    try {
        const result = updateManager.applyUpdate();
        if (result && typeof result.catch === 'function') result.catch(onUpdateApplyFailed);
    } catch (e) {
        onUpdateApplyFailed();
    }
}

function maybePromptUpdate(state) {
    if (typeof state === 'string') currentState = state;
    if (!updateReady || updatePrompted || updateDismissed || updateApplying || !SAFE_UPDATE_STATES[currentState]) {
        return false;
    }

    // 先置位再调 UI，避免同一帧或回调重入重复弹窗。
    updatePrompted = true;
    const store = getWx();
    if (!store || typeof store.showModal !== 'function') {
        updateDismissed = true;
        trackSafe('update_prompt_unavailable', { category: 'api_unavailable' });
        showToast('发现新版本，请稍后重启游戏更新');
        return false;
    }

    try {
        store.showModal({
            title: '发现新版本',
            content: '新版本已准备好，是否立即更新？',
            confirmText: '立即更新',
            cancelText: '稍后',
            success: function (res) {
                if (res && res.confirm) {
                    applyUpdate();
                } else {
                    updateDismissed = true;
                    trackSafe('update_cancelled', { category: 'user_cancel' });
                }
            },
            fail: function () {
                updateDismissed = true;
                trackSafe('update_cancelled', { category: 'modal_failed' });
            }
        });
    } catch (e) {
        updateDismissed = true;
        trackSafe('update_cancelled', { category: 'modal_failed' });
    }
    return true;
}

function init(initialState) {
    if (typeof initialState === 'string') currentState = initialState;
    if (initialized) return updateManager;
    initialized = true;

    const store = getWx();
    if (!store) return null;
    if (typeof store.onError === 'function') {
        try { store.onError(function () { recordError('on_error'); }); } catch (e) {}
    }
    if (typeof store.onUnhandledRejection === 'function') {
        try { store.onUnhandledRejection(function () { recordError('unhandled_rejection'); }); } catch (e) {}
    }
    if (typeof store.getUpdateManager === 'function') {
        try {
            updateManager = store.getUpdateManager();
            bindUpdateManager(updateManager);
        } catch (e) {
            updateManager = null;
        }
    }
    return updateManager;
}

function openPrivacyContract() {
    const store = getWx();
    if (!store || typeof store.openPrivacyContract !== 'function') {
        trackSafe('privacy_open_failed', { category: 'api_unavailable' });
        showToast('隐私说明暂不可用，请稍后重试');
        return false;
    }

    let settled = false;
    function finish(success) {
        if (settled) return;
        settled = true;
        if (success) {
            trackSafe('privacy_opened', { status: 'success' });
        } else {
            trackSafe('privacy_open_failed', { category: 'platform_unavailable' });
            showToast('隐私说明暂不可用，请稍后重试');
        }
    }

    try {
        const result = store.openPrivacyContract({
            success: function () { finish(true); },
            fail: function () { finish(false); }
        });
        if (result && typeof result.catch === 'function') result.catch(function () { finish(false); });
        return true;
    } catch (e) {
        finish(false);
        return false;
    }
}

module.exports = {
    SAFE_UPDATE_STATES: SAFE_UPDATE_STATES,
    init: init,
    maybePromptUpdate: maybePromptUpdate,
    openPrivacyContract: openPrivacyContract
};
