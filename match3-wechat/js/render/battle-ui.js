/**
 * 双人对战 UI 绘制模块
 * 所有按钮返回 {x, y, w, h} 区域，由 Main 统一做点击命中检测
 * 包含：房间等待页 / 对战顶部栏 / 道具栏 / 结算页 / 受击特效
 */

const THEME = require('./theme');
const assets = require('./assets');
const typography = require('./typography');
const moon = require('./moon-controls');
const gameLayout = require('./game-layout');
const illustration = require('./illustration-art');

const BattleUI = {};

/** 圆角矩形路径 */
function roundRect(ctx, x, y, w, h, r) {
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

function drawBg(ctx, screen) {
    const img = assets.get('gameBackground');
    if (img && img.width && img.height) {
        const scale = Math.max(screen.width / img.width, screen.height / img.height);
        const sw = screen.width / scale;
        const sh = screen.height / scale;
        ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, screen.width, screen.height);
    } else {
        const g = ctx.createLinearGradient(0, 0, 0, screen.height);
        g.addColorStop(0, THEME.bgTop);
        g.addColorStop(0.55, THEME.bgMid);
        g.addColorStop(1, THEME.bgBottom);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, screen.width, screen.height);
    }
    ctx.fillStyle = 'rgba(71, 86, 133, 0.14)';
    ctx.fillRect(0, 0, screen.width, screen.height);
}

function roomDisplayName(roomId) {
    const prefixes = ['紫藤', '星灯', '月桂', '晚樱', '云朵', '蜜桃', '铃兰', '萤火'];
    const places = ['猫眠亭', '爪爪巷', '猫月桥', '猫绒庭', '猫愿台', '猫掌坡', '猫影阁', '猫语泉'];
    let hash = 2166136261;
    const text = String(roomId || '');
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    hash >>>= 0;
    return prefixes[hash % prefixes.length] + places[Math.floor(hash / prefixes.length) % places.length];
}

function playerDisplayName(name,index) {
    return !name || ['我','对手','猫咪玩家'].includes(name) ? (index ? '星星猫咪' : '月光小猫') : name;
}

function drawImageCoverCircle(ctx, image, cx, cy, r) {
    if (!image || !image.width || !image.height) return false;
    const scale = Math.max(r * 2 / image.width, r * 2 / image.height);
    const sw = r * 2 / scale;
    const sh = r * 2 / scale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    return true;
}

/** 画一个玩家头像；无授权时使用项目内猫咪头像。 */
function drawAvatar(ctx, cx, cy, r, image, fallbackKey) {
    ctx.fillStyle = THEME.glassBgSoft;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = THEME.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (!drawImageCoverCircle(ctx, image && image.width && image.height ? image : assets.get(fallbackKey), cx, cy, r)) {
        ctx.fillStyle = THEME.textMid;
        typography.drawFit(ctx, '猫咪', cx, cy + 1, r * 1.6, {
            size: 15, minSize: 10, weight: 'bold', align: 'center'
        });
    }
}

const V3_ITEMS = [
    ['freeze','冰霜冻结','冻结对手3秒'], ['disturb','四连魔咒','5秒需四连'],
    ['reflect','镜面反弹','5秒反弹一次'], ['cheer','猫咪鼓舞','5秒得分×2']
];

function drawItemArt(ctx, key, x, y, size) {
    if (!illustration.drawItem(ctx, key, x, y, size)) moon.battleIcon(ctx, key, x, y, size);
}

const ILLUSTRATION_SERIF = '"Songti SC","STSong","Noto Serif CJK SC",Georgia,serif';
function serif(ctx, text, x, y, width, size, color, minimum) {
    ctx.fillStyle = color;
    return typography.drawFit(ctx, String(text), x, y, width, { size, minSize: minimum || 10,
        weight: 'bold', align: 'center', family: ILLUSTRATION_SERIF });
}
function rewardCoins(ctx, x, y, size) {
    const pile=assets.get('uiIllustrationCoins');
    if(pile&&pile.width&&pile.height){
        const w=size*1.24,h=w*pile.height/pile.width;
        ctx.drawImage(pile,x-size*.12,y+(size-h)/2,w,h);return;
    }
    const coin = assets.get('uiCoin');
    if (!coin || !coin.width || !coin.height) return;
    for (const [dx, dy, scale] of [[0, .34, .58], [.42, .30, .58], [.2, .02, .68]]) {
        ctx.drawImage(coin, x + dx * size, y + dy * size, size * scale, size * scale);
    }
}
function drawPreparationFrame(ctx, x, y, w, h, compact) {
    // Short screens reduce the decorative bands, never the editable content or
    // touch targets. The shared paper frame retains all four floral corners.
    const decorationScale = compact ? .35 : .75;
    const framed = illustration.paperFrame(ctx, x, y, w, h, decorationScale);
    const head = w * .24 * decorationScale, foot = w * .245 * decorationScale;
    const inset = w * .085;
    return { x: x + inset, y: y + head, w: w - inset * 2, h: h - head - foot,
        titleY: y + w * .135 * decorationScale, titleW: w * .48, framed };
}

