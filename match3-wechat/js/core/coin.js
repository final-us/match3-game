/**
 * 金币与道具系统（数据驱动）
 * 金币：通关获得，购买道具消耗
 * 道具：锤子（消单格）/ 炸弹（消3x3）/ 换色（棋子变色）
 * 存储：本地 storage
 */

const COIN_KEY = 'match3_coin_v1';
const COIN_RECEIPT_HISTORY_KEY = 'match3_coin_receipts_v1';
const COIN_PENDING_CREDIT_KEY = 'match3_coin_pending_credit_v1';
const REWARD_PENDING_CREDIT_KEY = 'match3_reward_pending_credit_v1';
const ITEM_KEY = 'match3_items_v1';
const ITEM_SPEND_KEY = 'match3_item_spend_pending_v1';
const REWARDED_ITEM_PENDING_KEY = 'match3_rewarded_item_pending_v1';
const REWARDED_ITEM_KEY = 'match3_rewarded_items_v1';
const REWARDED_ITEM_DAILY_LIMIT = 10;
const STAMINA_PRICE = 1000;

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

function hasStorage(store) {
    return !!store && typeof store.getStorageSync === 'function' && typeof store.setStorageSync === 'function';
}

function readStorage(store, key) {
    if (!hasStorage(store)) return { ok: false, reason: 'storage_unavailable' };
    try {
        return { ok: true, value: store.getStorageSync(key) };
    } catch (error) {
        return { ok: false, reason: 'storage_read_failed' };
    }
}

function writeStorage(store, key, value) {
    if (!hasStorage(store)) return { ok: false, reason: 'storage_unavailable' };
    try {
        store.setStorageSync(key, value);
        return { ok: true };
    } catch (error) {
        return { ok: false, reason: 'storage_write_failed' };
    }
}

function readCoinsRaw(store) {
    const saved = readStorage(store, COIN_KEY);
    if (!saved.ok) return saved;
    if (saved.value == null || saved.value === '') return { ok: true, value: 0 };
    if (!Number.isSafeInteger(saved.value) || saved.value < 0) {
        return { ok: false, reason: 'coin_balance_invalid' };
    }
    return { ok: true, value: saved.value };
}

function emptyItems() {
    return { hammer: 0, bomb: 0, color: 0 };
}

function readItemsRaw(store) {
    const saved = readStorage(store, ITEM_KEY);
    if (!saved.ok) return saved;
    if (saved.value == null || saved.value === '') return { ok: true, value: emptyItems() };
    if (!saved.value || typeof saved.value !== 'object') {
        return { ok: false, reason: 'item_balance_invalid' };
    }
    const items = emptyItems();
    const keys = Object.keys(items);
    for (let i = 0; i < keys.length; i++) {
        const value = saved.value[keys[i]];
        if (value == null) continue;
        if (!Number.isSafeInteger(value) || value < 0) {
            return { ok: false, reason: 'item_balance_invalid' };
        }
        items[keys[i]] = value;
    }
    return { ok: true, value: items };
}

function readReceiptHistory(store) {
    const saved = readStorage(store, COIN_RECEIPT_HISTORY_KEY);
    if (!saved.ok) return saved;
    // wx.getStorageSync returns an empty string for a missing key.
    if (saved.value == null || saved.value === '') return { ok: true, value: [] };
    if (!Array.isArray(saved.value) || saved.value.some(function (id) { return typeof id !== 'string'; })) {
        return { ok: false, reason: 'receipt_history_invalid' };
    }
    return { ok: true, value: saved.value };
}

function isPendingCredit(value) {
    return !!value && typeof value.receiptId === 'string' &&
        Number.isSafeInteger(value.amount) && value.amount > 0 &&
        Number.isSafeInteger(value.balanceBefore) && Number.isSafeInteger(value.balanceAfter) &&
        value.balanceAfter === value.balanceBefore + value.amount;
}

