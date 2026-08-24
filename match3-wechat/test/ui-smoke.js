/**
 * UI 冒烟测试：mock canvas，调用所有界面绘制函数确保不抛异常
 * 用法: node test/ui-smoke.js
 */

// mock canvas 2d context
const drawnText = [];
const drawnImages = [];
const canvasStats = { fill: 0 };
function mockCtx() {
    return new Proxy({}, {
        get: function (t, k) {
            if (Object.prototype.hasOwnProperty.call(t, k)) return t[k];
            if (k === 'fillText') return function (text, x, y) {
                drawnText.push({ text: String(text), x: x, y: y, font: t.font, align: t.textAlign, baseline: t.textBaseline });
            };
            if (k === 'measureText') return function (text) { return { width: String(text).length * 8 }; };
            if (k === 'drawImage') return function () {
                const args = Array.prototype.slice.call(arguments);
                drawnImages.push({ src: args[0] && args[0].src, args: args });
            };
            if (k === 'fill') return function () { canvasStats.fill++; };
            if (k === 'createLinearGradient' || k === 'createRadialGradient') return function () {
                return { addColorStop: function () {} };
            };
            return function () {};
        },
        set: function (t, k, v) { t[k] = v; return true; }
    });
}

const UI = require('../js/render/ui');
const BattleUI = require('../js/render/battle-ui');
const GameCore = require('../js/core/game-core');
const BoardRenderer = require('../js/render/board-render');
const assets = require('../js/render/assets');
const typography = require('../js/render/typography');
const OnboardingUI = require('../js/render/onboarding');
const ctx = mockCtx();
const screen = { width: 375, height: 667 };
assets.preload();
let allOk = true;
function textValues() {
    return drawnText.map(function (item) { return item.text; });
}
function imageRecords(src) {
    return drawnImages.filter(function (item) { return item.src === src; });
}
function assert(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
    } catch (e) {
        console.log('❌ ' + name + ' → ' + e.message);
        allOk = false;
    }
}