function drawWaitV3(ctx, screen, data) {
    const cx = screen.width / 2, top = Math.max(72, Number(screen.contentTop) || Number(screen.safeTop) || 0);
    const bottom = screen.height - (Number(screen.safeBottom) || 0) - 12;
    const width = screen.width - 32, buttons = {}, compact = bottom - top < 540;
    const headerH = compact ? 43 : 68;
    const duoH = compact ? 64 : Math.min(172, (bottom - top) * .24);
    const playerH = compact ? 64 : 75, avatarH = duoH + playerH;
    drawBg(ctx, screen);
    ctx.fillStyle='rgba(16,26,67,.18)';ctx.fillRect(0,0,screen.width,screen.height);
    const titleW = Math.min(width - 30, compact ? 228 : 270), titleH = compact ? 28 : 42;
    illustration.titlePlaque(ctx,cx-titleW/2,top,titleW,titleH,roomDisplayName(data.roomId));
    const roundLabel = data.protocolVersion === 2 ? '第 ' + data.roundNumber + ' 局 · 累计胜场 ' + data.myWins + ' : ' + data.oppWins : '对战准备';
    ctx.save();ctx.shadowColor='#27315D';ctx.shadowBlur=3;ctx.shadowOffsetY=1;
    serif(ctx,roundLabel+(compact?' · 各道具冷却10秒':''),cx,top+(compact?36:56),width,compact?10:14,'#FFF1CC');ctx.restore();
    const avatarTop=top+headerH, duo=assets.get('uiIllustrationPrepDuo');
    if(duo&&duo.width&&duo.height){
        const scale=Math.min((width-4)/duo.width,duoH/duo.height),dw=duo.width*scale,dh=duo.height*scale;
        ctx.drawImage(duo,cx-dw/2,avatarTop+duoH-dh,dw,dh);
    }else{
        const fallback=assets.get('homeDuelIcon');
        if(fallback&&fallback.width) {const sw=Math.min(width*.60,duoH*2);ctx.drawImage(fallback,cx-sw/2,avatarTop,sw,duoH);}
    }
    const playerTop=avatarTop+duoH+2,gap=12,playerW=(width-gap)/2;
    const awaitingInvite=data.isHost&&!data.oppJoined;
    for(const [index,name,ready,avatar,key] of [
        [0,playerDisplayName(data.myName,0),data.myReady,data.myAvatar,'piece1'],
        [1,playerDisplayName(data.oppJoined?data.oppName:null,1),data.oppReady,data.oppJoined?data.oppAvatar:null,'piece2']
    ]){
        const px=16+index*(playerW+gap), radius=22, cy=playerTop+24;
        illustration.card(ctx,px,playerTop,playerW,48,false);
        // The portrait remains a real optional player image. The illustrated
        // fallback is rendered locally and is never sent to the room profile.
        if(!avatar&&duo&&duo.width){
            const region=index?[.59,.04,.25,.55]:[.23,0,.27,.59];
            ctx.save();ctx.beginPath();ctx.arc(px+25,cy,21,0,Math.PI*2);ctx.clip();
            ctx.fillStyle='#F6E9F4';ctx.fill();
            ctx.drawImage(duo,duo.width*region[0],duo.height*region[1],duo.width*region[2],duo.height*region[3],px+3,cy-22,44,44);ctx.restore();
            ctx.strokeStyle='#DDBA80';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(px+25,cy,22,0,Math.PI*2);ctx.stroke();
        }else drawAvatar(ctx,px+25,cy,radius,avatar,key);
        if(!index)buttons.avatar={x:px+3,y:cy-radius,w:44,h:44};
        const copyX=px+51,copyW=playerW-55;
        serif(ctx,name,copyX+copyW/2,playerTop+13,copyW,compact?12:15,'#303864',11);
        const showShare=!index&&data.canChangeAvatar!==false&&!data.avatarShared;
        if(index&&awaitingInvite){
            const invite={x:copyX,y:playerTop+4,w:copyW,h:44};
            // Name remains below the invite action when the slot is vacant.
            illustration.button(ctx,invite.x,invite.y,invite.w,invite.h,'邀请好友',data.offline||data.actionPending?'muted':'pink',compact?12:15);
            if(!data.offline&&!data.actionPending)buttons.invite=invite;
            serif(ctx,name,px+playerW/2,playerTop+58,playerW-6,11,'#FFF3DC',11);
        }else{
            serif(ctx,showShare?'点头像设置':ready?'已准备':'配置中',copyX+copyW/2,playerTop+33,copyW,compact?10:12,'#615076',10);
            if(showShare){ctx.save();ctx.shadowColor='#25305B';ctx.shadowBlur=3;ctx.shadowOffsetY=1;
                serif(ctx,'向本房间好友展示',px+playerW/2,playerTop+58,playerW-2,11,'#FFF5DD',11);ctx.restore();}
        }
    }
    const footerH = compact ? 44 : 54, footerY = bottom - footerH;
    const configY = avatarTop + avatarH + 2, configH = footerY - configY - (compact ? 16 : 48);
    const content = drawPreparationFrame(ctx, 6, configY, screen.width - 12, configH, compact);
    const items = data.items || {}, total = V3_ITEMS.reduce((sum, [key]) => sum + (Number(items[key]) || 0), 0);
    const locked = !!(data.myReady || data.actionPending || data.offline);
    if(compact){
        // The small floral caps keep their aspect ratio; a native plaque gives
        // the full-size title a quiet, sufficiently tall background.
        ctx.save();ctx.fillStyle='#293E79';roundRect(ctx,cx-99,content.titleY-13,198,26,13);ctx.fill();
        ctx.strokeStyle='#E7C58A';ctx.lineWidth=1;ctx.stroke();ctx.restore();
    }
    serif(ctx, '对战道具 ' + total + '/5', cx, content.titleY, content.titleW, compact ? 16 : 20, content.framed || compact ? '#FFF1CC' : '#303864', 13);
    const cellGap = compact ? 6 : 8, rowGap = compact ? 4 : 8;
    const cellW = (content.w - cellGap) / 2, cellH = (content.h - rowGap) / 2;
    for (let i = 0; i < V3_ITEMS.length; i++) {
        const [key, name, description] = V3_ITEMS[i], col = i % 2, row = Math.floor(i / 2);
        const x = content.x + col * (cellW + cellGap), y = content.y + row * (cellH + rowGap), center = x + cellW / 2;
        const count = Number(items[key]) || 0;
        illustration.card(ctx, x, y, cellW, cellH, false);
        const artSize = compact ? 32 : Math.min(72, cellW - 94, cellH - 14);
        const artX = x + 4, artY = compact ? y + 4 : y + (cellH - artSize) / 2;
        const copyW = cellW - artSize - 14, copyX = x + artSize + 8 + copyW / 2;
        drawItemArt(ctx, key, artX, artY, artSize);
        serif(ctx, name, copyX, y + 9, copyW, compact ? 11 : 14, '#303864', 11);
        serif(ctx, description, copyX, y + 24, copyW, 10, '#805778', 10);
        const buttonY = y + cellH - 48;
        const minus = { x: x + cellW - 94, y: buttonY, w: 44, h: 44 }, plus = { x: x + cellW - 49, y: buttonY, w: 44, h: 44 };
        const canMinus = !locked && count > 0, canPlus = !locked && total < 5;
        // Compact jewel faces sit inside the unchanged 44px touch targets.
        illustration.button(ctx, minus.x + 8, minus.y + 8, 28, 28, '−', canMinus ? 'blue' : 'muted', 18);
        illustration.button(ctx, plus.x + 8, plus.y + 8, 28, 28, '+', canPlus ? 'pink' : 'muted', 18);
        serif(ctx, String(count), (minus.x + plus.x) / 2 + 22, buttonY + 22, 18, 21, '#303864', 13);
        if (canMinus) buttons[key + 'Minus'] = minus;
        if (canPlus) buttons[key + 'Plus'] = plus;
    }
    const hint = data.offline ? (data.pollPending ? '正在重连并核对房间状态…' : '状态尚未确认，请点击重试连接') :
        data.actionPending ? (data.pendingAction === 'items' ? '正在保存道具配置…' : '正在同步准备状态…') :
        total < 5 ? '还需分配 ' + (5 - total) + ' 次额度' : awaitingInvite ? '邀请好友加入，再一起准备' : (data.myReady ? '已锁定 · ' : '') + '双方准备后 3 秒开局';
    ctx.save(); ctx.shadowColor = '#26335A'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 1;
    serif(ctx, hint, cx, configY + configH + (compact ? 8 : 13), width, compact ? 10 : 13, '#FFF6E7');
    if (!compact) serif(ctx, '各道具冷却10秒', cx, footerY - 15, width, 12, '#FFF6E7');
    ctx.restore();
    const bw = (width - 12) / 2;
    illustration.decoratedButton(ctx, 16, footerY, bw, footerH, data.actionPending ? '同步中…' : data.offline ? (data.pollPending ? '重连中…' : '重试连接') : data.myReady ? '取消准备' : '准备', data.actionPending ? 'muted' : data.myReady ? 'blue' : 'pink', compact ? 20 : 25);
    illustration.decoratedButton(ctx, 28 + bw, footerY, bw, footerH, data.isHost ? '取消房间' : '退出房间', 'blue', compact ? 16 : 19);
    buttons.ready = { x: 16, y: footerY, w: bw, h: footerH };
    buttons.cancel = { x: 28 + bw, y: footerY, w: bw, h: footerH };
    return buttons;
}