function isPendingReward(value) {
    return !!value && typeof value.receiptId === 'string' &&
        Number.isSafeInteger(value.coins) && value.coins >= 0 &&
        Number.isSafeInteger(value.hammer) && value.hammer >= 0 &&
        value.coins + value.hammer > 0 &&
        Number.isSafeInteger(value.balanceBefore) && value.balanceBefore >= 0 &&
        Number.isSafeInteger(value.balanceAfter) &&
        value.balanceAfter === value.balanceBefore + value.coins &&
        Number.isSafeInteger(value.hammerBefore) && value.hammerBefore >= 0 &&
        Number.isSafeInteger(value.hammerAfter) &&
        value.hammerAfter === value.hammerBefore + value.hammer;
}

function appendReceipt(history, receiptId) {
    return history.concat(receiptId);
}

/**
 * Finishes an interrupted receipt credit before any balance operation.
 * The pending intent holds both old and new balances, so recovery can tell
 * whether the balance write happened before a crash without granting twice.
 */
function recoverPendingCredit() {
    const store = getStore();
    const pendingSaved = readStorage(store, COIN_PENDING_CREDIT_KEY);
    if (!pendingSaved.ok) return pendingSaved;
    if (pendingSaved.value == null || pendingSaved.value === '') return { ok: true };
    if (!isPendingCredit(pendingSaved.value)) return { ok: false, reason: 'pending_credit_invalid' };

    const pending = pendingSaved.value;
    const historySaved = readReceiptHistory(store);
    if (!historySaved.ok) return historySaved;
    const history = historySaved.value;

    if (history.indexOf(pending.receiptId) === -1) {
        const balanceSaved = readCoinsRaw(store);
        if (!balanceSaved.ok) return balanceSaved;
        if (balanceSaved.value === pending.balanceBefore) {
            const balanceWrite = writeStorage(store, COIN_KEY, pending.balanceAfter);
            if (!balanceWrite.ok) return balanceWrite;
        } else if (balanceSaved.value !== pending.balanceAfter) {
            return { ok: false, reason: 'pending_credit_conflict' };
        }

        const historyWrite = writeStorage(store, COIN_RECEIPT_HISTORY_KEY, appendReceipt(history, pending.receiptId));
        if (!historyWrite.ok) return historyWrite;
    }

    return writeStorage(store, COIN_PENDING_CREDIT_KEY, null);
}

function recoverPendingReward() {
    const store = getStore();
    const pendingSaved = readStorage(store, REWARD_PENDING_CREDIT_KEY);
    if (!pendingSaved.ok) return pendingSaved;
    if (pendingSaved.value == null || pendingSaved.value === '') return { ok: true };
    if (!isPendingReward(pendingSaved.value)) return { ok: false, reason: 'pending_reward_invalid' };

    const pending = pendingSaved.value;
    const historySaved = readReceiptHistory(store);
    if (!historySaved.ok) return historySaved;
    if (historySaved.value.indexOf(pending.receiptId) === -1) {
        const balanceSaved = readCoinsRaw(store);
        if (!balanceSaved.ok) return balanceSaved;
        if (pending.coins > 0 && balanceSaved.value === pending.balanceBefore) {
            const balanceWrite = writeStorage(store, COIN_KEY, pending.balanceAfter);
            if (!balanceWrite.ok) return balanceWrite;
        } else if (balanceSaved.value !== pending.balanceAfter) {
            return { ok: false, reason: 'pending_reward_coin_conflict' };
        }

        const itemsSaved = readItemsRaw(store);
        if (!itemsSaved.ok) return itemsSaved;
        if (pending.hammer > 0 && itemsSaved.value.hammer === pending.hammerBefore) {
            const nextItems = {
                hammer: pending.hammerAfter,
                bomb: itemsSaved.value.bomb,
                color: itemsSaved.value.color
            };
            const itemWrite = writeStorage(store, ITEM_KEY, nextItems);
            if (!itemWrite.ok) return itemWrite;
        } else if (itemsSaved.value.hammer !== pending.hammerAfter) {
            return { ok: false, reason: 'pending_reward_item_conflict' };
        }

        const historyWrite = writeStorage(store, COIN_RECEIPT_HISTORY_KEY,
            appendReceipt(historySaved.value, pending.receiptId));
        if (!historyWrite.ok) return historyWrite;
    }

    return writeStorage(store, REWARD_PENDING_CREDIT_KEY, null);
}

