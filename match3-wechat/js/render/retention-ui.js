/** Accepted Daily Coins concept, assembled from editable Canvas controls and existing art. */
const assets = require('./assets');
const type = require('./typography');
const art = require('./illustration-art');

const SIGN_REWARDS = [100, 100, 150, 100, 100, 150, 200];
const WEEKLY = [{ at: 200, coins: 300 }, { at: 350, coins: 500 }, { at: 500, coins: 1000 }];
const TASKS = [
    { title: '完成1局游戏', goal: 1, coins: 40, points: 20 },
    { title: '累计完成2局游戏', goal: 2, coins: 60, points: 30 },
    { title: '累计消除80枚棋子', goal: 80, coins: 60, points: 30 }
];
const INK = '#34355E', SOFT = '#746079', GOLD = '#D9BA87';
const SERIF = '"Songti SC","SongtiSC","STSong","Noto Serif CJK SC","NotoSerifCJKSC",Georgia,serif';
const SIGN_CARD_HEIGHT = 76, SIGN_HEIGHT = 298, WEEKLY_HEIGHT = 140;
const TASK_CARD_HEIGHT = 72, TASK_CARD_GAP = 8, TASK_TOP = 8, TASK_FOOTER = 52;
function progressKnown(data) { return !data.real || !!data.loaded || data.status==='ready'; }

function rect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function text(ctx, value, x, y, w, size, color, bold) {
    ctx.fillStyle = color || INK;
    type.drawFit(ctx, value, x, y, w, {size, minSize: Math.max(10,size - 1), align:'center', weight:bold?'bold':'500', family:SERIF});
}
function contain(ctx, key, x, y, w, h) {
    const img = assets.get(key);
    if (!img || !img.width || !img.height) return false;
    const s = Math.min(w/img.width,h/img.height), dw=img.width*s, dh=img.height*s;
    ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
    return true;
}
function gradient(ctx, x, y, h, colors) {
    const g=ctx.createLinearGradient(x,y,x,y+h);
    colors.forEach((c,i)=>g.addColorStop(i/(colors.length-1),c));return g;
}
function star(ctx,x,y,r) {
    ctx.save();ctx.fillStyle='#FBE3A3';ctx.strokeStyle=GOLD;ctx.lineWidth=.7;
    ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,d=i%2?r*.45:r;
        const px=x+Math.cos(a)*d,py=y+Math.sin(a)*d;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}
    ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function catCard(ctx, screen, x,y,w,h, active) {
    art.card(ctx,x,y,w,h,active);
}
function ribbonButton(ctx, r, label, enabled, pink) {
    art.button(ctx,r.x,r.y,r.w,r.h,label,enabled?(pink?'pink':'blue'):'muted',20);
    if(r.w>190){
        const tone=enabled?(pink?'pink':'blue'):'muted';
        art.pawSeal(ctx,r.x+23,r.y+r.h/2,17,tone);art.pawSeal(ctx,r.x+r.w-23,r.y+r.h/2,17,tone);
        art.blossom(ctx,r.x-3,r.y+r.h*.70,22);art.blossom(ctx,r.x+r.w+3,r.y+r.h*.70,22);
    }
}
function claimedRibbon(ctx,x,y,w) {
    ctx.save();ctx.fillStyle='#DE5B9A';ctx.strokeStyle='#E3B16B';ctx.lineWidth=.8;
    ctx.beginPath();ctx.moveTo(x-4,y+2);ctx.lineTo(x+w+4,y+2);ctx.lineTo(x+w,y+9);
    ctx.lineTo(x+w+4,y+16);ctx.lineTo(x-4,y+16);ctx.lineTo(x,y+9);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle=gradient(ctx,x,y,17,['#FF9EC9','#EF609F']);rect(ctx,x+2,y,w-4,17,5);ctx.fill();
    ctx.strokeStyle='#FFE8B4';ctx.stroke();
    text(ctx,'已领',x+w/2,y+8.5,w-10,11,'#FFFFFF',true);ctx.restore();
}

