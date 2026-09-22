/** 每日详情样板：沿用正式月光组件，所有文字/交互均为Canvas原生。 */
const assets = require('./assets');
const theme = require('./theme');
const type = require('./typography');
const moon = require('./moon-controls');
const dailyRules = require('../core/daily-challenge').DAILY_RULES;

function text(ctx, value, x, y, width, size, bold, numbers) {
    ctx.fillStyle = theme.textDark;
    type.drawFit(ctx, String(value), x, y, width, {
        size, minSize: 10, weight: bold ? 'bold' : 'normal', align: 'center', numbers: !!numbers
    });
}
function background(ctx, screen, assetKey) {
    const image = assets.get(assetKey || 'gameBackground');
    if (image && image.width) {
        const scale = Math.max(screen.width / image.width, screen.height / image.height);
        const w = screen.width / scale, h = screen.height / scale;
        ctx.drawImage(image, (image.width-w)/2, (image.height-h)/2, w, h, 0, 0, screen.width, screen.height);
    } else { ctx.fillStyle = theme.bgMid; ctx.fillRect(0,0,screen.width,screen.height); }
}
// Accepted invitation: decorative skin only; every value, label and hitbox stays native.
function drawDetail(ctx, screen, data) {
    // Main paints the live home underneath; this state consumes touches before menu.
    ctx.fillStyle='rgba(24,31,63,.60)';ctx.fillRect(0,0,screen.width,screen.height);
    const cx=screen.width/2, top=Math.max(72,screen.contentTop||screen.safeTop||0);
    const compact=screen.height-top-(screen.safeBottom||0)<530;
    const w=Math.min(358,screen.width-40), x=cx-w/2;
    const available=screen.height-(screen.safeBottom||0)-24-top;
    const cardH=Math.min(550,w*1.65,available),cardY=top+(available-cardH)/2;
    const bh=compact?44:48,bw=w*.65;
    const buttons={back:{x:x+w-40,y:cardY,w:44,h:44}};
    const skin=assets.get('dailyInvitation');
    // Three vertical bands preserve the cats/moon and bottom filigree while the quiet
    // middle stretches. Only the blank paper/side ribbon band changes height.
    const scale=w/1122, capTop=530*scale, capBottom=170*scale;
    if(skin&&skin.width) {
        const ih=skin.height, cut1=ih*530/1402, cut2=ih*1232/1402;
        ctx.drawImage(skin,0,0,skin.width,cut1,x,cardY,w,capTop);
        ctx.drawImage(skin,0,cut1,skin.width,cut2-cut1,x,cardY+capTop,w,cardH-capTop-capBottom);
        ctx.drawImage(skin,0,cut2,skin.width,ih-cut2,x,cardY+cardH-capBottom,w,capBottom);
    } else {
        moon.panel(ctx,screen,x,cardY+capTop*.6,w,cardH-capTop*.6);
    }
    const bodyTop=cardY+capTop, bodyH=cardH-capTop-capBottom;
    const innerW=w*.73, challenge=data.challenge, claimed=!!data.claimed;
    const target=challenge?challenge.target:dailyRules.target;
    const reward=challenge?challenge.reward:dailyRules.reward;
    const by=bodyTop+bodyH-(compact?10:12)-bh;
    text(ctx,dailyRules.moveCount+'步内达到'+target+'分',cx,bodyTop+(compact?22:26),innerW,compact?19:22,true,true);
    const ribbonY=bodyTop+(compact?53:62);
    ribbon(ctx,cx,ribbonY,Math.min(innerW-16,196),compact?23:29);
    ctx.fillStyle='#77532E';
    type.drawFit(ctx,claimed?'今日奖励已领取':data.pending?'奖励待确认':'达标奖励',cx,ribbonY,innerW-30,{size:compact?12:14,minSize:11,align:'center',weight:'bold'});
    if(compact) {
        contain(ctx,assets.get('uiCoin'),cx-65,bodyTop+75,36,36);
        text(ctx,reward+' 金币',cx+19,bodyTop+93,innerW-54,22,true,true);
    } else {
        const coinY=bodyTop+88;
        contain(ctx,assets.get('uiCoin'),cx-49,coinY+13,36,36);
        contain(ctx,assets.get('uiCoin'),cx+14,coinY+16,36,36);
        contain(ctx,assets.get('uiCoin'),cx-26,coinY,52,52);
        text(ctx,reward+'金币',cx,bodyTop+164,innerW,28,true,true);
    }
    const recordY=by-70;
    ctx.fillStyle='#666390';
    type.drawFit(ctx,'今日成绩  '+(data.best?String(data.best)+' 分':'—'),cx,recordY,innerW-12,{size:compact?12:14,minSize:11,align:'center',numbers:true});

    let status=data.lastCompleted&&challenge&&data.lastCompleted.date!==challenge.date
        ? data.lastCompleted.date.slice(5).replace('-','.')+' 成绩 '+data.lastCompleted.score+' 已记录'
        : data.completed?'今日挑战已完成，明日再来':data.active?'上次进度已保存，继续同一局':'';
    let label='开始挑战', active=true;
    if(data.loading){status='正在获取今日挑战…';label='加载中…';active=false;}
    else if(data.error){status=data.error;label=data.pendingUnavailable||data.activeUnavailable?'处理记录':'重试';}
    else if(data.pending){status='上次成绩待确认，请联网重试';label='确认成绩';}
    else if(data.starting){status='正在准备棋盘…';label='准备中…';active=false;}
    else if(data.active||data.attempted&&!data.completed)label='继续挑战';
    else if(data.completed||claimed){label='今日已完成';active=false;}
    else if(!challenge){status='正在获取今日挑战…';label='加载中…';active=false;}
    // Rules, recovery message and primary action all stay inside the invitation.
    text(ctx,'每日一局 · 不耗体力 · 不限时',cx,by-44,innerW,11,false);
    if(status) text(ctx,status,cx,by-22,innerW,10,false);
    invitationButton(ctx,cx-bw/2,by,bw,bh,label,active);
    if(active)buttons.start={x:cx-bw/2,y:by,w:bw,h:bh};
    const close=buttons.back;
    moon.button(ctx,close.x,close.y,close.w,close.h,'','blue');
    ctx.fillStyle='#62678A';
    type.drawCentered(ctx,'×',close.x,close.y,close.w,close.h,{size:26,minSize:26,weight:'500'});
    return buttons;
}
function ribbon(ctx,cx,y,w,h) {
    ctx.save();ctx.fillStyle='#D9AC60';
    for(const sign of [-1,1]) {
        ctx.beginPath();ctx.moveTo(cx+sign*(w/2-8),y-h*.27);ctx.lineTo(cx+sign*(w/2+13),y-h*.3);
        ctx.lineTo(cx+sign*(w/2+7),y+h*.18);ctx.lineTo(cx+sign*(w/2+15),y+h*.6);
        ctx.lineTo(cx+sign*(w/2-8),y+h*.48);ctx.closePath();ctx.fill();
    }
    const g=ctx.createLinearGradient(cx-w/2,y,cx+w/2,y);
    g.addColorStop(0,'#E6B560');g.addColorStop(.25,'#FFF1BC');g.addColorStop(.75,'#FFE6A3');g.addColorStop(1,'#E6B560');
    ctx.fillStyle=g;rounded(ctx,cx-w/2,y-h/2,w,h,4);ctx.fill();ctx.strokeStyle='#FFF5D4';ctx.lineWidth=1;ctx.stroke();ctx.restore();
}
function invitationButton(ctx,x,y,w,h,label,active) {
    moon.button(ctx,x,y,w,h,label,active?'blue':'muted',23);
    ctx.save();ctx.strokeStyle=active?'#CDBA97':'#C1C6D8';ctx.lineWidth=1.2;
    rounded(ctx,x,y,w,h,h/2);ctx.stroke();ctx.restore();
}
function rounded(ctx,x,y,w,h,r) {
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function contain(ctx,image,x,y,w,h) {
    if(!image||!image.width)return;
    const scale=Math.min(w/image.width,h/image.height),dw=image.width*scale,dh=image.height*scale;
    ctx.drawImage(image,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
}
function drawPlaying(ctx,screen,core,challenge,data) {
    const cx=screen.width/2,top=Math.max(72,screen.contentTop||screen.safeTop||0);
    const w=screen.width-32;
    moon.panel(ctx,screen,16,top,w,80);
    text(ctx,'每日挑战 · '+challenge.date,cx,top+17,w-20,12,false,true);
    text(ctx,'剩余 '+core.movesLeft+' 步',screen.width*.28,top+49,w/2-12,21,true,true);
    text(ctx,core.score+' / '+challenge.target,screen.width*.72,top+49,w/2-12,19,true,true);
    const by=screen.height-(screen.safeBottom||0)-66;
    moon.button(ctx,cx-75,by,150,44,data&&data.syncing?'正在同步…':'暂存离开',data&&data.syncing?'muted':'blue',15);
    return data&&data.syncing?{}:{back:{x:cx-75,y:by,w:150,h:44}};
}
module.exports = { drawDetail, drawPlaying };