/**
 * 房间等待页
 * @param data { roomId, myName, myReady, oppName, oppReady, oppJoined, items, isHost, myAvatar }
 * @returns { ready, cancel, avatar, invite? }
 */
BattleUI.drawWait = function (ctx, screen, data) {
    if(data.itemRulesVersion===3) return drawWaitV3(ctx,screen,data);
    const cx = screen.width / 2, compact = screen.height < 700;
    const top = Math.max(72, Number(screen.contentTop) || Number(screen.safeTop) || 0);
    const bottom = screen.height - (Number(screen.safeBottom) || 0) - 12;
    const width = screen.width - 32;
    drawBg(ctx, screen);
    const headerH = compact ? 76 : 166;
    if (!compact) {
        const logo = assets.get('homeTitleLogo');
        if (logo && logo.width) {
            const logoW = Math.min(280, width), logoH = logoW * logo.height / logo.width;
            ctx.drawImage(logo, cx-logoW/2, top, logoW, logoH);
        }
    }
    const titleY = top + (compact ? 0 : 90);
    moon.button(ctx,cx-110,titleY,220,36,'对战准备','blue',21);
    ctx.fillStyle=THEME.textDark;
    typography.drawFit(ctx,'相遇地点 · '+roomDisplayName(data.roomId),cx,titleY+50,width-12,{size:13,minSize:10,weight:'bold',align:'center'});
    typography.drawFit(ctx,data.protocolVersion===2?'第 '+data.roundNumber+' 局 · 累计胜场 '+data.myWins+' : '+data.oppWins:'邀请识别码 '+String(data.roomId||'').slice(-6).toUpperCase(),cx,titleY+68,width-12,{size:10,minSize:8,align:'center',numbers:true});

    const avatarTop=top+headerH+10, avatarH=compact?132:154;
    const playerW=(width-22)/2, r=compact?30:39, avatarY=avatarTop+(compact?36:47);
    const buttons={};
    const awaitingInvite = data.isHost && !data.oppJoined;
    for (const [index,name,ready,image,key] of [
        [0,data.myName||'我',data.myReady,data.myAvatar,'piece1'],
        [1,data.oppJoined?(data.oppName||'对手'):'等待加入',data.oppReady,data.oppJoined?data.oppAvatar:null,data.oppJoined?'piece2':'piece5']
    ]) {
        const x=16+index*(playerW+22), pc=x+playerW/2;
        moon.panel(ctx,screen,x,avatarTop,playerW,avatarH);
        drawAvatar(ctx,pc,avatarY,r,image,key);
        if (index === 1 && awaitingInvite) {
            const invite = { x: x + 8, y: avatarTop + avatarH - 56, w: playerW - 16, h: 44 };
            const enabled = !data.offline && !data.actionPending;
            moon.button(ctx,invite.x,invite.y,invite.w,invite.h,'邀请好友',enabled?'pink':'muted',18);
            if (enabled) buttons.invite = invite;
            continue;
        }
        ctx.fillStyle=THEME.textDark;
        typography.drawFit(ctx,name,pc,avatarY+r+17,playerW-12,{size:14,minSize:9,weight:'bold',align:'center'});
        const label=index===1&&!data.oppJoined?'等待好友':ready?'已准备':'配置中';
        const stateY=avatarY+r+30;
        const showAvatarSharing=index===0&&data.canChangeAvatar!==false&&!data.avatarShared;
        moon.button(ctx,x+12,stateY,playerW-24,24,label+(showAvatarSharing?'·点头像设置':''),ready?'pink':'muted',11);
        if(showAvatarSharing) typography.drawFit(ctx,'向本房间好友展示',pc,avatarTop+avatarH+3,playerW-8,{size:11,minSize:11,align:'center'});
        if(index===0) buttons.avatar={x:pc-r,y:avatarY-r,w:r*2,h:r*2};
    }
    ctx.fillStyle=THEME.textDark;
    typography.drawFit(ctx,'VS',cx,avatarY,24,{size:14,minSize:10,weight:'bold',numbers:true,align:'center'});

    const configY=avatarTop+avatarH+12, configH=compact?128:140;
    moon.panel(ctx,screen,16,configY,width,configH);
    const items=data.items||{freeze:1,disturb:2};
    const itemsLocked = data.myReady || data.actionPending || data.offline;
    const total=(Number(items.freeze)||0)+(Number(items.disturb)||0);
    ctx.fillStyle=THEME.textDark;
    typography.drawFit(ctx,'对战道具 '+total+'/3'+(data.myReady?' · 已锁定':''),cx,configY+20,width-24,{size:14,minSize:10,weight:'bold',numbers:true,align:'center'});
    for(const [index,key,name] of [[0,'freeze','冰冻'],[1,'disturb','干扰']]) {
        const gx=22+index*(width/2), gw=width/2-12, pc=gx+gw/2;
        drawItemArt(ctx,key,pc-40,configY+34,28);
        ctx.fillStyle=THEME.textDark;
        typography.drawFit(ctx,name,pc+12,configY+49,56,{size:13,minSize:10,weight:'bold',align:'center'});
        const rowY=configY+72, count=Number(items[key])||0;
        typography.drawFit(ctx,String(count),pc,rowY+22,30,{size:21,minSize:12,weight:'bold',numbers:true,align:'center'});
        for(const [suffix,label,x] of [['Minus','−',gx],['Plus','+',gx+gw-44]]) {
            moon.button(ctx,x,rowY,44,44,label,itemsLocked?'muted':suffix==='Plus'?'pink':'blue',21);
            if(!itemsLocked) buttons[key+suffix]={x,y:rowY,w:44,h:44};
        }
    }
    ctx.fillStyle=THEME.textDark;
    const hintY=configY+configH+16;
    typography.drawFit(ctx,data.offline?(data.pollPending?'正在重连并核对房间状态…':'状态尚未确认，请点击重试连接'):data.actionPending?(data.pendingAction==='items'?'正在保存道具配置…':'正在同步准备状态…'):awaitingInvite?'邀请好友加入，再一起准备':'双方准备后 3 秒开局',cx,hintY,width,{size:11,minSize:8,align:'center',numbers:true});
    const footerY=Math.min(bottom-48,hintY+24), gap=12, bw=(width-gap)/2;
    moon.button(ctx,16,footerY,bw,48,data.actionPending?'同步中…':data.offline?(data.pollPending?'重连中…':'重试连接'):data.myReady?'取消准备':'准备',data.myReady||awaitingInvite?'blue':'pink',18);
    moon.button(ctx,16+bw+gap,footerY,bw,48,data.isHost?'取消房间':'退出房间','blue',15);
    buttons.ready={x:16,y:footerY,w:bw,h:48};
    buttons.cancel={x:16+bw+gap,y:footerY,w:bw,h:48};
    return buttons;
};

