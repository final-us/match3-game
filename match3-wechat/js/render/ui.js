/**
 * UI 绘制模块（canvas 绘制主菜单 / 结算页，清新糖果风）
 * 所有按钮返回 {x, y, w, h} 区域，由 Main 统一做点击命中检测
 */

const THEME = require('./theme');
const coin = require('../core/coin');
const config = require('../core/config');
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

function drawImageCover(ctx, img, x, y, w, h) {
    if (!img || !img.width || !img.height) return false;
    const scale = Math.max(w / img.width, h / img.height);
    const sw = w / scale;
    const sh = h / scale;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    return true;
}

function drawSceneBackground(ctx, screen, assetKey, shade) {
    if (!drawImageCover(ctx, assets.get(assetKey), 0, 0, screen.width, screen.height)) drawBg(ctx, screen);
    ctx.fillStyle = 'rgba(8, 12, 48, ' + (shade == null ? 0.2 : shade) + ')';
    ctx.fillRect(0, 0, screen.width, screen.height);
}

function drawGlassCard(ctx, screen, x, y, w, h, radius) {
    ctx.save();
    if (!screen.reduceEffects) {
        ctx.shadowColor = THEME.cardShadow;
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 5;
    }
    ctx.fillStyle = THEME.glassBg;
    roundRectPath(ctx, x, y, w, h, radius || 20);
    ctx.fill();
    ctx.strokeStyle = THEME.glassBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
}