function recoverPendingWallet() {
    const credit = recoverPendingCredit();
    if (!credit.ok) return credit;
    const reward = recoverPendingReward();
    if (!reward.ok) return reward;
    const item = recoverPendingItem();
    if (!item.ok) return item;
    const spend = recoverPendingSpend();
    return spend.ok ? item : spend;
}

function getCoins() {
    const store = getStore();
    if (!store || !store.getStorageSync) return 0;
    const recovered = recoverPendingWallet();
    if (!recovered.ok) return null;
    const saved = readCoinsRaw(store);
    return saved.ok ? saved.value : null;
}

function addCoins(n) {
    const store = getStore();
    if (!store || !store.getStorageSync) return null;
    const recovered = recoverPendingWallet();
    if (!recovered.ok) return null;
    const saved = readCoinsRaw(store);
    if (!saved.ok) return null;
    const total = saved.value + (n || 0);
    return writeStorage(store, COIN_KEY, total).ok ? total : null;
}

/** 花费金币（返回是否成功） */
function spendCoins(n) {
    const store = getStore();
    if (!store || !store.getStorageSync) return false;
    const recovered = recoverPendingWallet();
    if (!recovered.ok) return false;
    const saved = readCoinsRaw(store);
    if (!saved.ok || saved.value < n) return false;
    return writeStorage(store, COIN_KEY, saved.value - n).ok;
}

/**
 * Credits one server-issued settlement receipt exactly once within the local
 * persisted receipt history. Storage failures always surface as non-success;
 * callers may retry the same receipt after the next wallet operation recovers.
 */
function creditOnce(receiptId, amount) {
    if (typeof receiptId !== 'string' || !receiptId || receiptId.length > 160) {
        return { ok: false, credited: false, reason: 'invalid_receipt' };
    }
    if (!Number.isSafeInteger(amount) || amount <= 0) {
        return { ok: false, credited: false, reason: 'invalid_amount' };
    }

    const store = getStore();
    const recovered = recoverPendingWallet();
    if (!recovered.ok) return { ok: false, credited: false, reason: recovered.reason };

    const historySaved = readReceiptHistory(store);
    if (!historySaved.ok) return { ok: false, credited: false, reason: historySaved.reason };
    const balanceSaved = readCoinsRaw(store);
    if (!balanceSaved.ok) return { ok: false, credited: false, reason: balanceSaved.reason };

    if (historySaved.value.indexOf(receiptId) !== -1) {
        return { ok: true, credited: false, balance: balanceSaved.value };
    }
    if (!Number.isSafeInteger(balanceSaved.value) || balanceSaved.value + amount > Number.MAX_SAFE_INTEGER) {
        return { ok: false, credited: false, reason: 'invalid_balance' };
    }

    const pending = {
        receiptId: receiptId,
        amount: amount,
        balanceBefore: balanceSaved.value,
        balanceAfter: balanceSaved.value + amount
    };
    const pendingWrite = writeStorage(store, COIN_PENDING_CREDIT_KEY, pending);
    if (!pendingWrite.ok) return { ok: false, credited: false, reason: pendingWrite.reason };

    const completed = recoverPendingCredit();
    if (!completed.ok) return { ok: false, credited: false, reason: completed.reason };
    return { ok: true, credited: true, balance: pending.balanceAfter };
}

