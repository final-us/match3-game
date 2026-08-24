'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = function (relativePath) {
    return fs.readFileSync(path.join(root, relativePath), 'utf8');
};

const configSource = read('js/core/config.js');
const readme = read('README.md');
const projectConfig = require('../project.config.json');
const cloudBattleSource = read('js/net/cloud-battle.js');
const battleSource = read('cloudfunctions/battle/index.js');
const battleConfig = require('../cloudfunctions/battle/config.json');
const mainSource = read('js/main.js');
const battleUiSource = read('js/render/battle-ui.js');
const adSource = read('js/core/ad.js');

assert(projectConfig.appid && projectConfig.appid !== 'touristappid', '项目 AppID 仍是陈旧占位值');
assert(!/占位|placeholder/i.test(configSource), '配置仍包含陈旧 placeholder 注释');
assert(!readme.includes('touristappid'), 'README 仍包含陈旧 touristappid 描述');
assert(!readme.includes('云函数依赖阻断项'), 'README 仍把云函数依赖写成阻断项');
assert(cloudBattleSource.includes('wx.cloud.init({ env: CLOUD_ENV });'), '云开发初始化配置发生漂移');
assert(!cloudBattleSource.includes('traceUser'), '云开发初始化不应启用 traceUser');
assert(battleSource.includes('logic.isValidRoomId(roomId)'), '房间事务入口缺少 roomId 门禁');
assert(battleSource.includes('if (!openid)'), '云函数缺少可信用户身份门禁');
assert(battleSource.includes('Number(res.stats.removed)'), '定时清理未读取 wx-server-sdk 的 stats.removed 计数');
assert(!battleSource.includes('error.message'), '云函数 catch 不得向客户端透传 error.message');
assert(mainSource.includes('cloudBattle.isValidRoomId(query.roomId)'), '分享 query 缺少 roomId 预校验');
assert(mainSource.includes('邀请已失效或对局已结束'), '加入失败缺少明确的邀请失效提示');
assert(mainSource.includes("res.err === '邀请已失效'"), '等待页未处理服务端邀请过期');
assert(battleSource.includes("case 'configureItems'"), 'PvP 缺少服务端权威道具配置入口');
assert(battleSource.includes('itemCooldownUntil'), 'PvP 缺少服务端共享冷却状态');
assert(battleSource.includes('consumeCreateRateLimit') && battleSource.includes('createLimitDocId'),
    'PvP 建房缺少服务端哈希限流');
assert(battleSource.includes('return db.runTransaction'), 'PvP 建房限流与房间写入未放入事务');
assert(mainSource.includes('创建太频繁，请稍后再试'), '客户端缺少建房限流友好提示');
assert(!battleUiSource.includes("key: 'hammer'") && !battleUiSource.includes("key: 'color'"), 'PvP UI 仍暴露单人商店道具');
assert(adSource.includes('isRealRewardedAvailable'), '商店缺少真实激励广告可用性门禁');
assert(mainSource.includes("allowMock: false"), '商店激励视频未明确禁止 debug mock');

const cleanupTrigger = (battleConfig.triggers || []).find(function (trigger) {
    return trigger.name === 'cleanup-battle-rooms';
});
assert(cleanupTrigger && cleanupTrigger.type === 'timer', '缺少对战房间定时清理触发器');
assert(/^\S+( \S+){6}$/.test(cleanupTrigger.config), '定时清理必须使用七段 cron');

console.log('release gates passed');