/**
 * 对战顶部栏（倒计时 + 双方分数）
 * @param data { timeLeft, myScore, oppScore, myAvatar, oppAvatar }
 */
BattleUI.drawTop = function (ctx, screen, data) {
    const cx = screen.width / 2;
    const layout = gameLayout.pvp(screen);
    const top = layout.hudY;
    const x = 10, w = screen.width - 20, h = layout.hudH;
    const roomy = h >= 110, footerH = roomy ? 28 : 19;
    const labelY = top + h * .21, scoreY = top + h * .54;
    const timerY = top + h * .32, timerCaptionY = top + h * .62;
    const footerY = top + h - footerH / 2;
    const urgent = !data.settling && (data.urgent || data.timeLeft <= 10);
    const sideW = (w - 76) / 2;
    ctx.save();
    if (layout.headlineY) {
        ctx.save();
        ctx.fillStyle = '#FFF7EB';
        ctx.shadowColor = 'rgba(25, 32, 63, .95)';
        ctx.shadowBlur = 3; ctx.shadowOffsetY = 1.5;
        typography.drawFit(ctx, '好友对战', 14, layout.headlineY, Math.min(150, screen.width - 170),
            { size: roomy ? 17 : 14, minSize: 12, weight: 'bold' });
        ctx.restore();
    }
    moon.scorePanel(ctx,screen,x,top,w,h);
    ctx.strokeStyle = '#DCD7E8'; ctx.lineWidth = 1;
    ctx.beginPath();ctx.moveTo(x + 12, top + h - footerH);ctx.lineTo(x + w - 12, top + h - footerH);ctx.stroke();

    for (const side of [
        { x: x, label: '我的得分', score: data.myScore, wins: data.myWins, avatar: data.myAvatar, color: '#914E73', key: 'piece1', right: false },
        { x: cx + 38, label: '对手得分', score: data.oppScore, wins: data.oppWins, avatar: data.oppAvatar, color: '#426494', key: 'piece2', right: true }
    ]) {
        const center = side.x + sideW / 2;
        const avatarX = side.right ? side.x + sideW - 17 : side.x + 17;
        drawAvatar(ctx, avatarX, labelY, roomy ? 14 : 11, side.avatar, side.key);
        ctx.fillStyle = side.color;
        typography.drawFit(ctx, side.label, side.right ? avatarX - 18 : avatarX + 18, labelY, sideW - 42,
            { size: roomy ? 14 : 11, minSize: 9, weight: '600', align: side.right ? 'right' : 'left' });
        typography.drawFit(ctx, String(side.score), center, scoreY, sideW - 18,
            { size: roomy ? 38 : 28, minSize: 10, weight: 'bold', numbers: true, align: 'center' });
        if (data.protocolVersion === 2) {
            typography.drawFit(ctx, '胜场 ' + side.wins, center, footerY, sideW - 12,
                { size: roomy ? 14 : 10, minSize: 8, numbers: true, align: 'center' });
        }
    }

    // The timer is typography, not a third item button. Urgency uses a calm color change.
    ctx.fillStyle = urgent ? '#963E60' : '#353D69';
    typography.drawFit(ctx, data.settling ? '确认' : String(data.timeLeft), cx, timerY, 64,
        { size: data.settling ? (roomy ? 27 : 22) : (roomy ? 40 : 32), minSize: 18, weight: 'bold', numbers: !data.settling, align: 'center' });
    typography.drawFit(ctx, data.settling ? '成绩' : urgent ? '即将结束' : '剩余秒数', cx, timerCaptionY, 72,
        { size: roomy ? 12 : 9, minSize: 9, align: 'center' });
    ctx.fillStyle = '#656482';
    typography.drawFit(ctx, data.protocolVersion === 2 ? '第 ' + data.roundNumber + ' 局' : '好友对战 · 60秒挑战',
        cx, footerY, data.protocolVersion === 2 ? 72 : w - 24,
        { size: roomy ? 14 : 10, minSize: 8, numbers: true, align: 'center' });
    ctx.restore();
};