function chest(ctx,x,y,size,index,opened) {
    if(!art.drawChest(ctx,index,x,y,size)) {
        // A missing optional illustration keeps the reward identifiable and usable.
        contain(ctx,'uiCoin',x+size*.2,y+size*.15,size*.6,size*.65);
        text(ctx,'宝箱',x+size/2,y+size*.8,size,12,INK,true);
    }
    if(opened){
        ctx.save();ctx.fillStyle='#44766E';ctx.beginPath();ctx.arc(x+size-9,y+12,9,0,Math.PI*2);ctx.fill();
        ctx.strokeStyle='#FFFFFF';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+size-13,y+12);ctx.lineTo(x+size-10,y+15);ctx.lineTo(x+size-5,y+8);ctx.stroke();ctx.restore();
    }
}

function layout(screen) {
    const w=Math.min(396,screen.width-20),x=(screen.width-w)/2;
    const top=Math.max(12,(screen.safeTop||0)+4,(screen.contentTop||0)-58);
    const close={x:x+w-50,y:Math.max(top+32,(screen.contentTop||0)+1),w:44,h:44};
    // The heading is wholly above the paper, so neither its gilt edge nor close can cross the glyphs.
    const titleY=close.y+close.h+20,subtitleY=titleY+25,frameY=subtitleY-1;
    const tabsY=frameY+w*.13-22;
    const innerX=x+w*.08,innerW=w*.84;
    const viewportY=Math.max(tabsY+50,frameY+w*.24+6);
    const contentHeight=Math.max(SIGN_HEIGHT,TASK_TOP+(TASK_CARD_HEIGHT+TASK_CARD_GAP)*TASKS.length+TASK_FOOTER)+WEEKLY_HEIGHT;
    const bottom=Math.min(screen.height-(screen.safeBottom||0)-12,viewportY+contentHeight+w*.22+2);
    const compact=bottom-top<610;
    const viewport={x:innerX-2,y:viewportY,w:innerW+4,h:Math.max(60,bottom-w*.22-viewportY)};
    return {x,w,top,bottom,titleY,subtitleY,frameY,tabsY,innerX,innerW,viewport,compact,close};
}

function frame(ctx,screen,l,data) {
    art.paperFrame(ctx,l.x,l.frameY,l.w,l.bottom-l.frameY);
    if(!contain(ctx,'uiIllustrationHeaderCat',l.x+2,l.top+30,l.w*.54,l.frameY-l.top+7)&&!contain(ctx,'uiResultWinMoon',l.x+2,l.top+5,l.w*.49,l.frameY-l.top))
        contain(ctx,'uiResultHappyCat',l.x+4,l.top+16,l.w*.47,l.frameY-l.top-12);
    const titleX=l.x+l.w*.72,titleW=l.w*.43;
    text(ctx,'每日金币',titleX,l.titleY,titleW,l.w<330?24:28,'#FFE9B2',true);
    text(ctx,data.tab==='tasks'?'完成任务领金币':'签到领好礼',titleX,l.subtitleY,titleW,12,'#FFF2D9');
}

function drawSign(ctx,screen,l,data,y,buttons) {
    const x=l.innerX,w=l.innerW,gap=9,cw=(w-gap*2)/3,ch=SIGN_CARD_HEIGHT;
    const known=progressKnown(data);
    y+=8;
    for(let i=0;i<6;i++){
        const px=x+(i%3)*(cw+gap),py=y+Math.floor(i/3)*(ch+10);
        const past=known&&(i+1<data.signDay || (i+1===data.signDay&&data.signed));
        catCard(ctx,screen,px,py,cw,ch,data.status==='ready'&&!data.signed&&i+1===data.signDay);
        text(ctx,'第'+(i+1)+'天',px+cw/2,py+14,cw-8,12,INK,true);
        if(!contain(ctx,'uiIllustrationCoins',px+cw/2-27,py+20,54,33))contain(ctx,'uiCoin',px+cw/2-22,py+22,44,24);
        text(ctx,String(SIGN_REWARDS[i]),px+cw/2,py+(past?52:62),cw-12,13,INK,true);
        if(past)claimedRibbon(ctx,px+10,py+ch-16,cw-20);
    }
    y+=ch*2+20;
    const seventhH=58;
    catCard(ctx,screen,x,y,w,seventhH,data.signDay===7&&!data.signed);
    text(ctx,'第7天',x+w*.13,y+19,w*.25,13,'#83394F',true);
    if(!contain(ctx,'uiIllustrationCoins',x+w*.15,y+24,w*.24,34))contain(ctx,'uiCoin',x+w*.19,y+26,39,28);
    if(!contain(ctx,'uiIllustrationDay7Cat',x+w*.30,y-6,w*.36,65)){
        contain(ctx,'uiResultHappyCat',x+w*.30,y+1,w*.26,58);
        if(!art.drawItem(ctx,'hammer',x+w*.49,y+4,48))contain(ctx,'uiToolHammer',x+w*.49,y+4,48,48);
    }
    text(ctx,'200金币',x+w*.80,y+20,w*.34,14,'#83394F',true);
    text(ctx,'锤子×1',x+w*.80,y+42,w*.34,12,'#83394F',true);
    if(data.signDay===7&&data.signed)claimedRibbon(ctx,x+8,y+37,w*.23);
    y+=seventhH+8;
    const primary={x:x+8,y,w:w-16,h:44};
    ribbonButton(ctx,primary,data.pendingAction==='primary'?'领取中…':!known?'同步中…':data.signed?'今日已领取':'领取今日金币',data.status==='ready'&&!data.signed,true);
    if(!data.signed)buttons.primary=primary;
    return y+52;
}

