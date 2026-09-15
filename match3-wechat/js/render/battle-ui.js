/**
 * 双人对战 UI 绘制模块
 * 所有按钮返回 {x, y, w, h} 区域，由 Main 统一做点击命中检测
 * 包含：房间等待页 / 对战顶部栏 / 道具栏 / 结算页 / 受击特效
 */

const THEME = require('./theme');
const assets = require('./assets');
const typography = require('./typography');
const moon = require('./moon-controls');

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
    const places = ['猫眠亭', '爪爪巷', '月牙桥', '绒球庭', '星愿台', '软软坡', '花影阁', '猫语泉'];
    let hash = 2166136261;
    const text = String(roomId || '');
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    hash >>>= 0;
    return prefixes[hash % prefixes.length] + places[Math.floor(hash / prefixes.length) % places.length];
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
    if (!drawImageCoverCircle(ctx, image || assets.get(fallbackKey), cx, cy, r)) {
        ctx.fillStyle = THEME.textMid;
        typography.drawFit(ctx, '猫咪', cx, cy + 1, r * 1.6, {
            size: 15, minSize: 10, weight: 'bold', align: 'center'
        });
    }
}

/**
 * 房间等待页
 * @param data { roomId, myName, myReady, oppName, oppReady, oppJoined, items, isHost, myAvatar }
 * @returns { ready, cancel, avatar }
 */
BattleUI.drawWait = function (ctx, screen, data) {
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
    typography.drawFit(ctx,'邀请识别码 '+String(data.roomId||'').slice(-6).toUpperCase(),cx,titleY+68,width-12,{size:10,minSize:8,align:'center',numbers:true});

    const avatarTop=top+headerH+10, avatarH=compact?132:154;
    const playerW=(width-22)/2, r=compact?30:39, avatarY=avatarTop+(compact?36:47);
    const buttons={};
    for (const [index,name,ready,image,key] of [
        [0,data.myName||'我',data.myReady,data.myAvatar,'piece1'],
        [1,data.oppJoined?(data.oppName||'对手'):'等待加入',data.oppReady,null,data.oppJoined?'piece2':'piece5']
    ]) {
        const x=16+index*(playerW+22), pc=x+playerW/2;
        moon.panel(ctx,screen,x,avatarTop,playerW,avatarH);
        drawAvatar(ctx,pc,avatarY,r,image,key);
        ctx.fillStyle=THEME.textDark;
        typography.drawFit(ctx,name,pc,avatarY+r+17,playerW-12,{size:14,minSize:9,weight:'bold',align:'center'});
        const label=index===1&&!data.oppJoined?'等待好友':ready?'已准备':'配置中';
        const stateY=avatarY+r+30;
        moon.button(ctx,x+12,stateY,playerW-24,24,label,ready?'pink':'muted',11);
        if(index===0) buttons.avatar={x:pc-r,y:avatarY-r,w:r*2,h:r*2};
    }
    ctx.fillStyle=THEME.textDark;
    typography.drawFit(ctx,'VS',cx,avatarY,24,{size:14,minSize:10,weight:'bold',numbers:true,align:'center'});

    const configY=avatarTop+avatarH+12, configH=compact?128:140;
    moon.panel(ctx,screen,16,configY,width,configH);
    const items=data.items||{freeze:1,disturb:2};
    const total=(Number(items.freeze)||0)+(Number(items.disturb)||0);
    ctx.fillStyle=THEME.textDark;
    typography.drawFit(ctx,'对战道具 '+total+'/3'+(data.myReady?' · 已锁定':''),cx,configY+20,width-24,{size:14,minSize:10,weight:'bold',numbers:true,align:'center'});
    for(const [index,key,name] of [[0,'freeze','冰冻'],[1,'disturb','干扰']]) {
        const gx=22+index*(width/2), gw=width/2-12, pc=gx+gw/2;
        moon.battleIcon(ctx,key,pc-40,configY+34,28);
        ctx.fillStyle=THEME.textDark;
        typography.drawFit(ctx,name,pc+12,configY+49,56,{size:13,minSize:10,weight:'bold',align:'center'});
        const rowY=configY+72, count=Number(items[key])||0;
        typography.drawFit(ctx,String(count),pc,rowY+22,30,{size:21,minSize:12,weight:'bold',numbers:true,align:'center'});
        for(const [suffix,label,x] of [['Minus','−',gx],['Plus','+',gx+gw-44]]) {
            moon.button(ctx,x,rowY,44,44,label,data.myReady?'muted':suffix==='Plus'?'pink':'blue',21);
            if(!data.myReady) buttons[key+suffix]={x,y:rowY,w:44,h:44};
        }
    }
    ctx.fillStyle=THEME.textDark;
    const hintY=configY+configH+16;
    typography.drawFit(ctx,'双方准备后 3 秒开局'+(!data.myAvatar?' · 点头像可更换':''),cx,hintY,width,{size:11,minSize:8,align:'center',numbers:true});
    const footerY=Math.min(bottom-48,hintY+24), gap=12, bw=(width-gap)/2;
    moon.button(ctx,16,footerY,bw,48,data.myReady?'取消准备':'准备',data.myReady?'blue':'pink',18);
    moon.button(ctx,16+bw+gap,footerY,bw,48,data.isHost?'取消房间':'退出房间','blue',15);
    buttons.ready={x:16,y:footerY,w:bw,h:48};
    buttons.cancel={x:16+bw+gap,y:footerY,w:bw,h:48};
    return buttons;
};