BattleUI.drawCountdown = function (ctx, screen, data) {
    ctx.fillStyle = 'rgba(71, 86, 133, 0.42)';
    ctx.fillRect(0, 0, screen.width, screen.height);
    const cx = screen.width / 2;
    const cy = screen.height * 0.46;
    moon.panel(ctx,screen,cx-130,cy-94,260,188);
    ctx.fillStyle = THEME.textDark;
    typography.drawFit(ctx, '准备好了吗', cx, cy - 54, screen.width - 48, {
        size: 28, minSize: 18, weight: 'bold', align: 'center'
    });
    ctx.fillStyle = '#9B5583';
    typography.drawFit(ctx, data.label || String(data.seconds), cx, cy + 18, screen.width - 48, {
        size: 84, minSize: 30, weight: 'bold', numbers: !data.label, align: 'center'
    });
};

BattleUI.drawWarning = function (ctx, screen) {
    const layout = gameLayout.pvp(screen), roomy = layout.hudH >= 110;
    const cy = layout.hudY + layout.hudH * .62, h = roomy ? 23 : 18;
    ctx.save();
    ctx.fillStyle = '#F7E0EB';
    roundRect(ctx, screen.width / 2 - 37, cy - h / 2, 74, h, 7); ctx.fill();
    ctx.fillStyle = '#8A3E61';
    typography.drawFit(ctx, '还剩30秒', screen.width / 2, cy, 68,
        { size: roomy ? 12 : 10, minSize: 9, align: 'center', numbers: true });
    ctx.restore();
};