/** Credits one server receipt containing coins and/or hammers exactly once. */
function creditRewardOnce(receiptId, reward) {
    if (typeof receiptId !== 'string' || !receiptId || receiptId.length > 160) {
        return { ok: false, credited: false, reason: 'invalid_receipt' };
    }
    const coins = reward && reward.coins;
    const items = reward && reward.items;
    const hammer = items && items.hammer;
    if (!reward || typeof reward !== 'object' || !Number.isSafeInteger(coins) || coins < 0 ||
        !items || typeof items !== 'object' || !Number.isSafeInteger(hammer) || hammer < 0 ||
        coins + hammer <= 0) {
        return { ok: false, credited: false, reason: 'invalid_reward' };
    }

    const store = getStore();
    const recovered = recoverPendingWallet();
    if (!recovered.ok) return { ok: false, credited: false, reason: recovered.reason };

    const historySaved = readReceiptHistory(store);
    if (!historySaved.ok) return { ok: false, credited: false, reason: historySaved.reason };
    const balanceSaved = readCoinsRaw(store);
    if (!balanceSaved.ok) return { ok: false, credited: false, reason: balanceSaved.reason };
    const itemsSaved = readItemsRaw(store);
    if (!itemsSaved.ok) return { ok: false, credited: false, reason: itemsSaved.reason };
    if (historySaved.value.indexOf(receiptId) !== -1) {
        return { ok: true, credited: false, balance: balanceSaved.value };
    }
    if (balanceSaved.value + coins > Number.MAX_SAFE_INTEGER ||
        itemsSaved.value.hammer + hammer > Number.MAX_SAFE_INTEGER) {
        return { ok: false, credited: false, reason: 'invalid_balance' };
    }

    const pending = {
        receiptId: receiptId,
        coins: coins,
        hammer: hammer,
        balanceBefore: balanceSaved.value,
        balanceAfter: balanceSaved.value + coins,
        hammerBefore: itemsSaved.value.hammer,
        hammerAfter: itemsSaved.value.hammer + hammer
    };
    const pendingWrite = writeStorage(store, REWARD_PENDING_CREDIT_KEY, pending);
    if (!pendingWrite.ok) return { ok: false, credited: false, reason: pendingWrite.reason };
    const completed = recoverPendingReward();
    if (!completed.ok) return { ok: false, credited: false, reason: completed.reason };
    return { ok: true, credited: true, balance: pending.balanceAfter };
}

// ===== 道具 =====

function getItems() {
    const store = getStore();
    if (!hasStorage(store)) return emptyItems();
    const recovered = recoverPendingWallet();
    if (!recovered.ok) return null;
    const saved = readItemsRaw(store);
    return saved.ok ? saved.value : null;
}

function saveItems(items) {
    const store = getStore();
    return writeStorage(store, ITEM_KEY, items).ok;
}

/** 增加道具数量 */
function addItem(type, n) {
    const items = getItems();
    if (!items || !(type in items)) return false;
    items[type] += (n || 1);
    return saveItems(items);
}

/** 使用一个道具（返回是否成功） */
function useItem(type) {
    const items = getItems();
    if (!items || !(type in items) || items[type] <= 0) return false;
    items[type]--;
    return saveItems(items);
}

/** A resumed tool operation and its inventory debit share a stable receipt. */
function recoverPendingSpend() {
    const store = getStore(), read = readStorage(store, ITEM_SPEND_KEY);
    if (!read.ok) return read;
    const p = read.value;
    if (p == null || p === '') return { ok: true };
    if (!p || !ITEM_DEFS[p.type] || typeof p.id !== 'string' ||
        !Number.isSafeInteger(p.before) || p.before < 1 || p.after !== p.before - 1) return { ok: false };
    const history = readReceiptHistory(store);
    if (!history.ok) return history;
    if (!history.value.includes(p.id)) {
        const items = readItemsRaw(store);
        if (!items.ok) return items;
        if (items.value[p.type] === p.before) {
            items.value[p.type] = p.after;
            const saved = writeStorage(store, ITEM_KEY, items.value);
            if (!saved.ok) return saved;
        } else if (items.value[p.type] !== p.after) return { ok: false };
        const saved = writeStorage(store, COIN_RECEIPT_HISTORY_KEY, history.value.concat(p.id));
        if (!saved.ok) return saved;
    }
    return writeStorage(store, ITEM_SPEND_KEY, null);
}
function useItemOnce(type, id) {
    if (!ITEM_DEFS[type] || typeof id !== 'string' || !id || id.length > 160) return { ok: false };
    const recovered = recoverPendingWallet();
    if (!recovered.ok) return recovered;
    const store = getStore(), history = readReceiptHistory(store);
    if (!history.ok) return history;
    if (history.value.includes(id)) return { ok: true };
    const items = readItemsRaw(store);
    if (!items.ok || items.value[type] < 1) return { ok: false };
    const saved = writeStorage(store, ITEM_SPEND_KEY, { id: id, type: type, before: items.value[type], after: items.value[type] - 1 });
    return saved.ok ? recoverPendingSpend() : saved;
}

function localDateKey(now) {
    const date = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
    const monthValue = date.getMonth() + 1;
    const dayValue = date.getDate();
    const month = (monthValue < 10 ? '0' : '') + monthValue;
    const day = (dayValue < 10 ? '0' : '') + dayValue;
    return date.getFullYear() + '-' + month + '-' + day;
}