/**
 * 对战顶部栏（倒计时 + 双方分数）
 * @param data { timeLeft, myScore, oppScore, myName, oppName }
 */
BattleUI.drawTop = function (ctx, screen, data) {
    const cx=screen.width/2, top=Math.max(72,Number(screen.contentTop)||Number(screen.safeTop)||0)+4;
    const urgent=data.urgent||data.timeLeft<=10;
    const cardW=(screen.width-92)/2;
    for(const [x,label,score,key] of [[8,'我',data.myScore,'piece1'],[screen.width-8-cardW,'对手',data.oppScore,'piece2']]) {
        moon.button(ctx,x,top+2,cardW,54,'','blue');
        drawAvatar(ctx,x+21,top+29,16,null,key);
        ctx.fillStyle=THEME.textDark;
        typography.drawFit(ctx,label,x+40+(cardW-46)/2,top+15,cardW-46,{size:10,minSize:8,align:'center'});
        typography.drawFit(ctx,String(score),x+40+(cardW-46)/2,top+37,cardW-46,{size:18,minSize:8,weight:'bold',numbers:true,align:'center'});
    }
    moon.button(ctx,cx-30,top-2,60,60,'',urgent?'pink':'blue');
    ctx.save();ctx.beginPath();ctx.arc(cx,top+28,26,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,Math.min(1,data.timeLeft/60)));ctx.strokeStyle=urgent?'#B35B86':'#F4DAA5';ctx.lineWidth=3;ctx.stroke();ctx.restore();
    ctx.fillStyle=urgent?'#923957':THEME.textDark;
    typography.drawFit(ctx,String(data.timeLeft),cx,top+24,46,{size:27,minSize:16,weight:'bold',numbers:true,align:'center'});
    typography.drawFit(ctx,'秒',cx,top+44,30,{size:10,minSize:8,align:'center'});
    ctx.fillStyle=THEME.textDark;
    typography.drawFit(ctx,'好友对战 · 60秒挑战',cx,top+74,screen.width-32,{size:11,minSize:9,align:'center',numbers:true});
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
    const top=Math.max(72,Number(screen.contentTop)||Number(screen.safeTop)||0);
    moon.button(ctx,12,top+66,screen.width-24,24,'还剩 30 秒！','pink',13);
};

/**
 * 对战道具栏（仅房间配置的冰冻/干扰；单人商店道具不进入 PvP）
 * @param data { freeze, disturb, cooldownRemaining, active }
 * @returns { freeze, disturb } 按钮区域
 */
BattleUI.drawItems = function (ctx, screen, data) {
    const width=Math.min(274,screen.width-24), x=(screen.width-width)/2;
    const y=screen.height-(Number(screen.safeBottom)||0)-98;
    moon.panel(ctx,screen,x,y,width,86);
    const cooling=Number(data.cooldownRemaining)>0;
    const status=cooling?'共享冷却 '+Math.ceil(data.cooldownRemaining/1000)+'秒':data.active?'效果生效中':'对战道具';
    ctx.fillStyle=THEME.textDark;
    typography.drawFit(ctx,status,screen.width/2,y+14,width-24,{size:11,minSize:8,numbers:true,align:'center'});
    const buttons={};
    for(const [index,key,name] of [[0,'freeze','冰冻'],[1,'disturb','干扰']]) {
        const bx=x+10+index*(width/2), bw=width/2-20, by=y+28;
        const count=Number(data[key])||0, enabled=count>0&&!data.active&&!cooling;
        moon.button(ctx,bx,by,bw,48,'',enabled?(key==='freeze'?'blue':'pink'):'muted');
        ctx.save();ctx.globalAlpha=enabled?1:.5;moon.battleIcon(ctx,key,bx+5,by+5,38);ctx.restore();
        ctx.fillStyle=THEME.textDark;
        typography.drawFit(ctx,name,bx+43+(bw-47)/2,by+16,bw-47,{size:12,minSize:9,align:'center'});
        typography.drawFit(ctx,count>0?'×'+count:'用尽',bx+43+(bw-47)/2,by+35,bw-47,{size:12,minSize:9,weight:'bold',numbers:count>0,align:'center'});
        buttons[key]={x:bx,y:by,w:bw,h:48};
    }
    return buttons;
};