function drawGlassPill(ctx, x, y, w, h, label, value) {
    ctx.save();
    ctx.fillStyle = 'rgba(22, 25, 73, 0.64)';
    ctx.strokeStyle = 'rgba(255, 226, 244, 0.68)';
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#F8D9EC';
    ctx.font = '12px sans-serif';
    ctx.fillText(label, x + w * 0.32, y + h / 2 + 1);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(String(value), x + w * 0.72, y + h / 2 + 1);
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

function drawAssetButton(ctx, img, x, y, w, h, text, fontSize) {
    if (!img || !img.width || !img.height) return false;
    ctx.drawImage(img, x, y, w, h);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold ' + (fontSize || 20) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(65, 35, 86, 0.65)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 2;
    ctx.fillText(text, x + w / 2, y + h / 2 - 1);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    return true;
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
 * @param {object} heart { count, timeLeftText, canPlay, canAd }
 * @param {object} economy { coins }
 * @returns {object} 按钮区域 {battle, start, addHeart?, shop, settings}
 */
UI.drawMenu = function (ctx, screen, unlockedLevel, heart, economy) {
    const cx = screen.width / 2;

    const bg = assets.get('homeBackground');
    if (!drawImageCover(ctx, bg, 0, 0, screen.width, screen.height)) drawBg(ctx, screen);
    ctx.fillStyle = 'rgba(8, 12, 48, 0.10)';
    ctx.fillRect(0, 0, screen.width, screen.height);

    const safe = Math.max(14, screen.safeTop || 14);
    const side = Math.max(14, screen.width * 0.045);
    const pillW = Math.min(108, (screen.width - side * 2 - 44) / 2);
    drawGlassPill(ctx, side, safe, pillW, 38, '体力', heart.count);
    drawGlassPill(ctx, side + pillW + 8, safe, pillW, 38, '金币', (economy && economy.coins) || 0);

    const buttons = {};

    const titleTop = Math.max(safe + 54, screen.height * 0.105);
    const titleLogo = assets.get('homeTitleLogo');
    const titleW = Math.min(340, screen.width * 0.9);
    const titleH = titleW * 0.394;
    if (titleLogo && titleLogo.width > 0) {
        ctx.drawImage(titleLogo, cx - titleW / 2, titleTop, titleW, titleH);
    } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold ' + Math.min(42, screen.width * 0.105) + 'px sans-serif';
        ctx.fillStyle = '#FFD7EC';
        ctx.fillText(config.GAME_CONFIG.title, cx, titleTop + titleH / 2);
    }

    const hero = assets.get('homeDuelCats');
    const heroW = Math.min(screen.width * 0.92, 390);
    const heroH = heroW * 0.684;
    const heroY = titleTop + titleH - 4;
    if (hero && hero.width > 0) {
        ctx.drawImage(hero, cx - heroW / 2, heroY, heroW, heroH);
    }

    const btnW = Math.min(304, screen.width - side * 2 - 20);
    const btnH = Math.max(58, Math.min(68, screen.height * 0.078));
    const btnX = cx - btnW / 2;
    const battleY = Math.max(heroY + heroH - 4, screen.height * 0.59);
    if (!drawAssetButton(ctx, assets.get('homeButtonPrimary'), btnX, battleY, btnW, btnH, '好友对战', 22)) {
        drawButton(ctx, btnX, battleY, btnW, btnH, '好友对战', '#FF91C2', '#E6549C', THEME.textLight, 22);
    }
    buttons.battle = { x: btnX, y: battleY, w: btnW, h: btnH };

    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255, 239, 249, 0.9)';
    ctx.fillText('60 秒实时比拼 · 邀请好友即刻开局', cx, battleY + btnH + 17);

    const soloY = battleY + btnH + 30;
    const soloText = heart.canPlay ? '单人闯关' : '体力不足';
    if (!heart.canPlay || !drawAssetButton(ctx, assets.get('homeButtonSecondary'), btnX, soloY, btnW, btnH, soloText, 21)) {
        drawButton(
            ctx, btnX, soloY, btnW, btnH, soloText,
            heart.canPlay ? '#A996ED' : THEME.btnGrayTop,
            heart.canPlay ? '#7962CC' : THEME.btnGrayBottom,
            THEME.textLight, 21
        );
    }
    buttons.start = { x: btnX, y: soloY, w: btnW, h: btnH };

    const utilityY = soloY + btnH + 18;
    const showHeartAd = !heart.canPlay && !!heart.canAd;
    if (showHeartAd) {
        const adW = Math.min(196, btnW * 0.66);
        drawButton(ctx, cx - adW / 2, utilityY, adW, 42, '看广告补充体力', '#F4B86C', '#D58B47', '#FFFFFF', 15);
        buttons.addHeart = { x: cx - adW / 2, y: utilityY, w: adW, h: 42 };
    } else {
        ctx.font = '12px sans-serif';
        ctx.fillStyle = 'rgba(255, 239, 249, 0.86)';
        const status = heart.canPlay
            ? '已解锁第 ' + unlockedLevel + ' 关 · ' + heart.timeLeftText + ' 后恢复体力'
            : '体力不足 · ' + heart.timeLeftText + ' 后恢复';
        ctx.fillText(status, cx, utilityY + 12);
    }

    const utilityButtonY = Math.min(screen.height - 52, utilityY + (showHeartAd ? 54 : 26));
    const utilityButtonW = 86;
    const utilityGap = 12;
    const utilityStartX = cx - utilityButtonW - utilityGap / 2;
    drawButton(ctx, utilityStartX, utilityButtonY, utilityButtonW, 36, '商店', '#6C669E', '#4A4679', '#FFFFFF', 13);
    buttons.shop = { x: utilityStartX, y: utilityButtonY, w: utilityButtonW, h: 36 };
    const settingsX = cx + utilityGap / 2;
    drawButton(ctx, settingsX, utilityButtonY, utilityButtonW, 36, '设置', '#6C669E', '#4A4679', '#FFFFFF', 13);
    buttons.settings = { x: settingsX, y: utilityButtonY, w: utilityButtonW, h: 36 };

    return buttons;
};