/**
 * 对战道具栏（房间配置的四道具；旧房间保持冰冻/干扰）
 * @param data { itemRulesVersion, freeze, disturb, reflect, cheer, cooldowns, sharedCooldown, pending, frozen }
 * @returns { freeze, disturb, reflect?, cheer? } 按钮区域
 */
BattleUI.drawItems = function (ctx, screen, data) {
    const layout = gameLayout.pvp(screen), y = layout.dockY, h = layout.dockH;
    const roomy = h >= 120, v3 = data.itemRulesVersion === 3;
    const items = v3 ? V3_ITEMS : [['freeze', '冰冻'], ['disturb', '干扰']];
    const width = screen.width - 24, x = 12, cellW = width / items.length;
    const cooldowns = data.cooldowns || {};
    const sharedRemaining = data.sharedCooldown ? Math.max(0, ...Object.values(cooldowns)) : Number(data.cooldownRemaining) || 0;
    const pending = !!(data.pending || data.actionPending);
    const status = data.settling ? '正在确认成绩…' : data.frozen ? '冰冻中 · 无法使用道具' :
        pending ? '正在确认道具…' : sharedRemaining > 0 ? '共享冷却 ' + Math.ceil(sharedRemaining / 1000) + '秒' : data.sharedCooldown ? '对战道具' : '对战道具 · 各自冷却10秒';
    ctx.save();
    ctx.save();
    ctx.fillStyle = '#FFF7EB';
    ctx.shadowColor = 'rgba(25, 32, 63, .95)';
    ctx.shadowBlur = 3; ctx.shadowOffsetY = 1.5;
    typography.drawFit(ctx, status, screen.width / 2, y + (roomy ? 16 : 11), width - 12,
        { size: roomy ? 14 : 11, minSize: 11, numbers: true, align: 'center' });
    ctx.restore();
    const iconSize = roomy ? Math.min(60, h * .38) : 30;
    const iconY = y + (roomy ? 32 : 22);
    const countY = iconY + iconSize + (roomy ? 15 : 9);
    const nameY = countY + (roomy ? 24 : 18);
    const buttons = {};
    for (let i = 0; i < items.length; i++) {
        const [key, name] = items[i], bx = x + i * cellW, center = bx + cellW / 2;
        const count = Number(data[key]) || 0;
        const remaining = Math.max(0, Number(cooldowns[key]) || sharedRemaining);
        const enabled = count > 0 && remaining <= 0 && !data.settling && !pending && !data.frozen;
        ctx.save();
        ctx.globalAlpha = enabled ? 1 : .48;
        drawItemArt(ctx, key, center - iconSize / 2, iconY, iconSize);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#FFF7EB';
        ctx.shadowColor = 'rgba(25, 32, 63, .95)';
        ctx.shadowBlur = 3; ctx.shadowOffsetY = 1.5;
        typography.drawFit(ctx, count > 0 ? '×' + count : '用尽', center, countY, cellW - 10,
            { size: roomy ? 15 : 11, minSize: 11, weight: 'bold', numbers: count > 0, align: 'center' });
        typography.drawFit(ctx, name, center, nameY, cellW - 8,
            { size: roomy ? 14 : 11, minSize: 11, weight: 'bold', align: 'center' });
        ctx.restore();
        if (remaining > 0 && count > 0) {
            const pillW = roomy ? 44 : 30, pillH = roomy ? 28 : 22;
            ctx.save();
            ctx.fillStyle = 'rgba(30, 37, 69, .92)';
            roundRect(ctx, center - pillW / 2, iconY + (iconSize - pillH) / 2, pillW, pillH, pillH / 2);
            ctx.fill();
            ctx.fillStyle = '#FFF7EB';
            typography.drawFit(ctx, Math.ceil(remaining / 1000) + 's', center, iconY + iconSize / 2, pillW - 4,
                { size: roomy ? 18 : 13, minSize: 11, weight: 'bold', numbers: true, align: 'center', baseline: 'middle' });
            ctx.restore();
        }
        // Unframed items still have distinct full-size interaction targets.
        buttons[key] = { x: bx + 2, y: iconY - 2, w: cellW - 4, h: h - (iconY - y) };
    }
    ctx.restore();
    return buttons;
};

/**
 * 结算页
 * @param data { result:'win'|'lose'|'draw', myScore, oppScore, coinReward }
 * @returns { again, menu }
 */
