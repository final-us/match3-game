/**
 * 金币与道具系统（数据驱动）
 * 金币：通关获得，购买道具消耗
 * 道具：锤子（消单格）/ 炸弹（消3x3）/ 换色（棋子变色）
 * 存储：本地 storage
 */

const COIN_KEY = 'match3_coin_v1';
const ITEM_KEY = 'match3_items_v1';
const REWARDED_ITEM_KEY = 'match3_rewarded_items_v1';
const REWARDED_ITEM_DAILY_LIMIT = 10;

// 金币奖励配置（改这里调数值）
const COIN_CONFIG = {
    winBase: 100,     // 通关基础金币
    stepBonus: 10,    // 剩余步数 × 每步金币
    starBonus: 30     // 每颗星 × 加成金币
};

// 星级阈值（按剩余步数占关卡步数的比例）
const STAR_CONFIG = {
    star3Ratio: 0.35,  // 剩余步数 ≥ 35% → 3 星
    star2Ratio: 0.15   // 剩余步数 ≥ 15% → 2 星，否则 1 星
};

/**
 * 计算通关星级（1-3 星）
 * @param {number} stepsLeft 剩余步数
 * @param {number} moveCount 关卡总步数
 */
function calcStars(stepsLeft, moveCount) {
    if (moveCount <= 0) return 1;
    const ratio = stepsLeft / moveCount;
    if (ratio >= STAR_CONFIG.star3Ratio) return 3;
    if (ratio >= STAR_CONFIG.star2Ratio) return 2;
    return 1;
}

/**
 * 计算通关奖励金币（含星级加成）
 * @param {number} stepsLeft 剩余步数
 * @param {number} star 星级 1-3
 */
function calcWinCoins(stepsLeft, star) {
    return COIN_CONFIG.winBase +
        Math.max(0, stepsLeft || 0) * COIN_CONFIG.stepBonus +
        Math.max(0, star || 1) * COIN_CONFIG.starBonus;
}

// 道具定义（价格/图标/说明）
const ITEM_DEFS = {
    hammer: { name: '锤子', price: 900, icon: '🔨', desc: '消除一个棋子' },
    bomb: { name: '炸弹', price: 1300, icon: '💣', desc: '消除 3x3 区域' },
    color: { name: '换色', price: 1100, icon: '🎨', desc: '智能制造即时消除' }
};

function getStore() {
    return typeof wx !== 'undefined' ? wx : global.wx;
}

// ===== 金币 =====

function getCoins() {
    const store = getStore();
    let coins = 0;
    if (store && store.getStorageSync) {
        coins = store.getStorageSync(COIN_KEY) || 0;
    }
    return typeof coins === 'number' ? coins : 0;
}

function addCoins(n) {
    const total = getCoins() + (n || 0);
    const store = getStore();
    if (store && store.setStorageSync) {
        store.setStorageSync(COIN_KEY, total);
    }
    return total;
}

/** 花费金币（返回是否成功） */
function spendCoins(n) {
    const coins = getCoins();
    if (coins < n) return false;
    const store = getStore();
    if (store && store.setStorageSync) {
        store.setStorageSync(COIN_KEY, coins - n);
    }
    return true;
}

// ===== 道具 =====

function getItems() {
    const store = getStore();
    let items = null;
    if (store && store.getStorageSync) {
        items = store.getStorageSync(ITEM_KEY);
    }
    if (!items) {
        items = { hammer: 0, bomb: 0, color: 0 };
    }
    // 兜底缺失字段
    if (typeof items.hammer !== 'number') items.hammer = 0;
    if (typeof items.bomb !== 'number') items.bomb = 0;
    if (typeof items.color !== 'number') items.color = 0;
    return items;
}

function saveItems(items) {
    const store = getStore();
    if (store && store.setStorageSync) {
        store.setStorageSync(ITEM_KEY, items);
    }
}

/** 增加道具数量 */
function addItem(type, n) {
    const items = getItems();
    if (!(type in items)) return;
    items[type] += (n || 1);
    saveItems(items);
}

/** 使用一个道具（返回是否成功） */
function useItem(type) {
    const items = getItems();
    if (!(type in items) || items[type] <= 0) return false;
    items[type]--;
    saveItems(items);
    return true;
}

function localDateKey(now) {
    const date = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
    const monthValue = date.getMonth() + 1;
    const dayValue = date.getDate();
    const month = (monthValue < 10 ? '0' : '') + monthValue;
    const day = (dayValue < 10 ? '0' : '') + dayValue;
    return date.getFullYear() + '-' + month + '-' + day;
}

function getRewardedItemState(now) {
    const store = getStore();
    const date = localDateKey(now);
    let saved = null;
    if (store && store.getStorageSync) saved = store.getStorageSync(REWARDED_ITEM_KEY);
    const count = saved && saved.date === date && Number.isSafeInteger(saved.count) && saved.count >= 0
        ? Math.min(REWARDED_ITEM_DAILY_LIMIT, saved.count)
        : 0;
    const state = { date: date, count: count, remaining: REWARDED_ITEM_DAILY_LIMIT - count };
    if (!saved || saved.date !== date) {
        if (store && store.setStorageSync) store.setStorageSync(REWARDED_ITEM_KEY, { date: date, count: 0 });
    }
    return state;
}

/** 完整广告观看后的唯一发奖入口；所有道具共享本地自然日 10 次上限。 */
function claimRewardedItem(type, now) {
    if (!ITEM_DEFS[type]) return { ok: false, reason: 'invalid_item' };
    const state = getRewardedItemState(now);
    if (state.remaining <= 0) return { ok: false, reason: 'limit', state: state };
    const next = { date: state.date, count: state.count + 1 };
    const store = getStore();
    if (!store || typeof store.setStorageSync !== 'function') {
        return { ok: false, reason: 'storage_unavailable', state: state };
    }
    store.setStorageSync(REWARDED_ITEM_KEY, next);
    addItem(type, 1);
    return {
        ok: true,
        state: { date: next.date, count: next.count, remaining: REWARDED_ITEM_DAILY_LIMIT - next.count }
    };
}

module.exports = {
    COIN_CONFIG: COIN_CONFIG,
    STAR_CONFIG: STAR_CONFIG,
    ITEM_DEFS: ITEM_DEFS,
    REWARDED_ITEM_KEY: REWARDED_ITEM_KEY,
    REWARDED_ITEM_DAILY_LIMIT: REWARDED_ITEM_DAILY_LIMIT,
    getCoins: getCoins,
    addCoins: addCoins,
    spendCoins: spendCoins,
    getItems: getItems,
    addItem: addItem,
    useItem: useItem,
    getRewardedItemState: getRewardedItemState,
    claimRewardedItem: claimRewardedItem,
    calcStars: calcStars,
    calcWinCoins: calcWinCoins
};