/**
 * 结算页
 * @param data { result:'win'|'lose'|'draw', myScore, oppScore, coinReward }
 * @returns { again, menu }
 */
BattleUI.drawResult = function (ctx, screen, data) {
    const cx=screen.width/2;
    drawBg(ctx,screen);
    ctx.fillStyle='rgba(71,86,133,.18)';ctx.fillRect(0,0,screen.width,screen.height);
    const w=Math.min(346,screen.width-32), h=390;
    const safeTop=Math.max(72,Number(screen.contentTop)||Number(screen.safeTop)||0)+18;
    const y=Math.max(safeTop,Math.min((screen.height-h)/2,screen.height-(Number(screen.safeBottom)||0)-h-16)),x=cx-w/2;
    moon.panel(ctx,screen,x,y,w,h);
    const won=data.result==='win', tied=data.result==='draw';
    moon.button(ctx,cx-110,y-12,220,44,won?'对战胜利':tied?'平局':'对战失败',won?'pink':'blue',24);
    const cat=assets.get(won?'uiResultHappyCat':tied?'homeDuelIcon':'uiResultSadCat');
    if(cat&&cat.width) {
        const scale=Math.min(230/cat.width,160/cat.height),cw=cat.width*scale,ch=cat.height*scale;
        ctx.drawImage(cat,cx-cw/2,y+44+(160-ch)/2,cw,ch);
    }
    for(const [sx,label,value,tone] of [[x+18,'我',data.myScore,'pink'],[cx+16,'对手',data.oppScore,'blue']]) {
        const sw=(w-68)/2;
        moon.button(ctx,sx,y+216,sw,58,'',tone);
        ctx.fillStyle=THEME.textDark;
        typography.drawFit(ctx,label,sx+sw/2,y+230,sw-12,{size:11,minSize:9,align:'center'});
        typography.drawFit(ctx,String(value),sx+sw/2,y+252,sw-12,{size:23,minSize:9,weight:'bold',numbers:true,align:'center'});
    }
    ctx.fillStyle=THEME.textDark;typography.drawFit(ctx,'VS',cx,y+245,28,{size:13,minSize:10,weight:'bold',align:'center'});
    if(data.coinReward>0) typography.drawFit(ctx,'奖励 +'+data.coinReward+' 金币',cx,y+294,w-36,{size:16,minSize:10,weight:'bold',numbers:true,align:'center'});
    const by=y+h-68,bw=(w-48)/2;
    moon.button(ctx,x+18,by,bw,48,'再来一局','pink',17);
    moon.button(ctx,x+w-18-bw,by,bw,48,'返回首页','blue',17);
    return {again:{x:x+18,y:by,w:bw,h:48},menu:{x:x+w-18-bw,y:by,w:bw,h:48}};
};

// All effect notices share the reserved HUD line; no stacked banners over tiles.
BattleUI.drawEffects = function (ctx, screen, data) {
    const labels=[];
    if(data.castNotice) labels.push('已释放'+(data.castNotice==='freeze'?'冰冻':'干扰'));
    if(data.frozen) labels.push('冰冻 '+Math.max(1,Math.ceil(Number(data.frozenRemaining)/1000))+'秒');
    if(data.disturb) labels.push('干扰需4连 '+Math.max(1,Math.ceil(Number(data.disturbRemaining)/1000))+'秒');
    if(!labels.length) return;
    const top=Math.max(72,Number(screen.contentTop)||Number(screen.safeTop)||0);
    moon.button(ctx,12,top+66,screen.width-24,24,labels.join(' · '),data.disturb?'pink':'blue',11);
    if((data.frozen||data.disturb)&&['boardX','boardY','boardW','boardH'].every(k=>Number.isFinite(Number(data[k])))) {
        ctx.save();ctx.strokeStyle=data.frozen?'#B7E9FF':'#ECC1DE';ctx.lineWidth=3;
        roundRect(ctx,Number(data.boardX)+1,Number(data.boardY)+1,Number(data.boardW)-2,Number(data.boardH)-2,12);ctx.stroke();ctx.restore();
    }
};

BattleUI.hitTest = function (x, y, btn) {
    if (!btn) return false;
    return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
};

BattleUI.roomDisplayName = roomDisplayName;

module.exports = BattleUI;
