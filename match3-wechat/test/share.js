/**
 * 分享裂变逻辑测试（Node 环境，mock wx）
 * 用法: node test/share.js
 */

let sharedCount = 0;
global.wx = {
    getStorageSync: function () { return undefined; }, // 由 store 模拟
    setStorageSync: function () {},
    shareAppMessage: function () { sharedCount++; }
};

// 用内存 storage 模拟（手动实现，覆盖上面 getStorageSync）
const store = {};
wx.getStorageSync = function (k) { return store[k]; };
wx.setStorageSync = function (k, v) { store[k] = v; };

const share = require('../js/core/share');

function assert(name, cond) {
    console.log((cond ? '✅' : '❌') + ' ' + name);
    return cond;
}

let allOk = true;

// 1. 初始可分享 3 次
allOk = assert('初始可分享3次', share.canShare() && share.getRemaining() === 3) && allOk;

// 2. 分享领奖（+1 体力计数）
let r = share.shareAndReward();
allOk = assert('第一次分享领奖', r.shared && r.rewarded && r.remaining === 2) && allOk;

// 3. 连续 3 次后不可再领
share.shareAndReward();
share.shareAndReward();
allOk = assert('3次后不可分享', share.getRemaining() === 0 && !share.canShare()) && allOk;

// 4. 超限后分享不给奖励
r = share.shareAndReward();
allOk = assert('超限分享无奖励', r.shared && !r.rewarded) && allOk;

// 5. 跨天重置（模拟日期变化）
const realDate = Date;
// 推进一天：直接改 storage 日期模拟跨天
store['match3_share_v1'] = { date: '2000-01-01', count: 3 };
allOk = assert('跨天重置可分享', share.canShare() && share.getRemaining() === 3) && allOk;

// 6. wx 存在时真的调起分享
allOk = assert('调起分享面板', sharedCount > 0) && allOk;

console.log('========================================');
console.log('分享裂变: ' + (allOk ? '全部通过 ✅' : '存在失败 ❌'));
process.exit(allOk ? 0 : 1);