UI.drawSettings = function (ctx, screen, settings) {
    const cx = screen.width / 2;
    drawSceneBackground(ctx, screen, 'homeBackground', 0.44);

    const cardW = Math.min(320, screen.width - 36);
    const cardH = 378;
    const cardX = cx - cardW / 2;
    const cardY = Math.max(76, (screen.height - cardH) / 2);
    drawGlassCard(ctx, screen, cardX, cardY, cardW, cardH, 24);

    const musicEnabled = settings.musicEnabled !== false;
    const sfxEnabled = settings.sfxEnabled == null ? settings.soundEnabled !== false : settings.sfxEnabled;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = THEME.textScene;
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('设置', cx, cardY + 48);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = THEME.textSceneMuted;
    ctx.fillText('调整声音，或查看隐私说明', cx, cardY + 80);

    const buttons = {};
    const btnW = cardW - 56;
    const btnX = cx - btnW / 2;
    const musicY = cardY + 108;
    drawButton(
        ctx, btnX, musicY, btnW, 52,
        musicEnabled ? '音乐：开启' : '音乐：关闭',
        musicEnabled ? '#A996ED' : THEME.btnGrayTop,
        musicEnabled ? '#7962CC' : THEME.btnGrayBottom,
        '#FFFFFF', 17
    );
    buttons.music = { x: btnX, y: musicY, w: btnW, h: 52 };

    const sfxY = musicY + 66;
    drawButton(
        ctx, btnX, sfxY, btnW, 52,
        sfxEnabled ? '音效：开启' : '音效：关闭',
        sfxEnabled ? '#A996ED' : THEME.btnGrayTop,
        sfxEnabled ? '#7962CC' : THEME.btnGrayBottom,
        '#FFFFFF', 17
    );
    buttons.sfx = { x: btnX, y: sfxY, w: btnW, h: 52 };

    const privacyY = sfxY + 66;
    drawButton(ctx, btnX, privacyY, btnW, 52, '隐私说明', '#8C82B0', '#514A78', '#FFFFFF', 17);
    buttons.privacy = { x: btnX, y: privacyY, w: btnW, h: 52 };

    const backY = privacyY + 70;
    drawButton(ctx, btnX, backY, btnW, 50, '返回首页', '#FF91C2', '#E6549C', '#FFFFFF', 17);
    buttons.back = { x: btnX, y: backY, w: btnW, h: 50 };
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

    drawSceneBackground(ctx, screen, 'homeBackground', 0.38);

    // 标题 + 金币
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = THEME.textScene;
    ctx.fillText('商店', cx, 52);

    // 金币胶囊
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px sans-serif';
    const coinText = '🪙 ' + coins;
    const coinW = ctx.measureText(coinText).width + 32;
    const coinH = 36;
    ctx.fillStyle = THEME.glassBgSoft;
    roundRectPath(ctx, cx - coinW / 2, 66, coinW, coinH, coinH / 2);
    ctx.fill();
    ctx.strokeStyle = THEME.glassBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = THEME.gold;
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

        drawGlassCard(ctx, screen, cardX, cardY, cardW, cardH, 18);

        // 图标
        ctx.textAlign = 'left';
        ctx.font = '34px sans-serif';
        ctx.fillText(def.icon, cardX + 18, cardY + cardH / 2);

        // 名称 + 说明
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = THEME.textScene;
        ctx.font = 'bold 17px sans-serif';
        ctx.fillText(def.name, cardX + 66, cardY + 34);
        ctx.fillStyle = THEME.textSceneMuted;
        ctx.font = '13px sans-serif';
        ctx.fillText(def.desc, cardX + 66, cardY + 58);
        ctx.fillStyle = THEME.textSceneMuted;
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

    drawSceneBackground(ctx, screen, 'gameBackground', 0.22);
    ctx.fillStyle = 'rgba(10, 10, 44, 0.42)';
    ctx.fillRect(0, 0, screen.width, screen.height);

    // 卡片（胜利时更高：多星星行；失败且有复活按钮时更高）
    const hasRevive = !result.win && result.canRevive;
    const cardW = 310;
    const cardH = hasRevive ? 400 : (result.win ? 370 : 330);
    const cardX = cx - cardW / 2;
    const cardY = screen.height * 0.2;

    drawGlassCard(ctx, screen, cardX, cardY, cardW, cardH, 24);

    // 结果大图标
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '52px sans-serif';
    ctx.fillText(result.win ? '🎉' : '💔', cx, cardY + 66);

    // 结果标题
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = result.win ? THEME.gold : '#FF9DB6';
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
        ctx.fillStyle = THEME.textScene;
        ctx.fillText('得分：' + result.score, cx, cardY + 196);

        // 金币奖励
        if (result.coinReward > 0) {
            ctx.font = 'bold 17px sans-serif';
            ctx.fillStyle = THEME.gold;
            ctx.fillText('🪙 +' + result.coinReward + ' 金币', cx, cardY + 226);
            nextBtnY = cardY + 252;
        } else {
            nextBtnY = cardY + 224;
        }
    } else {
        // 分数
        ctx.font = '20px sans-serif';
        ctx.fillStyle = THEME.textScene;
        ctx.fillText('得分：' + result.score, cx, cardY + 160);
        nextBtnY = cardY + 192;
    }

    // 按钮
    const btnW = 230;
    const btnH = 52;
    const btnX = cx - btnW / 2;
    const buttons = {};

    // 复活按钮（失败且激励视频可用；同一局可重复观看）
    if (hasRevive) {
        drawButton(ctx, btnX, nextBtnY, btnW, btnH, '看广告复活 +' + config.AD_CONFIG.reviveSteps + ' 步', '#FFDFA4', '#D89A49', THEME.textLight, 17);
        buttons.revive = { x: btnX, y: nextBtnY, w: btnW, h: btnH };
        nextBtnY += btnH + 14;
    }

    // 主按钮：下一关（胜利）或再来一次（失败）
    if (result.win && result.hasNext) {
        drawButton(ctx, btnX, nextBtnY, btnW, btnH, '下 一 关', '#B9A7F4', THEME.successDark, THEME.textLight, 19);
    } else {
        drawButton(ctx, btnX, nextBtnY, btnW, btnH, '再 来 一 次', THEME.primaryLight, THEME.primary, THEME.textLight, 19);
    }
    buttons.main = { x: btnX, y: nextBtnY, w: btnW, h: btnH };

    // 返回菜单按钮
    const menuBtnY = nextBtnY + btnH + 14;
    drawButton(ctx, btnX, menuBtnY, btnW, btnH, '返回主菜单', THEME.btnGrayTop, THEME.btnGrayBottom, THEME.textLight, 17);
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

    drawSceneBackground(ctx, screen, 'levelBackground', 0.16);

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = THEME.textScene;
    ctx.fillText('选择关卡', cx, 50);

    // 金币胶囊（右上）
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px sans-serif';
    const coinText = '🪙 ' + coins;
    const coinW = ctx.measureText(coinText).width + 24;
    const coinH = 30;
    ctx.fillStyle = THEME.glassBgSoft;
    roundRectPath(ctx, screen.width - coinW - 14, 14, coinW, coinH, coinH / 2);
    ctx.fill();
    ctx.strokeStyle = THEME.glassBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = THEME.gold;
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
            ctx.shadowColor = 'rgba(255, 156, 200, 0.72)';
            ctx.shadowBlur = 14;
            ctx.fillStyle = THEME.primary;
        } else if (state === 'done') {
            ctx.shadowColor = 'rgba(157, 131, 232, 0.52)';
            ctx.shadowBlur = 10;
            ctx.fillStyle = THEME.success;
        } else {
            ctx.fillStyle = 'rgba(48, 45, 99, 0.82)';
        }
        ctx.beginPath();
        ctx.arc(x, y, nodeSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 白色内圈
        ctx.strokeStyle = state === 'current' ? THEME.gold : THEME.glassBorder;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, nodeSize / 2 - 4, 0, Math.PI * 2);
        ctx.stroke();

        // 节点内容：代码绘制，避免混入旧版米黄猫头节点
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const nodeW = nodeSize * 1.05;
        const nodeH = nodeW * 0.88;
        ctx.fillStyle = 'rgba(255,245,252,0.18)';
        ctx.beginPath();
        ctx.arc(x, y - 2, nodeSize * 0.32, 0, Math.PI * 2);
        ctx.fill();

        // 关卡号
        ctx.font = 'bold 18px sans-serif';
        ctx.fillStyle = state === 'locked' ? '#B6AACB' : '#FFFFFF';
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
            ctx.fillStyle = 'rgba(255,255,255,0.66)';
            ctx.fillText('🔒', x, y + nodeH / 2 - 4);
        }

        // 关卡名（节点下方小字）
        ctx.font = '11px sans-serif';
        ctx.fillStyle = THEME.textSceneMuted;
        const lv = require('../core/level');
        const level = lv.getLevel(i);
        ctx.fillText(level ? level.name : '第' + i + '关', x, y + nodeSize / 2 + 9);

        buttons['level_' + i] = { x: x - nodeSize / 2, y: y - nodeSize / 2, w: nodeSize, h: nodeSize };
    }

    // 返回按钮（固定在底部附近，避开节点区）
    const backW = 200;
    const backH = 50;
    const backY = screen.height - 66;
    drawButton(ctx, cx - backW / 2, backY, backW, backH, '返 回', '#8C82B0', '#514A78', THEME.textLight, 17);
    buttons.back = { x: cx - backW / 2, y: backY, w: backW, h: backH };

    return buttons;
};

/** 判断点是否在按钮区域内 */
UI.hitTest = function (x, y, btn) {
    if (!btn) return false;
    return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
};

module.exports = UI;
