/**
 * 体力系统（数据驱动）
 * 规则：5 心上限，每 10 分钟恢复 1 颗，离线期间照常恢复（基于时间戳计算）
 * 存储：本地 storage（lastLossTime=0 表示满心、未在恢复中）
 */

// 体力配置（改这里调数值）
const HEART_CONFIG = {
    maxHeart: 5,                 // 上限
    regenMs: 10 * 60 * 1000     // 每颗恢复间隔：10 分钟
};

const STORAGE_KEY = 'match3_heart_v1';

function getStore() {
    return typeof wx !== 'undefined' ? wx : global.wx;
}

function save(state) {
    const store = getStore();
    if (store && store.setStorageSync) {
        store.setStorageSync(STORAGE_KEY, state);
    }
}

/** 读取并结算（含离线恢复）的体力状态 */
function getHeartState() {
    const store = getStore();
    const now = Date.now();
    let state = null;
    if (store && store.getStorageSync) {
        const saved = store.getStorageSync(STORAGE_KEY);
        state = saved && typeof saved === 'object' ? Object.assign({}, saved) : saved;
    }
    if (!state || typeof state.count !== 'number') {
        state = { count: HEART_CONFIG.maxHeart, lastLossTime: 0 };
        save(state);
        return state;
    }

    // 离线/等待期间的恢复结算
    if (state.count < HEART_CONFIG.maxHeart && state.lastLossTime > 0) {
        const elapsed = now - state.lastLossTime;
        const gained = Math.floor(elapsed / HEART_CONFIG.regenMs);
        if (gained > 0) {
            state.count = Math.min(HEART_CONFIG.maxHeart, state.count + gained);
            // lastLossTime 前进到实际恢复到的时刻（保留余数，保证连续恢复准确）
            state.lastLossTime = state.lastLossTime + gained * HEART_CONFIG.regenMs;
            if (state.count >= HEART_CONFIG.maxHeart) {
                state.lastLossTime = 0; // 满心，停止计时
            }
            save(state);
        }
    }
    return state;
}

/** 尝试消耗 1 颗体力（进关卡时调用），返回是否成功 */
function consumeHeart(refundable) {
    const state = getHeartState();
    if (state.count <= 0) return false;
    state.count--;
    state.refundPending = refundable === true;
    // 从满心扣到非满：开始记录恢复计时；非满继续扣：保持最早缺心时间
    if (state.count < HEART_CONFIG.maxHeart && state.lastLossTime === 0) {
        state.lastLossTime = Date.now();
    }
    save(state);
    return true;
}

/** 成功通关返还本局预扣体力；标记和数量在同一存储项写入，重复结算不重复返还。 */
function refundConsumedHeart() {
    const state = getHeartState();
    if (!state.refundPending) return false;
    state.count = Math.min(HEART_CONFIG.maxHeart, state.count + 1);
    state.refundPending = false;
    if (state.count >= HEART_CONFIG.maxHeart) state.lastLossTime = 0;
    save(state);
    return true;
}

/** 增加体力（看广告/奖励），返回新体力数 */
function addHeart(n) {
    const state = getHeartState();
    state.count = Math.min(HEART_CONFIG.maxHeart, state.count + (n || 1));
    if (state.count >= HEART_CONFIG.maxHeart) {
        state.lastLossTime = 0;
    }
    save(state);
    return state.count;
}

/** 距离下一颗体力恢复的剩余毫秒（满心返回 0） */
function getRecoverTimeLeft() {
    const state = getHeartState();
    if (state.count >= HEART_CONFIG.maxHeart) return 0;
    const elapsed = Date.now() - state.lastLossTime;
    const left = HEART_CONFIG.regenMs - elapsed;
    return left > 0 ? left : 0;
}

/** 格式化剩余恢复时间 mm:ss */
function formatTimeLeft() {
    const ms = getRecoverTimeLeft();
    const totalSec = Math.ceil(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return (min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec;
}

module.exports = {
    HEART_CONFIG: HEART_CONFIG,
    getHeartState: getHeartState,
    consumeHeart: consumeHeart,
    refundConsumedHeart: refundConsumedHeart,
    addHeart: addHeart,
    getRecoverTimeLeft: getRecoverTimeLeft,
    formatTimeLeft: formatTimeLeft
};
