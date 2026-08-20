/**
 * UI 绘制模块（canvas 绘制主菜单 / 结算页，清新糖果风）
 * 所有按钮返回 {x, y, w, h} 区域，由 Main 统一做点击命中检测
 */

const THEME = require('./theme');
const coin = require('../core/coin');
const assets = require('./assets');

const UI = {};

/** 绘制垂直渐变背景 */
function drawBg(ctx, screen) {
    const g = ctx.createLinearGradient(0, 0, 0, screen.height);
    g.addColorStop(0, THEME.bgTop);
    g.addColorStop(0.55, THEME.bgMid);
    g.addColorStop(1, THEME.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, screen.width, screen.height);
}

/** 绘制渐变圆角按钮（带底部阴影） */
function drawButton(ctx, x, y, w, h, text, colorTop, colorBottom, textColor, fontSize) {
    // 底部阴影
    ctx.save();
    ctx.shadowColor = THEME.cardShadow;
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, colorTop);
    g.addColorStop(1, colorBottom);
    ctx.fillStyle = g;
    roundRectPath(ctx, x, y, w, h, Math.min(16, h / 2));
    ctx.fill();
    ctx.restore();

    // 按钮文字
    ctx.fillStyle = textColor || THEME.textLight;
    ctx.font = 'bold ' + (fontSize || 20) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
}

/** 圆角矩形路径 */
function roundRectPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

/**
 * 主菜单
 * @param {CanvasRenderingContext2D} ctx
 * @param {{width:number,height:number}} screen
 * @param {number} unlockedLevel 已解锁的最大关卡
 * @param {object} heart { count, timeLeftText, canPlay }
 * @param {number} shareRemaining 今日剩余分享次数
 * @returns {object} 按钮区域 {start, addHeart?, shop, share}
 */
