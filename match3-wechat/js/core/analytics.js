/**
 * 本地匿名事件记录：默认只写 wx storage；远程上报需显式配置映射。
 */

const config = require('./config');

const STORAGE_KEY = 'match3_analytics_v1';
const MAX_EVENTS = 200;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

// 仅保留商业化和玩法漏斗所需的低敏标量字段。
const SAFE_KEYS = {
    placement: true,
    format: true,
    reason: true,
    category: true,
    errorCategory: true,
    source: true,
    mode: true,
    result: true,
    status: true,
    level: true,
    stars: true,
    durationBucket: true,
    reviveCount: true,
    count: true,
    cooldownMs: true,
    completedGames: true,
    available: true,
    isEnded: true,
    levelId: true,
    score: true,
    movesLeft: true,
    win: true
};
const SENSITIVE_KEY = /openid|open_id|unionid|union_id|nickname|nick_name|device|imei|oaid|idfa|phone|mobile|email|avatar|token|session|user|account|(^|_)(id|uid|name)(_|$)/i;
const SAFE_ENUM_KEY = {
    placement: true,
    format: true,
    reason: true,
    category: true,
    errorCategory: true,
    source: true,
    mode: true,
    result: true,
    status: true,
    durationBucket: true
};

let memoryEvents = [];
let onceEvents = Object.create(null);

function getStore() {
    if (typeof wx !== 'undefined') return wx;
    if (typeof global !== 'undefined' && global.wx) return global.wx;
    return null;
}

function readEvents() {
    const store = getStore();
    if (!store || typeof store.getStorageSync !== 'function') return memoryEvents.slice();
    try {
        const events = store.getStorageSync(STORAGE_KEY);
        return Array.isArray(events) ? events.slice() : [];
    } catch (e) {
        return [];
    }
}

function writeEvents(events) {
    memoryEvents = events.slice(-MAX_EVENTS);
    const store = getStore();
    if (!store || typeof store.setStorageSync !== 'function') return;
    try {
        store.setStorageSync(STORAGE_KEY, memoryEvents);
    } catch (e) {}
}

function cleanEvents(events, now) {
    const cutoff = now - RETENTION_MS;
    return events.filter(function (item) {
        return item && typeof item.event === 'string' && Number.isFinite(Number(item.timestamp)) && Number(item.timestamp) >= cutoff;
    }).slice(-MAX_EVENTS);
}

function sanitizeProperties(properties) {
    const clean = {};
    if (!properties || typeof properties !== 'object') return clean;
    Object.keys(properties).forEach(function (key) {
        if (!SAFE_KEYS[key] || SENSITIVE_KEY.test(key)) return;
        const value = properties[key];
        if (typeof value === 'boolean') {
            clean[key] = value;
        } else if (typeof value === 'number' && Number.isFinite(value)) {
            clean[key] = value;
        } else if (typeof value === 'string' && value.length <= 64 &&
            (!SAFE_ENUM_KEY[key] || /^[a-z][a-z0-9_-]{0,31}$/.test(value))) {
            clean[key] = value;
        }
    });
    return clean;
}

function getReportingConfig() {
    const reporting = config.REPORTING_CONFIG;
    return reporting && reporting.enabled === true ? reporting : null;
}

function getMappedValue(mapping, key) {
    if (!mapping || typeof mapping !== 'object' || !Object.prototype.hasOwnProperty.call(mapping, key)) return '';
    const value = mapping[key];
    return typeof value === 'string' ? value.trim() : '';
}

function swallowPromise(value) {
    if (value && typeof value.catch === 'function') value.catch(function () {});
}

/** 仅在显式启用且存在映射时调用微信原生事件上报。 */
function reportEvent(event, properties) {
    const reporting = getReportingConfig();
    const store = getStore();
    const eventId = reporting && getMappedValue(reporting.eventIds, event);
    if (!eventId || !store || typeof store.reportEvent !== 'function') return false;
    try {
        swallowPromise(store.reportEvent(eventId, sanitizeProperties(properties)));
        return true;
    } catch (e) {
        return false;
    }
}

/** 仅接受数值监控值，避免把原始错误或身份字段交给平台。 */
function reportMonitor(name, value) {
    const reporting = getReportingConfig();
    const store = getStore();
    const monitorName = reporting && getMappedValue(reporting.monitorNames, name);
    const numericValue = Number(value);
    if (!monitorName || !store || typeof store.reportMonitor !== 'function' || !Number.isFinite(numericValue)) {
        return false;
    }
    try {
        swallowPromise(store.reportMonitor(monitorName, numericValue));
        return true;
    } catch (e) {
        return false;
    }
}

function track(event, properties) {
    if (typeof event !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(event) || SENSITIVE_KEY.test(event)) return null;
    const now = Date.now();
    const item = { event: event, timestamp: now };
    const clean = sanitizeProperties(properties);
    Object.keys(clean).forEach(function (key) { item[key] = clean[key]; });
    writeEvents(cleanEvents(readEvents(), now).concat(item));
    reportEvent(event, clean);
    return item;
}

/** 同一运行会话内的单次事件，避免页面曝光和结算重复上报。 */
function trackOnce(event, properties, key) {
    const dedupeKey = typeof key === 'string' && key ? key : event;
    if (onceEvents[dedupeKey]) return null;
    const item = track(event, properties);
    if (item) onceEvents[dedupeKey] = true;
    return item;
}

function getEvents() {
    const now = Date.now();
    const events = cleanEvents(readEvents(), now);
    writeEvents(events);
    return events.slice();
}

function clear() {
    onceEvents = Object.create(null);
    writeEvents([]);
}

module.exports = {
    STORAGE_KEY: STORAGE_KEY,
    MAX_EVENTS: MAX_EVENTS,
    RETENTION_MS: RETENTION_MS,
    track: track,
    trackOnce: trackOnce,
    reportEvent: reportEvent,
    reportMonitor: reportMonitor,
    getEvents: getEvents,
    clear: clear
};