function drawTasks(ctx,screen,l,data,y,buttons) {
    const x=l.innerX,w=l.innerW,h=TASK_CARD_HEIGHT;
    const known=progressKnown(data);
    y+=TASK_TOP;
    TASKS.forEach((task,i)=>{
        catCard(ctx,screen,x,y,w,h,false);
        const done=known?Math.min(task.goal,Math.max(0,data.taskProgress[i]||0)):0;
        const claimed=known&&!!(data.taskClaimed&&data.taskClaimed[i]);
        const eligible=done>=task.goal&&!claimed&&data.taskClaimMode==='manual-v1';
        const ready=eligible&&data.status==='ready';
        const tx=x+52,tw=w-128;
        if(!art.drawItem(ctx,['cheer','reflect','color'][i],x+4,y+15,44))
            contain(ctx,i===2?'piece3':'uiCoin',x+8,y+19,36,36);
        ctx.fillStyle=INK;type.drawFit(ctx,task.title,tx,y+16,tw,{size:l.compact?12:14,minSize:12,weight:'bold',family:SERIF});
        const barY=y+31,barW=tw,barH=14;
        ctx.fillStyle='#DBD1DC';rect(ctx,tx,barY,barW,barH,7);ctx.fill();
        if(done){ctx.fillStyle=gradient(ctx,tx,barY,barH,ready?['#FF9BC7','#F45D9E']:['#ADBEFF','#879DE4']);rect(ctx,tx,barY,Math.max(barH,barW*done/task.goal),barH,7);ctx.fill();}
        text(ctx,(data.real&&!data.loaded&&data.status!=='ready'?'—':done)+'/'+task.goal,tx+barW/2,barY+barH/2,barW-8,11,INK,true);
        ctx.fillStyle='#83394F';type.drawFit(ctx,task.coins+'金币 · '+task.points+'活跃',tx,y+58,tw,{size:12,minSize:11,family:SERIF});
        const claim={x:x+w-70,y:y+14,w:64,h:44};
        art.button(ctx,claim.x,claim.y,claim.w,claim.h,!known?'同步中':data.pendingAction==='task'+i?'领取中':claimed?'已领':eligible?'领取':'未完成',ready?'pink':'muted',14);
        if(ready)buttons['task'+i]=claim;
        y+=h+TASK_CARD_GAP;
    });
    const primary={x:x+8,y:y+2,w:w-16,h:44};ribbonButton(ctx,primary,'去玩一局',true,true);buttons.primary=primary;
    return y+TASK_FOOTER;
}

