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
const BattleUI = require('../js/render/battle-ui');
const GameCore = require('../js/core/game-core');
const BoardRenderer = require('../js/render/board-render');
const assets = require('../js/render/assets');
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

assert('主菜单（体力充足）', function () {
    UI.drawMenu(ctx, screen, 5, { count: 5, timeLeftText: '00:00', canPlay: true }, { coins: 1000 });
});
assert('主菜单（体力不足）', function () {
    const hidden = UI.drawMenu(ctx, screen, 5, { count: 0, timeLeftText: '12:34', canPlay: false, canAd: false }, { coins: 0 });
    if (hidden.addHeart) throw new Error('广告不可用时仍显示补体力入口');
    const shown = UI.drawMenu(ctx, screen, 5, { count: 0, timeLeftText: '12:34', canPlay: false, canAd: true }, { coins: 0 });
    if (!shown.addHeart) throw new Error('广告可用时未显示补体力入口');
});
assert('商店页', function () {
    UI.drawShop(ctx, screen, 1000, { hammer: 1, bomb: 0, color: 2 });
});
assert('设置页（音乐/音效/隐私）', function () {
    const buttons = UI.drawSettings(ctx, screen, { musicEnabled: true, sfxEnabled: false });
    if (!buttons.music || !buttons.sfx || !buttons.privacy || !buttons.back) throw new Error('设置按钮不完整');
    UI.drawSettings(ctx, screen, { musicEnabled: false, sfxEnabled: true });
});
assert('设置页（320×568 不溢出）', function () {
    const small = { width: 320, height: 568, safeTop: 0, safeBottom: 0, reduceEffects: false };
    const buttons = UI.drawSettings(ctx, small, { musicEnabled: true, sfxEnabled: true });
    ['music', 'sfx', 'privacy', 'back'].forEach(function (key) {
        const button = buttons[key];
        if (!button || button.x < 0 || button.y < 0 || button.x + button.w > small.width || button.y + button.h > small.height) {
            throw new Error('设置按钮溢出 ' + key);
        }
    });
});
assert('结算页（胜利3星）', function () {
    UI.drawResult(ctx, screen, { win: true, score: 1000, coinReward: 180, star: 3, canRevive: false });
});
assert('结算页（失败可复活）', function () {
    const hidden = UI.drawResult(ctx, screen, { win: false, score: 500, coinReward: 0, star: 0, canRevive: false });
    if (hidden.revive) throw new Error('广告不可用时仍显示复活入口');
    const shown = UI.drawResult(ctx, screen, { win: false, score: 500, coinReward: 0, star: 0, canRevive: true });
    if (!shown.revive) throw new Error('广告可用时未显示复活入口');
});
assert('关卡地图（20关）', function () {
    UI.drawLevelSelect(ctx, screen, 8, 1000, 20, { 1: 3, 2: 2, 3: 1 });
});
assert('关卡地图（小屏）', function () {
    UI.drawLevelSelect(ctx, { width: 320, height: 568 }, 8, 1000, 20, {});
});
assert('PvP UI（倒计时/警告/受击）', function () {
    const pvpScreen = { width: 375, height: 812, safeTop: 0, safeBottom: 0, reduceEffects: false };
    BattleUI.drawWait(ctx, pvpScreen, {
        roomId: 'R1', myName: '我', myReady: false,
        oppName: '对手', oppReady: false, oppJoined: true, isHost: true
    });
    BattleUI.drawTop(ctx, pvpScreen, { timeLeft: 10, myScore: 10, oppScore: 8, urgent: true });
    BattleUI.drawCountdown(ctx, pvpScreen, { seconds: 3 });
    BattleUI.drawCountdown(ctx, pvpScreen, { label: '开始' });
    BattleUI.drawWarning(ctx, pvpScreen);
    BattleUI.drawItems(ctx, pvpScreen, { hammer: 1, bomb: 0, color: 1, freeze: 1, disturb: 1 });
    BattleUI.drawEffects(ctx, pvpScreen, { frozen: true, disturb: true, boardY: 218 });
    BattleUI.drawResult(ctx, pvpScreen, { result: 'win', myScore: 10, oppScore: 8, coinReward: 150 });
});
assert('PvP 8×8 棋盘在上下保留区居中且不溢出', function () {
    const pvpScreen = {
        width: 375, height: 812,
        safeTop: 0, safeBottom: 0, safeLeft: 0, safeRight: 0,
        reduceEffects: false
    };
    const board = new BoardRenderer(ctx, pvpScreen);
    board.battleMode = true;
    board.setGame(new GameCore({
        id: 0, rows: 8, columns: 8, moveCount: 999,
        goals: [{ type: 'score', target: 99999999 }]
    }, {}));
    const top = pvpScreen.safeTop + 64;
    const bottom = pvpScreen.height - pvpScreen.safeBottom - 88;
    if (board.core.grid.length !== 8 || board.core.grid[0].length !== 8) throw new Error('棋盘不是 8×8');
    if (board.boardX < 0 || board.boardX + board.boardW > pvpScreen.width) throw new Error('棋盘水平溢出');
    if (board.boardY < top || board.boardY + board.boardH > bottom) throw new Error('棋盘垂直溢出');
    if (Math.abs(board.boardX + board.boardW / 2 - pvpScreen.width / 2) > 1) throw new Error('棋盘未水平居中');
    if (Math.abs(board.boardY + board.boardH / 2 - (top + bottom) / 2) > 1) throw new Error('棋盘未垂直居中');
});

assert('正式视觉资源全部指向运行时素材', function () {
    if (assets.ASSETS.gameBackground !== 'res/game-background-v2.jpg') throw new Error('游戏背景未切换');
    if (assets.ASSETS.levelBackground !== 'res/level-background-v2.jpg') throw new Error('关卡背景未切换');
    for (let i = 1; i <= 5; i++) {
        if (assets.ASSETS['piece' + i] !== 'res/piece' + i + '-runtime.png') throw new Error('棋子 ' + i + ' 未切换');
    }
});

assert('三档目标屏幕布局不溢出', function () {
    const sizes = [
        { width: 375, height: 667, safeTop: 20, safeBottom: 0 },
        { width: 390, height: 844, safeTop: 44, safeBottom: 34 },
        { width: 430, height: 932, safeTop: 47, safeBottom: 34 }
    ];
    for (let i = 0; i < sizes.length; i++) {
        const s = Object.assign({ safeLeft: 0, safeRight: 0, reduceEffects: false }, sizes[i]);
        UI.drawMenu(ctx, s, 8, { count: 5, timeLeftText: '10:00', canPlay: true }, { coins: 1000 });
        UI.drawLevelSelect(ctx, s, 8, 1000, 20, {});
        UI.drawResult(ctx, s, { win: true, score: 1000, coinReward: 100, star: 3, hasNext: true });
        const board = new BoardRenderer(ctx, s);
        board.setGame(new GameCore({
            id: 1, rows: 8, columns: 8, moveCount: 20,
            goals: [{ type: 'score', target: 5000 }]
        }, {}));
        if (board.boardX < 0 || board.boardX + board.boardW > s.width) throw new Error('棋盘水平溢出 ' + s.width);
        if (board.boardY < s.safeTop + 92) throw new Error('棋盘压住 HUD ' + s.width);
        if (board.boardY + board.boardH > s.height - s.safeBottom - 108) throw new Error('棋盘压住道具栏 ' + s.width);
    }
});

console.log('========================================');
console.log('UI 冒烟: ' + (allOk ? '全部通过 ✅' : '存在失败 ❌'));
process.exit(allOk ? 0 : 1);
