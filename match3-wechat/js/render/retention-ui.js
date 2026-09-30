/** Accepted Daily Coins concept, assembled from editable Canvas controls and existing art. */
const assets = require('./assets');
const type = require('./typography');
const moon = require('./moon-controls');

const SIGN_REWARDS = [100, 100, 150, 100, 100, 150, 200];
const WEEKLY = [{ at: 200, coins: 300 }, { at: 350, coins: 500 }, { at: 500, coins: 1000 }];
const TASKS = [
    { title: '完成1局游戏', goal: 1, coins: 40, points: 20 },
    { title: '累计完成2局游戏', goal: 2, coins: 60, points: 30 },
    { title: '累计消除80枚棋子', goal: 80, coins: 60, points: 30 }
];
const INK = '#353465', SOFT = '#6D6A94', GOLD = '#D9BA87';
const TASK_CARD_HEIGHT = 70, TASK_CARD_GAP = 8, TASK_TOP = 10, TASK_FOOTER = 54;

function rect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);
    ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function text(ctx, value, x, y, w, size, color, bold) {
    ctx.fillStyle = color || INK;
    type.drawFit(ctx, value, x, y, w, {size, minSize: size - 1, align:'center', weight:bold?'bold':'500'});
}
function contain(ctx, key, x, y, w, h) {
    const img = assets.get(key);
    if (!img || !img.width || !img.height) return;
    const s = Math.min(w/img.width,h/img.height), dw=img.width*s, dh=img.height*s;
    ctx.drawImage(img,x+(w-dw)/2,y+(h-dh)/2,dw,dh);
}
function gradient(ctx, x, y, h, colors) {
    const g=ctx.createLinearGradient(x,y,x,y+h);
    colors.forEach((c,i)=>g.addColorStop(i/(colors.length-1),c));return g;
}
function paw(ctx, x, y, size, color) {
    ctx.save();ctx.translate(x,y);ctx.scale(size/24,size/24);ctx.fillStyle=color||'#DDA8D0';
    [[0,4,6,5],[-8,-3,3.1,3.8],[-3,-8,3,3.6],[4,-8,3,3.6],[9,-2,3,3.8]].forEach(p=>{
        ctx.beginPath();ctx.ellipse(p[0],p[1],p[2],p[3],0,0,Math.PI*2);ctx.fill();
    });ctx.restore();
}
function star(ctx,x,y,r) {
    ctx.save();ctx.fillStyle='#FBE3A3';ctx.strokeStyle=GOLD;ctx.lineWidth=.7;
    ctx.beginPath();for(let i=0;i<10;i++){const a=i*Math.PI/5-Math.PI/2,d=i%2?r*.45:r;
        const px=x+Math.cos(a)*d,py=y+Math.sin(a)*d;i?ctx.lineTo(px,py):ctx.moveTo(px,py);}
    ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function ear(ctx,x,y,w,flip) {
    ctx.save();ctx.translate(x,y);ctx.scale(flip||1,1);
    ctx.beginPath();ctx.moveTo(0,14);ctx.quadraticCurveTo(-1,-10,7,-5);ctx.lineTo(w,10);ctx.closePath();
    ctx.fillStyle='#FFFAFE';ctx.fill();ctx.strokeStyle=GOLD;ctx.lineWidth=.8;ctx.stroke();
    ctx.beginPath();ctx.moveTo(4,8);ctx.lineTo(6,-.5);ctx.lineTo(w-5,8);ctx.closePath();ctx.fillStyle='#F4C6DF';ctx.fill();ctx.restore();
}
function catCard(ctx, screen, x,y,w,h, active) {
    ear(ctx,x+10,y,24);ear(ctx,x+w-10,y,24,-1);
    ctx.save();
    if(!screen.reduceEffects){ctx.shadowColor=active?'rgba(242,192,102,.42)':'rgba(108,94,148,.13)';ctx.shadowBlur=active?10:5;ctx.shadowOffsetY=2;}
    ctx.fillStyle=gradient(ctx,x,y,h,active?['#FFF8E3','#FFF1EF','#FFE9F1']:['#FFFDFE','#F2ECFA','#FBEFF8']);
    rect(ctx,x,y,w,h,16);ctx.fill();ctx.shadowColor='transparent';
    ctx.strokeStyle=active?'#E8B65F':'#D6C1BA';ctx.lineWidth=active?1.7:1;ctx.stroke();
    ctx.strokeStyle='#FFFFFF';ctx.lineWidth=1.5;rect(ctx,x+3,y+3,w-6,h-6,13);ctx.stroke();
    paw(ctx,x+12,y+h-12,10,'#EBD0E1');ctx.restore();
}
function ribbonButton(ctx, r, label, enabled, pink) {
    moon.button(ctx,r.x,r.y,r.w,r.h,label,enabled?(pink?'pink':'blue'):'muted',18);
    ctx.save();ctx.strokeStyle=enabled?GOLD:'#C9C3D7';ctx.lineWidth=.8;rect(ctx,r.x,r.y,r.w,r.h,r.h/2);ctx.stroke();
    if(r.w>190){paw(ctx,r.x+20,r.y+r.h/2,15,'#D9A3C5');paw(ctx,r.x+r.w-20,r.y+r.h/2,15,'#D9A3C5');}
    ctx.restore();
}

// Native chest, with cat ears, pearl glazing, gold bands and paw clasp.
function chest(ctx,x,y,size,index,opened) {
    const palette=[['#D4ECFF','#7DAAD8'],['#E6D6FF','#A483CC'],['#FFD4EC','#CE79AE']][index];
    ctx.save();ctx.translate(x,y);ctx.scale(size/80,size/80);
    ear(ctx,13,12,20);ear(ctx,67,12,20,-1);
    ctx.fillStyle='rgba(137,120,172,.14)';ctx.beginPath();ctx.ellipse(40,69,37,7,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=palette[1];ctx.beginPath();ctx.moveTo(63,29);ctx.lineTo(74,25);ctx.lineTo(74,55);ctx.lineTo(64,65);ctx.closePath();ctx.fill();
    ctx.fillStyle=gradient(ctx,10,30,36,[palette[0],palette[1],palette[0]]);
    ctx.strokeStyle='#C3A273';ctx.lineWidth=1.7;rect(ctx,8,30,59,35,7);ctx.fill();ctx.stroke();
    const lift=opened?-7:0;
    ctx.fillStyle=gradient(ctx,10,12+lift,28,['#FFFFFF',palette[0],palette[1]]);
    ctx.beginPath();ctx.moveTo(6,40+lift);ctx.lineTo(7,28+lift);ctx.bezierCurveTo(8,7+lift,70,7+lift,73,28+lift);ctx.lineTo(74,40+lift);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.strokeStyle='#FFF4D5';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(10,34+lift);ctx.bezierCurveTo(11,10+lift,66,10+lift,69,34+lift);ctx.stroke();
    for(const bx of [18,58]) {
        ctx.fillStyle=gradient(ctx,bx,16,45,['#FFF9DE','#DDB56C','#FFF0B8']);rect(ctx,bx,18,5,42,2);ctx.fill();
    }
    ctx.strokeStyle='#F6D896';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(9,41);ctx.lineTo(71,41);ctx.stroke();
    ctx.fillStyle='#FDE9AF';ctx.beginPath();ctx.arc(40,40,12,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#BB975F';ctx.lineWidth=1;ctx.stroke();
    paw(ctx,40,40,16,'#C69A62');
    ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(11,52);ctx.lineTo(11,57);ctx.quadraticCurveTo(11,60,16,60);ctx.stroke();
    if(opened){ctx.fillStyle='#739994';ctx.beginPath();ctx.arc(66,19,10,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#FFFFFF';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(61,19);ctx.lineTo(65,23);ctx.lineTo(71,15);ctx.stroke();}
    ctx.restore();
}

function layout(screen) {
    const w=Math.min(396,screen.width-20),x=(screen.width-w)/2;
    const top=Math.max(12,(screen.safeTop||0)+4);
    const header=Math.min(148,w*.385);
    const bottom=Math.min(screen.height-(screen.safeBottom||0)-12,top+header+610);
    const compact=bottom-top<610;
    const titleY=Math.max(top+header-17,(screen.contentTop||0)+20);
    const tabsY=titleY+28;
    const innerX=x+24,innerW=w-48;
    const viewport={x:innerX-3,y:tabsY+54,w:innerW+6,h:Math.max(60,bottom-50-(tabsY+54))};
    return {x,w,top,bottom,titleY,tabsY,innerX,innerW,viewport,compact};
}

function frame(ctx,screen,l) {
    const img=assets.get('dailyInvitation');
    const h=l.bottom-l.top;
    // Preserve top cats and lower filigree, stretching only the quiet paper band.
    if(img&&img.width&&img.height){
        const a=img.height*.35,b=img.height*.86,cap=l.w*a/img.width,tail=l.w*.16;
        ctx.drawImage(img,0,0,img.width,a,l.x,l.top,l.w,cap);
        ctx.drawImage(img,0,a,img.width,b-a,l.x,l.top+cap,l.w,h-cap-tail);
        ctx.drawImage(img,0,b,img.width,img.height-b,l.x,l.bottom-tail,l.w,tail);
    } else moon.panel(ctx,screen,l.x,l.top+45,l.w,h-45);
    // Native title plaque avoids baking editable text into any art.
    ctx.save();
    const pw=Math.min(224,l.innerW-48),py=l.titleY-22;
    ctx.fillStyle=gradient(ctx,l.x,py,42,['#E7DDF7','#BDB0DA','#EADDF8']);
    rect(ctx,screen.width/2-pw/2,py,pw,44,22);ctx.fill();ctx.strokeStyle='#EED8AC';ctx.lineWidth=1.5;ctx.stroke();
    type.drawDisplay(ctx,'每日金币',screen.width/2,l.titleY+1,pw-18,l.compact?25:29,{fill:'#493565'});
    ctx.restore();
}

function drawSign(ctx,screen,l,data,y,buttons) {
    const x=l.innerX,w=l.innerW,gap=9,cw=(w-gap*2)/3,ch=74;
    y+=10;
    for(let i=0;i<6;i++){
        const px=x+(i%3)*(cw+gap),py=y+Math.floor(i/3)*(ch+11);
        const past=i+1<data.signDay || (i+1===data.signDay&&data.signed);
        catCard(ctx,screen,px,py,cw,ch,!data.signed&&i+1===data.signDay);
        text(ctx,'第'+(i+1)+'天',px+cw/2,py+14,cw-8,11,INK,true);
        contain(ctx,'uiCoin',px+cw/2-20,py+23,40,28);
        if(i===2){contain(ctx,'uiResultHappyCat',px+cw-29,py+24,24,28);}
        text(ctx,past?'已领取':String(SIGN_REWARDS[i]),px+cw/2,py+ch-13,cw-12,13,past?SOFT:INK,true);
    }
    y+=ch*2+20;
    const seventhH=60;
    catCard(ctx,screen,x,y,w,seventhH,data.signDay===7&&!data.signed);
    contain(ctx,'uiResultHappyCat',x+6,y+3,62,53);
    contain(ctx,'uiCoin',x+w*.48,y+5,37,31);
    contain(ctx,'uiToolHammer',x+w-55,y+2,40,36);
    star(ctx,x+w-66,y+14,5);
    text(ctx,'第7天',x+104,y+18,68,13,INK,true);
    text(ctx,data.signDay===7&&data.signed?'已领取':'200金币 ＋ 锤子×1',x+w*.63,y+43,w*.68,13,INK,true);
    y+=seventhH+10;
    const primary={x:x+8,y,w:w-16,h:46};
    ribbonButton(ctx,primary,data.signed?'今日已领取':'领取今日金币',!data.signed,true);
    if(!data.signed)buttons.primary=primary;
    return y+52;
}

function drawTasks(ctx,screen,l,data,y,buttons) {
    const x=l.innerX,w=l.innerW,h=TASK_CARD_HEIGHT;
    y+=TASK_TOP;
    TASKS.forEach((task,i)=>{
        catCard(ctx,screen,x,y,w,h,false);
        const done=Math.min(task.goal,Math.max(0,data.taskProgress[i]||0));
        const claimed=!!(data.taskClaimed&&data.taskClaimed[i]);
        const ready=done>=task.goal&&!claimed&&data.taskClaimMode==='manual-v1';
        const icon=32,tx=x+icon+13,tw=w-icon-96;
        if(i===0)paw(ctx,x+27,y+31,27,'#DF95BE');
        else contain(ctx,i===1?'piece3':'uiMoves',x+7,y+12,icon,icon);
        ctx.fillStyle=INK;type.drawFit(ctx,task.title,tx,y+17,tw,{size:14,minSize:12,weight:'bold'});
        const barY=y+33;
        ctx.fillStyle='#DEDBEE';rect(ctx,tx,barY,tw,7,3.5);ctx.fill();
        if(done){ctx.fillStyle=gradient(ctx,tx,barY,7,['#F5CADE','#CF91BF']);rect(ctx,tx,barY,Math.max(7,tw*done/task.goal),7,3.5);ctx.fill();}
        text(ctx,done+'/'+task.goal,tx+tw/2,y+46,tw,11,SOFT,true);
        text(ctx,task.coins+'金币 · '+task.points+'活跃',x+w/2,y+60,w-24,12,SOFT);
        const claim={x:x+w-76,y:y+9,w:64,h:44};
        moon.button(ctx,claim.x,claim.y,claim.w,claim.h,claimed?'已领取':ready?'领取':'未完成',ready?'pink':'muted',14);
        if(ready)buttons['task'+i]=claim;
        y+=h+TASK_CARD_GAP;
    });
    const primary={x:x+8,y:y+1,w:w-16,h:44};ribbonButton(ctx,primary,'去玩一局',true,true);buttons.primary=primary;
    return y+TASK_FOOTER;
}

function drawWeekly(ctx,screen,l,data,y,buttons) {
    const x=l.innerX,w=l.innerW;
    ctx.save();ctx.strokeStyle='#D9C6DE';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+4,y);ctx.quadraticCurveTo(x+w/2,y-8,x+w-4,y);ctx.stroke();ctx.restore();
    text(ctx,'每周宝箱',x+w/2,y+16,w-60,16,INK,true);
    paw(ctx,x+w/2-65,y+15,14,'#B3A5CF');paw(ctx,x+w/2+65,y+15,14,'#B3A5CF');
    text(ctx,'本周活跃  '+data.activity+'/500',x+w/2,y+34,w,10,SOFT);
    const barX=x+15,barW=w-30;
    ctx.fillStyle='#DDD9EE';rect(ctx,barX,y+45,barW,4,2);ctx.fill();
    if(data.activity>0){ctx.fillStyle='#C6A5D3';rect(ctx,barX,y+45,Math.max(5,barW*Math.min(1,data.activity/500)),4,2);ctx.fill();}
    for(let i=0;i<3;i++){
        const cellW=w/3,cx=x+cellW*(i+.5),opened=!!data.claimed[i],ready=data.activity>=WEEKLY[i].at&&!opened;
        text(ctx,WEEKLY[i].at+'活跃',cx,y+61,cellW-4,10,SOFT,true);
        const size=Math.min(64,cellW-10);
        if(ready){ctx.save();ctx.fillStyle='rgba(251,218,151,.27)';ctx.beginPath();ctx.ellipse(cx,y+105,cellW*.46,32,0,0,Math.PI*2);ctx.fill();ctx.restore();}
        chest(ctx,cx-size/2,y+67,size,i,opened);
        text(ctx,WEEKLY[i].coins+'金币',cx,y+67+size,cellW-4,12,INK,true);
        text(ctx,opened?'已领取':ready?'点击领取':'待解锁',cx,y+83+size,cellW-4,9,ready?'#AA6B43':SOFT,ready);
        if(ready)buttons['weekly'+i]={x:x+cellW*i+2,y:y+66,w:cellW-4,h:size+28};
    }
    if(data.previousWeek){
        const py=y+164,cw=(w-12)/3;
        text(ctx,'上周待领',x+w/2,py+12,w,11,SOFT,true);
        WEEKLY.forEach((reward,i)=>{
            const claimed=!!data.previousWeek.claimed[i],available=!!data.previousWeek.available[i];
            const r={x:x+i*(cw+6),y:py+29,w:cw,h:44};
            moon.button(ctx,r.x,r.y,r.w,r.h,claimed?'已领取':available?reward.coins+'金币':'未达标',available&&!claimed?'blue':'muted',11);
            if(available&&!claimed)buttons['previous'+i]=r;
        });
        return py+84;
    }
    return y+160;
}

function drawStatus(ctx,screen,l,data,y,buttons) {
    const messages={loading:['猫咪正在整理金币','正在加载，请稍候…'],offline:['网络连接暂时失败','请检查网络后重试'],error:['暂时无法同步每日金币','可以重试，也可以先关闭页面'],pending:['奖励还在确认中','确认后会自动更新领取状态']};
    const value=messages[data.status]||messages.error;
    const short=l.viewport.h<280;
    contain(ctx,'uiResultSadCat',l.innerX+l.innerW/2-(short?42:52),y+(short?12:24),short?84:104,short?74:92);
    text(ctx,value[0],l.innerX+l.innerW/2,y+(short?105:137),l.innerW,short?16:18,INK,true);
    text(ctx,data.message||value[1],l.innerX+l.innerW/2,y+(short?132:168),l.innerW,short?10:11,SOFT);
    if(data.diagnostic)text(ctx,'诊断：'+data.diagnostic,l.innerX+l.innerW/2,y+(short?151:188),l.innerW,10,SOFT);
    const r={x:l.innerX+20,y:y+(short?164:203),w:l.innerW-40,h:46};
    const retry=data.status==='offline'||data.status==='error'||(data.real&&data.status==='pending');
    ribbonButton(ctx,r,retry?'重试':data.status==='loading'?'加载中…':'待同步',retry,true);
    if(retry)buttons.primary=r;
    return y+(short?226:280);
}

function draw(ctx,screen,data) {
    const l=layout(screen),buttons={};
    ctx.save();ctx.fillStyle='rgba(27,29,59,.60)';ctx.fillRect(0,0,screen.width,screen.height);
    frame(ctx,screen,l);
    // Quiet pearl interior keeps stretched side flowers behind a readable content surface.
    ctx.fillStyle=gradient(ctx,l.x,l.tabsY,l.bottom-l.tabsY,['#FFFCFF','#F6F2FC','#F4EEFA']);
    rect(ctx,l.x+20,l.tabsY+48,l.w-40,l.bottom-l.tabsY-59,19);ctx.fill();
    ctx.strokeStyle='#E8D6B9';ctx.lineWidth=1.3;ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.9)';rect(ctx,l.x+23,l.tabsY+51,l.w-46,l.bottom-l.tabsY-65,16);ctx.stroke();
    const close={x:l.x+l.w-51,y:Math.max(l.top+58,(screen.contentTop||0)+1),w:44,h:44};
    moon.button(ctx,close.x,close.y,44,44,'×','blue',27);buttons.close=close;
    const tw=(l.innerW-6)/2;
    [['signinTab','七日签到','signin'],['tasksTab','每日任务','tasks']].forEach((tab,i)=>{
        const r={x:l.innerX+i*(tw+6),y:l.tabsY,w:tw,h:44};
        moon.button(ctx,r.x,r.y,r.w,r.h,tab[1],data.tab===tab[2]?'pink':'blue',17);buttons[tab[0]]=r;
        if(tab[2]==='tasks'&&data.status==='ready'&&data.taskClaimMode==='manual-v1'&&
            TASKS.some((task,index)=>data.taskProgress[index]>=task.goal&&!data.taskClaimed[index])){
            ctx.save();ctx.fillStyle='#F5222D';
            ctx.beginPath();ctx.arc(r.x+r.w-12,r.y+9,6,0,Math.PI*2);ctx.fill();ctx.restore();
        }
    });
    const viewport=l.viewport;
    // Content uses its own scroll plane; header/tabs/close never move.
    const signHeight=10+74*2+20+60+10+52;
    const tasksHeight=TASK_TOP+(TASK_CARD_HEIGHT+TASK_CARD_GAP)*TASKS.length+TASK_FOOTER;
    const naturalH=data.status!=='ready'?(viewport.h<280?226:280):(data.tab==='tasks'?tasksHeight:signHeight)+(data.previousWeek?248:160);
    const maxScroll=Math.max(0,naturalH-viewport.h);
    const offset=Math.max(0,Math.min(maxScroll,data.offset||0));
    ctx.save();ctx.beginPath();ctx.rect(viewport.x,viewport.y,viewport.w,viewport.h);ctx.clip();
    const y=viewport.y-offset;
    if(data.status!=='ready')drawStatus(ctx,screen,l,data,y,buttons);
    else {
        const end=data.tab==='tasks'?drawTasks(ctx,screen,l,data,y,buttons):drawSign(ctx,screen,l,data,y,buttons);
        drawWeekly(ctx,screen,l,data,end,buttons);
    }
    ctx.restore();
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
    if(data.message&&data.status==='ready'){
        const mw=Math.min(330,screen.width-32),my=Math.max(viewport.y,l.bottom-92);
        ctx.fillStyle='rgba(62,52,92,.94)';rect(ctx,(screen.width-mw)/2,my,mw,40,14);ctx.fill();
        text(ctx,data.message,screen.width/2,my+20,mw-18,11,'#FFFFFF');
    }
    ctx.restore();
    buttons.viewport=viewport;buttons.maxScroll=maxScroll;
    return buttons;
}

module.exports={draw,layout,chest};
