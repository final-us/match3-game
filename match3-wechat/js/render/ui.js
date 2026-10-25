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
const buttonMaterial = require('./button-material');
const privacyReader = require('./privacy-reader');
const levelData = require('../core/level');
const CompanionUI = require('./companion-ui');
const resultObstacles = require('./new-obstacles-render');
const staminaCard = require('./stamina-card');
const shopCard = require('./shop-card');
const illustration = require('./illustration-art');

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
function drawMoonHomeButton(ctx, x, y, w, h, text, primary, pressAmount) {
    ctx.save();
    if (pressAmount) {
        ctx.translate(x + w / 2, y + h / 2);
        ctx.scale(1 - pressAmount * 0.015, 1 - pressAmount * 0.055);
        ctx.translate(-x - w / 2, -y - h / 2);
    }
    ctx.shadowColor = 'rgba(69,67,120,0.27)';
    ctx.shadowBlur = pressAmount ? 5 : 10;
    ctx.shadowOffsetY = pressAmount ? 2 : 4;
    const tone = primary ? 'pink' : 'blue';
    const fill = ctx.createLinearGradient(x, y, x, y + h);
    THEME.buttonPalettes[tone].forEach((c,i)=>fill.addColorStop([0,.32,.70,1][i],c));
    ctx.fillStyle = fill;
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
    buttonMaterial.shine(ctx,x,y,w,h,tone);
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
    const chosen=!!(economy&&economy.companion);
    const titleW = Math.min(338, screen.width * (compactHome ? (chosen?.46:.56) : (chosen?.68:.76)));
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
    const soloY=activityY-(compactHome?(chosen?14:30):38)-soloH;
    const battleY=soloY-(compactHome?(chosen?12:24):28)-btnH;
    const heroY = titleTop + titleH - (compactHome ? 28 : 44);
    const heroH = Math.min(heroW * .684, Math.max(1, battleY - heroY - 12));
    if(economy && economy.companion){
        const artTop=titleTop+titleH-8;
        Object.assign(buttons,CompanionUI.drawHome(ctx,screen,{y:artTop,h:Math.max(60,battleY-artTop-8)},economy.companion,assets.getCatalogState()));
    } else if (hero && hero.width > 0) {
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

    drawMoonHomeButton(ctx, btnX, battleY, btnW, btnH, '好友对战', true,
        economy && economy.battlePress);
    buttons.battle = { x: btnX, y: battleY, w: btnW, h: btnH };

    const soloW=btnW*(compactHome?.85:.80);
    drawMoonHomeButton(ctx,cx-soloW/2,soloY,soloW,soloH,heart.storageReady===false?'体力待恢复':heart.canPlay?'单人闯关':'体力不足',false);
    buttons.start={x:cx-soloW/2,y:soloY,w:soloW,h:soloH};
    ctx.fillStyle=THEME.textDark;
    const status=heart.storageReady===false?'体力记录暂不可用，请稍后重试':heart.count>=5?'已解锁第 '+unlockedLevel+' 关 · 体力已满':heart.timeLeftText+' 后恢复体力';
    if(!(compactHome&&chosen))typography.drawFit(ctx,status,cx,soloY+soloH+15,screen.width-32,{size:11,minSize:9,align:'center',numbers:true});

    // User-selected combination: original main capsules, compact utility row below.
    const entries=[['shop','uiShop','商店'],['daily','uiCoin','每日挑战'],['settings','uiSettings','设置']];
    if(economy&&economy.retentionPreview)entries.splice(2,0,['retention','uiMoves','每日金币']);
    if(economy&&economy.catalogPreview)entries.splice(entries.length-1,0,['catalog','catalogIcon','猫咪图鉴']);
    if(showHeartAd)entries.push(['addHeart','uiHeart','看广告补体力']);
    const denseUtilities=entries.length>3;
    const utilityGap=denseUtilities?6:showHeartAd?8:(compactHome?20:28);
    const utilityW=denseUtilities
        ?Math.min(activityW,(screen.width-20-(entries.length-1)*utilityGap)/entries.length):activityW;
    const utilityLeft=cx-(entries.length*utilityW+(entries.length-1)*utilityGap)/2;
    entries.forEach(([key,icon,label],index)=>{
        const x=utilityLeft+index*(utilityW+utilityGap);
        drawImageContain(ctx,assets.get(icon),x+(utilityW-44)/2,activityY,44,44);
        moon.button(ctx,x,activityY+42,utilityW,22,denseUtilities?'':label,key==='addHeart'?'ad':'pink',key==='addHeart'?9:11);
        if(denseUtilities){ctx.fillStyle=THEME.textDark;typography.drawCentered(ctx,label,x+2,activityY+42,utilityW-4,22,{size:10,minSize:7,weight:'bold'});}
        buttons[key]={x,y:activityY,w:utilityW,h:activityH};
    });
    const reward=require('../core/daily-challenge').DAILY_RULES.reward;
    if(economy){
        if(economy.coinsReady&&buttons.retention)CompanionUI.dot(ctx,buttons.retention);
        if(economy.storyNew&&buttons.catalog)CompanionUI.dot(ctx,buttons.catalog,'新');
        if(economy.companionNew&&buttons.companionStory)CompanionUI.dot(ctx,buttons.companionStory);
    }
    const badgeX=buttons.daily.x+(economy&&economy.retentionPreview?utilityW-30:35);
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
    moon.button(ctx, btnX, privacyY, btnW, 52, settings.privacyPending ? '正在打开…' : '隐私说明', 'pink', 17);
    moon.glyph(ctx, 'privacy', btnX+14, privacyY+14, 24);
    buttons.privacy = { x: btnX, y: privacyY, w: btnW, h: 52 };

    const backY = privacyY + 66;
    moon.button(ctx, btnX, backY, btnW, 50, '返回首页', 'blue', 17);
    moon.glyph(ctx, 'home', btnX+14, backY+13, 24);
    buttons.back = { x: btnX, y: backY, w: btnW, h: 50 };
    return buttons;
};

UI.drawSoloSettingsButton = function (ctx, screen) {
    const capsule=screen.menuButtonRect;
    const hudY=Math.max(72,Number(screen.contentTop)||Number(screen.safeTop)||0)+6;
    const cy=capsule?capsule.y+capsule.h/2:hudY-26;
    const h=capsule?capsule.h:32,x=10+(Number(screen.safeLeft)||0),w=68;
    moon.button(ctx,x,cy-h/2,w,h,'设置','cream',15);
    const hitH=Math.max(44,h);
    return {x,y:Math.max(0,Math.min(cy-hitH/2,hudY-hitH-2)),w,h:hitH};
};

UI.drawSoloSettings = function (ctx, screen, settings) {
    const w=Math.min(320,screen.width-32),h=330,x=(screen.width-w)/2;
    const y=Math.max((screen.contentTop||0)+8,Math.min((screen.height-h)/2,screen.height-(screen.safeBottom||0)-h-12));
    ctx.save();ctx.fillStyle='rgba(28,28,58,.48)';ctx.fillRect(0,0,screen.width,screen.height);
    moon.panel(ctx,screen,x,y,w,h);
    ctx.fillStyle='#34355E';typography.drawCentered(ctx,'休息一下',x+16,y+14,w-32,34,{size:22,weight:'bold'});
    const buttons={},bx=x+18,bw=w-36;
    for(const [key,label,kind,on,dy] of [['music','背景音乐','music',settings.musicEnabled,58],['sfx','音效','sound',settings.sfxEnabled,116]]){
        moon.toggle(ctx,bx,y+dy,bw,48,label,kind,on);buttons[key]={x:bx,y:y+dy,w:bw,h:48};
    }
    for(const [key,label,tone,dy] of [['resume','继续游戏','pink',186],['home','返回首页','blue',246]]){
        moon.button(ctx,bx,y+dy,bw,48,label,tone,17);buttons[key]={x:bx,y:y+dy,w:bw,h:48};
    }
    ctx.restore();return buttons;
};

UI.drawAvatarConsent = function (ctx, screen, available) {
    const w=Math.min(330,screen.width-32),h=300,x=(screen.width-w)/2,y=Math.max(screen.contentTop||0,(screen.height-h)/2);
    ctx.save();ctx.fillStyle='rgba(28,28,58,.54)';ctx.fillRect(0,0,screen.width,screen.height);moon.panel(ctx,screen,x,y,w,h);
    ctx.fillStyle='#34355E';typography.drawCentered(ctx,'让好友认出你',x+16,y+18,w-32,34,{size:22,weight:'bold'});
    for(const [i,line] of ['头像用于好友对战的准备、对局和结算','本设备记住选择，下次授权有效时继续使用','仅向同房好友展示，暂不用也能正常对战'].entries())
        typography.drawCentered(ctx,line,x+16,y+65+i*28,w-32,28,{size:13,minSize:11});
    const confirm={x:x+20,y:y+174,w:w-40,h:48},cancel={x:x+20,y:y+234,w:w-40,h:46};
    moon.button(ctx,confirm.x,confirm.y,confirm.w,confirm.h,available?'使用微信头像':'当前微信暂不支持','pink',17);
    moon.button(ctx,cancel.x,cancel.y,cancel.w,cancel.h,'暂时不用','blue',16);
    ctx.restore();return {confirm:available?confirm:null,cancel};
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
    return shopCard.draw(ctx, screen, coins, items, rewardOptions);
};

/** 体力耗尽提醒：在当前页面上方提供金币购买和激励视频入口。 */
UI.drawStaminaEmpty = function (ctx, screen, options) {
    return staminaCard.draw(ctx, screen, options);
};

/**
 * 结算页
 * @param {CanvasRenderingContext2D} ctx
 * @param {{width:number,height:number}} screen
 * @param {object} result { win, score, reason, timed, levelId, hasNext, canRevive }
 * @returns {object} 按钮区域 {main, menu, revive?}
 */
UI.drawResult = function (ctx, screen, result) {
    const cx=screen.width/2, w=Math.min(346,screen.width-28), x=cx-w/2;
    const top=Math.max(screen.contentTop||0,(screen.safeTop||0)+12);
    const available=screen.height-top-(screen.safeBottom||0)-12;
    const compact=available<600, baseH=Math.min(640,available)-(result.rewardPending?54:0);
    const h=baseH-(result.win&&!compact&&!result.rewardPending?40:0), y=top+(available-baseH)/2;
    const catH=compact?58:(result.win?195:180), titleY=y+catH+(compact?30:result.win?68:36);
    const serif='"Songti SC","STSong","Noto Serif CJK SC",Georgia,serif';
    const revive=!result.win&&result.canRevive&&!result.rewardPending;
    const end=y+h-(result.retentionMessage?26:12), menuY=end-44;
    const actionY=result.rewardPending||(!result.win&&!revive)?end-52:menuY-10-(revive?64:52), buttons={};
    function label(value,px,py,width,size,color,family) {
        ctx.fillStyle=color||'#343B64';
        typography.drawFit(ctx,String(value),px,py,width,{size:size||16,minSize:12,align:'center',weight:'bold',family});
    }
    function star(px,py,r,bright) {
        ctx.beginPath();
        for(let i=0;i<10;i++) {const a=-Math.PI/2+i*Math.PI/5,d=i%2?r*.45:r;
            if(i)ctx.lineTo(px+Math.cos(a)*d,py+Math.sin(a)*d);else ctx.moveTo(px,py-r);}
        ctx.closePath();const gold=ctx.createLinearGradient(0,py-r,0,py+r);
        gold.addColorStop(0,bright?'#FFF8C3':'#ABB2C6');gold.addColorStop(.48,bright?'#FFDA71':'#7D88A5');gold.addColorStop(1,bright?'#D99632':'#56627D');
        ctx.fillStyle=gold;ctx.fill();
        ctx.strokeStyle=bright?'#FFF0BD':'#A7ADC0';ctx.lineWidth=1.5;ctx.stroke();
        for(let i=0;i<10;i++) {
            ctx.beginPath();ctx.moveTo(px,py);
            for(const k of [i,i+1]) {const a=-Math.PI/2+k*Math.PI/5,d=k%2?r*.45:r;ctx.lineTo(px+Math.cos(a)*d,py+Math.sin(a)*d);}
            ctx.closePath();ctx.fillStyle=i%2?'rgba(255,255,239,.35)':bright?'rgba(166,91,17,.22)':'rgba(35,45,70,.22)';ctx.fill();
        }
    }
    function control(key,px,py,bw,bh,value,tone) {
        illustration.decoratedButton(ctx,px,py,bw,bh,value,tone,compact?17:21);
        buttons[key]={x:px,y:py,w:bw,h:bh};
    }
    drawSceneBackground(ctx,screen,'gameBackground',.3);
    ctx.fillStyle='rgba(18,27,55,.52)';ctx.fillRect(0,0,screen.width,screen.height);
    ctx.save();
    const archY=y+catH*.63, frame=assets.get('uiResultFrame');
    if(frame&&frame.width&&frame.height)ctx.drawImage(frame,x-5,archY-8,w+10,end-archY+18);
    else {
        const g=ctx.createLinearGradient(0,archY,0,end);
        g.addColorStop(0,'#344265');g.addColorStop(.4,'#64708F');g.addColorStop(.66,'#F7EBD2');g.addColorStop(1,'#D9CEBF');
        ctx.beginPath();ctx.moveTo(x+22,end);ctx.quadraticCurveTo(x,end,x,end-22);ctx.lineTo(x,archY+w*.4);
        ctx.bezierCurveTo(x,archY-w*.1,x+w,archY-w*.1,x+w,archY+w*.4);
        ctx.lineTo(x+w,end-22);ctx.quadraticCurveTo(x+w,end,x+w-22,end);ctx.closePath();ctx.fillStyle=g;ctx.fill();
        ctx.strokeStyle='#D8B991';ctx.lineWidth=2;ctx.stroke();
    }
    const cat=assets.get(result.win?'uiResultWinMoon':'uiResultLoseMoon');
    if(!drawImageContain(ctx,cat,cx-w*.425,y,w*.85,catH))
        drawImageContain(ctx,assets.get(result.win?'uiResultHappyCat':'uiResultSadCat'),cx-catH*.65,y,catH*1.3,catH);
    if(result.win) {
        for(let i=0;i<3;i++)star(cx+(i-1)*(compact?40:56),titleY-(compact?31:45),i===1?(compact?20:30):(compact?16:24),i<(result.star||0));
        ctx.save();ctx.translate(cx,titleY);ctx.scale(1,.35);
        const glow=ctx.createRadialGradient(0,0,0,0,0,w*.49);
        glow.addColorStop(0,'rgba(255,247,218,.95)');glow.addColorStop(1,'rgba(255,247,218,0)');
        ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,w*.49,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    label(result.win?'通关成功':'挑战未完成',cx,titleY,w-26,compact?28:result.win?38:32,result.win?'#292755':'#E9E4FF',serif);
    if(!result.win) {
        const reasonY=titleY+(compact?29:32);
        ctx.strokeStyle='#DCC18E';ctx.lineWidth=1;
        for(const side of [-1,1]) {ctx.beginPath();ctx.moveTo(cx+side*76,reasonY);ctx.lineTo(cx+side*(w/2-24),reasonY);ctx.stroke();}
        label(result.reason==='timeout'?'时间用完了':'步数用完了',cx,reasonY,144,15,'#FBE7BB',serif);
    }
    const infoY=titleY+(result.win?(compact?28:34):(compact?44:54)), infoH=actionY-infoY-12;
    const warm=ctx.createLinearGradient(0,infoY,0,infoY+infoH);
    warm.addColorStop(0,'#FFF8E9');warm.addColorStop(1,'#F2DFC0');
    if(result.win) {
        const medalW=w*.76;ctx.fillStyle=warm;roundRectPath(ctx,cx-medalW/2,infoY,medalW,67,18);ctx.fill();
        ctx.strokeStyle='#D7AD6E';ctx.lineWidth=1.5;ctx.stroke();
        roundRectPath(ctx,cx-medalW/2+4,infoY+4,medalW-8,59,15);ctx.strokeStyle='#FFF8DC';ctx.stroke();
        label('本关得分',cx,infoY+17,w-40,12,'#876C62');
        label(result.score,cx,infoY+44,w-64,30,'#875431',serif);
        if(result.coinReward>0&&!result.rewardPending) {
            drawImageContain(ctx,assets.get('uiCoin'),cx-68,infoY+77,28,28);
            label('+'+result.coinReward+' 金币',cx+22,infoY+91,w-100,18,'#875D46');
        }
        if(result.rewardPending||!result.coinReward)label(result.rewardPending?'结算暂未保存，请重试':'重复通关不发金币 · 体力已返还',cx,Math.min(infoY+91,actionY-64),w-40,12);
    } else {
        const goals=(result.remainingGoals||[]).slice(0,4), rows=goals.length>2?2:1, goalArt=assets.get('uiResultGoals');
        const goalH=Math.min(compact?112:144,infoH-(result.rewardPending?96:70)), goalInset=rows===2?(compact?48:82):21, goalRightInset=rows===2&&!compact?46:goalInset, cellW=(w-goalInset-goalRightInset)/(goals.length===1?1:2);
        goals.forEach(function(goal,i) {
            const vertical=!compact&&rows===1, px=x+goalInset+cellW*(i%2)+cellW/2+(vertical&&goals.length===2?(i?-16:16):0);
            const py=vertical?infoY+44:infoY+goalH/rows*(Math.floor(i/2)+.5);
            const size=vertical?68:Math.min(rows===2?(compact?34:40):44,goalH/rows-6), iconX=vertical?px:rows===2?px-cellW/2+size/2:px-(goals.length===1?42:cellW/2-22);
            const names={score:'分数',collect:'猫咪',jelly:'果冻层',ice:'冰块',yarn:'毛线耐久',moonbud:'花苞',parcel:'包裹'};
            const tile=['jelly','yarn','ice','moonbud','parcel','score'].indexOf(goal.type);
            ctx.fillStyle=goal.type==='ice'?'#B7DFEF':goal.type==='jelly'?'#E9BEDD':'#D2B7DD';
            if(goal.type==='collect')drawImageContain(ctx,assets.get('piece'+goal.pieceType),iconX-size/2,py-size/2,size,size);
            else if(goalArt&&goalArt.width&&goalArt.height&&tile>=0)ctx.drawImage(goalArt,tile%3*160,Math.floor(tile/3)*160,160,160,iconX-size/2,py-size/2,size,size);
            else if(goal.type==='score')star(iconX,py,size/2,true);
            else if(goal.type==='moonbud')resultObstacles.moonbud(ctx,iconX,py,size,true,1,false);
            else if(goal.type==='parcel')resultObstacles.parcel(ctx,iconX,py,size);
            else {
                ctx.save();ctx.translate(iconX,py);ctx.strokeStyle='#917DA6';ctx.lineWidth=1.2;
                const polish=ctx.createLinearGradient(-size/2,-size/2,size/2,size/2);
                polish.addColorStop(0,'#FFF6FF');polish.addColorStop(.4,goal.type==='yarn'?'#C2AADF':goal.type==='jelly'?'#F3B8DB':'#B7DFEF');polish.addColorStop(1,goal.type==='yarn'?'#8D73B6':goal.type==='jelly'?'#D181B6':'#7DB8D2');ctx.fillStyle=polish;
                if(goal.type==='yarn') {
                    ctx.beginPath();ctx.arc(0,0,size/2,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.clip();
                    for(let k=-2;k<=2;k++) {
                        ctx.beginPath();ctx.ellipse(k*size*.17,0,size*.25,size*.55,-.6,0,Math.PI*2);ctx.stroke();
                    }
                    ctx.fillStyle='rgba(255,255,255,.55)';ctx.beginPath();ctx.ellipse(-size*.15,-size*.24,size*.16,size*.07,-.5,0,Math.PI*2);ctx.fill();
                } else {
                    roundRectPath(ctx,-size/2,-size/2,size,size,6);ctx.fill();ctx.stroke();
                    ctx.strokeStyle=goal.type==='ice'?'#648FAF':'#BA6A9D';
                    if(goal.type==='ice') {
                        ctx.beginPath();ctx.moveTo(-size*.35,-size*.35);ctx.lineTo(size*.35,size*.35);
                        ctx.moveTo(size*.35,-size*.35);ctx.lineTo(-size*.35,size*.35);ctx.stroke();
                    } else {
                        roundRectPath(ctx,-size*.4,-size*.23,size*.8,size*.56,4);ctx.stroke();
                    }
                    ctx.strokeStyle='#FFFFFF';ctx.beginPath();ctx.moveTo(-size*.28,-size*.3);ctx.lineTo(size*.1,-size*.3);ctx.stroke();
                }
                ctx.restore();
            }
            const textX=vertical?px:rows===2?px+(size+4)/2:px+(goals.length===1?22:20), textW=cellW-(rows===2?size+4:vertical?12:goals.length===1?96:52);
            label(names[goal.type],textX,vertical?infoY+92:py-8,textW,vertical?16:12,'#765347',serif);
            label(goal.type==='yarn'?'剩余'+goal.left+'/'+goal.target:'还差'+goal.left+(goal.type==='jelly'?'层':''),textX,vertical?infoY+116:py+9,textW,rows===2?12:17,'#B34C73',serif);
        });
        label('得分：'+result.score,cx,goals.length?infoY+goalH+14:infoY+26,w-42,goals.length?13:24);
        if(result.rewardPending)label('结算暂未保存，请重试',cx,infoY+(goals.length?goalH+36:53),w-40,12);
    }
    [['最高连消',result.maxCascade,' 连'],['特殊组合',result.specialComboCount,' 次']].forEach((s,i)=>{
        const px=cx+(i-.5)*w/2;
        label(s[0],px,actionY-44,w/2-20,12);label(Math.max(0,Number(s[1])||0)+s[2],px,actionY-23,w/2-20,16);
    });
    if(result.rewardPending)control('main',x+16,actionY,w-32,52,'重试结算','pink');
    else if(revive) {
        control('revive',x+16,actionY,w-32,64,'',result.revivePending?'pink':'ad');
        label(result.revivePending?'重试复活':'看广告继续',cx,actionY+22,w-48,compact?21:25,'#17365E',serif);
        label(result.revivePending?'无需再看广告':'+'+config.AD_CONFIG.reviveSteps+'步'+(result.timed?' · +30秒':''),cx,actionY+47,w-48,13,'#17365E',serif);
        control('main',x+16,menuY,(w-42)/2,44,'重新挑战','pink');
        control('menu',cx+5,menuY,(w-42)/2,44,'返回首页','blue');
    } else if(result.win) {
        control('main',x+16,actionY,w-32,52,result.hasNext?'下一关':'再来一次','pink');
        control('menu',cx-w*.31,menuY,w*.62,44,'返回首页','blue');
    } else {
        control('main',x+16,actionY,(w-42)/2,52,'重新挑战','pink');
        control('menu',cx+5,actionY,(w-42)/2,52,'返回首页','blue');
    }
    if(result.retentionMessage)label(result.retentionMessage,cx,end+14,w-24,12,'#FFF6E4');
    ctx.restore();return buttons;
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