assert('统一圆润排版与放大字号', function () {
    const numberFont = typography.font(20, 'bold', true);
    if (numberFont.indexOf('Arial Rounded MT Bold') === -1 || numberFont.indexOf('22px') === -1) {
        throw new Error('数字未使用圆润放大排版');
    }
    typography.set(ctx, 20, undefined, false, 'left', 'middle');
    if (ctx.font.indexOf('500 22px') !== 0) throw new Error('默认文字未加粗放大');
});
assert('首页 HUD 原尺寸、左对齐且避开胶囊', function () {
    const homeScreen = { width: 375, height: 667, safeTop: 20, contentRight: 280, reduceEffects: false };
    drawnText.length = 0;
    drawnImages.length = 0;
    UI.drawMenu(ctx, homeScreen, 5, { count: 5, timeLeftText: '00:00', canPlay: true }, { coins: 1000 });
    const heartImage = imageRecords('res/ui/heart.png')[0];
    const coinImage = imageRecords('res/ui/coin.png')[0];
    const heartText = drawnText.find(function (item) { return item.text === '5'; });
    const coinText = drawnText.find(function (item) { return item.text === '1000'; });
    if (!heartImage || !coinImage || !heartText || !coinText) throw new Error('首页 HUD 内容缺失');
    if (heartImage.args[4] < 28 || coinImage.args[4] < 28) throw new Error('首页 HUD 图标尺寸异常');
    if (Math.abs(heartImage.args[2] + heartImage.args[4] / 2 - (homeScreen.safeTop + 40 + 21)) > 1) {
        throw new Error('体力图标未垂直居中');
    }
    if (heartText.x <= heartImage.args[1] + heartImage.args[3] || coinText.x <= coinImage.args[1] + coinImage.args[3]) {
        throw new Error('首页 HUD 数字未在图标右侧左对齐');
    }
    if (coinImage.args[1] + coinImage.args[3] >= homeScreen.contentRight) throw new Error('首页 HUD 侵入微信胶囊');
    const titleImage = drawnImages.find(function (item) { return item.src === 'res/home/title-logo.png'; });
    if (!titleImage || titleImage.args[2] < homeScreen.safeTop + 90) throw new Error('首页标题与 HUD 重叠');
});
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
    drawnText.length = 0;
    drawnImages.length = 0;
    const shopButtons = UI.drawShop(ctx, screen, 999999999, { hammer: 9999, bomb: 0, color: 2 }, {
        canReward: true, count: 3, limit: 10, pending: false
    });
    const coinImages = imageRecords('res/ui/coin.png');
    ['900', '1300', '1100'].forEach(function (price, index) {
        const priceText = drawnText.find(function (item) { return item.text === price; });
        const priceIcon = coinImages[index + 1];
        if (!priceText || !priceIcon || priceText.align !== 'left' || priceText.x <= priceIcon.args[1] + priceIcon.args[3]) {
            throw new Error('商店价格未与金币图标分离 ' + price);
        }
    });
    if (!shopButtons.reward_hammer || !shopButtons.reward_bomb || !shopButtons.reward_color) {
        throw new Error('真实广告可用时缺少三种道具领取入口');
    }
    const hidden = UI.drawShop(ctx, screen, 0, { hammer: 0, bomb: 0, color: 0 }, { canReward: false });
    if (hidden.reward_hammer || hidden.reward_bomb || hidden.reward_color) throw new Error('广告不可用时仍显示领取入口');
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
assert('零素材情境式引导（窄屏安全区）', function () {
    const small = { width: 320, height: 568, safeTop: 24, safeBottom: 20, reduceEffects: false };
    Object.keys(OnboardingUI.CONTENT).forEach(function (key) {
        const buttons = OnboardingUI.draw(ctx, small, key);
        ['skip', 'confirm'].forEach(function (name) {
            const button = buttons[name];
            if (button.x < 0 || button.y < small.safeTop || button.x + button.w > small.width ||
                button.y + button.h > small.height - small.safeBottom) throw new Error('引导按钮溢出 ' + key);
        });
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
assert('单人倒计时与超时文案', function () {
    drawnText.length = 0;
    canvasStats.fill = 0;
    const board = new BoardRenderer(ctx, screen);
    board.setGame(new GameCore({
        id: 2, rows: 8, columns: 8, timeLimitSec: 180, moveCount: 28,
        goals: [{ type: 'score', target: 3600 }]
    }, {}));
    board.core.timerStarted = true;
    board.core.timeLeftMs = 62000;
    board.drawTopBar();
    const topBarText = textValues();
    if (topBarText.indexOf('目标分 3600') === -1 || topBarText.indexOf('时间') === -1 || topBarText.indexOf('01:02') === -1) {
        throw new Error('棋盘目标框未显示倒计时');
    }
    if (canvasStats.fill !== 4) throw new Error('棋盘新增了独立时间框');
    drawnText.length = 0;
    UI.drawResult(ctx, screen, { win: false, reason: 'timeout', score: 0, coinReward: 0, star: 0, canRevive: false });
    if (textValues().indexOf('时间到') === -1) throw new Error('结算页未显示超时文案');
});
assert('特殊棋子静态标识与触发动画', function () {
    const board = new BoardRenderer(ctx, screen);
    board.setGame(new GameCore({
        id: 6, rows: 8, columns: 8, moveCount: 20,
        goals: [{ type: 'score', target: 99999 }]
    }, {}));
    board.core.grid[0][0] = 101;
    board.core.grid[0][1] = 102;
    board.core.grid[0][2] = 103;
    board.core.grid[0][3] = 104;
    board.syncPiecesFromGrid();
    board.drawBoard();
    board.spawnSpecialEffect(101, board.boardX + board.tileSize / 2, board.boardY + board.tileSize / 2);
    board.spawnSpecialEffect(102, board.boardX + board.tileSize * 1.5, board.boardY + board.tileSize / 2);
    board.spawnSpecialEffect(103, board.boardX + board.tileSize * 2.5, board.boardY + board.tileSize / 2);
    board.spawnSpecialEffect(104, board.boardX + board.tileSize * 3.5, board.boardY + board.tileSize / 2);
    board.update(100);
    board.drawSpecialEffects();
});
assert('无限关卡地图每屏固定五关', function () {
    drawnImages.length = 0;
    const buttons = UI.drawLevelSelect(ctx, screen, 8, 999999999, { 6: 3, 7: 2 }, { offset: 5 });
    if (buttons.visibleLevels.length !== 5) throw new Error('可见关卡不是 5 个');
    if (buttons.visibleLevels.join(',') !== '6,7,8,9,10') throw new Error('可见关卡区间错误');
    if (buttons.map.maxOffset !== 7) throw new Error('最大预览边界不是已解锁关之后 4 关');
    buttons.visibleLevels.forEach(function (id) {
        if (!buttons['level_' + id]) throw new Error('缺少关卡命中区 ' + id);
    });
    if (imageRecords('res/ui/coin.png').length) throw new Error('关卡页仍显示金币数量 HUD');
    const centers = buttons.visibleLevels.map(function (id) {
        const button = buttons['level_' + id];
        return { x: button.x + button.w / 2, y: button.y + button.h / 2 };
    });
    if (centers[0].y <= centers[4].y || centers[4].y > screen.height * 0.3) {
        throw new Error('五个节点未沿小径向亭子收束');
    }
    const expectedPathX = [0.52, 0.45, 0.56, 0.48, 0.50];
    centers.forEach(function (center, index) {
        if (Math.abs(center.x / screen.width - expectedPathX[index]) > 0.01) {
            throw new Error('关卡节点偏离小径中心线 ' + (index + 1));
        }
    });
});
assert('关卡地图（小屏）', function () {
    const small = { width: 320, height: 568, safeTop: 20, safeBottom: 0, reduceEffects: false };
    const buttons = UI.drawLevelSelect(ctx, small, 100000, 999999999, {}, { offset: 99999 });
    buttons.visibleLevels.forEach(function (id) {
        const button = buttons['level_' + id];
        if (button.x < 0 || button.y < 0 || button.x + button.w > small.width || button.y + button.h > small.height) {
            throw new Error('小屏关卡节点溢出 ' + id);
        }
    });
});
assert('PvP UI（倒计时/警告/受击）', function () {
    const pvpScreen = { width: 375, height: 812, safeTop: 0, safeBottom: 0, reduceEffects: false };
    const waitButtons = BattleUI.drawWait(ctx, pvpScreen, {
        roomId: 'R1', myName: '我', myReady: false,
        oppName: '对手', oppReady: false, oppJoined: true, items: { freeze: 1, disturb: 2 }, isHost: true
    });
    if (!waitButtons.freezeMinus || !waitButtons.freezePlus || !waitButtons.disturbMinus || !waitButtons.disturbPlus) {
        throw new Error('等待页缺少对战道具配置按钮');
    }
    BattleUI.drawTop(ctx, pvpScreen, { timeLeft: 10, myScore: 10, oppScore: 8, urgent: true });
    BattleUI.drawCountdown(ctx, pvpScreen, { seconds: 3 });
    BattleUI.drawCountdown(ctx, pvpScreen, { label: '开始' });
    BattleUI.drawWarning(ctx, pvpScreen);
    const pvpItems = BattleUI.drawItems(ctx, pvpScreen, {
        freeze: 1, disturb: 2, cooldownRemaining: 8500, active: false
    });
    if (!pvpItems.freeze || !pvpItems.disturb || pvpItems.hammer || pvpItems.bomb || pvpItems.color) {
        throw new Error('PvP 道具栏仍包含单人商店道具');
    }
    BattleUI.drawEffects(ctx, pvpScreen, {
        frozen: true, frozenRemaining: 2400,
        disturb: true, disturbRemaining: 4200,
        castNotice: 'freeze', boardX: 8, boardY: 218, boardW: 359, boardH: 359
    });
    BattleUI.drawResult(ctx, pvpScreen, { result: 'win', myScore: 10, oppScore: 8, coinReward: 150 });
    if (!/^[\u4e00-\u9fff]+$/.test(BattleUI.roomDisplayName('R123456789abcdef'))) throw new Error('中文房间名生成失败');
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
    const top = Math.max(72, pvpScreen.contentTop || pvpScreen.safeTop) + 64;
    const bottom = pvpScreen.height - pvpScreen.safeBottom - 88;
    if (board.core.grid.length !== 8 || board.core.grid[0].length !== 8) throw new Error('棋盘不是 8×8');
    if (board.boardX < 0 || board.boardX + board.boardW > pvpScreen.width) throw new Error('棋盘水平溢出');
    if (board.boardY < top || board.boardY + board.boardH > bottom) throw new Error('棋盘垂直溢出');
    if (Math.abs(board.boardX + board.boardW / 2 - pvpScreen.width / 2) > 1) throw new Error('棋盘未水平居中');
    if (Math.abs(board.boardY + board.boardH / 2 - (top + bottom) / 2) > 1) throw new Error('棋盘未垂直居中');
    if (board.pointToGrid(board.boardX + board.boardW, board.boardY) !== null ||
        board.pointToGrid(board.boardX, board.boardY + board.boardH) !== null) {
        throw new Error('棋盘右/下精确边界被映射到越界格');
    }
});

assert('正式视觉资源全部指向运行时素材', function () {
    if (assets.ASSETS.gameBackground !== 'res/game-background-v2.jpg') throw new Error('游戏背景未切换');
    if (assets.ASSETS.levelBackground !== 'res/level-background-v2.jpg') throw new Error('关卡背景未切换');
    ['Current', 'Done', 'Locked'].forEach(function (state) {
        if (assets.ASSETS['levelNode' + state] !== 'res/ui/level-node-' + state.toLowerCase() + '-v2.png') {
            throw new Error('关卡节点素材未切换: ' + state);
        }
    });
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
        UI.drawShop(ctx, s, 999999999, { hammer: 9999, bomb: 9999, color: 9999 });
        UI.drawLevelSelect(ctx, s, 100000, 999999999, {}, { offset: 99997 });
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