// Quota and receipts share one atomic storage item; inventory uses a before/after WAL.
function readRewardedQuota(store) {
    const saved = readStorage(store, REWARDED_ITEM_KEY);
    if (!saved.ok) return saved;
    const value = saved.value;
    if (value == null || value === '') return { ok: true, value: { days: {}, receipts: [] } };
    if (!value || typeof value !== 'object' ||
        (value.receipts != null && (!Array.isArray(value.receipts) ||
        value.receipts.some(id => typeof id !== 'string'))) ||
        (value.days != null && (typeof value.days !== 'object' || Array.isArray(value.days)))) {
        return { ok: false, reason: 'rewarded_quota_invalid' };
    }
    const days = Object.assign({}, value.days);
    if (value.date != null) {
        if (!Number.isSafeInteger(value.count) || value.count < 0 || value.count > REWARDED_ITEM_DAILY_LIMIT) {
            return { ok: false, reason: 'rewarded_quota_invalid' };
        }
        if (days[value.date] == null) days[value.date] = value.count;
    }
    if (Object.keys(days).some(date => !Number.isSafeInteger(days[date]) ||
        days[date] < 0 || days[date] > REWARDED_ITEM_DAILY_LIMIT)) {
        return { ok: false, reason: 'rewarded_quota_invalid' };
    }
    return { ok: true, value: Object.assign({}, value, { days: days, receipts: (value.receipts || []).slice() }) };
}

function recoverPendingItem() {
    const store = getStore();
    const saved = readStorage(store, REWARDED_ITEM_PENDING_KEY);
    if (!saved.ok) return saved;
    const pending = saved.value;
    if (pending == null || pending === '') return { ok: true };
    const solo = pending.kind === 'solo_item';
    if (!Object.prototype.hasOwnProperty.call(ITEM_DEFS, pending.type) ||
        !Number.isSafeInteger(pending.before) || pending.before < 0 ||
        !Number.isSafeInteger(pending.after) || pending.after !== pending.before + 1 ||
        (solo ? typeof pending.receiptId !== 'string' || !pending.receiptId || pending.receiptId.length > 160 : !pending.quota)) {
        return { ok: false, reason: 'pending_item_invalid' };
    }
    const receipts = solo ? readReceiptHistory(store) : readRewardedQuota(store);
    if (!receipts.ok) return receipts;
    const history = solo ? receipts.value : receipts.value.receipts;
    let granted = false;
    if (!pending.receiptId || history.indexOf(pending.receiptId) === -1) {
        const items = readItemsRaw(store);
        if (!items.ok) return items;
        if (items.value[pending.type] === pending.before) {
            items.value[pending.type] = pending.after;
            const written = writeStorage(store, ITEM_KEY, items.value);
            if (!written.ok) return written;
            granted = true;
        } else if (items.value[pending.type] !== pending.after) {
            return { ok: false, reason: 'pending_item_conflict' };
        }
        const written = solo
            ? writeStorage(store, COIN_RECEIPT_HISTORY_KEY, appendReceipt(history, pending.receiptId))
            : writeStorage(store, REWARDED_ITEM_KEY, pending.quota);
        if (!written.ok) return written;
    }
    const cleared = writeStorage(store, REWARDED_ITEM_PENDING_KEY, null);
    if (!cleared.ok) return cleared;
    return { ok: true, granted: granted, receiptId: pending.receiptId };
}

function getRewardedItemState(now) {
    const recovered = recoverPendingWallet();
    if (!recovered.ok) return null;
    const quota = readRewardedQuota(getStore());
    if (!quota.ok) return null;
    const date = localDateKey(now);
    const count = quota.value.days[date] || 0;
    return { date: date, count: count, remaining: REWARDED_ITEM_DAILY_LIMIT - count };
}

