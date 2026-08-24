/**
 * UI 绘制模块（canvas 绘制主菜单 / 结算页，清新糖果风）
 * 所有按钮返回 {x, y, w, h} 区域，由 Main 统一做点击命中检测
 */

const THEME = require('./theme');
const coin = require('../core/coin');
const config = require('../core/config');
const assets = require('./assets');
const typography = require('./typography');

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

    ctx.fillStyle = '#F8D9EC';
    typography.drawFit(ctx, label, x + w * 0.32, y + h / 2 + 1, w * 0.48, {
        size: 12, minSize: 9, align: 'center'
    });
    ctx.fillStyle = '#FFFFFF';
    typography.drawFit(ctx, String(value), x + w * 0.72, y + h / 2 + 1, w * 0.48, {
        size: 16, minSize: 9, weight: 'bold', numbers: true, align: 'center'
    });
}

function drawImageContain(ctx, img, x, y, w, h) {
    if (!img || !img.width || !img.height) return false;
    const scale = Math.min(w / img.width, h / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    return true;
}

/** 首页与棋盘共用的暖金猫咪 HUD 控件。 */
function drawHudPill(ctx, screen, x, y, w, h, img, label, value) {
    ctx.save();
    if (!screen.reduceEffects) {
        ctx.shadowColor = 'rgba(23, 12, 58, 0.38)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
    }
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, 'rgba(255, 232, 226, 0.96)');
    g.addColorStop(1, 'rgba(202, 151, 177, 0.94)');
    ctx.fillStyle = g;
    roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = '#F6D08C';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    const inset = Math.max(7, Math.floor(h * 0.14));
    const iconSize = Math.min(h - inset * 2, w * 0.36);
    drawImageContain(ctx, img, x + inset, y + (h - iconSize) / 2, iconSize, iconSize);
    const valueX = x + inset + iconSize + Math.max(7, Math.floor(h * 0.14));
    const valueW = Math.max(1, x + w - inset - valueX);
    ctx.fillStyle = '#FFF8F2';
    ctx.shadowColor = 'rgba(68, 35, 72, 0.55)';
    ctx.shadowBlur = 2;
    typography.drawFit(ctx, String(value), valueX, y + h / 2, valueW, {
        size: Math.max(18, Math.floor(h * 0.46)), minSize: 8,
        weight: 'bold', numbers: true, align: 'left'
    });
    ctx.shadowColor = 'transparent';
    if (label) {
        ctx.fillStyle = 'rgba(70, 43, 84, 0.78)';
        typography.drawFit(ctx, label, valueX, y + h * 0.27, valueW, {
            size: 11, minSize: 7, align: 'left'
        });
    }
}