UI.drawMenu = function (ctx, screen, unlockedLevel, heart, shareRemaining) {
    const cx = screen.width / 2;

    // 渐变背景
    drawBg(ctx, screen);

    // 装饰糖果（固定点缀）
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.85;
    ctx.fillText('🍬', screen.width * 0.12, screen.height * 0.2);
    ctx.fillText('🍭', screen.width * 0.88, screen.height * 0.16);
    ctx.fillText('🍩', screen.width * 0.85, screen.height * 0.68);
    ctx.fillText('🍪', screen.width * 0.1, screen.height * 0.7);
    ctx.globalAlpha = 1;

    // 体力条胶囊（顶部）
    const heartW = 120;
    const heartH = 36;
    const heartX = screen.width / 2 - heartW / 2;
    const heartY = 18;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    roundRectPath(ctx, heartX, heartY, heartW, heartH, heartH / 2);
    ctx.fill();
    ctx.font = 'bold 17px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = THEME.heartRed;
    ctx.fillText('❤ ' + heart.count, cx, heartY + heartH / 2 + 1);

    // 标题（带描边更有设计感）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 46px sans-serif';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.strokeText('消消乐', cx, screen.height * 0.27);
    ctx.fillStyle = THEME.primary;
    ctx.fillText('消消乐', cx, screen.height * 0.27);

    ctx.fillStyle = THEME.textMid;
    ctx.font = '15px sans-serif';
    ctx.fillText('简单快乐的三消小游戏', cx, screen.height * 0.27 + 38);

    // 进度
    ctx.fillStyle = THEME.textMid;
    ctx.font = '14px sans-serif';
    ctx.fillText('已解锁到第 ' + unlockedLevel + ' 关', cx, screen.height * 0.27 + 70);

    const buttons = {};
    const btnW = 240;
    const btnH = 62;
    const btnX = cx - btnW / 2;

    // 双人对战按钮（醒目，绿色）
    const battleBtnY = screen.height * 0.41;
    drawButton(ctx, btnX, battleBtnY, btnW, 58, '🆚 双人对战', '#8FE3A3', THEME.success, THEME.textLight, 20);
    buttons.battle = { x: btnX, y: battleBtnY, w: btnW, h: 58 };

    // 开始按钮（体力不足时置灰）
    const btnY = screen.height * 0.52;

    if (heart.canPlay) {
        drawButton(ctx, btnX, btnY, btnW, btnH, '选 择 关 卡', THEME.primaryLight, THEME.primary, THEME.textLight, 22);
    } else {
        drawButton(ctx, btnX, btnY, btnW, btnH, '体 力 不 足', THEME.btnGrayTop, THEME.btnGrayBottom, THEME.textLight, 21);
    }
    buttons.start = { x: btnX, y: btnY, w: btnW, h: btnH };

    let shopBtnY;

    // 体力不足时：看广告补心按钮
    if (!heart.canPlay) {
        const adBtnW = 220;
        const adBtnH = 50;
        const adBtnY = btnY + btnH + 20;
        drawButton(ctx, btnX, adBtnY, adBtnW, adBtnH, '看广告 +1 体力', '#8FE3A3', THEME.success, THEME.textLight, 17);
        buttons.addHeart = { x: btnX, y: adBtnY, w: adBtnW, h: adBtnH };
        shopBtnY = adBtnY + adBtnH + 20;
    } else {
        // 恢复提示
        ctx.textBaseline = 'alphabetic';
        ctx.font = '12px sans-serif';
        ctx.fillStyle = THEME.textMid;
        ctx.fillText('体力 ' + heart.timeLeftText + ' 后恢复 1 颗', cx, btnY + btnH + 32);
        shopBtnY = btnY + btnH + 46;
    }

    // 底部双按钮：商店 + 分享（并排）
    const subBtnW = 140;
    const subBtnH = 46;
    const subGap = 12;
    const subTotal = subBtnW * 2 + subGap;
    const subX = cx - subTotal / 2;

    // 商店按钮
    drawButton(ctx, subX, shopBtnY, subBtnW, subBtnH, '🛒 商店', THEME.shopTop, THEME.shopBottom, THEME.textLight, 16);
    buttons.shop = { x: subX, y: shopBtnY, w: subBtnW, h: subBtnH };

    // 分享按钮（剩余次数显示）
    const shareX = subX + subBtnW + subGap;
    if (shareRemaining > 0) {
        drawButton(ctx, shareX, shopBtnY, subBtnW, subBtnH, '📤 分享+1❤', THEME.shareTop, THEME.shareBottom, THEME.textLight, 15);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.font = '11px sans-serif';
        ctx.fillStyle = THEME.shareBottom;
        ctx.fillText('今日剩 ' + shareRemaining + ' 次', shareX + subBtnW / 2, shopBtnY + subBtnH + 15);
    } else {
        drawButton(ctx, shareX, shopBtnY, subBtnW, subBtnH, '分享已用尽', THEME.btnGrayTop, THEME.btnGrayBottom, THEME.textLight, 14);
    }
    buttons.share = { x: shareX, y: shopBtnY, w: subBtnW, h: subBtnH };

    return buttons;
};

/**
 * 商店页
 * @param {CanvasRenderingContext2D} ctx
 * @param {{width:number,height:number}} screen
 * @param {number} coins 当前金币
 * @param {object} items 道具数量 { hammer, bomb, color }
 * @returns {object} 按钮区域 { buy_hammer, buy_bomb, buy_color, back }
 */