/** now is the completion time, retained by the caller across retries and days. */
function claimRewardedItem(type, now, receiptId) {
    if (!Object.prototype.hasOwnProperty.call(ITEM_DEFS, type)) return { ok: false, reason: 'invalid_item' };
    if (receiptId != null && (typeof receiptId !== 'string' || !receiptId || receiptId.length > 160)) {
        return { ok: false, reason: 'invalid_receipt' };
    }
    const recovered = recoverPendingWallet();
    if (!recovered.ok) return recovered;
    const store = getStore();
    const quota = readRewardedQuota(store);
    if (!quota.ok) return quota;
    const date = localDateKey(now);
    const count = quota.value.days[date] || 0;
    const state = { date: date, count: count, remaining: REWARDED_ITEM_DAILY_LIMIT - count };
    if (receiptId && quota.value.receipts.indexOf(receiptId) !== -1) return { ok: true, granted: recovered.granted === true && recovered.receiptId === receiptId, state: state };
    if (!state.remaining) return { ok: false, reason: 'limit', state: state };
    const items = readItemsRaw(store);
    if (!items.ok) return items;
    if (items.value[type] === Number.MAX_SAFE_INTEGER) return { ok: false, reason: 'item_balance_invalid' };
    quota.value.days[date] = count + 1;
    quota.value.date = date;
    quota.value.count = count + 1;
    if (receiptId) quota.value.receipts.push(receiptId);
    const written = writeStorage(store, REWARDED_ITEM_PENDING_KEY, {
        type: type, receiptId: receiptId, before: items.value[type], after: items.value[type] + 1,
        quota: quota.value
    });
    if (!written.ok) return written;
    const finished = recoverPendingItem();
    if (!finished.ok) return finished;
    return { ok: true, granted: true, state: { date: date, count: count + 1, remaining: state.remaining - 1 } };
}

/** One completed solo view grants one item, independent of the shop daily quota.
 * Call only after completion; retain the same receipt across retries.
 */
function claimSoloRewardedItem(type, receiptId) {
    if (!Object.prototype.hasOwnProperty.call(ITEM_DEFS, type)) return { ok: false, reason: 'invalid_item' };
    if (typeof receiptId !== 'string' || !receiptId || receiptId.length > 160) {
        return { ok: false, reason: 'invalid_receipt' };
    }
    const recovered = recoverPendingWallet();
    if (!recovered.ok) return recovered;
    const store = getStore();
    const history = readReceiptHistory(store);
    if (!history.ok) return history;
    if (history.value.indexOf(receiptId) !== -1) {
        return { ok: true, granted: recovered.granted === true && recovered.receiptId === receiptId };
    }
    const items = readItemsRaw(store);
    if (!items.ok) return items;
    if (items.value[type] === Number.MAX_SAFE_INTEGER) return { ok: false, reason: 'item_balance_invalid' };
    const written = writeStorage(store, REWARDED_ITEM_PENDING_KEY, {
        kind: 'solo_item', type: type, receiptId: receiptId,
        before: items.value[type], after: items.value[type] + 1
    });
    if (!written.ok) return written;
    const finished = recoverPendingItem();
    if (!finished.ok) return finished;
    return { ok: true, granted: true };
}

module.exports = {
    COIN_CONFIG: COIN_CONFIG,
    STAR_CONFIG: STAR_CONFIG,
    ITEM_DEFS: ITEM_DEFS,
    COIN_RECEIPT_HISTORY_KEY: COIN_RECEIPT_HISTORY_KEY,
    COIN_PENDING_CREDIT_KEY: COIN_PENDING_CREDIT_KEY,
    REWARD_PENDING_CREDIT_KEY: REWARD_PENDING_CREDIT_KEY,
    REWARDED_ITEM_KEY: REWARDED_ITEM_KEY,
    REWARDED_ITEM_DAILY_LIMIT: REWARDED_ITEM_DAILY_LIMIT,
    STAMINA_PRICE: STAMINA_PRICE,
    getCoins: getCoins,
    addCoins: addCoins,
    spendCoins: spendCoins,
    creditOnce: creditOnce,
    creditRewardOnce: creditRewardOnce,
    getItems: getItems,
    addItem: addItem,
    useItem: useItem,
    useItemOnce: useItemOnce,
    getRewardedItemState: getRewardedItemState,
    claimRewardedItem: claimRewardedItem,
    claimSoloRewardedItem: claimSoloRewardedItem,
    calcStars: calcStars,
    calcWinCoins: calcWinCoins
};