function drawIconControl(ctx, screen, x, y, size, img, label) {
    ctx.save();
    if (!screen.reduceEffects) {
        ctx.shadowColor = 'rgba(23, 12, 58, 0.36)';
        ctx.shadowBlur = 9;
        ctx.shadowOffsetY = 3;
    }
    const g = ctx.createLinearGradient(x, y, x, y + size);
    g.addColorStop(0, 'rgba(255, 236, 228, 0.98)');
    g.addColorStop(1, 'rgba(199, 148, 177, 0.96)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#F6D08C';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    drawImageContain(ctx, img, x + 3, y + 3, size - 6, size - 6);
    if (label) {
        ctx.fillStyle = '#FFF7FC';
        typography.drawFit(ctx, label, x + size / 2, y + size + 7, size, {
            size: 10, minSize: 8, weight: 'bold', align: 'center', baseline: 'top'
        });
    }
}

function toolAssetKey(type) {
    if (type === 'hammer') return 'uiToolHammer';
    if (type === 'bomb') return 'uiToolBomb';
    return 'uiToolYarn';
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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
    typography.drawCentered(ctx, text, x, y + 1, w, h, {
        size: fontSize || 20, minSize: 10, weight: 'bold'
    });
}

function drawCoinPriceButton(ctx, x, y, w, h, price, affordable) {
    drawButton(
        ctx, x, y, w, h, '',
        affordable ? THEME.shopTop : THEME.btnGrayTop,
        affordable ? THEME.shopBottom : THEME.btnGrayBottom,
        THEME.textLight, 13
    );
    const iconSize = Math.min(25, h - 10);
    drawImageContain(ctx, assets.get('uiCoin'), x + 8, y + (h - iconSize) / 2, iconSize, iconSize);
    ctx.fillStyle = THEME.textLight;
    const priceX = x + iconSize + 14;
    typography.drawFit(ctx, String(price), priceX, y + h / 2 + 1, Math.max(1, w - iconSize - 22), {
        size: 14, minSize: 8, weight: 'bold', numbers: true, align: 'left'
    });
}

function drawAssetButton(ctx, img, x, y, w, h, text, fontSize) {
    if (!img || !img.width || !img.height) return false;
    ctx.drawImage(img, x, y, w, h);
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(65, 35, 86, 0.65)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 2;
    typography.drawCentered(ctx, text, x, y - 1, w, h, {
        size: fontSize || 20, minSize: 10, weight: 'bold'
    });
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

    const safe = Math.max(12, screen.safeTop || 12);
    const side = Math.max(10, screen.width * 0.032);
    const control = 48;
    const hudHeight = 42;
    // The simulator can report a missing menu-button rect even while drawing
    // the capsule. Keep the enlarged HUD on the next visual row so values are
    // never covered by the WeChat chrome.
    const hudY = Math.max(safe + 40, Number(screen.contentTop) || 0);
    const gap = 7;
    const hudRight = Math.max(side + 150, Math.min(
        screen.width * 0.47,
        screen.width - side,
        Number(screen.contentRight) || screen.width - side
    ));
    const pillW = Math.min(108, Math.max(1, (hudRight - side - gap) / 2));
    const buttons = {};

    drawHudPill(ctx, screen, side, hudY, pillW, hudHeight, assets.get('uiHeart'), '', heart.count);
    drawHudPill(ctx, screen, side + pillW + gap, hudY, pillW, hudHeight, assets.get('uiCoin'), '', (economy && economy.coins) || 0);

    const titleTop = Math.max(hudY + hudHeight + 8, screen.height * 0.085);
    const titleLogo = assets.get('homeTitleLogo');
    const titleW = Math.min(374, screen.width * 0.985);
    const titleH = titleW * 0.394;
    if (titleLogo && titleLogo.width > 0) {
        ctx.drawImage(titleLogo, cx - titleW / 2, titleTop, titleW, titleH);
    } else {
        ctx.fillStyle = '#FFD7EC';
        typography.drawCentered(ctx, config.GAME_CONFIG.title, cx - titleW / 2, titleTop, titleW, titleH, {
            size: Math.min(42, screen.width * 0.105), minSize: 18, weight: 'bold'
        });
    }

    const hero = assets.get('homeDuelCats');
    const heroW = Math.min(screen.width * 1.08, 420);
    const heroH = heroW * 0.684;
    const heroY = titleTop + titleH - 24;
    if (hero && hero.width > 0) {
        ctx.drawImage(hero, cx - heroW / 2, heroY, heroW, heroH);
    }

    const btnW = Math.min(322, screen.width - side * 2 - 12);
    const btnH = Math.max(58, Math.min(70, screen.height * 0.082));
    const btnX = cx - btnW / 2;
    const battleY = Math.min(screen.height - 232, Math.max(heroY + heroH - 24, screen.height * 0.55));
    if (!drawAssetButton(ctx, assets.get('homeButtonPrimary'), btnX, battleY, btnW, btnH, '好友对战', 22)) {
        drawButton(ctx, btnX, battleY, btnW, btnH, '好友对战', '#FF91C2', '#E6549C', THEME.textLight, 22);
    }
    buttons.battle = { x: btnX, y: battleY, w: btnW, h: btnH };

    ctx.fillStyle = 'rgba(255, 239, 249, 0.9)';
    typography.drawFit(ctx, '60 秒实时比拼 · 邀请好友即刻开局', cx, battleY + btnH + 17, btnW, {
        size: 12, minSize: 9, align: 'center'
    });

    const soloY = battleY + btnH + 28;
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

    const utilityY = soloY + btnH + 14;
    const showHeartAd = !heart.canPlay && !!heart.canAd;
    if (showHeartAd) {
        const adW = Math.min(196, btnW * 0.66);
        drawButton(ctx, cx - adW / 2, utilityY, adW, 42, '看广告补充体力', '#F4B86C', '#D58B47', '#FFFFFF', 15);
        buttons.addHeart = { x: cx - adW / 2, y: utilityY, w: adW, h: 42 };
    } else {
        ctx.fillStyle = 'rgba(255, 239, 249, 0.86)';
        const status = heart.canPlay
            ? '已解锁第 ' + unlockedLevel + ' 关 · ' + heart.timeLeftText + ' 后恢复体力'
            : '体力不足 · ' + heart.timeLeftText + ' 后恢复';
        typography.drawFit(ctx, status, cx, utilityY + 12, screen.width - side * 2, {
            size: 12, minSize: 8, align: 'center', numbers: true
        });
    }

    const utilityButtonY = Math.min(
        screen.height - (Number(screen.safeBottom) || 0) - control - 8,
        utilityY + (showHeartAd ? 48 : 22)
    );
    const shopX = cx - control - 10;
    const settingsX = cx + 10;
    drawIconControl(ctx, screen, shopX, utilityButtonY, control, assets.get('uiShop'), '商店');
    drawIconControl(ctx, screen, settingsX, utilityButtonY, control, assets.get('uiSettings'), '设置');
    buttons.shop = { x: shopX, y: utilityButtonY, w: control, h: control + 14 };
    buttons.settings = { x: settingsX, y: utilityButtonY, w: control, h: control + 14 };

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

    ctx.fillStyle = THEME.textScene;
    typography.drawFit(ctx, '设置', cx, cardY + 48, cardW - 40, {
        size: 28, minSize: 20, weight: 'bold', align: 'center'
    });
    ctx.fillStyle = THEME.textSceneMuted;
    typography.drawFit(ctx, '调整声音，或查看隐私说明', cx, cardY + 80, cardW - 40, {
        size: 14, minSize: 10, align: 'center'
    });

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
 * @param {object} rewardOptions { canReward, count, limit, pending }
 * @returns {object} 按钮区域 { buy_*, reward_*, back }
 */
UI.drawShop = function (ctx, screen, coins, items, rewardOptions) {
    const cx = screen.width / 2;
    const safe = Math.max(10, Number(screen.safeTop) || 10);
    const headerW = Math.max(150, screen.width * 0.47);

    drawSceneBackground(ctx, screen, 'homeBackground', 0.38);

    // 标题 + 金币
    ctx.fillStyle = THEME.textScene;
    typography.drawFit(ctx, '商店', 16, safe + 16, headerW, {
        size: 30, minSize: 20, weight: 'bold', align: 'left'
    });

    drawHudPill(ctx, screen, 16, safe + 32, Math.min(116, headerW), 40, assets.get('uiCoin'), '', coins);
    rewardOptions = rewardOptions || {};
    if (rewardOptions.canReward) {
        ctx.fillStyle = THEME.textSceneMuted;
        typography.drawFit(ctx, '视频领取 ' + (Number(rewardOptions.count) || 0) + '/' +
            (Number(rewardOptions.limit) || 10), 140, safe + 52, screen.width - 156, {
            size: 12, minSize: 8, numbers: true, align: 'right'
        });
    }

    const buttons = {};

    // 道具卡片（竖排 3 个）
    const defs = coin.ITEM_DEFS;
    const types = ['hammer', 'bomb', 'color'];
    const cardW = Math.min(300, screen.width - 24);
    const cardH = rewardOptions.canReward ? 112 : 96;
    const startY = Math.max(130, safe + 88);
    const gap = rewardOptions.canReward ? 10 : 14;

    for (let i = 0; i < types.length; i++) {
        const type = types[i];
        const def = defs[type];
        const cardX = cx - cardW / 2;
        const cardY = startY + i * (cardH + gap);

        drawGlassCard(ctx, screen, cardX, cardY, cardW, cardH, 18);

        // 图标
        drawImageContain(ctx, assets.get(toolAssetKey(type)), cardX + 12, cardY + (cardH - 62) / 2, 62, 62);

        // 名称 + 说明
        const buyW = Math.min(88, Math.max(76, cardW * 0.29));
        const buyH = rewardOptions.canReward ? 36 : 40;
        const buyX = cardX + cardW - buyW - 12;
        const textX = cardX + 78;
        const textW = Math.max(52, buyX - textX - 8);
        ctx.fillStyle = THEME.textScene;
        typography.drawFit(ctx, def.name, textX, cardY + 28, textW, {
            size: 17, minSize: 11, weight: 'bold'
        });
        ctx.fillStyle = THEME.textSceneMuted;
        typography.drawFit(ctx, def.desc, textX, cardY + 52, textW, {
            size: 13, minSize: 9
        });
        ctx.fillStyle = THEME.textSceneMuted;
        typography.drawFit(ctx, '拥有 ' + (items[type] || 0), textX, cardY + 76, textW, {
            size: 12, minSize: 8, numbers: true
        });

        // 购买按钮
        const buyY = rewardOptions.canReward ? cardY + 10 : cardY + cardH / 2 - buyH / 2;
        const affordable = coins >= def.price;
        drawCoinPriceButton(ctx, buyX, buyY, buyW, buyH, def.price, affordable);
        buttons['buy_' + type] = { x: buyX, y: buyY, w: buyW, h: buyH };
        if (rewardOptions.canReward) {
            const rewardY = cardY + cardH - 44;
            const atLimit = Number(rewardOptions.count) >= (Number(rewardOptions.limit) || 10);
            const rewardText = rewardOptions.pending ? '领取中' : (atLimit ? '今日已满' : '视频 +1');
            drawButton(
                ctx, buyX, rewardY, buyW, 34, rewardText,
                atLimit ? THEME.btnGrayTop : '#B9A7F4',
                atLimit ? THEME.btnGrayBottom : THEME.successDark,
                THEME.textLight, 12
            );
            buttons['reward_' + type] = { x: buyX, y: rewardY, w: buyW, h: 34 };
        }
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
 * @param {object} result { win, score, reason, timed, levelId, hasNext, canRevive }
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
    const cardH = hasRevive ? 450 : (result.win ? 420 : 380);
    const cardX = cx - cardW / 2;
    const cardY = screen.height * 0.2;

    drawGlassCard(ctx, screen, cardX, cardY, cardW, cardH, 24);

    // 结果猫咪：成功大笑，失败沮丧
    const resultCat = assets.get(result.win ? 'uiResultHappyCat' : 'uiResultSadCat');
    drawImageContain(ctx, resultCat, cx - 72, cardY + 12, 144, 132);

    // 结果标题
    ctx.fillStyle = result.win ? THEME.gold : '#FF9DB6';
    const resultTitle = result.win ? '通关成功' : (result.reason === 'timeout' ? '时间到' : '挑战失败');
    typography.drawFit(ctx, resultTitle, cx, cardY + 154, cardW - 32, {
        size: 28, minSize: 18, weight: 'bold', align: 'center'
    });

    // 星星（胜利时显示 ★ 亮 / ☆ 暗）
    let nextBtnY = cardY + 232;
    if (result.win) {
        const startSX = cx - 30;
        for (let k = 1; k <= 3; k++) {
            ctx.fillStyle = k <= result.star ? '#FFC531' : '#E8E0D0';
            typography.drawFit(ctx, '★', startSX + (k - 1) * 30, cardY + 190, 30, {
                size: 30, minSize: 18, align: 'center'
            });
        }
        // 分数（下移给星星让位）
        ctx.fillStyle = THEME.textScene;
        typography.drawFit(ctx, '得分：' + result.score, cx, cardY + 222, cardW - 36, {
            size: 20, minSize: 11, numbers: true, align: 'center'
        });

        // 金币奖励
        if (result.coinReward > 0) {
            drawImageContain(ctx, assets.get('uiCoin'), cx - 68, cardY + 232, 30, 30);
            ctx.fillStyle = THEME.gold;
            typography.drawFit(ctx, '+' + result.coinReward + ' 金币', cx - 34, cardY + 247, cardW - 92, {
                size: 17, minSize: 10, weight: 'bold', numbers: true
            });
            nextBtnY = cardY + 276;
        } else {
            nextBtnY = cardY + 250;
        }
    } else {
        // 分数
        ctx.fillStyle = THEME.textScene;
        typography.drawFit(ctx, '得分：' + result.score, cx, cardY + 198, cardW - 36, {
            size: 20, minSize: 11, numbers: true, align: 'center'
        });
        if (result.reason === 'timeout') {
            ctx.fillStyle = THEME.textSceneMuted;
            typography.drawFit(ctx, '别急，下一次会走得更远', cx, cardY + 225, cardW - 36, {
                size: 13, minSize: 9, align: 'center'
            });
        }
        nextBtnY = cardY + 248;
    }

    // 按钮
    const btnW = 230;
    const btnH = 52;
    const btnX = cx - btnW / 2;
    const buttons = {};

    // 复活按钮（失败且激励视频可用；同一局可重复观看）
    if (hasRevive) {
        const reviveText = '看广告复活 +' + config.AD_CONFIG.reviveSteps + ' 步' + (result.timed ? ' · +30秒' : '');
        drawButton(ctx, btnX, nextBtnY, btnW, btnH, reviveText, '#FFDFA4', '#D89A49', THEME.textLight, result.timed ? 15 : 17);
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
 * 关卡地图：固定透视路面上的连续五关。
 * `offset` 是 0 基准的平滑滚动位置；最大位置让最后一个预览节点不超过 unlockedLevel + 4。
 */
UI.drawLevelSelect = function (ctx, screen, unlockedLevel, coins, stars, mapState) {
    // 保留旧测试/调用的参数形状：(..., coins, totalLevels, stars)。totalLevels 已不再参与绘制。
    if (typeof stars === 'number') {
        stars = mapState || {};
        mapState = {};
    }
    stars = stars && typeof stars === 'object' ? stars : {};
    const currentLevel = Math.max(1, Math.floor(Number(unlockedLevel) || 1));
    const maxOffset = Math.max(0, currentLevel - 1);
    const rawOffset = Number(mapState && mapState.offset) || 0;
    const offset = clamp(rawOffset, 0, maxOffset);
    const baseLevel = Math.floor(offset) + 1;
    const fraction = offset - Math.floor(offset);
    const cx = screen.width / 2;
    const safe = Math.max(10, Number(screen.safeTop) || 10);

    drawSceneBackground(ctx, screen, 'levelBackground', 0.11);
    const titleW = Math.max(150, screen.width * 0.48);
    ctx.fillStyle = THEME.textScene;
    typography.drawFit(ctx, '沿着星光小路出发', 16, safe + 28, titleW, {
        size: 27, minSize: 18, weight: 'bold', align: 'left'
    });
    ctx.fillStyle = 'rgba(255,239,249,0.82)';
    typography.drawFit(ctx, '向下拖动小路，探索更深处', 16, safe + 53, titleW, {
        size: 11, minSize: 8, align: 'left'
    });
    const buttons = { visibleLevels: [] };
    const top = Math.max(safe + 96, screen.height * 0.19);
    const bottom = screen.height - Math.max(120, Number(screen.safeBottom) + 110);
    // Follow the visible center line of level-background-v2.jpg from the
    // foreground path to the pavilion, instead of drifting onto the flowers.
    const pathX = [0.52, 0.45, 0.56, 0.48, 0.50];

    function pathPoint(distance) {
        const d = Number(distance) || 0;
        const anchor = clamp(d, 0, 4);
        const lo = Math.floor(anchor);
        const hi = Math.min(4, lo + 1);
        const mix = anchor - lo;
        let nx = pathX[lo] + (pathX[hi] - pathX[lo]) * mix;
        if (d < 0) nx = pathX[0] + (pathX[1] - pathX[0]) * d;
        if (d > 4) nx = pathX[4] + (pathX[4] - pathX[3]) * (d - 4);
        const depth = d / 4;
        return {
            x: screen.width * nx,
            y: bottom - (bottom - top) * depth,
            scale: Math.max(0.58, 1 - depth * 0.34)
        };
    }

    for (let i = 0; i < 5; i++) {
        const levelId = baseLevel + i;
        const distance = i - fraction;
        const point = pathPoint(distance);
        const state = levelId < currentLevel ? 'done' : (levelId === currentLevel ? 'current' : 'locked');
        const nodeSize = 78 * point.scale;
        const imageKey = state === 'done' ? 'levelNodeDone' : (state === 'current' ? 'levelNodeCurrent' : 'levelNodeLocked');
        const image = assets.get(imageKey);

        ctx.save();
        if (!screen.reduceEffects && state === 'current') {
            ctx.shadowColor = 'rgba(255, 156, 200, 0.88)';
            ctx.shadowBlur = 18;
        }
        drawImageContain(ctx, image, point.x - nodeSize / 2, point.y - nodeSize / 2, nodeSize, nodeSize);
        ctx.restore();

        ctx.fillStyle = state === 'locked' ? '#D6CEE7' : '#FFFFFF';
        typography.drawFit(ctx, String(levelId), point.x, point.y - nodeSize * 0.03, nodeSize * 0.48, {
            size: Math.max(17, nodeSize * 0.29), minSize: 10,
            weight: 'bold', numbers: true, align: 'center'
        });

        if (state === 'done') {
            const starCount = Math.max(0, Math.min(3, Number(stars[levelId]) || 0));
            for (let star = 0; star < 3; star++) {
                ctx.fillStyle = star < starCount ? '#FFE19B' : 'rgba(255,255,255,0.44)';
                typography.drawFit(ctx, '★', point.x - nodeSize * 0.25 + star * nodeSize * 0.25,
                    point.y + nodeSize * 0.27, nodeSize * 0.23, {
                        size: Math.max(10, nodeSize * 0.17), minSize: 7, align: 'center'
                    });
            }
        } else {
            ctx.fillStyle = state === 'current' ? '#FFF4FB' : '#C7BEDB';
            typography.drawFit(ctx, state === 'current' ? '当前' : '锁定', point.x,
                point.y + nodeSize * 0.54, nodeSize + 12, {
                    size: Math.max(10, nodeSize * 0.16), minSize: 8, align: 'center'
                });
        }

        const hitSize = nodeSize + 18;
        buttons['level_' + levelId] = {
            x: point.x - hitSize / 2,
            y: point.y - hitSize / 2,
            w: hitSize,
            h: hitSize
        };
        buttons.visibleLevels.push(levelId);
    }

    const backW = Math.min(150, screen.width - 36);
    const backH = 46;
    const backY = screen.height - Math.max(58, Number(screen.safeBottom) + 52);
    drawButton(ctx, cx - backW / 2, backY, backW, backH, '返回花园', '#8C82B0', '#514A78', THEME.textLight, 15);
    buttons.back = { x: cx - backW / 2, y: backY, w: backW, h: backH };
    buttons.map = { minOffset: 0, maxOffset: maxOffset, stepPx: Math.max(90, (bottom - top) / 4) };
    buttons.offset = offset;
    return buttons;
};

/** 判断点是否在按钮区域内 */
UI.hitTest = function (x, y, btn) {
    if (!btn) return false;
    return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
};

module.exports = UI;
