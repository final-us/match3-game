/**
 * UI 冒烟测试：mock canvas，调用所有界面绘制函数确保不抛异常
 * 用法: node test/ui-smoke.js
 */

// mock canvas 2d context
function mockCtx() {
    return new Proxy({}, {
        get: function (t, k) {
            if (k === 'measureText') return function () { return { width: 50 }; };
            if (k === 'createLinearGradient') return function () {
                return { addColorStop: function () {} };
            };
            return function () {};
        },
        set: function () { return true; }
    });
}

const UI = require('../js/render/ui');
const ctx = mockCtx();
const screen = { width: 375, height: 667 };
let allOk = true;
function assert(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
    } catch (e) {
        console.log('❌ ' + name + ' → ' + e.message);
        allOk = false;
    }
}

assert('主菜单（体力充足+可分享）', function () {
    UI.drawMenu(ctx, screen, 5, { count: 5, timeLeftText: '00:00', canPlay: true }, 3);
});
assert('主菜单（体力不足+分享用尽）', function () {
    UI.drawMenu(ctx, screen, 5, { count: 0, timeLeftText: '12:34', canPlay: false }, 0);
});
assert('商店页', function () {
    UI.drawShop(ctx, screen, 1000, { hammer: 1, bomb: 0, color: 2 });
});
assert('结算页（胜利3星）', function () {
    UI.drawResult(ctx, screen, { win: true, score: 1000, coinReward: 180, star: 3, canRevive: false });
});
assert('结算页（失败可复活）', function () {
    UI.drawResult(ctx, screen, { win: false, score: 500, coinReward: 0, star: 0, canRevive: true });
});
assert('关卡地图（20关）', function () {
    UI.drawLevelSelect(ctx, screen, 8, 1000, 20, { 1: 3, 2: 2, 3: 1 });
});
assert('关卡地图（小屏）', function () {
    UI.drawLevelSelect(ctx, { width: 320, height: 568 }, 8, 1000, 20, {});
});

console.log('========================================');
console.log('UI 冒烟: ' + (allOk ? '全部通过 ✅' : '存在失败 ❌'));
process.exit(allOk ? 0 : 1);
