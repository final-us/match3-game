/**
 * UI 绘制模块（canvas 绘制主菜单 / 结算页，清新糖果风）
 * 所有按钮返回 {x, y, w, h} 区域，由 Main 统一做点击命中检测
 */

const THEME = require('./theme');
const coin = require('../core/coin');
const config = require('../core/config');
const assets = require('./assets');
const typography = require('./typography');
const moon = require('./moon-controls');
const privacyReader = require('./privacy-reader');
const levelData = require('../core/level');

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
    ctx.fillStyle = 'rgba(72, 89, 142, ' + (shade == null ? 0.12 : shade * 0.55) + ')';
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
    ctx.fillStyle = THEME.glassBgSoft;
    ctx.strokeStyle = THEME.glassBorder;
    ctx.lineWidth = 1.5;
    roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = THEME.textMid;
    typography.drawFit(ctx, label, x + w * 0.32, y + h / 2 + 1, w * 0.48, {
        size: 12, minSize: 9, align: 'center'
    });
    ctx.fillStyle = THEME.textDark;
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
    g.addColorStop(0, THEME.glassBg);
    g.addColorStop(1, THEME.glassBgSoft);
    ctx.fillStyle = g;
    roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.strokeStyle = THEME.glassBorder;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    const inset = Math.max(7, Math.floor(h * 0.14));
    const iconSize = Math.min(h - inset * 2, w * 0.36);
    drawImageContain(ctx, img, x + inset, y + (h - iconSize) / 2, iconSize, iconSize);
    const valueX = x + inset + iconSize + Math.max(7, Math.floor(h * 0.14));
    const valueW = Math.max(1, x + w - inset - valueX);
    ctx.fillStyle = THEME.textDark;
    ctx.shadowColor = 'rgba(255,255,255,0.65)';
    ctx.shadowBlur = 2;
    typography.drawFit(ctx, String(value), valueX, y + h / 2, valueW, {
        size: Math.max(18, Math.floor(h * 0.46)), minSize: 8,
        weight: 'bold', numbers: true, align: 'left'
    });
    ctx.shadowColor = 'transparent';
    if (label) {
        ctx.fillStyle = THEME.textMid;
        typography.drawFit(ctx, label, valueX, y + h * 0.27, valueW, {
            size: 11, minSize: 7, align: 'left'
        });
    }
}

