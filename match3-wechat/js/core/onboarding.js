/** 一次性情境引导。只保存步骤完成标记，不记录身份或玩法数据。 */

const STORAGE_KEY = 'match3_onboarding_v1';

const GUIDE_KEYS = Object.freeze({
    SOLO: 'solo_intro',
    SPECIAL: 'special_piece',
    OBSTACLE: 'obstacle',
    SOLO_ITEM: 'solo_item',
    PVP_WAIT: 'pvp_wait',
    COLLECT: 'collect_cats',
    SPECIAL_COMBO: 'special_combo'
});
const KNOWN_KEYS = Object.keys(GUIDE_KEYS).map(function (name) { return GUIDE_KEYS[name]; });

let memoryState = {};

function getStore() {
    if (typeof wx !== 'undefined') return wx;
    if (typeof global !== 'undefined' && global.wx) return global.wx;
    return null;
}

function readState() {
    const store = getStore();
    if (!store || typeof store.getStorageSync !== 'function') return Object.assign({}, memoryState);
    try {
        const value = store.getStorageSync(STORAGE_KEY);
        return value && typeof value === 'object' && !Array.isArray(value) ? Object.assign({}, value) : {};
    } catch (e) {
        return {};
    }
}

function writeState(state) {
    memoryState = Object.assign({}, state);
    const store = getStore();
    if (!store || typeof store.setStorageSync !== 'function') return;
    try { store.setStorageSync(STORAGE_KEY, memoryState); } catch (e) {}
}

function isKnown(key) {
    return typeof key === 'string' && KNOWN_KEYS.indexOf(key) >= 0;
}

function hasSeen(key) {
    return isKnown(key) && readState()[key] === true;
}

function shouldShow(key) {
    return isKnown(key) && !hasSeen(key);
}

function markSeen(key) {
    if (!isKnown(key)) return false;
    const state = readState();
    state[key] = true;
    writeState(state);
    return true;
}

module.exports = {
    STORAGE_KEY: STORAGE_KEY,
    GUIDE_KEYS: GUIDE_KEYS,
    hasSeen: hasSeen,
    shouldShow: shouldShow,
    markSeen: markSeen
};