UI.drawShop = function (ctx, screen, coins, items) {
    const cx = screen.width / 2;

    // 渐变背景
    drawBg(ctx, screen);

    // 标题 + 金币
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = THEME.textDark;
    ctx.fillText('商店', cx, 52);

    // 金币胶囊
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px sans-serif';
    const coinText = '🪙 ' + coins;
    const coinW = ctx.measureText(coinText).width + 32;
    const coinH = 36;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    roundRectPath(ctx, cx - coinW / 2, 66, coinW, coinH, coinH / 2);
    ctx.fill();
    ctx.fillStyle = THEME.primaryDark;
    ctx.fillText(coinText, cx, 66 + coinH / 2 + 1);

    const buttons = {};

    // 道具卡片（竖排 3 个）
    const defs = coin.ITEM_DEFS;
    const types = ['hammer', 'bomb', 'color'];
    const cardW = 300;
    const cardH = 96;
    const startY = 130;
    const gap = 14;

    for (let i = 0; i < types.length; i++) {
        const type = types[i];
        const def = defs[type];
        const cardX = cx - cardW / 2;
        const cardY = startY + i * (cardH + gap);

        // 卡片
        ctx.save();
        ctx.shadowColor = THEME.cardShadow;
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
        ctx.fillStyle = '#FFFFFF';
        roundRectPath(ctx, cardX, cardY, cardW, cardH, 16);
        ctx.fill();
        ctx.restore();

        // 图标
        ctx.textAlign = 'left';
        ctx.font = '34px sans-serif';
        ctx.fillText(def.icon, cardX + 18, cardY + cardH / 2);

        // 名称 + 说明
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = THEME.textDark;
        ctx.font = 'bold 17px sans-serif';
        ctx.fillText(def.name, cardX + 66, cardY + 34);
        ctx.fillStyle = THEME.textMid;
        ctx.font = '13px sans-serif';
        ctx.fillText(def.desc, cardX + 66, cardY + 58);
        ctx.fillStyle = THEME.textMid;
        ctx.font = '12px sans-serif';
        ctx.fillText('拥有 ' + (items[type] || 0), cardX + 66, cardY + 80);

        // 购买按钮
        const buyW = 86;
        const buyH = 40;
        const buyX = cardX + cardW - buyW - 12;
        const buyY = cardY + cardH / 2 - buyH / 2;
        const affordable = coins >= def.price;
        drawButton(ctx, buyX, buyY, buyW, buyH, '🪙' + def.price, affordable ? THEME.shopTop : THEME.btnGrayTop, affordable ? THEME.shopBottom : THEME.btnGrayBottom, THEME.textLight, 14);
        buttons['buy_' + type] = { x: buyX, y: buyY, w: buyW, h: buyH };
    }

    // 返回按钮
    const backW = 200;
    const backH = 50;
    const backY = startY + 3 * (cardH + gap) + 10;
    drawButton(ctx, cx - backW / 2, backY, backW, backH, '返 回', THEME.btnGrayTop, THEME.btnGrayBottom, THEME.textLight, 17);
    buttons.back = { x: cx - backW / 2, y: backY, w: backW, h: backH };

    return buttons;
};

/**
 * 结算页
 * @param {CanvasRenderingContext2D} ctx
 * @param {{width:number,height:number}} screen
 * @param {object} result { win, score, levelId, hasNext, canRevive }
 * @returns {object} 按钮区域 {main, menu, revive?}
 */
UI.drawResult = function (ctx, screen, result) {
    const cx = screen.width / 2;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(40,30,20,0.55)';
    ctx.fillRect(0, 0, screen.width, screen.height);

    // 卡片（胜利时更高：多星星行；失败且有复活按钮时更高）
    const hasRevive = !result.win && result.canRevive;
    const cardW = 310;
    const cardH = hasRevive ? 400 : (result.win ? 370 : 330);
    const cardX = cx - cardW / 2;
    const cardY = screen.height * 0.2;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = THEME.cardBg;
    roundRectPath(ctx, cardX, cardY, cardW, cardH, 22);
    ctx.fill();
    ctx.restore();

    // 结果大图标
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '52px sans-serif';
    ctx.fillText(result.win ? '🎉' : '💔', cx, cardY + 66);

    // 结果标题
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = result.win ? THEME.successDark : THEME.danger;
    ctx.fillText(result.win ? '通关成功' : '挑战失败', cx, cardY + 122);

    // 星星（胜利时显示 ★ 亮 / ☆ 暗）
    let nextBtnY = cardY + 192;
    if (result.win) {
        ctx.font = '30px sans-serif';
        const startSX = cx - 30;
        for (let k = 1; k <= 3; k++) {
            ctx.fillStyle = k <= result.star ? '#FFC531' : '#E8E0D0';
            ctx.fillText('★', startSX + (k - 1) * 30, cardY + 160);
        }
        // 分数（下移给星星让位）
        ctx.font = '20px sans-serif';
        ctx.fillStyle = THEME.textDark;
        ctx.fillText('得分：' + result.score, cx, cardY + 196);

        // 金币奖励
        if (result.coinReward > 0) {
            ctx.font = 'bold 17px sans-serif';
            ctx.fillStyle = THEME.primaryDark;
            ctx.fillText('🪙 +' + result.coinReward + ' 金币', cx, cardY + 226);
            nextBtnY = cardY + 252;
        } else {
            nextBtnY = cardY + 224;
        }
    } else {
        // 分数
        ctx.font = '20px sans-serif';
        ctx.fillStyle = THEME.textDark;
        ctx.fillText('得分：' + result.score, cx, cardY + 160);
        nextBtnY = cardY + 192;
    }

    // 按钮
    const btnW = 230;
    const btnH = 52;
    const btnX = cx - btnW / 2;
    const buttons = {};

    // 复活按钮（失败且还有复活机会）
    if (hasRevive) {
        drawButton(ctx, btnX, nextBtnY, btnW, btnH, '看广告复活 +5 步', '#8FE3A3', THEME.success, THEME.textLight, 17);
        buttons.revive = { x: btnX, y: nextBtnY, w: btnW, h: btnH };
        nextBtnY += btnH + 14;
    }

    // 主按钮：下一关（胜利）或再来一次（失败）
    if (result.win && result.hasNext) {
        drawButton(ctx, btnX, nextBtnY, btnW, btnH, '下 一 关', '#8FE3A3', THEME.success, THEME.textLight, 19);
    } else {
        drawButton(ctx, btnX, nextBtnY, btnW, btnH, '再 来 一 次', THEME.primaryLight, THEME.primary, THEME.textLight, 19);
    }
    buttons.main = { x: btnX, y: nextBtnY, w: btnW, h: btnH };

    // 返回菜单按钮
    const menuBtnY = nextBtnY + btnH + 14;
    ctx.fillStyle = THEME.btnGrayTop;
    roundRectPath(ctx, btnX, menuBtnY, btnW, btnH, 14);
    ctx.fill();
    ctx.fillStyle = THEME.textMid;
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('返回主菜单', cx, menuBtnY + btnH / 2 + 1);
    buttons.menu = { x: btnX, y: menuBtnY, w: btnW, h: btnH };

    return buttons;
};