BattleUI.drawResult = function (ctx, screen, data) {
    const cx = screen.width / 2, top = Math.max(72, Number(screen.contentTop) || Number(screen.safeTop) || 0);
    const bottom = screen.height - (Number(screen.safeBottom) || 0) - 12, compact = bottom - top < 540;
    drawBg(ctx, screen);
    ctx.fillStyle = 'rgba(20,30,70,.32)'; ctx.fillRect(0, 0, screen.width, screen.height);
    const w = Math.min(370, screen.width - 20), frameH = compact ? 310 : 428;
    const heroSpace = compact ? 64 : 160, gap = compact ? 8 : 10, actionH = compact ? 48 : 56;
    const h = heroSpace + frameH + gap + actionH, y = top + (bottom - top - h) / 2, x = cx - w / 2;
    const frameY = y + heroSpace, bodyY = frameY + w * (compact ? .28 : .30);
    const won = data.result === 'win', tied = data.result === 'draw';
    const framed = illustration.resultFrame(ctx, x, frameY, w, frameH);
    const cat = assets.get(tied ? 'uiIllustrationDrawCat' : won ? 'uiResultWinMoon' : 'uiResultLoseMoon') || assets.get(tied ? 'piece1' : won ? 'uiResultHappyCat' : 'uiResultSadCat');
    if (cat && cat.width && cat.height) {
        const heroH = heroSpace + w * (compact ? .10 : .12), scale = Math.min(w * .86 / cat.width, heroH / cat.height);
        const pawDock=tied?(compact?7:23):0;
        ctx.drawImage(cat, cx - cat.width * scale / 2, y + heroH - cat.height * scale + pawDock, cat.width * scale, cat.height * scale);
    }
    ctx.save(); ctx.shadowColor = won ? '#CB5E95' : '#8475C5'; ctx.shadowBlur = compact ? 3 : 5; ctx.shadowOffsetY = 1;
    serif(ctx, won ? '对战胜利' : tied ? '平局' : '对战失败', cx, frameY + w * .21, w * .72, compact ? 29 : 38, framed ? won ? '#FFF1B8' : '#F6EEFF' : '#343961', 22);
    ctx.restore();
    const scoreW = w * .34, r = compact ? 22 : 32, avatarY = bodyY + (compact ? 23 : 35);
    for (const [index, label, value, image, key] of [
        [0, playerDisplayName(data.myName,0), data.myScore, data.myAvatar, 'piece1'],
        [1, playerDisplayName(data.oppName,1), data.oppScore, data.oppAvatar, 'piece2']
    ]) {
        const center = cx + (index ? 1 : -1) * w * .245;
        drawAvatar(ctx, center, avatarY, r, image, key);
        serif(ctx, label, center, bodyY + (compact ? 56 : 82), scoreW, compact ? 12 : 16, '#343961', 10);
        const winner = !tied && (index ? data.oppScore > data.myScore : data.myScore > data.oppScore);
        ctx.save();
        if (winner) { ctx.shadowColor = '#F3CEAA'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1; }
        serif(ctx, String(value), center, bodyY + (compact ? 79 : 112), scoreW, compact ? 27 : 34, winner ? '#AD680F' : '#5C5CA0', 12);
        ctx.restore();
    }
    ctx.save(); ctx.shadowColor = '#F5D99A'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
    serif(ctx, 'VS', cx, avatarY + (compact ? 8 : 14), w * .17, compact ? 25 : 34, '#B57A23', 20);
    ctx.restore();
    const roundY = bodyY + (compact ? 102 : 146);
    illustration.rule(ctx, x + w * .14, roundY - (compact ? 12 : 16), w * .72);
    if (data.protocolVersion === 2) serif(ctx, '第 ' + data.roundNumber + ' 局 · 累计胜场 ' + data.myWins + ' : ' + data.oppWins, cx, roundY, w * .76, compact ? 11 : 15, '#4A426B', 10);
    const rewardY = bodyY + (compact ? 116 : 166), rewardH = compact ? 54 : 76, coinSize = compact ? 54 : 76;
    const rewardW = w * .72, rewardX = cx - rewardW / 2;
    rewardCoins(ctx, rewardX + 4, rewardY, coinSize);
    const rewardCopyX = rewardX + coinSize + 10, rewardCopyW = rewardW - coinSize - 14;
    serif(ctx, '奖励', rewardCopyX + rewardCopyW / 2, rewardY + (compact ? 11 : 17), rewardCopyW, compact ? 13 : 17, '#71486B', 11);
    serif(ctx, '+' + (data.coinReward || 0) + ' 金币', rewardCopyX + rewardCopyW / 2, rewardY + (compact ? 35 : 49), rewardCopyW, compact ? 23 : 29, won ? '#C93F82' : '#505DAB', 14);
    let label = '再来一局', status = '双方确认后，再次配置道具并准备';
    if (data.protocolVersion !== 2) { label = '重新邀请'; status = '邀请好友，开启新房间'; }
    else if (data.expired) { label = '重新邀请'; status = '房间已失效，可以重新邀请好友'; }
    else if (data.oppLeft) { label = '重新邀请'; status = '好友已离开，可以重新邀请'; }
    else if (data.offline) { label = '重试连接'; status = '连接暂时中断，正在同步房间'; }
    else if (data.myRematch) { label = '取消等待'; status = data.oppOnline ? '已确认 · 等待好友再来一局' : '已确认 · 等待好友回到房间'; }
    else if (data.oppRematch) status = '好友想再来一局，等你确认';
    else if (!data.oppOnline) status = '好友暂时离线，回来后可继续';
    if (data.actionPending) label = '同步中…';
    const statusY = bodyY + (compact ? 184 : 270);
    if (!data.rewardPending) illustration.rule(ctx, x + w * .2, statusY - (compact ? 12 : 19), w * .6);
    serif(ctx, status, cx, statusY, w * .70, compact ? 10 : 13, '#57527E', 9);
    const by = frameY + frameH + gap, bw = (w - 20) / 2;
    illustration.button(ctx, x + 4, by, bw, actionH, label, data.actionPending ? 'muted' : data.myRematch ? 'blue' : 'pink', compact ? 18 : 21);
    illustration.button(ctx, x + w - 4 - bw, by, bw, actionH, '返回首页', 'blue', compact ? 18 : 21);
    const buttons = { again: { x: x + 4, y: by, w: bw, h: actionH }, menu: { x: x + w - 4 - bw, y: by, w: bw, h: actionH } };
    if (data.rewardPending) {
        buttons.reward = { x: rewardX, y: rewardY, w: rewardW, h: rewardH };
        // The retry affordance is a separate line, leaving the reward amount legible.
        serif(ctx, '金币待保存 · 点击重试', cx, rewardY + rewardH + (compact ? 1 : 9), w * .72, compact ? 9 : 11, '#8D426D', 9);
    }
    if (data.retentionMessage) serif(ctx, data.retentionMessage, cx, statusY + (compact ? 16 : 20), w * .65, 9, '#71486B', 9);
    return buttons;
};

