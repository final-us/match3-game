/**
 * 分享裂变模块
 * 机制：分享给好友/群 → 获得 +1 体力；每日限 3 次（跨天重置）
 * 说明：微信小游戏分享无"成功回调"，采用点击即奖励 + 每日限次防刷
 */

const SHARE_KEY = 'match3_share_v1';

const SHARE_CONFIG = {
    dailyLimit: 3,      // 每日分享奖励上限
    heartReward: 1,     // 每次分享奖励体力
    title: '快来和我一起玩消消乐！' // 分享文案
};

function getStore() {
    return typeof wx !== 'undefined' ? wx : global.wx;
}

/** 今天日期字符串 YYYY-MM-DD */
function today() {
    const d = new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

/** 读取分享状态（自动跨天重置） */
function getShareState() {
    const store = getStore();
    let state = null;
    if (store && store.getStorageSync) {
        state = store.getStorageSync(SHARE_KEY);
    }
    if (!state || state.date !== today()) {
        state = { date: today(), count: 0 };
    }
    return state;
}

function save(state) {
    const store = getStore();
    if (store && store.setStorageSync) {
        store.setStorageSync(SHARE_KEY, state);
    }
}

/** 今天还可分享几次 */
function getRemaining() {
    const state = getShareState();
    return Math.max(0, SHARE_CONFIG.dailyLimit - state.count);
}

/** 是否还可分享领奖 */
function canShare() {
    return getRemaining() > 0;
}

/**
 * 执行分享（调起微信分享面板）
 * @returns {boolean} 是否成功调起分享
 */
function share() {
    if (typeof wx !== 'undefined' && wx.shareAppMessage) {
        try {
            wx.shareAppMessage({
                title: SHARE_CONFIG.title
                // imageUrl: 分享图（上线前可配置，默认使用页面截图）
            });
            return true;
        } catch (e) {
            return false;
        }
    }
    // 开发环境无 wx：模拟成功，方便联调
    return true;
}

/**
 * 分享并领取奖励（点击分享即发放，每日限次）
 * @returns {{shared: boolean, rewarded: boolean, remaining: number}}
 */
function shareAndReward() {
    const shared = share();
    if (!shared) {
        return { shared: false, rewarded: false, remaining: getRemaining() };
    }
    if (!canShare()) {
        return { shared: true, rewarded: false, remaining: 0 };
    }
    const state = getShareState();
    state.count++;
    save(state);
    return { shared: true, rewarded: true, remaining: getRemaining() };
}

module.exports = {
    SHARE_CONFIG: SHARE_CONFIG,
    getRemaining: getRemaining,
    canShare: canShare,
    share: share,
    shareAndReward: shareAndReward
};