function drawWeekly(ctx,screen,l,data,y,buttons) {
    const x=l.innerX,w=l.innerW;
    const known=progressKnown(data);
    art.rule(ctx,x+4,y,w-8);
    ctx.fillStyle=INK;type.drawFit(ctx,'每周宝箱',x+2,y+15,92,{size:16,minSize:14,weight:'bold',family:SERIF});
    type.drawFit(ctx,'本周活跃 '+(data.real&&!data.loaded&&data.status!=='ready'?'—':data.activity)+'/500',x+w-2,y+15,w-102,{size:11,minSize:10,align:'right',family:SERIF});
    const barX=x+9,barW=w-18,barY=y+66;
    ctx.save();ctx.fillStyle='#C5BFD3';rect(ctx,barX,barY,barW,8,4);ctx.fill();
    ctx.strokeStyle='#FFF9E8';ctx.lineWidth=1.5;ctx.stroke();
    if(known&&data.activity>0){ctx.fillStyle=gradient(ctx,barX,barY,8,['#FFE59C','#E4B65E']);rect(ctx,barX,barY,Math.max(8,barW*Math.min(1,data.activity/500)),8,4);ctx.fill();}
    ctx.restore();
    for(let i=0;i<3;i++){
        const cellW=w/3,cx=x+cellW*(i+.5),opened=known&&!!data.claimed[i],ready=known&&data.activity>=WEEKLY[i].at&&!opened;
        const size=Math.min(62,cellW-12);
        if(ready){ctx.save();ctx.fillStyle='rgba(251,218,151,.32)';ctx.beginPath();ctx.ellipse(cx,y+59,cellW*.43,29,0,0,Math.PI*2);ctx.fill();ctx.restore();}
        chest(ctx,cx-size/2,y+26,size,i,opened);
        text(ctx,WEEKLY[i].at+'活跃',cx,y+98,cellW-4,11,INK);
        text(ctx,WEEKLY[i].coins+'金币',cx,y+114,cellW-4,12,'#83394F',true);
        text(ctx,!known?'同步中':opened?'已领取':ready?'点击领取':'待解锁',cx,y+130,cellW-4,11,ready?'#9A5735':SOFT,ready);
        if(ready)buttons['weekly'+i]={x:x+cellW*i+2,y:y+26,w:cellW-4,h:111};
    }
    if(data.previousWeek){
        const py=y+WEEKLY_HEIGHT+4,cw=(w-12)/3;
        text(ctx,'上周待领',x+w/2,py+12,w,11,SOFT,true);
        WEEKLY.forEach((reward,i)=>{
            const claimed=!!data.previousWeek.claimed[i],available=!!data.previousWeek.available[i];
            const r={x:x+i*(cw+6),y:py+29,w:cw,h:44};
            art.button(ctx,r.x,r.y,r.w,r.h,claimed?'已领取':available?reward.coins+'金币':'未达标',available&&!claimed?'pink':'muted',11);
            if(available&&!claimed)buttons['previous'+i]=r;
        });
        return py+84;
    }
    return y+WEEKLY_HEIGHT;
}

function drawStatus(ctx,screen,l,data,y,buttons) {
    const messages={loading:['猫咪正在整理金币','正在加载，请稍候…'],offline:['网络连接暂时失败','请检查网络后重试'],error:['暂时无法同步每日金币','可以重试，也可以先关闭页面'],pending:['奖励还在确认中','确认后会自动更新领取状态']};
    const value=messages[data.status]||messages.error;
    const short=l.viewport.h<280;
    const height=short?Math.min(210,l.viewport.h):280;
    contain(ctx,'uiResultSadCat',l.innerX+l.innerW/2-(short?39:52),y+(short?8:24),short?78:104,short?68:92);
    text(ctx,value[0],l.innerX+l.innerW/2,y+(short?86:137),l.innerW,short?16:18,INK,true);
    text(ctx,data.message||value[1],l.innerX+l.innerW/2,y+(short?108:168),l.innerW,11,SOFT);
    if(data.diagnostic)text(ctx,'诊断：'+data.diagnostic,l.innerX+l.innerW/2,y+(short?128:188),l.innerW,10,SOFT);
    const r={x:l.innerX+20,y:y+(short?height-50:203),w:l.innerW-40,h:46};
    const retry=data.status==='offline'||data.status==='error'||(data.real&&data.status==='pending');
    ribbonButton(ctx,r,retry?'重试':data.status==='loading'?'加载中…':'待同步',retry,true);
    if(retry)buttons.primary=r;
    return y+height;
}

