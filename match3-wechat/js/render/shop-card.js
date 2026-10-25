'use strict';
const assets = require('./assets');
const coin = require('../core/coin');
const type = require('./typography');
const moon = require('./moon-controls');
const art = require('./illustration-art');
const SERIF = '"Songti SC","STSong","Noto Serif CJK SC",Georgia,serif';

function image(ctx, key, x, y, w, h, cover) {
    const img = assets.get(key);
    if (!img || !img.width || !img.height) return false;
    const scale = (cover ? Math.max : Math.min)(w / img.width, h / img.height);
    if (cover) {
        const sw = w / scale, sh = h / scale;
        ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
    } else ctx.drawImage(img, x + (w - img.width * scale) / 2, y + (h - img.height * scale) / 2, img.width * scale, img.height * scale);
    return true;
}
function label(ctx, value, x, y, w, size, color, options) {
    ctx.fillStyle = color;
    type.drawFit(ctx, String(value), x, y, w, Object.assign({ size, minSize: size, weight: 'bold' }, options));
}
function path(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function plaque(ctx, x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, '#365C9C'); g.addColorStop(.5, '#253D7D'); g.addColorStop(1, '#192B63');
    ctx.fillStyle = g;
    path(ctx, x, y, w, h, h / 2); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#EEC57F'; ctx.stroke();
    path(ctx, x + 4, y + 4, w - 8, h - 8, h / 2 - 4);
    ctx.lineWidth = 1; ctx.strokeStyle = '#FFF3CA'; ctx.stroke();
    label(ctx, '商店', x + w / 2, y + h / 2, w - 24, h * .56, '#FFF8E6', { align: 'center', family: SERIF });
}
function draw(ctx, screen, coins, items, rewardOptions) {
    const options = rewardOptions || {}, buttons = {}, cx = screen.width / 2;
    const top = Math.max(91, screen.contentTop || 0, (screen.safeTop || 0) + 12);
    const bottom = screen.height - Math.max(16, Number(screen.safeBottom) || 0) - 8;
    const available = bottom - top, compact = available < 510;
    const w = Math.min(410, screen.width - 8), x = cx - w / 2;
    const frameY = top + (compact ? 48 : 88), frameH = bottom - frameY;
    const titleH = w * .11, titleCenter = frameY + w * .13;
    const backH = 44, backW = Math.min(190, w * .56), backY = bottom - 54;
    const rowTop = frameY + w * .24 + 6;
    const inset = w * .09, innerX = x + inset, innerW = w - inset * 2;
    const viewport = { x: innerX - 3, y: rowTop, w: innerW + 6, h: backY - 15 - rowTop };
    const rowH = options.canReward ? (compact ? 106 : 114) : (compact ? 86 : 96);
    const maxScroll = Math.max(0, rowH * 4 - viewport.h), offset = Math.max(0, Math.min(maxScroll, Number(options.offset) || 0));
    const iconSize = compact ? 52 : 68, iconX = innerX + (compact ? 7 : 9);
    const textX = iconX + iconSize + 6;
    const actionW = compact ? 86 : 102, actionX = innerX + innerW - actionW;
    const textW = actionX - textX - 7;
    const register = (key, r) => { if (r.y >= viewport.y && r.y + r.h <= viewport.y + viewport.h) buttons[key] = r; };

    ctx.save(); art.scene(ctx, screen);
    const framed = art.paperFrame(ctx, x, frameY, w, frameH);
    const heroH = compact ? 70 : 116;
    if (!image(ctx, 'uiIllustrationHeaderCat', cx - w * .30, titleCenter - titleH / 2 - heroH + 9, w * .60, heroH))
        image(ctx, 'uiResultWinMoon', cx - w * .30, titleCenter - titleH / 2 - heroH + 9, w * .60, heroH);
    if (!framed) plaque(ctx, cx - w * .29, titleCenter - titleH / 2, w * .58, titleH);
    else label(ctx, '商店', cx, titleCenter, w * .48, titleH * .62, '#FFF8E6', { align: 'center', family: SERIF });
    art.button(ctx, innerX, top, 124, 34, '', 'cream');
    image(ctx, 'uiCoin', innerX + 7, top + 5, 24, 24);
    label(ctx, coins === null ? '—' : coins, innerX + 37, top + 17, 80, 19, '#263D72', { minSize: 13, numbers: true });
    if (options.canReward) label(ctx, '道具视频领取 ' + (Number(options.count) || 0) + '/' + (Number(options.limit) || 10),
        innerX + innerW, top + 17, innerW - 132, 10, '#FFF4DD', { align: 'right', minSize: 9 });

    ctx.save();ctx.beginPath();ctx.rect(viewport.x,viewport.y,viewport.w,viewport.h);ctx.clip();
    for (const [index, key] of ['hammer', 'bomb', 'color', 'heart'].entries()) {
        const def = key === 'heart' ? { name: '体力', price: coin.STAMINA_PRICE, desc: '恢复 1 点体力' } : coin.ITEM_DEFS[key];
        const rowY = rowTop + index * rowH - offset;
        const owned = key === 'heart' ? (options.heartReady === false ? '—' : (Number(options.heartCount) || 0)) : (items ? items[key] || 0 : '—');
        const heartMax = Number(options.heartMax) || 5, heartFull = key === 'heart' && owned >= heartMax;
        const storageReady = coins !== null && !!items && (key !== 'heart' || options.heartReady !== false);
        const affordable = storageReady && coins >= def.price && !heartFull;
        if (index) art.rule(ctx, innerX, rowY, innerW);
        const iconY = rowY + (rowH - iconSize) / 2 - 3;
        art.pedestal(ctx,iconX+3,iconY+iconSize-3,iconSize-6);
        if (key === 'heart' || !art.drawItem(ctx, key, iconX, iconY, iconSize))
            image(ctx, key === 'heart' ? 'uiHeart' : { hammer: 'uiToolHammer', bomb: 'uiToolBomb', color: 'uiToolYarn' }[key], iconX, iconY, iconSize, iconSize);
        label(ctx, def.name, textX, rowY + 24, textW, compact ? 20 : 23, '#202F67', { family: SERIF, minSize: 18 });
        label(ctx, key === 'heart' ? owned + '/' + heartMax : '拥有 ' + owned, textX, rowY + 45, textW, 12, '#72546A', { minSize: 11, numbers: true });
        const desc = !storageReady ? '奖励待保存，请重试' : heartFull ? '体力已满' : coins < def.price ? '金币不足' : def.desc;
        // Descriptions stay in the information column, clear of both stacked actions.
        const chars = Math.max(4, Math.floor(textW / 11));
        const lines = desc.length > chars ? [desc.slice(0, chars), desc.slice(chars)] : [desc];
        lines.forEach((line,i)=>label(ctx,line,textX,rowY+64+i*14,textW,11,'#786486',{weight:'500',minSize:10}));
        const actionY = rowY + (options.canReward ? (rowH - 94) / 2 : (rowH - 44) / 2);
        art.button(ctx, actionX, actionY, actionW, 44, '', affordable ? 'pink' : 'muted');
        image(ctx, 'uiCoin', actionX + 8, actionY + 11, 22, 22);
        label(ctx, def.price, actionX + 35, actionY + 22, actionW - 40, 18, '#493454', { minSize: 16, numbers: true });
        if (storageReady) register('buy_' + key, { x: actionX, y: actionY, w: actionW, h: 44 });
        if (options.canReward) {
            const rewardY = actionY + 50;
            const pending = key === 'heart' ? options.heartPending : options.pending;
            const limited = key === 'heart' ? heartFull || options.heartReady === false : Number(options.count) >= (Number(options.limit) || 10);
            const rewardText = key === 'heart' && options.heartReady === false ? '待恢复' : pending ? '领取中' : limited ? (heartFull ? '已满' : '今日已满') : '看广告+1';
            art.button(ctx, actionX, rewardY, actionW, 44, '', limited || pending ? 'muted' : 'ad');
            if (!limited && !pending) moon.glyph(ctx, 'video', actionX + 8, rewardY + 13, 18);
            label(ctx, rewardText, actionX + (limited || pending ? actionW / 2 : 31+(actionW-35)/2), rewardY + 22,
                limited || pending ? actionW - 12 : actionW - 35, compact ? 11 : 13, '#17365E', { align: 'center', minSize: 10 });
            register('reward_' + key, { x: actionX, y: rewardY, w: actionW, h: 44 });
        }
    }
    ctx.restore();
    if(maxScroll){
        const trackX=innerX+innerW+5, thumbH=Math.max(24,viewport.h*viewport.h/(rowH*4));
        ctx.fillStyle='#E2CDB4';path(ctx,trackX,viewport.y,3,viewport.h,1.5);ctx.fill();
        ctx.fillStyle='#AA7899';path(ctx,trackX,viewport.y+(viewport.h-thumbH)*offset/maxScroll,3,thumbH,1.5);ctx.fill();
        label(ctx,offset<maxScroll?'上滑查看更多':'已显示全部商品',cx,backY-7,w*.7,10,'#72546A',{align:'center'});
    }
    art.decoratedButton(ctx, cx - backW / 2, backY, backW, backH, '返回', 'blue', 22);
    art.blossom(ctx,cx-backW/2-5,backY+backH*.58,compact?24:30);
    art.blossom(ctx,cx+backW/2+5,backY+backH*.58,compact?24:30);
    buttons.back = { x: cx - backW / 2, y: backY, w: backW, h: backH };
    buttons.viewport=viewport;buttons.maxScroll=maxScroll;
    ctx.restore();return buttons;
}
module.exports = { draw };
