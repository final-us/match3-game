'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const storage = {};
let remoteReports = 0;
global.wx = {
    getStorageSync: function (key) { return storage[key]; },
    setStorageSync: function (key, value) { storage[key] = value; },
    reportEvent: function () { remoteReports++; }
};

const analytics = require('../js/core/analytics');
analytics.clear();

const item = analytics.track('solo_complete', {
    level: 8,
    result: 'win',
    stars: 3,
    durationBucket: 'from_60_to_119s',
    reviveCount: 1,
    roomId: 'Rsecret',
    openid: 'openid-secret',
    nickname: '昵称',
    avatar: 'https://secret',
    rawError: 'database stack'
});
assert(item);
assert.deepStrictEqual(Object.keys(item).sort(), [
    'durationBucket', 'event', 'level', 'result', 'reviveCount', 'stars', 'timestamp'
].sort());
assert.strictEqual(JSON.stringify(item).includes('secret'), false);
assert.strictEqual(remoteReports, 0, '远端上报默认关闭');

assert(analytics.trackOnce('home_exposure'));
assert.strictEqual(analytics.trackOnce('home_exposure'), null, '同一会话首页曝光未去重');
assert.strictEqual(analytics.track('room_id_leak', { result: 'success' }), null,
    '敏感事件名未被拒绝');
const enumItem = analytics.track('pvp_error', { category: 'join', reason: '数据库原始错误' });
assert.strictEqual(enumItem.category, 'join');
assert.strictEqual(Object.prototype.hasOwnProperty.call(enumItem, 'reason'), false,
    '枚举字段接受了未经约束的原始错误');

const mainSource = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
[
    'home_exposure', 'solo_level_select', 'solo_start', 'solo_complete',
    'pvp_click', 'pvp_create', 'pvp_invite_share', 'pvp_join', 'pvp_ready',
    'pvp_start', 'pvp_complete', 'pvp_error'
].forEach(function (event) {
    assert(mainSource.includes("'" + event + "'"), '缺少核心漏斗事件 ' + event);
});

console.log('analytics funnel tests passed');