/**
 * 关卡地图（选关界面）
 * @param {CanvasRenderingContext2D} ctx
 * @param {{width:number,height:number}} screen
 * @param {number} unlockedLevel 已解锁的最大关卡
 * @param {number} coins 金币
 * @param {number} totalLevels 关卡总数
 * @param {object} stars 各关已获最高星 { levelId: 1-3 }
 * @returns {object} 按钮区域 { level_N..., back }
 */
UI.drawLevelSelect = function (ctx, screen, unlockedLevel, coins, totalLevels, stars) {
    const cx = screen.width / 2;

    // 渐变背景
    drawBg(ctx, screen);

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = THEME.textDark;
    ctx.fillText('选择关卡', cx, 50);

    // 金币胶囊（右上）
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px sans-serif';
    const coinText = '🪙 ' + coins;
    const coinW = ctx.measureText(coinText).width + 24;
    const coinH = 30;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    roundRectPath(ctx, screen.width - coinW - 14, 14, coinW, coinH, coinH / 2);
    ctx.fill();
    ctx.fillStyle = THEME.primaryDark;
    ctx.fillText(coinText, screen.width - coinW + 12, 14 + coinH / 2 + 1);

    const buttons = {};

    // 关卡节点：自适应屏幕宽度/高度换行网格
    let nodeSize = 60;
    let gapY = 20;
    const gapX = 16;   // 水平间距
    const nameH = 16;  // 关卡名高度
    const padX = 14;   // 左右边距

    // 每行能放的节点数（按屏宽）
    const colsPerRow = Math.max(3, Math.floor((screen.width - padX * 2 + gapX) / (nodeSize + gapX)));
    const totalRows = Math.ceil(totalLevels / colsPerRow);

    // 高度不足时压缩节点/间距（防小屏溢出，浮点精确计算）
    const availH = screen.height - 150; // 内容区高度（84 标题 + 66 返回按钮）
    const needH = totalRows * (nodeSize + gapY + nameH);
    if (needH > availH) {
        const base = nodeSize + gapY;
        const targetBase = (availH / totalRows) - nameH;
        const scale = targetBase / base;
        nodeSize = Math.max(42, nodeSize * scale);
        gapY = Math.max(6, gapY * scale);
    }

    const rowH = nodeSize + gapY + nameH;
    const startY = 84;

    // 当前行节点起始 x（居中）
    function rowStartX(countInRow) {
        return cx - ((countInRow - 1) * (nodeSize + gapX)) / 2;
    }

    for (let i = 1; i <= totalLevels; i++) {
        const row = Math.floor((i - 1) / colsPerRow);
        const col = (i - 1) % colsPerRow;
        const countInRow = (row < totalRows - 1) ? colsPerRow : (totalLevels - row * colsPerRow);
        const x = rowStartX(countInRow) + col * (nodeSize + gapX);
        const y = startY + row * rowH;
        const state = i < unlockedLevel ? 'done' : (i === unlockedLevel ? 'current' : 'locked');

        // 节点圆形
        ctx.save();
        if (state === 'current') {
            ctx.shadowColor = 'rgba(255,138,61,0.45)';
            ctx.shadowBlur = 14;
            ctx.fillStyle = THEME.primary;
        } else if (state === 'done') {
            ctx.shadowColor = 'rgba(94,203,113,0.4)';
            ctx.shadowBlur = 10;
            ctx.fillStyle = THEME.success;
        } else {
            ctx.fillStyle = THEME.btnGrayTop;
        }
        ctx.beginPath();
        ctx.arc(x, y, nodeSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 白色内圈
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, nodeSize / 2 - 4, 0, Math.PI * 2);
        ctx.stroke();

        // 节点内容：素材猫头 + 中央白圆覆盖原数字 + 新数字
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const nodeImg = assets.get(
            state === 'done' ? 'nodeDone' :
            state === 'current' ? 'nodeCurrent' : 'nodeLocked'
        );
        const nodeW = nodeSize * 1.05;
        const nodeH = nodeW * 0.88;
        if (nodeImg && nodeImg.width > 0) {
            ctx.drawImage(nodeImg, x - nodeW / 2, y - nodeH / 2 + 2, nodeW, nodeH);
        } else {
            // fallback：圆形底
            ctx.fillStyle = state === 'current' ? THEME.primary : (state === 'done' ? THEME.success : '#D8CFC2');
            ctx.beginPath(); ctx.arc(x, y, nodeSize / 2, 0, Math.PI * 2); ctx.fill();
        }

        // 中央白圆覆盖（隐藏素材上的示例数字）
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.beginPath();
        ctx.arc(x, y - 2, nodeSize * 0.32, 0, Math.PI * 2);
        ctx.fill();

        // 关卡号
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = state === 'done' ? '#6B3FA0' : (state === 'current' ? '#1F4F8F' : '#5A5A5A');
        ctx.fillText(String(i), x, y - 2);

        // 星级（done 状态在节点底部）
        if (state === 'done') {
            const s = (stars && stars[i]) || 0;
            ctx.font = 'bold 11px sans-serif';
            const starW = 12;
            const startSX = x - starW;
            for (let k = 1; k <= 3; k++) {
                ctx.fillStyle = k <= s ? '#FFC531' : 'rgba(0,0,0,0.35)';
                ctx.fillText('★', startSX + (k - 1) * starW, y + nodeH / 2 - 4);
            }
        } else if (state === 'locked') {
            ctx.font = '16px sans-serif';
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillText('🔒', x, y + nodeH / 2 - 4);
        }

        // 关卡名（节点下方小字）
        ctx.font = '11px sans-serif';
        ctx.fillStyle = THEME.textMid;
        const lv = require('../core/level');
        const level = lv.getLevel(i);
        ctx.fillText(level ? level.name : '第' + i + '关', x, y + nodeSize / 2 + 9);

        buttons['level_' + i] = { x: x - nodeSize / 2, y: y - nodeSize / 2, w: nodeSize, h: nodeSize };
    }

    // 返回按钮（固定在底部附近，避开节点区）
    const backW = 200;
    const backH = 50;
    const backY = screen.height - 66;
    drawButton(ctx, cx - backW / 2, backY, backW, backH, '返 回', THEME.btnGrayTop, THEME.btnGrayBottom, THEME.textLight, 17);
    buttons.back = { x: cx - backW / 2, y: backY, w: backW, h: backH };

    return buttons;
};

/** 判断点是否在按钮区域内 */
UI.hitTest = function (x, y, btn) {
    if (!btn) return false;
    return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
};

module.exports = UI;
