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

// 临时本地诊断：仅开发版/模拟器，只有固定阶段名，无正文、身份或原始错误。
function privacyDiagnostic(stage) {
    const store = getWx();
    if (!store) return;
    let channel = '';
    try {
        channel = store.getAccountInfoSync().miniProgram.envVersion;
    } catch (e) {}
    if (channel === 'release' || channel === 'trial') return;
    let simulator = false;
    try { simulator = store.getDeviceInfo().platform === 'devtools'; } catch (e) {}
    if (channel !== 'develop' && !simulator) return;
    try { console.info('[privacy-P3] ' + stage); } catch (e) {}
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

// 分享卡片是最容易暴露旧缓存的入口。若微信已经把新包下载好，
// 进入邀请房间前直接应用新包，避免好友停留在旧 UI。
function applyReadyUpdate(state) {
    if (typeof state === 'string') currentState = state;
    if (!SAFE_UPDATE_STATES[currentState] || !updateReady || updateApplying || !updateManager ||
        typeof updateManager.applyUpdate !== 'function') return false;
    applyUpdate();
    return updateApplying;
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
    privacyDiagnostic('loaded');

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

// onComplete 仅报告协议是否打开，不代表用户同意任何隐私授权。
function openPrivacyContract(onComplete) {
    const store = getWx();
    privacyDiagnostic('request');
    let settled = false;
    let timeout = null;
    function finish(success, category) {
        if (settled) return;
        settled = true;
        if (timeout !== null) clearTimeout(timeout);
        timeout = null;
        if (success) {
            privacyDiagnostic('callback_success');
            trackSafe('privacy_opened', { status: 'success' });
        } else {
            privacyDiagnostic(category || 'callback_fail');
            trackSafe('privacy_open_failed', { category: category || 'platform_unavailable' });
            if (typeof onComplete !== 'function') showToast('隐私说明暂不可用，请稍后重试');
        }
        if (typeof onComplete === 'function') onComplete(success);
    }

    if (!store || typeof store.openPrivacyContract !== 'function') {
        finish(false, 'api_unavailable');
        return false;
    }

    try {
        // 某些平台实现可能不回调；仅结束本次等待，不重试或代表用户授权。
        timeout = setTimeout(function () { finish(false, 'timeout'); }, 5000);
        const result = store.openPrivacyContract({
            success: function () { finish(true); },
            fail: function () { finish(false); }
        });
        // 官方声明不支持Promise风格：返回值完成不等于页面打开，唯success回调作准。
        if (result && typeof result.then === 'function') {
            privacyDiagnostic('thenable_returned');
            result.then(undefined, function () { finish(false, 'promise_rejected'); });
        } else if (result && typeof result.catch === 'function') {
            result.catch(function () { finish(false, 'promise_rejected'); });
        }
        return true;
    } catch (e) {
        finish(false, 'sync_throw');
        return false;
    }
}

module.exports = {
    privacyDiagnostic: privacyDiagnostic,
    SAFE_UPDATE_STATES: SAFE_UPDATE_STATES,
    init: init,
    maybePromptUpdate: maybePromptUpdate,
    applyReadyUpdate: applyReadyUpdate,
    openPrivacyContract: openPrivacyContract
};
