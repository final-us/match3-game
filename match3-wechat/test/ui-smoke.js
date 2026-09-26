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
    if (Math.abs(heartImage.args[2] + heartImage.args[4] / 2 - (homeScreen.safeTop + 8 + 21)) > 1) {
        throw new Error('体力图标未垂直居中');
    }
    if (heartText.x <= heartImage.args[1] + heartImage.args[3] || coinText.x <= coinImage.args[1] + coinImage.args[3]) {
        throw new Error('首页 HUD 数字未在图标右侧左对齐');
    }
    if (coinImage.args[1] + coinImage.args[3] >= homeScreen.contentRight) throw new Error('首页 HUD 侵入微信胶囊');
    const titleImage = drawnImages.find(function (item) { return item.src === 'res/home/title-logo.png'; });
    if (!titleImage || titleImage.args[2] < homeScreen.safeTop + 58) throw new Error('首页标题与 HUD 重叠');
});
assert('主菜单（体力充足）', function () {
    UI.drawMenu(ctx, screen, 5, { count: 5, timeLeftText: '00:00', canPlay: true }, { coins: 1000 });
});
assert('原稿首页层级与短屏触控', function () {
    for (const [width,height] of [[320,568],[375,812],[430,932]]) {
        const s={width,height,safeTop:24,safeBottom:20};
        drawnImages.length = 0;
        const b=UI.drawMenu(ctx,s,5,{count:5,timeLeftText:'12:34',canPlay:true},{coins:1000});
        for (const [key, src] of [['shop','res/ui/shop.png'],['settings','res/ui/settings.png']]) {
            const image = imageRecords(src)[0];
            if (!image) throw new Error('缺少精修按钮图标 ' + key);
            const [,ix,iy,iw,ih] = image.args;
            const target = b[key];
            if (ix < target.x || iy < target.y || ix + iw > target.x + target.w || iy + ih > target.y + target.h) throw new Error('图标溢出按钮 ' + key);
        }
        if(b.start.w>=b.battle.w) throw new Error('副入口宽度不得压过主入口');
        for(const [key,label] of [['battle','好友对战'],['start','单人闯关']]) {
            const labelDraw=drawnText.filter(item=>item.text===label).pop(),target=b[key];
            if(!labelDraw||labelDraw.align!=='center'||Math.abs(labelDraw.x-(target.x+target.w/2))>.01||Math.abs(labelDraw.y-(target.y+target.h/2))>.01) throw new Error('按钮文字未完整居中 '+key);
        }
        for(const key of ['battle','start','shop','settings']) {
            const r=b[key];
            if(r.w<44||r.h<44||r.x<0||r.x+r.w>width||r.y<0||r.y+r.h>height) throw new Error('触控范围异常 '+key);
        }
        if(b.battle.y+b.battle.h>=b.start.y) throw new Error('主副入口重叠');
    }
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
        canReward: true, count: 3, limit: 10, pending: false, heartCount: 2, heartMax: 5
    });
    const coinImages = imageRecords('res/ui/coin.png');
    ['900', '1300', '1100', '1000'].forEach(function (price, index) {
        const priceText = drawnText.find(function (item) { return item.text === price; });
        const priceIcon = coinImages[index + 1];
        if (!priceText || !priceIcon || priceText.align !== 'left' || priceText.x <= priceIcon.args[1] + priceIcon.args[3]) {
            throw new Error('商店价格未与金币图标分离 ' + price);
        }
    });
    if (!shopButtons.reward_hammer || !shopButtons.reward_bomb || !shopButtons.reward_color || !shopButtons.reward_heart) {
        throw new Error('真实广告可用时缺少商品领取入口');
    }
    if (!shopButtons.buy_heart) throw new Error('商店缺少1000金币体力商品');
    const hidden = UI.drawShop(ctx, screen, 0, { hammer: 0, bomb: 0, color: 0 }, { canReward: false });
    if (hidden.reward_hammer || hidden.reward_bomb || hidden.reward_color || hidden.reward_heart) {
        throw new Error('广告不可用时仍显示领取入口');
    }
    drawnText.length = 0;
    UI.drawShop(ctx, screen, 1000, { hammer: 0, bomb: 0, color: 0 }, {
        canReward: true, count: 10, limit: 10, heartCount: 5, heartMax: 5
    });
    if (!textValues().includes('已满')) throw new Error('体力已满时广告入口未禁用');
});
assert('设置页（音乐/音效/隐私）', function () {
    const buttons = UI.drawSettings(ctx, screen, { musicEnabled: true, sfxEnabled: false });
    if (!buttons.music || !buttons.sfx || !buttons.privacy || !buttons.back) throw new Error('设置按钮不完整');
    UI.drawSettings(ctx, screen, { musicEnabled: false, sfxEnabled: true });
});
assert('体力耗尽提醒', function () {
    for (const dimensions of [[320,568],[375,812],[430,932]]) {
        const s = { width: dimensions[0], height: dimensions[1], safeTop: 24, safeBottom: 20, contentTop: 72 };
        drawnText.length = 0;
        const shown = UI.drawStaminaEmpty(ctx, s, { timeLeftText: '12:34', canBuy: true, canAd: true });
        if (!shown.buy || !shown.ad || !shown.close) throw new Error('双补充入口或关闭入口缺失');
        if (!textValues().includes('体力耗尽') || !textValues().includes('广告 · +1')) {
            throw new Error('提醒文案缺失');
        }
        Object.keys(shown).forEach(function (key) {
            const button = shown[key];
            if (button.w < 44 || button.h < 44 || button.x < 0 || button.y < s.safeTop ||
                button.x + button.w > s.width || button.y + button.h > s.height - s.safeBottom) {
                throw new Error('提醒触控溢出 ' + key);
            }
        });
        const hidden = UI.drawStaminaEmpty(ctx, s, { timeLeftText: '12:34', canBuy: false, canAd: false });
        if (hidden.ad) throw new Error('广告不可用时仍显示补体力入口');
    }
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
assert('B商店与设置：三档状态、触控与独立开关', function () {
    for (const [width,height] of [[320,568],[375,812],[430,932]]) {
        const s={width,height,safeTop:24,safeBottom:20,contentTop:72,reduceEffects:true};
        for (const options of [{canReward:true,count:1,limit:10},{canReward:true,count:10,limit:10},{canReward:true,pending:true},{canReward:false}]) {
            drawnText.length=0;
            const b=UI.drawShop(ctx,s,0,{hammer:0,bomb:0,color:0},options);
            for(const [key,r] of Object.entries(b)) {
                if(r.w<44||r.h<44||r.x<0||r.y<s.safeTop||r.x+r.w>width||r.y+r.h>height-s.safeBottom) throw new Error('商店触控溢出或过小 '+key);
            }
            if (!textValues().includes('金币不足')) throw new Error('未显示金币不足原因');
            if (options.pending && !textValues().includes('领取中')) throw new Error('未显示领取中');
            if (options.count===10 && !textValues().includes('今日已满')) throw new Error('未显示领取上限');
            for (const type of ['hammer','bomb','color','heart']) {
                const a=b['buy_'+type],r=b['reward_'+type];
                if (r && a.x+a.w>=r.x) throw new Error('购买与领取命中范围重叠');
            }
        }
        drawnText.length=0;
        const b=UI.drawSettings(ctx,s,{musicEnabled:true,sfxEnabled:false});
        if(!textValues().includes('开')||!textValues().includes('关')) throw new Error('开关状态不独立或仅靠颜色');
        for(const r of Object.values(b)) {
            if(r.h<44||r.w<44||r.x<0||r.y<s.safeTop||r.x+r.w>width||r.y+r.h>height-s.safeBottom) throw new Error('设置触控异常');
        }
    }
});
assert('单人短屏：棋盘完整且不被道具遮挡', function () {
    for(const [width,height] of [[320,568],[375,812],[430,932]]) {
        const s={width,height,safeTop:24,safeBottom:20};
        const board=new BoardRenderer(ctx,s);
        board.setGame(new GameCore({id:5,rows:8,columns:8,moveCount:25,goals:[{type:'score',target:3600}]},{}));
        board.setTools({hammer:2,bomb:1,color:0});
        if(board.tileSize<30) throw new Error('小屏棋子缩得过小');
        if(board.boardY+board.boardH+8>board.tools[0].y-44) throw new Error('道具面板遮住棋盘');
        drawnImages.length=0;
        board.drawTools();
        for(const type of ['hammer','bomb','yarn']) {
            if(!imageRecords('res/ui/tool-'+type+'.png').length) throw new Error('道具图标未绘制 '+type);
        }
    }
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
    const timedFills=canvasStats.fill;
    const timerText=drawnText.find(t=>t.text==='01:02');
    if(timerText.y>=board.boardY || timerText.y<130) throw new Error('倒计时未位于既有目标框');
    board.core.timeLimitMs=0;canvasStats.fill=0;board.drawTopBar();
    if(canvasStats.fill!==timedFills) throw new Error('计时状态增加了额外框体');
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
    if (centers[0].y <= centers[4].y || Math.abs(centers[4].y - screen.height * 0.3) > 0.001) {
        throw new Error('五个节点未沿小径向亭子收束');
    }
    centers.forEach(function (center, index) {
        if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || center.x < screen.width*.35 || center.x > screen.width*.80) {
            throw new Error('关卡节点不在云阶有效区 ' + (index + 1));
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
assert('地图连续拖动不抢返回按钮，缺省安全区仍有效', function () {
    for (const [width,height] of [[320,568],[375,812],[430,932]]) {
        for (const fraction of [0,.5,.9]) {
            for (const safeBottom of [undefined,34]) {
                const s={width,height,contentTop:72,safeBottom};
                const b=UI.drawLevelSelect(ctx,s,8,0,{}, {offset:5+fraction});
                if (b.visibleLevels.length!==5) throw new Error('滚动五关窗口丢失');
                if (!Number.isFinite(b.back.y) || b.back.y+b.back.h>height-(safeBottom||0)) throw new Error('返回按钮安全区异常');
                for (const id of b.visibleLevels) {
                    const hit=b['level_'+id];
                    if (!hit) continue; // Partially clipped nodes must not receive taps.
                    if (hit.w<44 || hit.h<44 || hit.y<144 || hit.y+hit.h>b.back.y-12) throw new Error('滚动节点侵入固定控件 '+id);
                    if (UI.hitTest(b.back.x+b.back.w/2,b.back.y+4,hit)) throw new Error('返回点击被节点捕获');
                }
            }
        }
    }
});
assert('第一关及静止地图五个节点在全面屏均可点击', function () {
    for (const [width, height] of [[320,568],[375,667],[375,812],[390,844],[430,932]]) {
        for (const safeBottom of [0, 20, 34]) {
            const s = { width, height, safeTop: 47, contentTop: 91, safeBottom };
            for (const offset of [0, 5]) {
                const b = UI.drawLevelSelect(ctx, s, offset + 1, 0, {}, { offset });
                for (const id of b.visibleLevels) {
                    const hit = b['level_' + id];
                    if (!hit) throw new Error(width + '×' + height + ' bottom=' + safeBottom + ' 缺少level_' + id + '命中区');
                    if (hit.w < 44 || hit.h < 44 || hit.y + hit.h > b.back.y - 12) throw new Error('节点命中区不可完整操作');
                    if (!UI.hitTest(hit.x + hit.w / 2, hit.y + hit.h / 2, hit)) throw new Error('节点中心不可点击');
                }
            }
        }
    }
});
assert('月光结算各状态安全区、按钮与内容不重叠', function () {
    for (const [width,height] of [[320,568],[375,812],[430,932]]) {
        for (const state of [{win:true,star:3,hasNext:true},{win:true,star:0,hasNext:false},{win:false,canRevive:false},{win:false,canRevive:true},{win:false,reason:'timeout',timed:true,canRevive:true}]) {
            drawnText.length=0;
            const b=UI.drawResult(ctx,{width,height,contentTop:72,safeBottom:34}, {...state,score:999999999,coinReward:999999});
            const controls=Object.values(b);
            for (const a of controls) {
                if (a.w<44 || a.h<44 || a.x<0 || a.y<72 || a.x+a.w>width || a.y+a.h>height-34) throw new Error('结算按钮越界');
                for (const c of controls) if (a!==c && a.x<c.x+c.w && a.x+a.w>c.x && a.y<c.y+c.h && a.y+a.h>c.y) throw new Error('结算按钮相交');
            }
            const content=drawnText.filter(t=>t.text.startsWith('得分：') || t.text.includes('金币') || t.text.startsWith('别急'));
            const firstButtonY=Math.min(...controls.map(b=>b.y));
            if (content.some(t=>t.y+16>firstButtonY)) throw new Error('结果文字遮挡按钮');
            if (!!b.revive!==!!(!state.win&&state.canRevive)) throw new Error('复活可用性改变');
        }
    }
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
    const top = Math.max(72, pvpScreen.contentTop || pvpScreen.safeTop) + 96;
    const bottom = pvpScreen.height - pvpScreen.safeBottom - 104;
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

assert('B对战准备/结算状态：安全区、44px控件、互不交叠', function () {
    const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
    for(const [width,height] of [[320,568],[375,812],[430,932]]) for(const contentTop of [72,88]) {
        const s={width,height,contentTop,safeBottom:34};
        function check(buttons) {
            const controls=Object.values(buttons);
            for(const a of controls) {
                if(a.w<44||a.h<44||a.x<0||a.y<contentTop||a.x+a.w>width||a.y+a.h>height-34) throw new Error('对战控件安全区/尺寸异常');
                for(const b of controls) if(a!==b&&overlap(a,b)) throw new Error('对战控件相交');
            }
        }
        for(const myReady of [false,true]) {
            drawnText.length=0;
            const buttons=BattleUI.drawWait(ctx,s,{roomId:'long-room-123456',myName:'很长的猫咪玩家名字',oppName:'另一个猫咪玩家',myReady,oppReady:myReady,oppJoined:myReady,items:{freeze:0,disturb:3},isHost:!myReady});
            check(buttons);
            if(!!buttons.freezePlus===myReady) throw new Error('准备锁定配额契约改变');
            if (!!buttons.invite === myReady) throw new Error('房主空位需邀请入口，好友加入后隐藏');
            if (!myReady && !textValues().includes('邀请好友')) throw new Error('邀请按钮文字缺失');
            const hint=drawnText.find(t=>t.text.startsWith('双方准备后') || t.text === '邀请好友加入，再一起准备');
            if(hint.y+7>buttons.ready.y) throw new Error('短屏提示压住准备按钮');
        }
        for (const [state, text] of [
            [{actionPending:true,pendingAction:'items'}, '正在保存道具配置…'],
            [{actionPending:true,pendingAction:'ready'}, '正在同步准备状态…'],
            [{offline:true}, '状态尚未确认，请点击重试连接'],
            [{offline:true,pollPending:true}, '正在重连并核对房间状态…']
        ]) {
            drawnText.length=0;
            const buttons=BattleUI.drawWait(ctx,s,{roomId:'room',isHost:true,oppJoined:false,items:{freeze:1,disturb:2},canChangeAvatar:false,...state});
            check(buttons);
            if(buttons.invite) throw new Error('离线或状态未确认时不得邀请');
            if(buttons.freezePlus||buttons.disturbMinus||!buttons.cancel||!buttons.ready) throw new Error('待确认时道具应禁用、退出和重连应保留');
            if(!textValues().includes(text)) throw new Error('缺失具体同步状态');
            if(textValues().some(t=>t.includes('点头像'))) throw new Error('不可用头像仍显示更换提示');
        }
        for(const state of [{},{myRematch:true},{oppRematch:true},{oppLeft:true},{expired:true},{offline:true},{rewardPending:true},{actionPending:true}]) {
            drawnText.length=0;
            const buttons=BattleUI.drawResult(ctx,s,{protocolVersion:2,roundNumber:2,myWins:1,oppWins:0,oppOnline:true,result:'win',myScore:4000,oppScore:3200,coinReward:150,...state});
            check(buttons);
            if(!textValues().some(t=>t.includes('第 2 局')&&t.includes('1 : 0'))) throw new Error('续局局次与战绩缺失');
            if(state.rewardPending&&(!buttons.reward||textValues().some(t=>t.includes('奖励 +150')))) throw new Error('未入账不得声称领奖');
            if(state.myRematch&&!textValues().includes('取消等待')) throw new Error('等待无法取消');
        }
        for(const result of ['win','draw','lose']) {
            drawnText.length=0;drawnImages.length=0;
            check(BattleUI.drawResult(ctx,s,{result,myScore:999999999,oppScore:888888888,coinReward:result==='lose'?0:150}));
            if(result==='draw'&&!imageRecords('res/home/duel-heads.png').length) throw new Error('平局双猫缺失');
            if(result==='lose'&&textValues().includes('奖励 +150 金币')) throw new Error('虚构奖励');
        }
    }
});
assert('B对战提示：受击在棋盘、干扰短提示后不遮棋子，冷却/生效/耗尽可辨', function () {
    for(const [width,height] of [[320,568],[375,812],[430,932]]) {
        const s={width,height,contentTop:72,safeBottom:34};
        const board=new BoardRenderer(ctx,s);board.battleMode=true;
        board.setGame(new GameCore({id:0,rows:8,columns:8,moveCount:999,goals:[{type:'score',target:99999}]},{}));
        const dockY=height-34-98;
        if(board.boardY<168||board.boardY+board.boardH>dockY-6) throw new Error('对战棋盘侵入HUD/道具区');
        drawnText.length=0;
        BattleUI.drawTop(ctx,s,{timeLeft:8,myScore:999999999,oppScore:999999999});
        BattleUI.drawEffects(ctx,s,{frozen:true,frozenRemaining:2500,disturb:true,disturbRemaining:4000,castNotice:'freeze',boardX:board.boardX,boardY:board.boardY,boardW:board.boardW,boardH:board.boardH});
        const frozen=drawnText.find(t=>t.text==='冰冻中 · 3秒');
        if(!frozen||frozen.y<board.boardY||frozen.y>board.boardY+board.boardH) throw new Error('冰冻未在棋盘内');
        if(!textValues().includes('干扰中 · 需要4连 · 4秒')) throw new Error('组合受击状态丢失');
        if(!textValues().includes('已向对手释放冰冻')) throw new Error('未区分释放与受击');
        const bounds={boardX:board.boardX,boardY:board.boardY,boardW:board.boardW,boardH:board.boardH};
        drawnText.length=0;
        BattleUI.drawEffects(ctx,s,{...bounds,disturb:true,disturbRemaining:4000,disturbNotice:true});
        if(!textValues().includes('需要4连才能消除')) throw new Error('干扰命中缺少规则提示');
        drawnText.length=0;
        BattleUI.drawEffects(ctx,s,{...bounds,disturb:true,disturbRemaining:3000});
        if(drawnText.some(t=>t.y>board.boardY+board.tileSize/2)) throw new Error('干扰持续提示遮挡棋子中心');
        drawnText.length=0;
        BattleUI.drawEffects(ctx,s,bounds);
        if(drawnText.length) throw new Error('结束后仍残留受击提示');
        for(const state of [{freeze:1,disturb:2,cooldownRemaining:4500,active:false},{freeze:0,disturb:2,cooldownRemaining:0,active:true}]) {
            drawnText.length=0;const b=BattleUI.drawItems(ctx,s,state);
            if(b.freeze.h<44||b.disturb.h<44||b.freeze.y<dockY) throw new Error('道具触控异常');
            if(state.active&&!textValues().includes('用尽')) throw new Error('耗尽状态丢失');
            if(state.cooldownRemaining&&!textValues().includes('共享冷却 5秒')) throw new Error('冷却秒数丢失');
        }
    }
});

assert('四道具 V3：短屏分配、锁定、战斗栏与效果边缘提示', function () {
    const names=['冰霜冻结','四连魔咒','镜面反弹','猫咪鼓舞'];
    const keys=['freeze','disturb','reflect','cheer'];
    const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
    for(const [width,height] of [[320,568],[375,812],[430,932]]) {
        const s={width,height,contentTop:91,safeBottom:34};
        for(const state of [
            {items:{freeze:1,disturb:1,reflect:1,cheer:1}},
            {items:{freeze:2,disturb:1,reflect:1,cheer:1}},
            {items:{freeze:2,disturb:1,reflect:1,cheer:1},myReady:true},
            {items:{freeze:2,disturb:1,reflect:1,cheer:1},actionPending:true},
            {items:{freeze:2,disturb:1,reflect:1,cheer:1},offline:true}
        ]) {
            drawnText.length=0;
            const buttons=BattleUI.drawWait(ctx,s,{itemRulesVersion:3,roomId:'room',oppJoined:true,...state});
            for(const name of names) if(!textValues().includes(name)) throw new Error('缺少道具名称 '+name);
            for(const description of ['冻结对手3秒','5秒需四连','5秒反弹一次','5秒得分×2']) if(!textValues().includes(description)) throw new Error('缺少道具说明 '+description);
            if(!textValues().some(t=>t.includes('剩余 '+(5-Object.values(state.items).reduce((a,b)=>a+b,0))))) throw new Error('额度提示错误');
            const controls=Object.values(buttons);
            for(const a of controls) {
                if(a.x<0||a.y<s.contentTop||a.x+a.w>width||a.y+a.h>height-s.safeBottom||a.w<44||a.h<44) throw new Error('V3 控件越界或不足44px');
                for(const b of controls) if(a!==b&&overlap(a,b)) throw new Error('V3 控件相交');
            }
            const locked=state.myReady||state.actionPending||state.offline;
            for(const key of keys) {
                if(!!buttons[key+'Minus']===!!locked) throw new Error('V3 减少按钮状态错误');
                if(!!buttons[key+'Plus']!==(state.items.freeze+state.items.disturb+state.items.reflect+state.items.cheer<5&&!locked)) throw new Error('V3 增加按钮状态错误');
            }
        }
        drawnText.length=0;
        const dock=BattleUI.drawItems(ctx,s,{itemRulesVersion:3,freeze:1,disturb:0,reflect:2,cheer:1,cooldownRemaining:4200});
        for(const key of keys) if(!dock[key]||dock[key].w<44||dock[key].h<44) throw new Error('V3 战斗按钮尺寸错误');
        for(let i=0;i<keys.length;i++) {
            const label=drawnText.find(t=>t.text===names[i]);
            if(!label||Math.abs(label.x-(dock[keys[i]].x+dock[keys[i]].w/2))>1) throw new Error('V3 道具名称未占满按钮底行');
        }
        if(!textValues().includes('共享冷却 5秒')||!textValues().includes('用尽')) throw new Error('V3 冷却或耗尽提示缺失');
        drawnText.length=0;
        BattleUI.drawItems(ctx,s,{itemRulesVersion:3,freeze:1,disturb:1,reflect:1,cheer:1,frozen:true});
        if(!textValues().includes('冰冻中 · 无法使用道具')) throw new Error('V3 冻结时未提示道具锁定');
        const board=new BoardRenderer(ctx,s);board.battleMode=true;
        board.setGame(new GameCore({id:0,rows:8,columns:8,moveCount:999,goals:[{type:'score',target:99999}]},{}));
        drawnText.length=0;
        BattleUI.drawEffects(ctx,s,{itemRulesVersion:3,boardX:board.boardX,boardY:board.boardY,boardW:board.boardW,boardH:board.boardH,
            disturb:true,disturbRemaining:4000,reflectRemaining:4500,cheerRemaining:3500,castNotice:'reflect'});
        if(!textValues().some(t=>t.includes('镜面反弹'))||!textValues().some(t=>t.includes('鼓舞×2'))||!textValues().includes('镜面反弹 · 已开启')) throw new Error('V3 反弹/鼓舞效果提示缺失');
        if(drawnText.some(t=>t.y>board.boardY+board.tileSize/2&&t.y<board.boardY+board.boardH-10)) throw new Error('V3 持续提示进入棋盘中心');
        drawnText.length=0;
        BattleUI.drawEffects(ctx,s,{itemRulesVersion:3,boardX:board.boardX,boardY:board.boardY,boardW:board.boardW,boardH:board.boardH,
            cheerRemaining:3500,castNotice:'cheer'});
        if(!textValues().includes('猫咪鼓舞 · 得分×2')) throw new Error('V3 鼓舞释放提示错误');
        drawnText.length=0;
        BattleUI.drawEffects(ctx,s,{itemRulesVersion:3,boardX:board.boardX,boardY:board.boardY,boardW:board.boardW,boardH:board.boardH,
            castNotice:'freeze'});
        if(!textValues().includes('已向对手释放冰霜冻结')) throw new Error('V3 攻击释放提示错误');
    }
});

assert('每日详情样板：三档状态、安全区与首页入口', function () {
    const DailyUI=require('../js/render/daily-ui');
    const challenge=require('../js/core/daily-challenge').challengeForDate('2026-09-22');
    const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
    for(const [width,height] of [[320,568],[375,812],[430,932]]) {
        const s={width,height,contentTop:91,safeTop:47,safeBottom:34};
        for(const state of [{},{loading:true},{error:'网络未连接，请重试'},{starting:true},{claimed:true,best:2130},{completed:true,best:1500},{active:{runId:'same'}},{pending:true}]) {
            drawnText.length=0;
            const buttons=DailyUI.drawDetail(ctx,s,{challenge,...state});
            for(const b of Object.values(buttons)) if(b.w<44||b.h<44||b.y<91||b.y+b.h>height-34) throw new Error('每日控件不满足安全区');
            if(buttons.start&&overlap(buttons.start,buttons.back)) throw new Error('每日控件重叠');
            if((state.loading||state.starting||state.completed||state.claimed)&&buttons.start) throw new Error('加载中可重复开局');
            if(!textValues().includes('25步内达到2000分')||!textValues().includes('每日一局 · 不耗体力 · 不限时')) throw new Error('每日规则缺失');
            if(buttons.start) {
                const label=drawnText.find(t=>['开始挑战','继续挑战','确认成绩','重试'].includes(t.text));
                if(!label||Math.abs(label.x-(buttons.start.x+buttons.start.w/2))>1||Math.abs(label.y-(buttons.start.y+buttons.start.h/2))>1) throw new Error('每日按钮文字未居中');
                if(buttons.start.y+buttons.start.h>height-s.safeBottom-24) throw new Error('每日按钮底部留白不足');
            }
        }
        const b=UI.drawMenu(ctx,s,42,{count:5,canPlay:true,timeLeftText:'00:00'},{coins:100});
        if(b.daily.h<44||overlap(b.daily,b.shop)||overlap(b.daily,b.settings)||overlap(b.daily,b.start)) throw new Error('每日入口挤占原入口');
        if(b.daily.w>=b.battle.w||b.daily.h>=b.battle.h) throw new Error('每日入口压过PvP');
    }
});
assert('正式视觉资源全部指向运行时素材', function () {
    if (assets.ASSETS.gameBackground !== 'res/home/moonlit-garden-bg.jpg') throw new Error('游戏背景未复用首页文件');
    if (!assets.isReady() || assets.get('gameBackground').src !== assets.get('homeBackground').src) {
        throw new Error('共用背景加载未就绪');
    }
    if (assets.ASSETS.levelBackground !== 'res/level-background-v2.jpg') throw new Error('关卡背景未切换');
    ['Current', 'Done', 'Locked'].forEach(function (state) {
        if (assets.ASSETS['levelNode' + state] !== undefined) {
            throw new Error('原生关卡节点不应加载旧图片: ' + state);
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
