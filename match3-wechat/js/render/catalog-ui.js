/** Editable Canvas catalog. The atlas is sampled for portraits only, never as a page. */
const assets=require('./assets');
const type=require('./typography');
const moon=require('./moon-controls');
const catalog=require('../platform/catalog-preview');
const INK='#303653', SOFT='#69708B';
const STAGE_ART={
    cream:{1:'catalogNaitangFamiliar',2:'catalogNaitangTrust',3:'catalogNaitangAttachment',4:'catalogNaitangBestFriend'},
    ragdoll:{1:'catalogRagdollFamiliar',2:'catalogRagdollTrust',3:'catalogRagdollAttachment',4:'catalogRagdollBestFriend'},
    siamese:{1:'catalogSiameseFamiliar',2:'catalogSiameseTrust',3:'catalogSiameseAttachment',4:'catalogSiameseBestFriend'},
    calico:{1:'catalogCalicoFamiliar',2:'catalogCalicoTrust',3:'catalogCalicoAttachment',4:'catalogCalicoBestFriend'},
};
const ART_NOTES=['初见时的相遇，一直珍藏','一点点熟悉，一点点靠近','在你身边，它终于安心放松','总想再靠近你一点点','把最柔软的一面，放心交给你'];
function round(ctx,x,y,w,h,r) {
    r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);
    ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();
}
function label(ctx,str,x,y,w,size,color,bold) {
    ctx.fillStyle=color||INK;type.drawFit(ctx,str,x,y,w,{size,minSize:Math.max(9,size-2),align:'center',weight:bold?'700':'500'});
}
function gradient(ctx,y,h,colors) {
    const g=ctx.createLinearGradient(0,y,0,y+h);colors.forEach((c,i)=>g.addColorStop(i/(colors.length-1),c));return g;
}
function paw(ctx,x,y,size,color) {
    ctx.save();ctx.translate(x,y);ctx.scale(size/24,size/24);ctx.fillStyle=color;
    [[0,4,6,5],[-8,-3,3,3.5],[-3,-8,3,3.5],[4,-8,3,3.5],[9,-2,3,3.5]].forEach(p=>{
        ctx.beginPath();ctx.ellipse(p[0],p[1],p[2],p[3],0,0,Math.PI*2);ctx.fill();
    });ctx.restore();
}
function fish(ctx,x,y,size) {
    ctx.save();ctx.translate(x,y);ctx.scale(size/24,size/24);ctx.fillStyle='#7482AD';
    ctx.beginPath();ctx.ellipse(-2,0,9,5,-.28,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.moveTo(4,-1);ctx.lineTo(12,-8);ctx.lineTo(12,5);ctx.closePath();ctx.fill();
    ctx.fillStyle='#FFFFFF';ctx.beginPath();ctx.arc(-7,-1,1,0,Math.PI*2);ctx.fill();ctx.restore();
}
function lock(ctx,x,y) {
    ctx.save();ctx.strokeStyle=SOFT;ctx.lineWidth=1.7;ctx.beginPath();ctx.arc(x,y-3,3.8,Math.PI,0);ctx.stroke();
    ctx.fillStyle=SOFT;round(ctx,x-6,y-2,12,10,2);ctx.fill();
    ctx.fillStyle='#FFF';ctx.fillRect(x-.6,y+1,1.2,4);ctx.restore();
}
function arch(ctx,x,y,w,h) {
    ctx.beginPath();ctx.moveTo(x+16,y+11);
    ctx.bezierCurveTo(x+w*.17,y+5,x+w*.37,y+7,x+w/2-12,y-1);
    ctx.quadraticCurveTo(x+w/2,y-11,x+w/2+12,y-1);
    ctx.bezierCurveTo(x+w*.63,y+7,x+w*.83,y+5,x+w-16,y+11);
    ctx.quadraticCurveTo(x+w,y+14,x+w,y+34);ctx.lineTo(x+w,y+h-20);
    ctx.quadraticCurveTo(x+w,y+h-3,x+w-20,y+h);ctx.lineTo(x+20,y+h);
    ctx.quadraticCurveTo(x,y+h-3,x,y+h-20);ctx.lineTo(x,y+34);ctx.quadraticCurveTo(x,y+14,x+16,y+11);ctx.closePath();
}
function frame(ctx,screen,r,tone) {
    ctx.save();
    if(!screen.reduceEffects){ctx.shadowColor='rgba(21,29,70,.3)';ctx.shadowBlur=8;ctx.shadowOffsetY=4;}
    ctx.fillStyle=gradient(ctx,r.y,r.h,['#FEF6F1','#F4EDF6','#EAE7F7']);arch(ctx,r.x,r.y,r.w,r.h);ctx.fill();
    ctx.shadowColor='transparent';ctx.strokeStyle=tone;ctx.lineWidth=6;ctx.stroke();
    ctx.strokeStyle='#FFF4EC';ctx.lineWidth=3;ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.92)';ctx.lineWidth=1;arch(ctx,r.x+4,r.y+4,r.w-8,r.h-8);ctx.stroke();
    ctx.restore();
}
function portrait(ctx,cat,r) {
    const img=assets.get('catalogPortraits');
    if(!img || !img.width || !img.height) return false;
    const c=cat.crop,sx=img.width/700,sy=img.height/776;
    const scale=Math.min(r.w/(c[2]*sx),r.h/(c[3]*sy));
    const w=c[2]*sx*scale,h=c[3]*sy*scale;
    ctx.save();round(ctx,r.x,r.y,r.w,r.h,13);ctx.clip();
    ctx.drawImage(img,c[0]*sx,c[1]*sy,c[2]*sx,c[3]*sy,r.x+(r.w-w)/2,r.y+(r.h-h)/2,w,h);ctx.restore();return true;
}
function button(ctx,r,str,tone) {
    const colors=tone==='lavender'?['#F7F0FF','#C9B3E8','#E0D1F4']:['#F0EDF5','#D7D1E2','#E4DFED'];
    ctx.save();ctx.fillStyle=gradient(ctx,r.y,r.h,colors);round(ctx,r.x,r.y,r.w,r.h,r.h/2);ctx.fill();
    ctx.strokeStyle=tone==='lavender'?'#AE92CF':'#C5BDCF';ctx.lineWidth=1.2;ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.9)';round(ctx,r.x+2,r.y+2,r.w-4,r.h-4,r.h/2-2);ctx.stroke();
    label(ctx,str,r.x+r.w/2,r.y+r.h/2,r.w-14,14,INK,true);ctx.restore();
}
function layout(screen,model) {
    const x=Math.max(16,(screen.safeLeft||0)+8),right=Math.max(16,(screen.safeRight||0)+8);
    const w=screen.width-x-right,top=Math.max((screen.contentTop||0)+6,(screen.safeTop||0)+10,18);
    const footer=screen.height-(screen.safeBottom||0)-18;
    const viewport={x:x-5,y:top+52,w:w+10,h:Math.max(70,footer-26-(top+52))};
    const gap=16,cw=(w-gap)/2;
    // Let each row follow its original portrait proportions; short screens scroll.
    const rowHeights=[0,1].map(row=>Math.ceil((cw-10)*Math.max(...catalog.cats.slice(row*2,row*2+2).map(cat=>cat.crop[3]/cat.crop[2])))+117);
    if(model.view==='detail')viewport.h=Math.max(60,viewport.h-84);
    return {x,w,top,footer,viewport,gap,cw,rowHeights};
}
function detailArtHeight(l) { return Math.min(252,Math.min(332,l.w-4)*.8,Math.max(156,l.viewport.h-208)); }
function detailExtra(model) { return (catalog.growthFor(model,model.selectedId).enabled?258:186)+(catalog.statusFor(model,model.selectedId)==='owned'?56:0); }
function hasStageArt(cat,stage) { return stage===0 || !!(STAGE_ART[cat.id]&&STAGE_ART[cat.id][stage]); }
function stageArt(ctx,cat,r,stage) {
    if(stage===0){portrait(ctx,cat,r);return;}
    if(hasStageArt(cat,stage)) {
        const img=assets.get(STAGE_ART[cat.id][stage]);
        if(img&&img.width&&img.height){
            const scale=Math.min(r.w/img.width,r.h/img.height),w=img.width*scale,h=img.height*scale;
            const x=r.x+(r.w-w)/2,y=r.y+(r.h-h)/2;
            ctx.save();round(ctx,x,y,w,h,13);ctx.clip();ctx.drawImage(img,x,y,w,h);ctx.restore();return;
        }
        label(ctx,'原画暂未加载',r.x+r.w/2,r.y+r.h/2,r.w-12,13,SOFT);return;
    }
    const cy=r.y+r.h/2;
    paw(ctx,r.x+r.w/2,cy-24,48,'#B6A0CC');
    label(ctx,catalog.stages[stage].name+'原画',r.x+r.w/2,cy+24,r.w-12,17,INK,true);
    label(ctx,'待制作 · 当前为流程预览',r.x+r.w/2,cy+47,r.w-8,10,SOFT);
}
function visibleButton(buttons,key,r,v) {
    if(r.y>=v.y && r.y+r.h<=v.y+v.h && r.x>=v.x && r.x+r.w<=v.x+v.w)buttons[key]=r;
}
function drawCard(ctx,screen,model,cat,r,buttons,v,companion) {
    const state=catalog.statusFor(model,cat.id);
    frame(ctx,screen,r,cat.tone);
    const art={x:r.x+5,y:r.y+13,w:r.w-10,h:r.h-117};
    const growth=catalog.growthFor(model,cat.id);
    if(art.y+art.h>=v.y&&art.y<=v.y+v.h)stageArt(ctx,cat,art,growth.enabled&&hasStageArt(cat,growth.displayStage)?growth.displayStage:0);
    ctx.save();ctx.fillStyle='#FFF5F0';ctx.beginPath();ctx.arc(r.x+r.w/2,r.y+3,9,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=cat.tone;ctx.lineWidth=1;ctx.stroke();paw(ctx,r.x+r.w/2,r.y+3,11,cat.tone);ctx.restore();
    const ty=r.y+r.h-94;
    label(ctx,cat.name,r.x+r.w/2,ty,r.w-14,18,INK,true);
    if(state==='owned') {
        const stage=catalog.stageFor(model,cat.id);
        label(ctx,companion&&companion.hasUnread(model,cat.id)?'有新故事 · 等你来读':'已领养 · '+catalog.stages[stage].name,r.x+r.w/2,ty+22,r.w-10,11,SOFT);
        for(let i=0;i<5;i++)paw(ctx,r.x+r.w/2-34+i*17,ty+41,11,i<=stage?'#D88C9F':'#C8C5D0');
    } else if(state==='adoptable') {
        label(ctx,model.owned.length?'可以领养啦':'选一只陪伴你',r.x+r.w/2,ty+22,r.w-10,11,'#77608F');
        label(ctx,model.owned.length?'累计陪伴 7 天':'首次免费领养',r.x+r.w/2,ty+40,r.w-10,10,SOFT);
    } else {
        lock(ctx,r.x+r.w/2-28,ty+25);label(ctx,'未解锁',r.x+r.w/2+10,ty+25,r.w-45,11,SOFT);
        label(ctx,model.owned.length===1?catalog.condition(model):'解锁条件待确定',r.x+r.w/2,ty+42,r.w-10,9,SOFT);
    }
    const action={x:r.x+10,y:r.y+r.h-45,w:r.w-20,h:40};
    button(ctx,action,state==='owned'?'去陪伴':state==='adoptable'?'查看并领养':'查看条件',state==='locked'?'muted':'lavender');
    // Entire visible cards are tappable; clipped cards keep only their fully visible action.
    const hit=r.y>=v.y && r.y+r.h<=v.y+v.h?r:{x:r.x+5,y:r.y+r.h-48,w:r.w-10,h:44};
    visibleButton(buttons,'cat:'+cat.id,hit,v);
}
function drawDetail(ctx,screen,model,l,buttons,companion) {
    const cat=catalog.cats.find(item=>item.id===model.selectedId);
    if(!cat)return 0;
    const state=catalog.statusFor(model,cat.id),w=Math.min(332,l.w-4),x=(screen.width-w)/2;
    const growth=catalog.growthFor(model,cat.id);
    const artH=detailArtHeight(l),h=artH+detailExtra(model),y=l.viewport.y+10-model.offset;
    const r={x,y,w,h};frame(ctx,screen,r,cat.tone);
    // Detail keeps the whole accepted cat rather than filling a wide crop.
    const artW=Math.min(w-14,artH*cat.crop[2]/cat.crop[3]);
    ctx.save();
    ctx.fillStyle=gradient(ctx,y+10,artH+10,['#D9CBEA','#EEE6F5','#D7C6E7']);
    round(ctx,x+8,y+10,w-16,artH+10,18);ctx.fill();
    ctx.strokeStyle='#FFF7EF';ctx.lineWidth=1;ctx.stroke();
    paw(ctx,x+28,y+15+artH/2,16,'rgba(168,139,191,.3)');
    paw(ctx,x+w-28,y+15+artH/2,16,'rgba(168,139,191,.3)');
    ctx.restore();
    if(y+15+artH>=l.viewport.y)stageArt(ctx,cat,{x:x+(w-artW)/2,y:y+15,w:artW,h:artH},growth.enabled?growth.displayStage:0);
    const t=y+artH+35;
    label(ctx,cat.name,x+w/2,t,w-24,22,INK,true);
    label(ctx,cat.breed,x+w/2,t+25,w-24,11,SOFT);
    if(growth.enabled) {
        const stage=catalog.stages[growth.stage],next=catalog.stages[growth.stage+1];
        label(ctx,stage.name+' · 亲密度 '+growth.affection,x+w/2,t+49,w-20,13,INK,true);
        const track={x:x+24,y:t+65,w:w-48,h:8};
        ctx.fillStyle='#DAD0E6';round(ctx,track.x,track.y,track.w,track.h,4);ctx.fill();
        const ratio=next?(growth.affection-stage.threshold)/(next.threshold-stage.threshold):1;
        if(ratio>0){ctx.fillStyle='#AF8ECF';round(ctx,track.x,track.y,Math.max(8,track.w*ratio),track.h,4);ctx.fill();}
        label(ctx,next?'再喂 '+(next.threshold-growth.affection)+' 次，成为「'+next.name+'」':'已经是最亲密的挚友啦',x+w/2,t+91,w-20,11,SOFT);
        for(let i=0;i<5;i++){
            const cellW=(w-20)/5,px=x+10+cellW*(i+.5),open=i<=growth.stage;
            const hit={x:x+10+cellW*i,y:t+107,w:cellW,h:55};
            if(i===growth.displayStage){ctx.fillStyle='#E1D2ED';round(ctx,hit.x+2,hit.y,hit.w-4,hit.h,12);ctx.fill();}
            if(open)paw(ctx,px,t+125,19,'#AC80BA');else lock(ctx,px,t+125);
            label(ctx,catalog.stages[i].name,px,t+148,cellW-4,11,open?INK:SOFT,i===growth.displayStage);
            visibleButton(buttons,'stage:'+i,hit,l.viewport);
        }
        label(ctx,'点击阶段回顾 · 已开放 '+(growth.stage+1)+'/5 阶段',x+w/2,t+183,w-20,11,SOFT);
        const artCount=1+Object.keys(STAGE_ART[cat.id]||{}).length;
        label(ctx,artCount===5?'五段陪伴，五份珍藏':'已制作原画 '+artCount+'/5 张 · 后续原画待制作',x+w/2,t+204,w-20,10,SOFT);
    } else if(state==='owned') {
        label(ctx,cat.note,x+w/2,t+49,w-20,11,SOFT);
        label(ctx,'本轮先体验第一只猫的成长',x+w/2,t+94,w-20,13,INK,true);
        label(ctx,'其他猫咪保留领养状态',x+w/2,t+121,w-20,11,SOFT);
    } else {
        label(ctx,cat.note,x+w/2,t+49,w-20,11,SOFT);
        label(ctx,state==='adoptable'?'现在可以免费领养':catalog.condition(model),x+w/2,t+89,w-20,15,INK,true);
        label(ctx,model.owned.length<2?'累计游玩，不要求连续':'后续规则确定后开放',x+w/2,t+116,w-20,11,SOFT);
    }
    if(state==='owned'){
        const by=y+h-48,bw=(w-32)/2;
        const story={x:x+10,y:by,w:bw,h:44},select={x:x+22+bw,y:by,w:bw,h:44};
        button(ctx,story,companion&&companion.hasUnread(model,cat.id)?'新故事':'小故事','lavender');button(ctx,select,'设为陪伴','lavender');
        visibleButton(buttons,'open-story',story,l.viewport);visibleButton(buttons,'set-companion',select,l.viewport);
    }
    return h+22;
}
function drawOverlay(ctx,screen,model,l) {
    const overlay=model.overlay,cat=catalog.cats.find(item=>item.id===overlay.catId);
    if(!cat)return {maxScroll:0};
    const growth=catalog.growthFor(model,cat.id),kind=overlay.kind;
    const artMode=kind==='gallery'||kind==='unlock';
    const w=Math.min(334,l.w),h=artMode?350:kind==='food'?300:264;
    const x=(screen.width-w)/2,y=Math.max(l.top+4,(l.top+l.footer-h)/2),cx=screen.width/2;
    const buttons={maxScroll:0};
    ctx.save();ctx.fillStyle='rgba(28,25,53,.58)';ctx.fillRect(0,0,screen.width,screen.height);
    frame(ctx,screen,{x,y,w,h},'#C2A7DD');
    const add=(key,str,by,tone,bx=x+18,bw=w-36)=>{
        const r={x:bx,y:by,w:bw,h:44};button(ctx,r,str,tone);buttons[key]=r;
    };
    if(kind==='feed'){
        paw(ctx,cx,y+37,30,'#BA97CA');
        label(ctx,'喂给'+cat.name,cx,y+74,w-28,21,INK,true);
        label(ctx,'1 份小鱼干 → 亲密度 +1',cx,y+110,w-28,14,INK);
        label(ctx,'现有 '+model.fish+' 份 · 仅本次预览有效',cx,y+138,w-28,11,SOFT);
        add('confirm-feed','确认喂食',y+163,'lavender');
        add('dismiss','再等等',y+212,'muted');
    }else if(kind==='food'){
        fish(ctx,cx,y+37,36);
        label(ctx,'给'+cat.name+'带点小鱼干',cx,y+75,w-24,19,INK,true);
        label(ctx,'每天第 1 局和第 3 局有效完成',cx,y+111,w-24,12,INK);
        label(ctx,'各获得 1 份，每天最多 2 份',cx,y+135,w-24,12,INK);
        label(ctx,'主动退出不计入 · 食物不会跨日清空',cx,y+159,w-22,10,SOFT);
        label(ctx,'本样板通过页面外的演示工具模拟获取',cx,y+182,w-18,10,SOFT);
        add('go-play','回首页玩一局',y+198,'lavender');
        add('dismiss','再陪一会儿',y+247,'muted');
    }else if(artMode){
        const stage=overlay.stage,unlocked=stage<=growth.stage;
        label(ctx,kind==='unlock'?'你们更亲密啦':cat.name+'的成长回顾',cx,y+31,w-24,19,INK,true);
        label(ctx,catalog.stages[stage].name+(unlocked?' · 已开放':' · 未解锁'),cx,y+58,w-24,13,SOFT);
        const art={x:x+18,y:y+76,w:w-36,h:134};
        ctx.fillStyle='#E9DFF2';round(ctx,art.x,art.y,art.w,art.h,16);ctx.fill();
        if(unlocked)stageArt(ctx,cat,art,stage);
        else {lock(ctx,cx,y+124);label(ctx,'亲密度达到 '+catalog.stages[stage].threshold+' 后开放',cx,y+164,w-30,13,INK);}
        label(ctx,hasStageArt(cat,stage)?ART_NOTES[stage]:'新阶段原画尚未制作，本次仅验证解锁流程',cx,y+229,w-22,10,SOFT);
        if(kind==='gallery'&&unlocked){
            add('show-stage',hasStageArt(cat,stage)?'展示这张原画':'预览此阶段（原画待制作）',y+244,'lavender');
            add('dismiss','返回陪伴',y+290,'muted');
        } else if(kind==='unlock'){
            add('read-unlock','读新故事',y+244,'lavender');
            add('dismiss','继续陪伴',y+290,'muted');
        } else add('dismiss','返回陪伴',y+275,'lavender');
    }
    ctx.restore();return buttons;
}
function background(ctx,screen) {
    const img=assets.get('homeBackground');
    ctx.fillStyle='#354767';ctx.fillRect(0,0,screen.width,screen.height);
    if(img&&img.width&&img.height){
        const s=Math.max(screen.width/img.width,screen.height/img.height);
        ctx.drawImage(img,(screen.width-img.width*s)/2,(screen.height-img.height*s)/2,img.width*s,img.height*s);
    }
    ctx.fillStyle='rgba(31,42,74,.42)';ctx.fillRect(0,0,screen.width,screen.height);
}
function albumBacking(ctx,screen,l,detail) {
    const v=l.viewport,x=l.x-9,y=v.y-3,w=l.w+18,h=v.h+(detail?82:6);
    ctx.save();
    if(!screen.reduceEffects){ctx.shadowColor='rgba(23,20,52,.28)';ctx.shadowBlur=14;ctx.shadowOffsetY=5;}
    ctx.fillStyle=gradient(ctx,y,h,['rgba(239,225,249,.94)','rgba(211,193,232,.93)','rgba(234,216,242,.96)']);
    round(ctx,x,y,w,h,24);ctx.fill();ctx.shadowColor='transparent';
    ctx.strokeStyle='rgba(255,244,230,.95)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.strokeStyle='rgba(158,132,181,.5)';ctx.lineWidth=1;
    round(ctx,x+4,y+4,w-8,h-8,20);ctx.stroke();
    if(!detail){
        const middle=x+w/2;
        ctx.fillStyle='rgba(159,131,183,.18)';round(ctx,middle-2,y+20,4,h-40,2);ctx.fill();
    }
    ctx.restore();
}
function draw(ctx,screen,model,resources,companion) {
    const l=layout(screen,model),v=l.viewport,buttons={viewport:v,maxScroll:0};
    background(ctx,screen);
    albumBacking(ctx,screen,l,model.view==='detail');
    const back={x:l.x-2,y:l.top,w:44,h:44};
    moon.button(ctx,back.x,back.y,44,44,'','blue');moon.glyph(ctx,'back',back.x+10,back.y+10,24);
    buttons[model.view==='detail'?'back':'close']=back;
    const statX=l.x+54,statY=l.top+8,statW=l.w-54;
    ctx.fillStyle='rgba(239,237,255,.78)';round(ctx,statX,statY,statW,28,14);ctx.fill();
    label(ctx,'已领养 '+model.owned.length+'/4',statX+62,statY+14,111,12,INK);
    fish(ctx,l.x+l.w-65,statY+14,20);label(ctx,String(model.fish),l.x+l.w-33,statY+14,32,13,INK,true);
    label(ctx,'界面预览 · 领养与进度仅本次有效',screen.width/2,l.footer,screen.width-24,10,'#FFF7EB');
    if(resources && resources.status!=='ready') {
        const y=v.y+Math.max(8,(v.h-175)/2),failed=resources.status==='error';
        moon.panel(ctx,screen,l.x,y,l.w,166);
        label(ctx,failed?'猫咪原画暂未到齐':'正在打开猫咪图鉴…',screen.width/2,y+39,l.w-28,18,INK,true);
        label(ctx,failed?resources.message:'原画加载 '+resources.progress+'%',screen.width/2,y+72,l.w-24,12,SOFT);
        if(failed){buttons['retry-assets']={x:l.x+24,y:y+102,w:l.w-48,h:44};button(ctx,buttons['retry-assets'],'重新加载','lavender');}
        return buttons;
    }
    if(model.status!=='ready') {
        model.offset=0;
        const y=v.y+Math.max(8,(v.h-175)/2);
        moon.panel(ctx,screen,l.x,y,l.w,166);
        const titles={loading:'正在寻找猫咪…',offline:'暂时没有连接',error:'暂时无法读取图鉴'};
        label(ctx,titles[model.status]||titles.error,screen.width/2,y+39,l.w-28,18,INK,true);
        label(ctx,'当前为界面状态演示',screen.width/2,y+72,l.w-24,12,SOFT);
        if(model.status==='offline'||model.status==='error') {
            buttons.retry={x:l.x+24,y:y+102,w:l.w-48,h:44};button(ctx,buttons.retry,'重试','lavender');
        }
        return buttons;
    }
    const contentH=model.view==='detail'?detailArtHeight(l)+detailExtra(model)+22:l.rowHeights[0]+l.rowHeights[1]+l.gap+22;
    buttons.maxScroll=Math.max(0,contentH-v.h);model.offset=Math.max(0,Math.min(buttons.maxScroll,model.offset));
    ctx.save();ctx.beginPath();ctx.rect(v.x,v.y,v.w,v.h);ctx.clip();
    if(model.view==='detail')drawDetail(ctx,screen,model,l,buttons,companion);
    else catalog.cats.forEach((cat,i)=>drawCard(ctx,screen,model,cat,{x:l.x+(i%2)*(l.cw+l.gap),y:v.y+12+(i<2?0:l.rowHeights[0]+l.gap)-model.offset,w:l.cw,h:l.rowHeights[Math.floor(i/2)]},buttons,v,companion));
    ctx.restore();
    if(model.view==='detail') {
        const state=catalog.statusFor(model,model.selectedId),r={x:l.x+12,y:v.y+v.h+28,w:l.w-24,h:44};
        const growth=catalog.growthFor(model,model.selectedId),next=catalog.stages[growth.stage+1];
        const condition=growth.enabled?(next?catalog.stages[growth.stage].name+' · '+growth.affection+'/'+next.threshold+' → '+next.name:'挚友 · 已满级，不再消耗小鱼干'):state==='owned'?'已领养 · 本轮先体验第一只猫':catalog.condition(model);
        label(ctx,condition,screen.width/2,v.y+v.h+12,l.w-12,11,INK);
        if(state==='adoptable'){button(ctx,r,'免费领养','lavender');buttons.adopt=r;}
        else if(growth.enabled){
            const action=next?'feed':'interaction';buttons[action]=r;
            button(ctx,r,next?(model.fish?'喂食 · 1 份小鱼干':'小鱼干不足 · 看看如何获取'):'摸摸它 · 免费互动','lavender');
        }
        else if(state==='owned')button(ctx,r,'其他猫咪成长 · 后续开放','muted');
        else button(ctx,r,model.owned.length<2?'陪伴满 7 天即可领养':'解锁规则待确定','muted');
    }
    if(buttons.maxScroll>0){
        const th=Math.max(28,v.h*v.h/contentH),ty=v.y+(v.h-th)*model.offset/buttons.maxScroll;
        ctx.fillStyle='rgba(255,246,239,.65)';round(ctx,v.x+v.w-2,ty,2,th,1);ctx.fill();
    }
    if(model.message){
        ctx.fillStyle='rgba(42,54,80,.95)';round(ctx,statX,statY-1,statW,30,15);ctx.fill();
        label(ctx,model.message,statX+statW/2,statY+14,statW-18,11,'#FFF');
    }
    return model.overlay?drawOverlay(ctx,screen,model,l):buttons;
}
module.exports={draw,layout,portrait,stageArt,background,button};
