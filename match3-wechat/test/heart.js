/**
 * 体力系统逻辑测试（Node 环境，mock wx storage）
 * 用法: node test/heart.js
 * 验证：消耗/恢复/离线恢复/加心/倒计时
 */

// mock wx storage（内存实现）
const store = {};
global.wx = {
    getStorageSync: function (k) { return store[k]; },
    setStorageSync: function (k, v) { store[k] = v; }
};

const heart = require('../js/core/heart');

// 用可控时钟模拟时间
let fakeNow = Date.now();
const realNow = Date.now;
Date.now = function () { return fakeNow; };

function assert(name, cond) {
    console.log((cond ? '✅' : '❌') + ' ' + name);
    return cond;
}

let allOk = true;

// 1. 初始满心 5
let s = heart.getHeartState();
allOk = assert('初始满心5', s.count === 5) && allOk;

// 2. 消耗 3 颗 → 剩 2，开始计时
heart.consumeHeart(); heart.consumeHeart(); heart.consumeHeart();
s = heart.getHeartState();
allOk = assert('消耗3颗后剩2', s.count === 2) && allOk;
allOk = assert('开始恢复计时', s.lastLossTime > 0) && allOk;

// 3. 25 分钟后恢复 1 颗 → 3
fakeNow += 25 * 60 * 1000;
s = heart.getHeartState();
allOk = assert('25分钟后恢复1颗(3)', s.count === 3) && allOk;

// 4. 再 50 分钟 → 恢复 2 颗 → 5（满）
fakeNow += 50 * 60 * 1000;
s = heart.getHeartState();
allOk = assert('累计75分钟恢复满(5)', s.count === 5) && allOk;
allOk = assert('满心停止计时(lastLossTime=0)', s.lastLossTime === 0) && allOk;

// 5. 满心时剩余恢复时间为 0
allOk = assert('满心倒计时为0', heart.getRecoverTimeLeft() === 0) && allOk;

// 6. 消耗到 0，不能继续消耗
heart.consumeHeart(); heart.consumeHeart(); heart.consumeHeart(); heart.consumeHeart(); heart.consumeHeart();
s = heart.getHeartState();
allOk = assert('消耗到0', s.count === 0) && allOk;
allOk = assert('0心不能消耗', heart.consumeHeart() === false) && allOk;

// 7. 看广告补 1 心 → 1
heart.addHeart(1);
s = heart.getHeartState();
allOk = assert('补1心(1)', s.count === 1) && allOk;

// 8. 倒计时格式 mm:ss
fakeNow += 5 * 60 * 1000; // 恢复计时已过5分钟
const left = heart.getRecoverTimeLeft();
const fmt = heart.formatTimeLeft();
allOk = assert('倒计时剩余20分钟', left === 20 * 60 * 1000 && fmt === '20:00') && allOk;

// 9. 离线恢复：模拟离开 100 分钟
fakeNow += 100 * 60 * 1000;
s = heart.getHeartState();
allOk = assert('离线100分钟恢复(1→满5)', s.count === 5) && allOk;

Date.now = realNow;
console.log('========================================');
console.log('体力系统: ' + (allOk ? '全部通过 ✅' : '存在失败 ❌'));
process.exit(allOk ? 0 : 1);
