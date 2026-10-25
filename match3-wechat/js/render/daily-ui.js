/** 每日详情样板：沿用正式月光组件，所有文字/交互均为Canvas原生。 */
const assets = require('./assets');
const theme = require('./theme');
const type = require('./typography');
const moon = require('./moon-controls');
const art = require('./illustration-art');
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
    const cx=screen.width/2, top=Math.max(72,screen.contentTop||screen.safeTop||0);
    const bottom=screen.height-(screen.safeBottom||0)-24;
    const compact=bottom-top<530,w=Math.min(370,screen.width-24),x=cx-w/2;
    const titleH=compact?32:42,titleW=Math.min(w-72,272);
    art.scene(ctx,screen);
    type.drawDisplay(ctx,'每日猫咪挑战',cx-12,top+titleH/2,titleW,compact?24:30);
    const bh=compact?44:52,bw=w*.72,by=bottom-bh;
    const cardY=top+(compact?42:58),cardH=by-12-cardY;
    const buttons={back:{x:screen.width-52,y:top,w:44,h:44}};
    const skin=assets.get('dailyInvitation');
    // Keep cats and corner flowers proportional. Long cards extend the empty
    // band below the pendants; short cards only compress the pendant section.
    // Content can use the clear centre beside the flowers, so its bottom inset
    // is smaller than the protected decorative footer.
    const scale=w/1122,capTop=530*scale,capBottom=170*scale;
    if(skin&&skin.width){
        const footerH=400*scale,middleH=cardH-capTop-footerH;
        const pendantH=Math.min(430*scale,middleH),quietH=middleH-pendantH;
        const slice=(from,to,y,h)=>ctx.drawImage(skin,0,skin.height*from/1402,skin.width,skin.height*(to-from)/1402,x,y,w,h);
        slice(0,530,cardY,capTop);
        slice(530,960,cardY+capTop,pendantH);
        if(quietH>0)slice(960,1002,cardY+capTop+pendantH,quietH);
        slice(1002,1402,cardY+cardH-footerH,footerH);
    }else{
        art.paperFrame(ctx,x,cardY,w,cardH);
        contain(ctx,assets.get('uiIllustrationHeaderCat'),cx-w*.30,cardY,w*.60,capTop);
    }
    const bodyTop=cardY+capTop,bodyH=cardH-capTop-capBottom;
    const innerW=w*.73,challenge=data.challenge,claimed=!!data.claimed;
    const target=challenge?challenge.target:dailyRules.target,reward=challenge?challenge.reward:dailyRules.reward;
    text(ctx,dailyRules.moveCount+'步内达到'+target+'分',cx,bodyTop+bodyH*.08,innerW,compact?18:23,true,true);
    const ribbonY=bodyTop+bodyH*.26;
    ribbon(ctx,cx,ribbonY,Math.min(innerW-16,196),compact?23:29);
    ctx.fillStyle='#77532E';
    type.drawFit(ctx,claimed?'今日奖励已领取':data.pending?'奖励待确认':'达标奖励',cx,ribbonY,innerW-30,{size:compact?12:14,minSize:11,align:'center',weight:'bold'});
    const coins=assets.get('uiIllustrationCoins')||assets.get('uiCoin');
    if(compact){
        contain(ctx,coins,cx-83,bodyTop+bodyH*.38,65,40);
        text(ctx,reward+' 金币',cx+27,bodyTop+bodyH*.52,innerW-68,23,true,true);
    }else{
        contain(ctx,coins,cx-58,bodyTop+bodyH*.35,116,bodyH*.24);
        text(ctx,reward+'金币',cx,bodyTop+bodyH*.64,innerW,30,true,true);
    }
    const recordY=bodyTop+bodyH*(compact?.72:.77);
    if(!compact)art.rule(ctx,cx-innerW*.36,recordY-20,innerW*.72);
    ctx.fillStyle='#666390';type.drawFit(ctx,'今日成绩  '+(data.best?String(data.best)+' 分':'—'),cx,recordY,innerW-12,{size:compact?12:14,minSize:11,align:'center',numbers:true});

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
    text(ctx,data.retentionMessage||'每日一局 · 不耗体力 · 不限时',cx,bodyTop+bodyH*(compact?.85:.88),innerW,11,false);
    if(status) text(ctx,status,cx,bodyTop+bodyH*.98,innerW,10,false);
    invitationButton(ctx,cx-bw/2,by,bw,bh,label,active);
    art.blossom(ctx,cx-bw/2+1,by+bh*.60,compact?15:22);art.blossom(ctx,cx+bw/2-1,by+bh*.60,compact?15:22);
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
    art.decoratedButton(ctx,x,y,w,h,label,active?'pink':'muted',23);
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