function draw(ctx,screen,data) {
    const l=layout(screen),buttons={};
    ctx.save();ctx.shadowColor='transparent';ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;
    art.scene(ctx,screen);
    frame(ctx,screen,l,data);
    const close=l.close;
    art.button(ctx,close.x,close.y,44,44,'×','blue',27);buttons.close=close;
    const tw=(l.innerW-6)/2;
    [['signinTab','七日签到','signin'],['tasksTab','每日任务','tasks']].forEach((tab,i)=>{
        const r={x:l.innerX+i*(tw+6),y:l.tabsY,w:tw,h:44};
        art.button(ctx,r.x,r.y,r.w,r.h,tab[1],data.tab===tab[2]?'pink':'cream',17);buttons[tab[0]]=r;
        if(tab[2]==='tasks'&&data.status==='ready'&&data.taskClaimMode==='manual-v1'&&
            TASKS.some((task,index)=>data.taskProgress[index]>=task.goal&&!data.taskClaimed[index])){
            ctx.save();ctx.fillStyle='#F5222D';
            ctx.beginPath();ctx.arc(r.x+r.w-12,r.y+9,6,0,Math.PI*2);ctx.fill();ctx.restore();
        }
    });
    const viewport=l.viewport;
    // Content uses its own scroll plane; header/tabs/close never move.
    const tasksHeight=TASK_TOP+(TASK_CARD_HEIGHT+TASK_CARD_GAP)*TASKS.length+TASK_FOOTER;
    const failed=data.status==='offline'||data.status==='error'||(data.status==='pending'&&!data.busy);
    const naturalH=failed?(viewport.h<280?Math.min(210,viewport.h):280):(data.tab==='tasks'?tasksHeight:SIGN_HEIGHT)+WEEKLY_HEIGHT+(data.previousWeek?88:0);
    const maxScroll=Math.max(0,naturalH-viewport.h);
    const offset=Math.max(0,Math.min(maxScroll,data.offset||0));
    ctx.save();ctx.beginPath();ctx.rect(viewport.x,viewport.y,viewport.w,viewport.h);ctx.clip();
    const y=viewport.y-offset;
    if(failed)drawStatus(ctx,screen,l,data,y,buttons);
    else {
        const end=data.tab==='tasks'?drawTasks(ctx,screen,l,data,y,buttons):drawSign(ctx,screen,l,data,y,buttons);
        drawWeekly(ctx,screen,l,data,end,buttons);
    }
    ctx.restore();
    if(!failed&&data.status!=='ready'){
        // Keep the same paper, tab and scroll plane while only reward actions wait.
        // No cached state is a loading shell, never a promise of eligibility.
        for(const key of ['primary','task0','task1','task2','weekly0','weekly1','weekly2','previous0','previous1','previous2'])delete buttons[key];
        text(ctx,data.pendingAction?'正在确认领取…':'正在同步进度…',l.innerX+l.innerW/2,l.bottom-25,l.innerW,11,'#FFF5E8');
    }
    // Only visible controls receive hits; a clipped card cannot be claimed underneath footer.
    for(const key of ['primary','task0','task1','task2','weekly0','weekly1','weekly2','previous0','previous1','previous2']){
        const r=buttons[key];if(!r)continue;
        if(r.y<viewport.y||r.y+r.h>viewport.y+viewport.h)delete buttons[key];
    }
    if(maxScroll){
        const railX=l.x+l.w-18,thumbH=Math.max(20,viewport.h*viewport.h/naturalH),travel=viewport.h-thumbH;
        ctx.fillStyle='#DBD1E7';rect(ctx,railX,viewport.y,3,viewport.h,1.5);ctx.fill();
        ctx.fillStyle='#B5A1CA';rect(ctx,railX,viewport.y+travel*offset/maxScroll,3,thumbH,1.5);ctx.fill();
    }
    // Reserve a distinct footer, so the sample is never mistaken for real rewards.
    if(!data.real)text(ctx,'界面预览 · 奖励不入账',l.innerX+l.innerW/2,l.bottom-25,l.innerW,10,SOFT);
    star(ctx,screen.width/2,l.bottom-10,4);
    if(data.message&&!failed){
        const mw=Math.min(330,screen.width-32),my=Math.max(viewport.y,l.bottom-92);
        ctx.fillStyle='rgba(62,52,92,.94)';rect(ctx,(screen.width-mw)/2,my,mw,40,14);ctx.fill();
        text(ctx,data.message,screen.width/2,my+20,mw-18,11,'#FFFFFF');
    }
    ctx.restore();
    buttons.viewport=viewport;buttons.maxScroll=maxScroll;
    return buttons;
}

module.exports={draw,layout,chest};