function drawIconControl(ctx, screen, x, y, size, img, label) {
    // Transparent pearl icons; retain native silhouettes for an unavailable image.
    if (!drawImageContain(ctx, img, x, y, size, size)) {
    ctx.save();ctx.translate(x,y);ctx.scale(size/48,size/48);
    const skin=ctx.createLinearGradient(0,0,0,48);
    skin.addColorStop(0,'#FFFFFF');skin.addColorStop(.48,'#DDD7ED');skin.addColorStop(1,'#B9BEDB');
    ctx.fillStyle=skin;ctx.strokeStyle='#F6E4C7';ctx.lineWidth=1.8;
    ctx.shadowColor=THEME.cardShadow;ctx.shadowBlur=5;ctx.shadowOffsetY=2;
    if(label==='商店') {
        ctx.beginPath();ctx.moveTo(10,16);ctx.lineTo(38,16);ctx.lineTo(42,44);ctx.quadraticCurveTo(24,48,6,44);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.beginPath();ctx.moveTo(17,19);ctx.lineTo(17,11);ctx.bezierCurveTo(17,-1,31,-1,31,11);ctx.lineTo(31,19);ctx.strokeStyle='#DEC5A3';ctx.lineWidth=3;ctx.stroke();
        ctx.fillStyle='#DB9ABD';ctx.shadowColor='transparent';
        [[19,27,3],[26,24,3],[32,28,3],[15,32,2.6],[24,36,5.7]].forEach(p=>{ctx.beginPath();ctx.arc(p[0],p[1],p[2],0,Math.PI*2);ctx.fill();});
    } else {
        ctx.beginPath();
        for(let i=0;i<40;i++) {const a=i*Math.PI/20-Math.PI/2;const r=i%5===0||i%5===4?19:23;const px=24+Math.cos(a)*r,py=24+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}
        ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowColor='transparent';
        ctx.beginPath();ctx.arc(24,24,12,0,Math.PI*2);ctx.fillStyle='#B5B8D7';ctx.fill();ctx.stroke();
        const pearl=ctx.createRadialGradient(21,20,1,24,24,11);pearl.addColorStop(0,'#FFFFFF');pearl.addColorStop(.5,'#F4EFFB');pearl.addColorStop(1,'#B1B3D4');ctx.fillStyle=pearl;ctx.beginPath();ctx.arc(24,24,9.5,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
    }
    ctx.fillStyle=THEME.textDark;
    typography.drawFit(ctx,label,x+size/2,y+size+8,size+10,{size:12,minSize:9,weight:'bold',align:'center',baseline:'top'});
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
    ctx.strokeStyle = THEME.glassBorder;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    ctx.globalAlpha = 0.42;
    ctx.strokeStyle = '#FFFFFF';
    roundRectPath(ctx, x + 2, y + 2, w - 4, Math.max(1, h * 0.44), Math.min(14, h / 2));
    ctx.stroke();
    ctx.restore();

    // 按钮文字
    ctx.fillStyle = textColor || THEME.textLight;
    typography.drawCentered(ctx, text, x, y + 1, w, h, {
        size: fontSize || 20, minSize: 10, weight: 'bold'
    });
}

/** Home-only crystal capsule, with editable text and native ornament layers. */
function drawMoonHomeButton(ctx, x, y, w, h, text, primary, enabled) {
    ctx.save();
    ctx.shadowColor = 'rgba(69,67,120,0.27)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    const fill = ctx.createLinearGradient(x, y, x, y + h);
    fill.addColorStop(0, '#FFFFFF');
    fill.addColorStop(0.14, primary ? '#FFE9FB' : '#F0F8FF');
    fill.addColorStop(0.50, primary ? '#E8ADE0' : '#AFCBF0');
    fill.addColorStop(0.86, primary ? '#F7CCEC' : '#DBEAFF');
    fill.addColorStop(1, '#FFFFFF');
    ctx.fillStyle = enabled === false ? THEME.btnGrayTop : fill;
    roundRectPath(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#C2A585';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#FFF9EA';
    ctx.lineWidth = 2.5;
    roundRectPath(ctx, x + 3, y + 3, w - 6, h - 6, h / 2 - 3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, x + 6, y + 6, w - 12, h - 12, h / 2 - 6);
    ctx.stroke();
    // Broad diagonal glass reflection, clipped to the actual button.
    ctx.save();
    roundRectPath(ctx, x + 6, y + 6, w - 12, h - 12, h / 2 - 6);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.beginPath();
    ctx.moveTo(x + w * 0.26, y);
    ctx.lineTo(x + w * 0.42, y);
    ctx.lineTo(x + w * 0.23, y + h);
    ctx.lineTo(x + w * 0.12, y + h);
    ctx.closePath();ctx.fill();ctx.restore();
    // Fine edge scrolls stay outside the independent icon and label regions.
    for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side < 0 ? x + 10 : x + w - 10, y + h / 2);
        ctx.scale(side, 1);
        ctx.strokeStyle = '#C9AA87';ctx.lineWidth = 1;
        for (const vertical of [-1, 1]) {
            ctx.beginPath();ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-7, vertical * 6, -8, vertical * 15, 0, vertical * 19);
            ctx.bezierCurveTo(7, vertical * 23, 13, vertical * 20, 8, vertical * 16);
            ctx.stroke();
        }
        ctx.fillStyle = '#FFF7E9';ctx.beginPath();ctx.arc(0, 0, 2.2, 0, Math.PI * 2);ctx.fill();ctx.stroke();
        ctx.restore();
    }
    if (primary) {
        // Pearl crest in the same role as the reference's ornamental crown.
        for (let i = -1; i <= 1; i++) {
            const pearl = ctx.createRadialGradient(x + w / 2 + i * 7 - 1, y - 3, 0, x + w / 2 + i * 7, y, 5);
            pearl.addColorStop(0, '#FFFFFF');pearl.addColorStop(.5, '#F9E5F3');pearl.addColorStop(1, '#C7A5C6');
            ctx.fillStyle = pearl;ctx.strokeStyle = '#D5BA94';ctx.lineWidth = 1;
            ctx.beginPath();ctx.arc(x + w / 2 + i * 7, y + 1 - (i === 0 ? 3 : 0), i === 0 ? 5 : 3, 0, Math.PI * 2);ctx.fill();ctx.stroke();
        }
    }
    const iconSize = h * 0.46;
    const iconX = x + h * 0.22;
    if (primary) {
        drawImageContain(ctx, assets.get('homeDuelIcon'), iconX - 2, y + (h - iconSize) / 2 - 1, iconSize * 1.50, iconSize);
    } else {
        const iy=y+(h-iconSize)/2;
        const catGlass=ctx.createLinearGradient(iconX,iy,iconX+iconSize,iy+iconSize);
        catGlass.addColorStop(0,'#F1F5FF');catGlass.addColorStop(.32,'#A3BAEA');catGlass.addColorStop(.68,'#708BC3');catGlass.addColorStop(1,'#C9D8F6');
        ctx.fillStyle=catGlass;ctx.strokeStyle='#F9EDDB';ctx.lineWidth=1.8;
        ctx.beginPath();ctx.moveTo(iconX+3,iy+iconSize*.42);ctx.lineTo(iconX+5,iy+2);ctx.quadraticCurveTo(iconX+12,iy,iconX+iconSize*.33,iy+iconSize*.18);ctx.quadraticCurveTo(iconX+iconSize*.5,iy+iconSize*.12,iconX+iconSize*.67,iy+iconSize*.18);ctx.lineTo(iconX+iconSize-6,iy+1);ctx.lineTo(iconX+iconSize-2,iy+iconSize*.45);ctx.bezierCurveTo(iconX+iconSize+7,iy+iconSize,iconX-7,iy+iconSize,iconX+3,iy+iconSize*.42);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.fillStyle='#FFFFFF';
        [0.34,0.67].forEach(f=>{ctx.beginPath();ctx.arc(iconX+iconSize*f,iy+iconSize*.48,1.8,0,Math.PI*2);ctx.fill();});
        ctx.beginPath();ctx.arc(iconX+iconSize*.5,iy+iconSize*.66,3,0,Math.PI);ctx.stroke();
    }
    // Full-control alignment: ornaments never change the text's centre.
    ctx.fillStyle = '#292A62';
    typography.drawCentered(ctx,text,x+24,y,w-48,h,{size:primary?24:21,minSize:18,weight:'bold'});
    ctx.restore();
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
    // Button skins remain registered for compatibility, but B uses editable glass.
    drawButton(ctx, x, y, w, h, text, THEME.primaryLight, THEME.primary, THEME.textDark, fontSize);
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
    ctx.fillStyle = 'rgba(71, 86, 133, 0.08)';
    ctx.fillRect(0, 0, screen.width, screen.height);

    const safe = Math.max(12, screen.safeTop || 12);
    const side = Math.max(10, screen.width * 0.032);
    const hudHeight = 42;
    // Reference top row; HUD stays in the left 47%, outside the right-side capsule.
    // Honor a platform-provided lower contentTop when it requests one.
    const hudY = Math.max(safe + 8, Number(screen.contentTop) || 0);
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
    const compactHome = screen.height < 640;
    const titleW = Math.min(338, screen.width * (compactHome ? 0.56 : 0.76));
    const titleH = titleW * 0.5;
    if (titleLogo && titleLogo.width > 0) {
        ctx.drawImage(titleLogo, cx - titleW / 2, titleTop, titleW, titleH);
    } else {
        ctx.fillStyle = THEME.primaryDark;
        typography.drawCentered(ctx, config.GAME_CONFIG.title, cx - titleW / 2, titleTop, titleW, titleH, {
            size: Math.min(42, screen.width * 0.105), minSize: 18, weight: 'bold'
        });
    }

    const hero = assets.get('homeDuelCats');
    const heroW = Math.min(screen.width * 1.28, 550);
    const showHeartAd = !heart.canPlay && !!heart.canAd;
    // Reserve the whole action area first; short screens shrink art, never touch targets.
    const btnW = Math.min(328, screen.width * (compactHome ? .82 : .76));
    const btnX = cx - btnW / 2;
    const btnH = compactHome ? 66 : 72;
    const soloH = compactHome ? 44 : 56;
    const activityH=64,activityW=64;
    const bottom = screen.height - (Number(screen.safeBottom) || 0) - (compactHome?32:52);
    const activityY=bottom-activityH;
    const soloY=activityY-(compactHome?30:38)-soloH;
    const battleY=soloY-(compactHome?24:28)-btnH;
    const heroY = titleTop + titleH - (compactHome ? 28 : 44);
    const heroH = Math.min(heroW * .684, Math.max(1, battleY - heroY - 12));
    if (hero && hero.width > 0) {
        const ratio = hero.width / hero.height;
        const drawW = Math.min(heroW, heroH * ratio);
        const drawH = drawW / ratio;
        const drawX = cx - drawW / 2;
        const drawY = heroY + (heroH - drawH) / 2;
        // Transparent moon/cat component; no rectangular card or clipping frame.
        ctx.save();
        // Extend the hanging chains into the scene, behind the HUD/title slots.
        ctx.strokeStyle='rgba(217,182,119,0.85)';ctx.lineWidth=1;
        [drawX+drawW*.187,drawX+drawW*.815].forEach(chainX=>{
            for(let chainY=2;chainY<drawY;chainY+=7) {
                const underHud=chainX>=side&&chainX<=side+pillW*2+gap&&chainY>hudY-4&&chainY<hudY+hudHeight+4;
                const underTitle=chainX>cx-titleW/2&&chainX<cx+titleW/2&&chainY>titleTop&&chainY<titleTop+titleH;
                if(underHud||underTitle) continue;
                ctx.beginPath();ctx.ellipse(chainX,chainY,1.5,3.5,0,0,Math.PI*2);ctx.stroke();
            }
        });
        const glow = ctx.createRadialGradient(cx, drawY + drawH * 0.42, 0,
            cx, drawY + drawH * 0.42, drawW * 0.19);
        glow.addColorStop(0, 'rgba(255,247,224,0.48)');
        glow.addColorStop(1, 'rgba(255,247,224,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(drawX, drawY, drawW, drawH);
        ctx.strokeStyle='rgba(255,231,170,0.78)';ctx.lineWidth=1.4;
        ctx.beginPath();ctx.arc(cx,drawY+drawH*.42,drawW*.13,-1.1,.7);ctx.stroke();
        ctx.beginPath();ctx.arc(cx,drawY+drawH*.42,drawW*.13,2.1,3.6);ctx.stroke();
        ctx.drawImage(hero, drawX, drawY, drawW, drawH);
        ctx.restore();
    }

    drawMoonHomeButton(ctx, btnX, battleY, btnW, btnH, '好友对战', true, true);
    buttons.battle = { x: btnX, y: battleY, w: btnW, h: btnH };

    ctx.fillStyle=THEME.textDark;
    typography.drawFit(ctx,'60秒欢乐对决',cx,battleY+btnH+12,btnW,{size:11,minSize:10,align:'center',numbers:true});
    const soloW=btnW*(compactHome?.85:.80);
    drawMoonHomeButton(ctx,cx-soloW/2,soloY,soloW,soloH,heart.canPlay?'单人闯关':'体力不足',false,heart.canPlay);
    buttons.start={x:cx-soloW/2,y:soloY,w:soloW,h:soloH};
    ctx.fillStyle=THEME.textDark;
    const status=heart.count>=5?'已解锁第 '+unlockedLevel+' 关 · 体力已满':heart.timeLeftText+' 后恢复体力';
    typography.drawFit(ctx,status,cx,soloY+soloH+15,screen.width-32,{size:11,minSize:9,align:'center',numbers:true});

    // User-selected combination: original main capsules, compact utility row below.
    const entries=[['shop','uiShop','商店'],['daily','uiCoin','每日挑战'],['settings','uiSettings','设置']];
    if(showHeartAd)entries.push(['addHeart','uiHeart','看广告补体力']);
    const utilityGap=showHeartAd?8:(compactHome?20:28);
    const utilityLeft=cx-(entries.length*activityW+(entries.length-1)*utilityGap)/2;
    entries.forEach(([key,icon,label],index)=>{
        const x=utilityLeft+index*(activityW+utilityGap);
        drawImageContain(ctx,assets.get(icon),x+10,activityY,44,44);
        moon.button(ctx,x,activityY+42,activityW,22,label,'blue',key==='addHeart'?9:11);
        buttons[key]={x,y:activityY,w:activityW,h:activityH};
    });
    const reward=require('../core/daily-challenge').DAILY_RULES.reward;
    const badgeX=buttons.daily.x+35;
    ctx.save();ctx.fillStyle='#FFF1CA';roundRectPath(ctx,badgeX,activityY,30,16,8);ctx.fill();
    ctx.fillStyle='#775320';typography.drawCentered(ctx,String(reward),badgeX,activityY,30,16,{size:10,minSize:9,weight:'bold',numbers:true});ctx.restore();

    return buttons;
};

function drawSupportHeading(ctx, screen, title, iconKey) {
    const compact = screen.height < 700;
    const top = Math.max(16, Number(screen.contentTop) || 0, (Number(screen.safeTop) || 0) + 8);
    const cx = screen.width / 2;
    let y = top;
    if (!compact) {
        const w = Math.min(248, screen.width * .66);
        drawImageContain(ctx, assets.get('homeTitleLogo'), cx - w / 2, y, w, w / 2);
        y += w / 2 + 6;
    }
    const splitHeader = compact && title === '商店';
    const titleX = splitHeader ? 14 : cx - 86;
    const titleW = splitHeader ? 138 : 172;
    moon.button(ctx, titleX, y, titleW, 38, '', 'pink');
    drawImageContain(ctx, assets.get(iconKey), titleX+14, y + 5, 28, 28);
    ctx.fillStyle = THEME.textDark;
    typography.drawFit(ctx, title, titleX+titleW/2+14, y + 19, titleW-68, {size:22,minSize:18,weight:'bold',align:'center'});
    return y + 48;
}

UI.drawPrivacy = function (ctx, screen, offset) {
    drawSceneBackground(ctx, screen, 'homeBackground', 0.44);
    return privacyReader.draw(ctx, screen, offset);
};

UI.drawSettings = function (ctx, screen, settings) {
    const cx = screen.width / 2;
    drawSceneBackground(ctx, screen, 'homeBackground', 0.44);

    const headingEnd = drawSupportHeading(ctx, screen, '设置', 'uiSettings');
    const cardW = Math.min(340, screen.width - 32);
    const cardH = 338;
    const cardX = cx - cardW / 2;
    const cardY = Math.max(headingEnd + 16, (screen.height - cardH) / 2);
    moon.panel(ctx, screen, cardX, cardY, cardW, cardH);

    const musicEnabled = settings.musicEnabled !== false;
    const sfxEnabled = settings.sfxEnabled == null ? settings.soundEnabled !== false : settings.sfxEnabled;

    const buttons = {};
    const btnW = cardW - 36;
    const btnX = cx - btnW / 2;
    const musicY = cardY + 24;
    moon.toggle(ctx, btnX, musicY, btnW, 52, '背景音乐', 'music', musicEnabled);
    buttons.music = { x: btnX, y: musicY, w: btnW, h: 52 };

    const sfxY = musicY + 66;
    moon.toggle(ctx, btnX, sfxY, btnW, 52, '音效', 'sound', sfxEnabled);
    buttons.sfx = { x: btnX, y: sfxY, w: btnW, h: 52 };

    ctx.strokeStyle='#CBC8E0';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(btnX+24,sfxY+69);ctx.lineTo(btnX+btnW-24,sfxY+69);ctx.stroke();
    const privacyY = sfxY + 86;
    moon.button(ctx, btnX, privacyY, btnW, 52, settings.privacyPending ? '正在打开…' : '隐私说明', 'blue', 17);
    moon.glyph(ctx, 'privacy', btnX+14, privacyY+14, 24);
    buttons.privacy = { x: btnX, y: privacyY, w: btnW, h: 52 };

    const backY = privacyY + 66;
    moon.button(ctx, btnX, backY, btnW, 50, '返回首页', 'blue', 17);
    moon.glyph(ctx, 'home', btnX+14, backY+13, 24);
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
    drawSceneBackground(ctx, screen, 'homeBackground', 0.38);
    const headingEnd = drawSupportHeading(ctx, screen, '商店', 'uiShop');
    const compact = screen.height < 700;
    drawHudPill(ctx, screen, compact ? screen.width-130 : 18, compact ? headingEnd-48 : headingEnd, 116, 38, assets.get('uiCoin'), '', coins);
    rewardOptions = rewardOptions || {};
    let listTop = headingEnd + (compact ? 14 : 46);
    if (rewardOptions.canReward) {
        const quotaW = 164;
        const quotaH = 26;
        const quotaX = compact ? cx - quotaW / 2 : screen.width - quotaW - 18;
        const quotaY = headingEnd + (compact ? 5 : 6);
        ctx.fillStyle = 'rgba(246,245,255,.90)';
        roundRectPath(ctx, quotaX, quotaY, quotaW, quotaH, quotaH / 2);
        ctx.fill();
        moon.glyph(ctx, 'video', quotaX + 10, quotaY + 5, 16);
        ctx.fillStyle = THEME.textSceneMuted;
        typography.drawFit(ctx, '道具视频领取 ' + (Number(rewardOptions.count) || 0) + '/' +
            (Number(rewardOptions.limit) || 10), quotaX + 32, quotaY + quotaH / 2, quotaW - 42, {
            size: 11, minSize: 8, numbers: true, align: 'left'
        });
        listTop = quotaY + quotaH + (compact ? 8 : 14);
    }

    const buttons = {};
    const defs = coin.ITEM_DEFS;
    const types = ['hammer', 'bomb', 'color', 'heart'];
    const listW = Math.min(346, screen.width - 28);
    const listX = cx - listW / 2;
    const rowH = 78;
    const listPad = 8;
    const listH = listPad * 2 + rowH * types.length;
    moon.panel(ctx, screen, listX, listTop, listW, listH);

    for (let i = 0; i < types.length; i++) {
        const type = types[i];
        const def = type === 'heart'
            ? { name: '体力', price: coin.STAMINA_PRICE, desc: '恢复 1 点体力' }
            : defs[type];
        const rowY = listTop + listPad + i * rowH;
        const owned = type === 'heart' ? (Number(rewardOptions.heartCount) || 0) : (items[type] || 0);
        const heartMax = Number(rewardOptions.heartMax) || 5;
        const heartFull = type === 'heart' && owned >= heartMax;
        const affordable = coins >= def.price && !heartFull;
        const atLimit = Number(rewardOptions.count) >= (Number(rewardOptions.limit) || 10);

        if (i > 0) {
            ctx.strokeStyle = 'rgba(142, 137, 181, 0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(listX + 14, rowY);
            ctx.lineTo(listX + listW - 14, rowY);
            ctx.stroke();
        }

        const iconSize = 48;
        const iconX = listX + 12;
        const iconY = rowY + (rowH - iconSize) / 2;
        drawImageContain(ctx, assets.get(type === 'heart' ? 'uiHeart' : toolAssetKey(type)), iconX, iconY, iconSize, iconSize);

        const actionW = Math.min(140, Math.floor(listW * 0.47));
        const actionX = listX + listW - actionW - 10;
        const actionY = rowY + (rowH - 44) / 2;
        const textX = iconX + iconSize + 9;
        const textW = actionX - textX - 8;
        ctx.fillStyle = THEME.textScene;
        typography.drawFit(ctx, def.name, textX, rowY + 22, textW, {
            size: 16, minSize: 10, weight: 'bold'
        });
        ctx.fillStyle = THEME.textSceneMuted;
        typography.drawFit(ctx, type === 'heart' ? ('体力 ' + owned + '/' + heartMax) : ('拥有 ' + owned),
            textX, rowY + 43, textW, { size: 11, minSize: 8, numbers: true });
        ctx.fillStyle = affordable ? THEME.textSceneMuted : '#84577B';
        typography.drawFit(ctx, heartFull ? '体力已满' : (coins < def.price ? '金币不足' : def.desc),
            textX, rowY + 61, textW, { size: 10, minSize: 8 });

        const canRewardItem = rewardOptions.canReward;
        const actionGap = 6;
        const buyW = canRewardItem ? Math.floor((actionW - actionGap) / 2) : actionW;
        moon.button(ctx, actionX, actionY, buyW, 44, '', affordable ? 'pink' : 'muted');
        drawImageContain(ctx, assets.get('uiCoin'), actionX + 7, actionY + 12, 20, 20);
        ctx.fillStyle = THEME.textDark;
        typography.drawFit(ctx, String(def.price), actionX + 31, actionY + 22, buyW - 36, {
            size: 13, minSize: 8, weight: 'bold', numbers: true, align: 'left'
        });
        buttons['buy_' + type] = { x: actionX, y: actionY, w: buyW, h: 44 };

        if (canRewardItem) {
            const rewardX = actionX + buyW + actionGap;
            const rewardPending = type === 'heart' ? rewardOptions.heartPending : rewardOptions.pending;
            const rewardLimit = type === 'heart' ? heartFull : atLimit;
            const rewardText = rewardPending ? '领取中' : (rewardLimit ? (heartFull ? '已满' : '今日已满') : '+1');
            moon.button(ctx, rewardX, actionY, buyW, 44, '', rewardLimit || rewardPending ? 'muted' : 'blue');
            if (!rewardLimit && !rewardPending) moon.glyph(ctx, 'video', rewardX + 7, actionY + 13, 18);
            ctx.fillStyle = THEME.textDark;
            typography.drawFit(ctx, rewardText, rewardX + (rewardLimit || rewardPending ? buyW / 2 : 29),
                actionY + 22, rewardLimit || rewardPending ? buyW - 10 : buyW - 34, {
                    size: 11, minSize: 8, weight: 'bold', align: rewardLimit || rewardPending ? 'center' : 'left'
                });
            buttons['reward_' + type] = { x: rewardX, y: actionY, w: buyW, h: 44 };
        }
    }

    const safeBottom = Math.max(16, Number(screen.safeBottom) || 0);
    const backW = 180;
    const backH = 44;
    const backY = Math.min(screen.height - safeBottom - backH, listTop + listH + 10);
    moon.button(ctx, cx - backW / 2, backY, backW, backH, '返 回', 'blue', 16);
    moon.glyph(ctx, 'back', cx - backW / 2 + 14, backY + 10, 24);
    buttons.back = { x: cx - backW / 2, y: backY, w: backW, h: backH };

    return buttons;
};

/** 体力耗尽提醒：在当前页面上方提供金币购买和激励视频入口。 */
UI.drawStaminaEmpty = function (ctx, screen, options) {
    options = options || {};
    const cx = screen.width / 2;
    const safeTop = Math.max(Number(screen.contentTop) || 0, (Number(screen.safeTop) || 0) + 12);
    const safeBottom = (Number(screen.safeBottom) || 0) + 12;
    const cardW = Math.min(344, screen.width - 28);
    const preferredH = options.canAd ? 258 : 232;
    const cardH = Math.min(preferredH, screen.height - safeTop - safeBottom);
    const cardX = cx - cardW / 2;
    const cardY = Math.max(safeTop, (screen.height - cardH) / 2);
    ctx.fillStyle = 'rgba(27, 24, 63, 0.58)';
    ctx.fillRect(0, 0, screen.width, screen.height);
    moon.panel(ctx, screen, cardX, cardY, cardW, cardH);
    drawImageContain(ctx, assets.get('uiHeart'), cx - 22, cardY + 18, 44, 44);
    ctx.fillStyle = THEME.textScene;
    typography.drawFit(ctx, '体力耗尽', cx, cardY + 84, cardW - 38, {
        size: 20, minSize: 15, weight: 'bold', align: 'center'
    });
    ctx.fillStyle = THEME.textSceneMuted;
    typography.drawFit(ctx, '下一点体力将在 ' + (options.timeLeftText || '--:--') + ' 后恢复', cx, cardY + 108, cardW - 38, {
        size: 12, minSize: 9, align: 'center', numbers: true
    });

    const actionGap = 10;
    const actionY = cardY + 128;
    const canBuy = options.canBuy !== false;
    const hasAd = !!options.canAd;
    const actionW = hasAd ? Math.floor((cardW - 36 - actionGap) / 2) : cardW - 36;
    const buyX = cx - (hasAd ? actionW + actionGap / 2 : actionW / 2);
    moon.button(ctx, buyX, actionY, actionW, 48, '', canBuy ? 'pink' : 'muted');
    drawImageContain(ctx, assets.get('uiCoin'), buyX + 10, actionY + 12, 24, 24);
    ctx.fillStyle = THEME.textDark;
    typography.drawFit(ctx, canBuy ? (Number(options.staminaPrice) || 1000) + ' 金币 · +1' : '金币不足', buyX + 38, actionY + 24, actionW - 44, {
        size: 13, minSize: 9, weight: 'bold', align: 'left', numbers: true
    });

    const buttons = { buy: { x: buyX, y: actionY, w: actionW, h: 48 } };
    if (hasAd) {
        const adX = buyX + actionW + actionGap;
        moon.button(ctx, adX, actionY, actionW, 48, '', 'blue');
        moon.glyph(ctx, 'video', adX + 10, actionY + 13, 22);
        ctx.fillStyle = THEME.textDark;
        typography.drawFit(ctx, '广告 · +1', adX + 38, actionY + 24, actionW - 44, {
            size: 13, minSize: 9, weight: 'bold', align: 'left'
        });
        buttons.ad = { x: adX, y: actionY, w: actionW, h: 48 };
    }
    const closeY = actionY + 58;
    moon.button(ctx, cx - 72, closeY, 144, 44, '稍后再说', 'blue', 13);
    buttons.close = { x: cx - 72, y: closeY, w: 144, h: 44 };
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
    ctx.fillStyle = 'rgba(71, 86, 133, 0.18)';
    ctx.fillRect(0, 0, screen.width, screen.height);

    // 卡片（胜利时更高：多星星行；失败且有复活按钮时更高）
    const hasRevive = !result.win && result.canRevive;
    const cardW = Math.min(346, screen.width - 32);
    const safeTop = Math.max(Number(screen.contentTop) || 0, (Number(screen.safeTop) || 0) + 16) + 18;
    const safeBottom = (Number(screen.safeBottom) || 0) + 16;
    const preferredH = result.win ? 464 : (hasRevive ? 502 : (result.reason === 'timeout' ? 434 : 404));
    const cardH = Math.min(preferredH, screen.height - safeTop - safeBottom);
    const cardX = cx - cardW / 2;
    const cardY = Math.max(safeTop, (screen.height - cardH) / 2);

    moon.panel(ctx, screen, cardX, cardY, cardW, cardH);

    const nextBtnY = cardY + cardH - 68;
    const statsTop = nextBtnY - (hasRevive ? 60 : 0) - 56;

    // 结果猫咪：成功大笑，失败沮丧
    const resultCat = assets.get(result.win ? 'uiResultHappyCat' : 'uiResultSadCat');
    const catH = Math.max(50, Math.min(178, statsTop - cardY -
        (result.win ? 120 : (result.reason === 'timeout' ? 100 : 80))));
    drawImageContain(ctx, resultCat, cx - 110, cardY + 36, 220, catH);

    // 结果标题
    moon.button(ctx,cx-110,cardY-12,220,44,'',result.win?'pink':'blue');
    ctx.fillStyle = THEME.textDark;
    const resultTitle = result.win ? '通关成功' : (result.reason === 'timeout' ? '时间到' : '挑战失败');
    typography.drawFit(ctx, resultTitle, cx, cardY + 10, 192, {
        size: 25, minSize: 18, weight: 'bold', align: 'center'
    });

    // 星星（胜利时显示 ★ 亮 / ☆ 暗）
    const scoreY = cardY + catH + (result.win ? 83 : 65);
    if (result.win) {
        const startSX = cx - 30;
        for (let k = 1; k <= 3; k++) {
            ctx.fillStyle = k <= result.star ? '#FFC531' : '#E8E0D0';
                typography.drawFit(ctx, '★', startSX + (k - 1) * 30, cardY + catH + 51, 30, {
                size: 30, minSize: 18, align: 'center'
            });
        }
        // 分数（下移给星星让位）
        ctx.fillStyle = THEME.textScene;
        typography.drawFit(ctx, '得分：' + result.score, cx, scoreY, cardW - 36, {
            size: 20, minSize: 11, numbers: true, align: 'center'
        });

        // 金币奖励
        if (result.rewardPending || !result.coinReward) {
            ctx.fillStyle = THEME.textSceneMuted;
            typography.drawFit(ctx, result.rewardPending ? '结算暂未保存，请重试' : '重复通关不发金币 · 体力已返还', cx, scoreY + 29, cardW - 40, {size:12,minSize:10,align:'center'});
        }
        if (result.coinReward > 0) {
            drawImageContain(ctx, assets.get('uiCoin'), cx - 68, scoreY + 14, 30, 30);
            ctx.fillStyle = '#8A654D';
            typography.drawFit(ctx, '+' + result.coinReward + ' 金币', cx - 34, scoreY + 29, cardW - 92, {
                size: 17, minSize: 10, weight: 'bold', numbers: true
            });
        }
    } else {
        // 分数
        ctx.fillStyle = THEME.textScene;
        typography.drawFit(ctx, '得分：' + result.score, cx, scoreY, cardW - 36, {
            size: 20, minSize: 11, numbers: true, align: 'center'
        });
        if (result.reason === 'timeout') {
            ctx.fillStyle = THEME.textSceneMuted;
            typography.drawFit(ctx, '别急，下一次会走得更远', cx, scoreY + 26, cardW - 36, {
                size: 13, minSize: 9, align: 'center'
            });
        }
    }

    const stats = [
        { label: '最高连消', value: Math.max(0, Number(result.maxCascade) || 0) + ' 连', x: cx - cardW / 4 },
        { label: '特殊组合', value: Math.max(0, Number(result.specialComboCount) || 0) + ' 次', x: cx + cardW / 4 }
    ];
    stats.forEach(function (stat) {
        ctx.fillStyle = THEME.textSceneMuted;
        typography.drawFit(ctx, stat.label, stat.x, statsTop + 8, cardW / 2 - 28, {
            size: 12, minSize: 11, align: 'center'
        });
        ctx.fillStyle = THEME.textDark;
        typography.drawFit(ctx, stat.value, stat.x, statsTop + 30, cardW / 2 - 28, {
            size: 19, minSize: 13, numbers: true, weight: 'bold', align: 'center'
        });
    });

    // 按钮
    const btnW = (cardW - 48) / 2;
    const btnH = 48;
    const btnX = cardX + 18;
    const buttons = {};

    // 复活按钮（失败且激励视频可用；同一局可重复观看）
    if (hasRevive) {
        const reviveText = '看广告复活 +' + config.AD_CONFIG.reviveSteps + ' 步' + (result.timed ? ' · +30秒' : '');
        const reviveY = nextBtnY - 60;
        moon.button(ctx, btnX, reviveY, cardW-36, 48, reviveText, 'pink', result.timed ? 14 : 16);
        buttons.revive = { x: btnX, y: reviveY, w: cardW-36, h: 48 };
    }

    // 主按钮：下一关（胜利）或再来一次（失败）
    if (result.rewardPending) {
        moon.button(ctx, btnX, nextBtnY, btnW, btnH, '重试结算', 'pink', 17);
    } else if (result.win && result.hasNext) {
        moon.button(ctx, btnX, nextBtnY, btnW, btnH, '下一关', 'pink', 18);
    } else {
        moon.button(ctx, btnX, nextBtnY, btnW, btnH, '再来一次', hasRevive?'blue':'pink', 17);
    }
    buttons.main = { x: btnX, y: nextBtnY, w: btnW, h: btnH };

    // 返回菜单按钮
    const menuX = cardX + cardW - 18 - btnW;
    moon.button(ctx, menuX, nextBtnY, btnW, btnH, result.rewardPending ? '重试结算' : '返回首页', 'blue', 17);
    buttons.menu = { x: menuX, y: nextBtnY, w: btnW, h: btnH };

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
    const safe = Math.max(16, Number(screen.contentTop) || 0, (Number(screen.safeTop) || 0) + 8);

    drawSceneBackground(ctx, screen, 'levelBackground', 0.11);
    const titleW = Math.min(246, screen.width - 40);
    moon.panel(ctx,screen,cx-titleW/2,safe,titleW,64);
    ctx.fillStyle = THEME.textScene;
    typography.drawFit(ctx, '单人闯关', cx, safe + 23, titleW-24, {
        size: 24, minSize: 18, weight: 'bold', align: 'center'
    });
    ctx.fillStyle = THEME.textMid;
    const currentConfig = levelData.getLevel(currentLevel);
    typography.drawFit(ctx, '第 ' + currentLevel + ' 关 · ' + currentConfig.name, cx, safe + 47, titleW-24, {
        size: 11, minSize: 8, align: 'center'
    });
    const buttons = { visibleLevels: [] };
    const top = Math.max(safe + 104, screen.height * 0.30);
    const backW = Math.min(150, screen.width - 36);
    const backH = 46;
    const backY = screen.height - Math.max(58, (Number(screen.safeBottom) || 0) + 52);
    const mapTop = safe + 72;
    const mapBottom = backY - 12;
    const baseNodeSize = screen.height < 700 ? 58 : 84;
    // Keep the nearest node's entire hit area inside the clipped map viewport.
    const bottom = Math.min(
        screen.height - Math.max(120, (Number(screen.safeBottom) || 0) + 110),
        mapBottom - Math.max(44, baseNodeSize + 10) / 2
    );
    // Authored center line in the 640×1384 background, projected through cover cropping.
    const stairs = [[.20,.74],[.28,.73],[.33,.73],[.37,.52],[.41,.43],[.47,.58],[.53,.65],[.60,.64],[.68,.54],[.76,.45],[.84,.46],[.92,.52],[1,.53]];
    const bgScale=Math.max(screen.width/640,screen.height/1384);
    const bgW=640*bgScale,bgH=1384*bgScale;

    function pathPoint(distance) {
        const d = Number(distance) || 0;
        const depth = d / 4;
        const y=bottom-(bottom-top)*depth;
        const sourceY=clamp((y+(bgH-screen.height)/2)/bgH,.20,1);
        const index=stairs.findIndex((p,i)=>i<stairs.length-1&&sourceY<=stairs[i+1][0]);
        const a=stairs[Math.max(0,index)],b=stairs[Math.max(0,index)+1];
        const mix=(sourceY-a[0])/(b[0]-a[0]);
        const nx=a[1]+(b[1]-a[1])*mix;
        return {
            x: nx*bgW-(bgW-screen.width)/2,
            y: y,
            scale: Math.max(0.58, 1 - depth * 0.34)
        };
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, mapTop, screen.width, mapBottom - mapTop);
    ctx.clip();
    for (let i = 0; i < 5; i++) {
        const levelId = baseLevel + i;
        const distance = i - fraction;
        const point = pathPoint(distance);
        const state = levelId < currentLevel ? 'done' : (levelId === currentLevel ? 'current' : 'locked');
        const nodeSize = baseNodeSize * point.scale;
        moon.levelNode(ctx,point.x,point.y,nodeSize,state,screen.reduceEffects);

        ctx.fillStyle = THEME.textDark;
        typography.drawFit(ctx, String(levelId), point.x, point.y - nodeSize * .01, nodeSize * 0.58, {
            size: Math.max(17, nodeSize * 0.29), minSize: 10,
            weight: 'bold', numbers: true, align: 'center'
        });

        if (state === 'done') {
            const starCount = Math.max(0, Math.min(3, Number(stars[levelId]) || 0));
            for (let star = 0; star < 3; star++) {
                ctx.fillStyle = star < starCount ? '#AA793B' : '#98A7C6';
                typography.drawFit(ctx, '★', point.x - nodeSize * 0.25 + star * nodeSize * 0.25,
                    point.y + nodeSize * 0.27, nodeSize * 0.23, {
                        size: Math.max(10, nodeSize * 0.17), minSize: 7, align: 'center'
                    });
            }
        } else {
            ctx.fillStyle='rgba(250,246,255,.9)';roundRectPath(ctx,point.x-26,point.y+nodeSize*.43,52,18,9);ctx.fill();
            ctx.fillStyle = THEME.textDark;
            typography.drawFit(ctx, state === 'current' ? '当前' : '锁定', point.x,
                point.y + nodeSize * 0.43 + 9, nodeSize + 12, {
                    size: Math.max(10, nodeSize * 0.16), minSize: 8, align: 'center'
                });
        }

        const hitSize = Math.max(44,nodeSize + 10);
        const hit = {
            x: point.x - hitSize / 2,
            y: point.y - hitSize / 2,
            w: hitSize,
            h: hitSize
        };
        // A node crossing the scroll viewport is decorative until fully tappable again.
        if (hit.y >= mapTop && hit.y + hit.h <= mapBottom) buttons['level_' + levelId] = hit;
        buttons.visibleLevels.push(levelId);
    }
    ctx.restore();

    moon.button(ctx, cx - backW / 2, backY, backW, backH, '返回花园', 'blue', 15);
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