// Receiving effects stay attached to the board. Only the frozen board is covered
// persistently; the playable disturbed board gets a brief hit notice and edge label.
BattleUI.drawEffects = function (ctx, screen, data) {
    const reflect=Number(data.reflectRemaining)>0,cheer=Number(data.cheerRemaining)>0;
    if(!data.frozen&&!data.disturb&&!data.castNotice&&!data.notice&&!reflect&&!cheer) return;
    if(!['boardX','boardY','boardW','boardH'].every(k=>Number.isFinite(data[k]))||data.boardW<=0||data.boardH<=0) return;
    const {boardX:x,boardY:y,boardW:w,boardH:h}=data, cx=x+w/2;
    const seconds=value=>Math.max(1,Math.ceil(Number(value)/1000));
    ctx.save();
    if(data.frozen||data.disturb) {
        // The inner wash and double rim remain static on reduced-effects devices.
        roundRect(ctx,x+1,y+1,w-2,h-2,12);
        if(data.frozen) {ctx.fillStyle='rgba(107, 183, 232, 0.28)';ctx.fill();}
        ctx.strokeStyle=data.frozen?'#D9F6FF':'#F1B9E4';ctx.lineWidth=4;ctx.stroke();
        roundRect(ctx,x+5,y+5,w-10,h-10,9);
        ctx.strokeStyle=data.frozen?'#6BAAD4':'#B765A5';ctx.lineWidth=1;ctx.stroke();
    }
    if(data.disturb||reflect||cheer) {
        const compact=Number(!!data.disturb)+Number(reflect)+Number(cheer)>1;
        const badges=[];
        if(data.disturb) badges.push([(compact?'四连 ':'干扰中 · 需要4连 · ')+seconds(data.disturbRemaining)+'秒','pink']);
        if(reflect) badges.push([(compact?'反弹 ':'镜面反弹 ')+seconds(data.reflectRemaining)+'秒','blue']);
        if(cheer) badges.push(['鼓舞×2 '+seconds(data.cheerRemaining)+'秒','pink']);
        const gap=3,badgeW=Math.min(220,(w-12-(badges.length-1)*gap)/badges.length);
        const start=cx-(badges.length*badgeW+(badges.length-1)*gap)/2;
        badges.forEach(([label,tone],index)=>{
            const bx=start+index*(badgeW+gap);
            moon.button(ctx,bx,y-14,badgeW,26,'',tone);
            ctx.fillStyle='#303C70';
            typography.drawFit(ctx,label,bx+badgeW/2,y-1,badgeW-8,{size:compact?10:13,minSize:8,weight:'bold',align:'center'});
        });
    }
    if(data.frozen||data.disturbNotice&&data.disturb) {
        const panelW=Math.min(w-24,260),panelH=78,py=y+(h-panelH)/2;
        roundRect(ctx,cx-panelW/2,py,panelW,panelH,16);
        ctx.fillStyle=data.frozen?'rgba(28, 65, 108, 0.94)':'rgba(92, 43, 100, 0.94)';ctx.fill();
        ctx.strokeStyle=data.frozen?'#D9F6FF':'#F5CDEC';ctx.lineWidth=2;ctx.stroke();
        ctx.fillStyle='#FFFFFF';
        typography.drawFit(ctx,data.frozen?'冰冻中 · '+seconds(data.frozenRemaining)+'秒':'受到干扰',cx,py+28,panelW-24,{size:22,minSize:17,weight:'bold',align:'center'});
        typography.drawFit(ctx,data.frozen?'暂时无法移动':'需要4连才能消除',cx,py+56,panelW-24,{size:15,minSize:12,align:'center'});
    }
    if(data.castNotice||data.notice) {
        const badgeW=Math.min(w-12,220);
        const castName=data.itemRulesVersion===3&&V3_ITEMS.find(([key])=>key===data.castNotice);
        const label=data.notice||(data.castNotice==='reflect'&&data.itemRulesVersion===3?'镜面反弹 · 已开启':
            data.castNotice==='cheer'&&data.itemRulesVersion===3?'猫咪鼓舞 · 得分×2':
            '已向对手释放'+(castName?castName[1]:data.castNotice==='freeze'?'冰冻':'干扰'));
        moon.button(ctx,cx-badgeW/2,y+h-10,badgeW,24,
            label,'blue',12);
    }
    ctx.restore();
};

BattleUI.hitTest = function (x, y, btn) {
    if (!btn) return false;
    return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
};

BattleUI.roomDisplayName = roomDisplayName;

module.exports = BattleUI;
