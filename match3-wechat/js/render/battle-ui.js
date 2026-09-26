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

const V3_ITEMS = [
    ['freeze','冰霜冻结','冻结对手3秒'], ['disturb','四连魔咒','5秒需四连'],
    ['reflect','镜面反弹','5秒反弹一次'], ['cheer','猫咪鼓舞','5秒得分×2']
];

function drawWaitV3(ctx, screen, data) {
    const cx=screen.width/2, top=Math.max(72,Number(screen.contentTop)||Number(screen.safeTop)||0);
    const bottom=screen.height-(Number(screen.safeBottom)||0)-12;
    const width=screen.width-32, buttons={};
    drawBg(ctx,screen);
    moon.button(ctx,cx-105,top,210,32,'对战准备','blue',18);
    ctx.fillStyle=THEME.textDark;
    typography.drawFit(ctx,'相遇地点 · '+roomDisplayName(data.roomId),cx,top+44,width-12,{size:12,minSize:9,weight:'bold',align:'center'});
    const roomLine=data.protocolVersion===2?'第 '+data.roundNumber+' 局 · 累计胜场 '+data.myWins+' : '+data.oppWins:'邀请识别码 '+String(data.roomId||'').slice(-6).toUpperCase();
    typography.drawFit(ctx,roomLine,cx,top+59,width-12,{size:10,minSize:8,align:'center',numbers:true});
    const avatarTop=top+67, avatarH=78, gap=10, playerW=(width-gap)/2;
    const awaitingInvite=data.isHost&&!data.oppJoined;
    for(const [index,name,ready,image,key] of [
        [0,data.myName||'我',data.myReady,data.myAvatar,'piece1'],
        [1,data.oppJoined?(data.oppName||'对手'):'等待加入',data.oppReady,null,data.oppJoined?'piece2':'piece5']
    ]) {
        const x=16+index*(playerW+gap), avatarX=x+27, avatarY=avatarTop+39;
        moon.panel(ctx,screen,x,avatarTop,playerW,avatarH);
        drawAvatar(ctx,avatarX,avatarY,22,image,key);
        if(index===0) buttons.avatar={x:avatarX-22,y:avatarY-22,w:44,h:44};
        if(index===1&&awaitingInvite) {
            const invite={x:x+55,y:avatarTop+17,w:playerW-61,h:44};
            const enabled=!data.offline&&!data.actionPending;
            moon.button(ctx,invite.x,invite.y,invite.w,invite.h,'邀请好友',enabled?'pink':'muted',12);
            if(enabled) buttons.invite=invite;
        } else {
            const textX=x+55, textW=playerW-61;
            ctx.fillStyle=THEME.textDark;
            typography.drawFit(ctx,name,textX+textW/2,avatarTop+29,textW,{size:13,minSize:9,weight:'bold',align:'center'});
            typography.drawFit(ctx,index===1&&!data.oppJoined?'等待好友':ready?'已准备':'配置中',textX+textW/2,avatarTop+53,textW,{size:11,minSize:9,align:'center'});
        }
    }
    const configY=avatarTop+86;
    // Keep the complete 2x2 grid and footer within the 320x568 safe area.
    const configH=Math.min(226,Math.max(204,bottom-configY-74));
    moon.panel(ctx,screen,16,configY,width,configH);
    const items=data.items||{};
    const total=V3_ITEMS.reduce((sum,[key])=>sum+(Number(items[key])||0),0);
    const locked=!!(data.myReady||data.actionPending||data.offline);
    ctx.fillStyle=THEME.textDark;
    typography.drawFit(ctx,'对战道具 '+total+'/5 · 剩余 '+Math.max(0,5-total)+(data.myReady?' · 已锁定':''),cx,configY+20,width-20,{size:13,minSize:10,weight:'bold',numbers:true,align:'center'});
    const cellW=(width-24)/2, cellH=(configH-30)/2;
    for(let i=0;i<V3_ITEMS.length;i++) {
        const [key,name,description]=V3_ITEMS[i], col=i%2,row=Math.floor(i/2);
        const x=22+col*(cellW+12), y=configY+28+row*cellH, center=x+cellW/2;
        moon.battleIcon(ctx,key,center-51,y+3,25);
        ctx.fillStyle=THEME.textDark;
        typography.drawFit(ctx,name,center+10,y+17,Math.max(65,cellW-45),{size:12,minSize:10,weight:'bold',align:'center'});
        typography.drawFit(ctx,description,center,y+33,cellW-8,{size:10,minSize:8,align:'center',numbers:true});
        const buttonY=y+cellH-48, count=Number(items[key])||0;
        const minus={x,y:buttonY,w:44,h:44},plus={x:x+cellW-44,y:buttonY,w:44,h:44};
        const canMinus=!locked&&count>0,canPlus=!locked&&total<5;
        moon.button(ctx,minus.x,minus.y,44,44,'−',canMinus?'blue':'muted',21);
        moon.button(ctx,plus.x,plus.y,44,44,'+',canPlus?'pink':'muted',21);
        ctx.fillStyle=THEME.textDark;
        typography.drawFit(ctx,String(count),center,buttonY+28,cellW-92,{size:20,minSize:13,weight:'bold',numbers:true,align:'center'});
        if(canMinus) buttons[key+'Minus']=minus;
        if(canPlus) buttons[key+'Plus']=plus;
    }
    const hintY=configY+configH+13;
    ctx.fillStyle=THEME.textDark;
    const hint=data.offline?(data.pollPending?'正在重连并核对房间状态…':'状态尚未确认，请点击重试连接'):
        data.actionPending?(data.pendingAction==='items'?'正在保存道具配置…':'正在同步准备状态…'):
        total<5?'还需分配 '+(5-total)+' 次额度':awaitingInvite?'邀请好友加入，再一起准备':'双方准备后 3 秒开局';
    typography.drawFit(ctx,hint,cx,hintY,width,{size:11,minSize:9,align:'center',numbers:true});
    const footerY=Math.min(bottom-48,hintY+13),bw=(width-12)/2;
    moon.button(ctx,16,footerY,bw,48,data.actionPending?'同步中…':data.offline?(data.pollPending?'重连中…':'重试连接'):data.myReady?'取消准备':'准备',data.myReady||awaitingInvite||total<5?'blue':'pink',17);
    moon.button(ctx,28+bw,footerY,bw,48,data.isHost?'取消房间':'退出房间','blue',15);
    buttons.ready={x:16,y:footerY,w:bw,h:48};
    buttons.cancel={x:28+bw,y:footerY,w:bw,h:48};
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
        [1,data.oppJoined?(data.oppName||'对手'):'等待加入',data.oppReady,null,data.oppJoined?'piece2':'piece5']
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
        moon.button(ctx,x+12,stateY,playerW-24,24,label,ready?'pink':'muted',11);
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
        moon.battleIcon(ctx,key,pc-40,configY+34,28);
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
    typography.drawFit(ctx,data.offline?(data.pollPending?'正在重连并核对房间状态…':'状态尚未确认，请点击重试连接'):data.actionPending?(data.pendingAction==='items'?'正在保存道具配置…':'正在同步准备状态…'):awaitingInvite?'邀请好友加入，再一起准备':'双方准备后 3 秒开局'+(!data.myAvatar&&data.canChangeAvatar!==false?' · 点头像可更换':''),cx,hintY,width,{size:11,minSize:8,align:'center',numbers:true});
    const footerY=Math.min(bottom-48,hintY+24), gap=12, bw=(width-gap)/2;
    moon.button(ctx,16,footerY,bw,48,data.actionPending?'同步中…':data.offline?(data.pollPending?'重连中…':'重试连接'):data.myReady?'取消准备':'准备',data.myReady||awaitingInvite?'blue':'pink',18);
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
    typography.drawFit(ctx,data.protocolVersion===2?'第 '+data.roundNumber+' 局 · 累计胜场 '+data.myWins+' : '+data.oppWins:'好友对战 · 60秒挑战',cx,top+74,screen.width-32,{size:11,minSize:9,align:'center',numbers:true});
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
 * 对战道具栏（房间配置的四道具；旧房间保持冰冻/干扰）
 * @param data { itemRulesVersion, freeze, disturb, reflect, cheer, cooldownRemaining, active, pending, frozen }
 * @returns { freeze, disturb, reflect?, cheer? } 按钮区域
 */
BattleUI.drawItems = function (ctx, screen, data) {
    if(data.itemRulesVersion===3) {
        const width=screen.width-24,x=12,y=screen.height-(Number(screen.safeBottom)||0)-98;
        moon.panel(ctx,screen,x,y,width,86);
        const cooling=Number(data.cooldownRemaining)>0;
        const pending=!!(data.pending||data.actionPending);
        const status=data.frozen?'冰冻中 · 无法使用道具':pending?'正在确认道具…':cooling?'共享冷却 '+Math.ceil(data.cooldownRemaining/1000)+'秒':data.active?'效果生效中':'对战道具';
        ctx.fillStyle=THEME.textDark;
        typography.drawFit(ctx,status,screen.width/2,y+14,width-20,{size:11,minSize:9,numbers:true,align:'center'});
        const gap=4,cellW=(width-16-3*gap)/4,buttons={};
        for(let i=0;i<V3_ITEMS.length;i++) {
            const [key,name]=V3_ITEMS[i],bx=x+8+i*(cellW+gap),by=y+27;
            const count=Number(data[key])||0,enabled=count>0&&!data.active&&!cooling&&!pending&&!data.frozen;
            moon.button(ctx,bx,by,cellW,52,'',enabled?(key==='freeze'||key==='reflect'?'blue':'pink'):'muted');
            ctx.save();ctx.globalAlpha=enabled?1:.5;moon.battleIcon(ctx,key,bx+8,by+5,22);ctx.restore();
            ctx.fillStyle=THEME.textDark;
            typography.drawFit(ctx,count>0?'×'+count:'用尽',bx+cellW-20,by+19,cellW-38,{size:12,minSize:10,weight:'bold',numbers:count>0,align:'center'});
            typography.drawFit(ctx,name,bx+cellW/2,by+41,cellW-8,{size:11,minSize:10,weight:'bold',align:'center'});
            buttons[key]={x:bx,y:by,w:cellW,h:52};
        }
        return buttons;
    }
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
    const w=Math.min(346,screen.width-32), h=414;
    const safeTop=Math.max(72,Number(screen.contentTop)||Number(screen.safeTop)||0)+18;
    const y=Math.max(safeTop,Math.min((screen.height-h)/2,screen.height-(Number(screen.safeBottom)||0)-h-16)),x=cx-w/2;
    moon.panel(ctx,screen,x,y,w,h);
    const won=data.result==='win', tied=data.result==='draw';
    moon.button(ctx,cx-110,y-12,220,44,won?'对战胜利':tied?'平局':'对战失败',won?'pink':'blue',24);
    const cat=assets.get(won?'uiResultHappyCat':tied?'homeDuelIcon':'uiResultSadCat');
    if(cat&&cat.width) {
        const scale=Math.min(210/cat.width,128/cat.height),cw=cat.width*scale,ch=cat.height*scale;
        ctx.drawImage(cat,cx-cw/2,y+38+(128-ch)/2,cw,ch);
    }
    for(const [sx,label,value,tone] of [[x+18,'我',data.myScore,'pink'],[cx+16,'对手',data.oppScore,'blue']]) {
        const sw=(w-68)/2;
        moon.button(ctx,sx,y+190,sw,58,'',tone);
        ctx.fillStyle=THEME.textDark;
        typography.drawFit(ctx,label,sx+sw/2,y+204,sw-12,{size:11,minSize:9,align:'center'});
        typography.drawFit(ctx,String(value),sx+sw/2,y+226,sw-12,{size:23,minSize:9,weight:'bold',numbers:true,align:'center'});
    }
    ctx.fillStyle=THEME.textDark;typography.drawFit(ctx,'VS',cx,y+219,28,{size:13,minSize:10,weight:'bold',align:'center'});
    if(data.protocolVersion===2) typography.drawFit(ctx,'第 '+data.roundNumber+' 局 · 累计胜场 '+data.myWins+' : '+data.oppWins,cx,y+174,w-36,{size:13,minSize:10,weight:'bold',numbers:true,align:'center'});
    const rewardLabel=data.rewardPending?'金币待保存 · 点击重试':'奖励 +'+(data.coinReward||0)+' 金币';
    typography.drawFit(ctx,rewardLabel,cx,y+274,w-36,{size:15,minSize:10,weight:'bold',numbers:!data.rewardPending,align:'center'});
    let label='再来一局', status='双方确认后，再次配置道具并准备';
    if(data.protocolVersion!==2) { label='重新邀请'; status='邀请好友，开启新房间'; }
    else if(data.expired) { label='重新邀请'; status='房间已失效，可以重新邀请好友'; }
    else if(data.oppLeft) { label='重新邀请'; status='好友已离开，可以重新邀请'; }
    else if(data.offline) { label='重试连接'; status='连接暂时中断，正在同步房间'; }
    else if(data.myRematch) { label='取消等待'; status=data.oppOnline?'已确认 · 等待好友再来一局':'已确认 · 等待好友回到房间'; }
    else if(data.oppRematch) status='好友想再来一局，等你确认';
    else if(!data.oppOnline) status='好友暂时离线，回来后可继续';
    if(data.actionPending) label='同步中…';
    ctx.fillStyle=THEME.textMid;
    typography.drawFit(ctx,status,cx,y+315,w-28,{size:12,minSize:9,align:'center'});
    const by=y+h-68,bw=(w-48)/2;
    moon.button(ctx,x+18,by,bw,48,label,data.actionPending?'muted':'pink',17);
    moon.button(ctx,x+w-18-bw,by,bw,48,'返回首页','blue',17);
    const buttons = {again:{x:x+18,y:by,w:bw,h:48},menu:{x:x+w-18-bw,y:by,w:bw,h:48}};
    if(data.rewardPending) buttons.reward={x:x+18,y:y+252,w:w-36,h:44};
    if(data.retentionMessage)typography.drawFit(ctx,data.retentionMessage,cx,y+h-9,w-30,{size:9,minSize:9,align:'center'});
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
        // Persistent states sit on the upper rim; the board center stays playable.
        const badges=[];
        if(data.disturb) badges.push(['干扰中 · 需要4连 · '+seconds(data.disturbRemaining)+'秒','pink']);
        if(reflect) badges.push(['镜面反弹 '+seconds(data.reflectRemaining)+'秒','blue']);
        if(cheer) badges.push(['鼓舞×2 '+seconds(data.cheerRemaining)+'秒','pink']);
        const gap=3,badgeW=Math.min(220,(w-12-(badges.length-1)*gap)/badges.length);
        const start=cx-(badges.length*badgeW+(badges.length-1)*gap)/2;
        badges.forEach(([label,tone],index)=>moon.button(ctx,start+index*(badgeW+gap),y-14,badgeW,26,label,tone,badges.length>1?10:13));
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
