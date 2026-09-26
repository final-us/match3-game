/** Static companion display and chapter reader; all controls stay editable. */
const catalog=require('../platform/catalog-preview');
const art=require('./catalog-ui');
const stories=require('../core/cat-stories');
const type=require('./typography');
const moon=require('./moon-controls');
const INK='#303653';
function text(ctx,s,x,y,w,size=13,bold=false){ctx.fillStyle=INK;type.drawFit(ctx,s,x,y,w,{size,minSize:10,align:'center',weight:bold?'700':'500'});}
function button(ctx,r,s,buttons,key){art.button(ctx,r,s,'lavender');if(key)buttons[key]=r;}
function drawHome(ctx,screen,r,selection,resources){
    const cat=catalog.cats.find(c=>c.id===selection.id),buttons={};if(!cat)return buttons;
    const width=Math.min(screen.width-32,320),x=(screen.width-width)/2,barY=r.y+r.h-46;
    if(r.h<150){
        const size=Math.min(96,r.h-6),rightX=x+size+12,rightW=width-size-12;
        moon.panel(ctx,screen,x,r.y,width,r.h);
        if(selection.stage===0||resources.status==='ready')art.stageArt(ctx,cat,{x:x+3,y:r.y+3,w:size,h:size},selection.stage);
        else text(ctx,resources.status==='error'?'原画待重试':'加载中…',x+size/2,r.y+size/2,size-8,11);
        text(ctx,cat.name+'陪伴着你',rightX+rightW/2,r.y+19,rightW-4,12,true);
        const bw=(rightW-8)/2;
        button(ctx,{x:rightX,y:r.y+r.h-46,w:bw,h:44},'切换',buttons,'companionSwitch');
        button(ctx,{x:rightX+bw+8,y:r.y+r.h-46,w:bw,h:44},'小故事',buttons,'companionStory');
        return buttons;
    }
    const h=Math.max(1,r.h-54),size=Math.min(width,h),ax=(screen.width-size)/2;
    ctx.save();ctx.shadowColor='rgba(47,32,84,.3)';ctx.shadowBlur=12;
    moon.panel(ctx,screen,ax-5,r.y-2,size+10,size+5);ctx.restore();
    const ready=selection.stage===0||resources.status==='ready';
    if(ready)art.stageArt(ctx,cat,{x:ax,y:r.y,w:size,h:size},selection.stage);
    else text(ctx,resources.status==='error'?'原画加载失败 · 点击小故事重试':'正在迎接'+cat.name,screen.width/2,r.y+h/2,width,12);
    moon.panel(ctx,screen,x,barY,width,44);
    const labelW=width-122;text(ctx,cat.name+'陪伴着你',x+labelW/2+4,barY+22,labelW-4,12,true);
    button(ctx,{x:x+width-120,y:barY,w:56,h:44},'切换',buttons,'companionSwitch');
    button(ctx,{x:x+width-62,y:barY,w:62,h:44},'小故事',buttons,'companionStory');
    return buttons;
}
function notice(ctx,screen,x,y,w,message){
    if(!message)return;
    text(ctx,message,x+w/2,y,w,11,true);
}
function dot(ctx,r,label){
    ctx.fillStyle='#884675';ctx.beginPath();ctx.arc(r.x+r.w-8,r.y+8,5,0,Math.PI*2);ctx.fill();
    if(label)text(ctx,label,r.x+r.w-18,r.y-7,40,10,true);
}
function selectedOutline(ctx,r){
    const x=r.x+2,y=r.y+2,w=r.w-4,h=r.h-4,q=18;
    ctx.strokeStyle='#805497';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+q,y);
    ctx.arcTo(x+w,y,x+w,y+h,q);ctx.arcTo(x+w,y+h,x,y+h,q);
    ctx.arcTo(x,y+h,x,y,q);ctx.arcTo(x,y,x+w,y,q);ctx.closePath();ctx.stroke();
}
function drawSwitch(ctx,screen,view,model,companion,resources){
    ctx.fillStyle='rgba(28,22,54,.48)';ctx.fillRect(0,0,screen.width,screen.height);
    const selected=companion.selection,owned=model&&model.status==='ready'?model.owned:[];
    const cats=catalog.cats.filter(c=>owned.includes(c.id)||(selected&&c.id===selected.id));
    const w=Math.min(344,screen.width-32),x=(screen.width-w)/2;
    const top=Math.max(screen.contentTop||0,20),bottom=screen.height-(screen.safeBottom||0)-16;
    const h=Math.min(bottom-top,196+Math.max(1,cats.length)*86),y=top+(bottom-top-h)/2;
    moon.panel(ctx,screen,x,y,w,h);
    const buttons={maxScroll:0},v={x:x+10,y:y+60,w:w-20,h:h-184};buttons.viewport=v;
    text(ctx,'选择陪伴猫咪',x+w/2-14,y+28,w-80,18,true);
    button(ctx,{x:x+w-52,y:y+6,w:44,h:44},'×',buttons,'close');
    buttons.maxScroll=Math.max(0,cats.length*86-v.h);view.offset=Math.max(0,Math.min(view.offset,buttons.maxScroll));
    ctx.save();ctx.beginPath();ctx.rect(v.x,v.y,v.w,v.h);ctx.clip();
    if(!cats.length)text(ctx,'先去图鉴领养一位伙伴吧',x+w/2,v.y+30,w-30,13);
    cats.forEach((cat,i)=>{
        const r={x:v.x,y:v.y+i*86-view.offset,w:v.w,h:78},current=selected&&selected.id===cat.id;
        const growth=owned.includes(cat.id)?catalog.growthFor(model,cat.id):null;
        const stage=current?selected.stage:growth&&growth.enabled?growth.displayStage:0;
        moon.panel(ctx,screen,r.x,r.y,r.w,r.h);
        if(stage===0||resources.status==='ready')art.stageArt(ctx,cat,{x:r.x+8,y:r.y+7,w:64,h:64},stage);
        else text(ctx,resources.status==='error'?'待重试':'加载中',r.x+40,r.y+39,62,10);
        text(ctx,cat.name,r.x+76+(r.w-82)/2,r.y+24,r.w-88,16,true);
        text(ctx,current?(owned.includes(cat.id)?'正在陪伴 · 更换形象':'正在陪伴 · 查看已存故事'):'查看形象与故事',r.x+76+(r.w-82)/2,r.y+53,r.w-88,11);
        if(companion.hasUnread&&companion.hasUnread(model,cat.id))dot(ctx,r);
        if(r.y>=v.y&&r.y+r.h<=v.y+v.h)buttons['choose:'+cat.id]=r;
    });ctx.restore();
    if(buttons.maxScroll){ctx.fillStyle='#9C77B3';ctx.fillRect(x+w-6,v.y+view.offset/buttons.maxScroll*(v.h-26),3,26);}
    const footer=y+h-100,r={x:x+14,y:footer+46,w:w-28,h:44};
    button(ctx,{x:r.x,y:footer,w:r.w,h:44},'去猫咪图鉴',buttons,'catalog');
    art.button(ctx,r,'恢复默认首页','muted');buttons.default=r;
    notice(ctx,screen,x+10,footer-12,w-20,companion.error||'选择仅保存在本机');
    return buttons;
}
function draw(ctx,screen,view,model,companion,resources){
    if(view.kind==='switch')return drawSwitch(ctx,screen,view,model,companion,resources);
    art.background(ctx,screen);
    const x=Math.max(16,(screen.safeLeft||0)+8),w=screen.width-x-Math.max(16,(screen.safeRight||0)+8);
    const top=Math.max(screen.contentTop||0,(screen.safeTop||0)+10,18),bottom=screen.height-(screen.safeBottom||0)-16;
    const buttons={maxScroll:0},cat=catalog.cats.find(c=>c.id===view.catId),stage=view.stage,unlocked=stage<=view.unlocked;
    const ready=stage===0||resources.status==='ready',owned=model&&model.status==='ready'&&model.owned.includes(cat.id);
    const growth=owned?catalog.growthFor(model,cat.id):null;
    button(ctx,{x,y:top,w:44,h:44},'‹',buttons,'close');
    moon.panel(ctx,screen,x+52,top,w-52,44);
    text(ctx,cat.name+'的小故事',x+52+(w-52)/2,top+22,w-64,19,true);
    moon.panel(ctx,screen,x-3,top+53,w+6,bottom-top-49);
    for(let i=0;i<5;i++){
        const cell=w/5,r={x:x+cell*i+1,y:top+62,w:cell-2,h:48},open=i<=view.unlocked;
        art.button(ctx,r,catalog.stages[i].name,open?'lavender':'muted');buttons['chapter:'+i]=r;
        if(i===stage)selectedOutline(ctx,r);
        if(!open){ctx.strokeStyle='#725982';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(r.x+r.w/2,r.y+7,3,Math.PI,0);ctx.stroke();ctx.strokeRect(r.x+r.w/2-4,r.y+7,8,6);}
        else if(companion.read&&!(companion.read[cat.id]&(1<<i)))dot(ctx,r);
    }
    const footer=bottom-94,v={x,y:top+120,w,h:footer-(top+120)-24};buttons.viewport=v;
    const artH=Math.min(w-30,250,Math.max(64,v.h-120)),contentH=artH+120;
    buttons.maxScroll=Math.max(0,contentH-v.h);view.offset=Math.max(0,Math.min(view.offset,buttons.maxScroll));
    const y=v.y+3-view.offset;
    ctx.save();ctx.beginPath();ctx.rect(v.x,v.y,v.w,v.h);ctx.clip();
    if(!unlocked){
        text(ctx,'这篇故事还没有解锁',x+w/2,y+40,w-24,17,true);
        text(ctx,growth&&growth.enabled?'再喂 '+Math.max(0,catalog.stages[stage].threshold-growth.affection)+' 次，就能读到新故事':'亲密度达到 '+catalog.stages[stage].threshold+' 后阅读',x+w/2,y+76,w-24,13);
        text(ctx,growth&&growth.enabled?'当前亲密度 '+growth.affection+' / '+catalog.stages[stage].threshold:owned?'这只猫的成长暂未开放':'本机仅保留已解锁的故事',x+w/2,y+105,w-24,12);
    }else if(!ready){
        text(ctx,resources.status==='error'?'原画加载失败':'正在打开小故事…',x+w/2,y+60,w-24,16,true);
        text(ctx,resources.message||('加载 '+resources.progress+'%'),x+w/2,y+92,w-24,12);
    }else{
        art.stageArt(ctx,cat,{x:x+(w-artH)/2,y,w:artH,h:artH},stage);
        text(ctx,catalog.stages[stage].name+' · 第'+(stage+1)+'篇',x+w/2,y+artH+18,w-22,12);
        const story=stories[cat.id][stage];
        text(ctx,story.title,x+w/2,y+artH+41,w-26,16,true);
        story.lines.forEach((line,i)=>text(ctx,line,x+w/2,y+artH+64+i*20,w-24,13));
    }
    ctx.restore();
    const add=(key,s,fy)=>button(ctx,{x:x+10,y:fy,w:w-20,h:44},s,buttons,key);
    if(companion.error)add('retry-save','保存失败 · 点此重试',footer);
    else if(!unlocked)add(growth&&growth.enabled?'feed':'catalog',growth&&growth.enabled?'去喂'+cat.name:'去图鉴看看',footer);
    else if(!ready){if(resources.status==='error')add('retry','重新加载',footer);}
    else if(owned&&stage<=(growth.enabled?growth.stage:0)){
        const current=companion.selection&&companion.selection.id===cat.id&&companion.selection.stage===stage;
        if(current){art.button(ctx,{x:x+10,y:footer,w:w-20,h:44},'正在陪伴你','muted');}
        else add('select','让'+cat.name+'陪伴我',footer);
    }
    add('close',view.backSwitch?'返回选择':view.returnState==='catalog_preview'?'回到图鉴':'返回首页',bottom-44);
    notice(ctx,screen,x+8,footer-12,w-16,companion.error?'原陪伴保留，记录尚未保存':!owned?'仅保留本机回忆，可在图鉴查看领养':'');
    view.readVisible=ready&&unlocked&&y+artH+111<=v.y+v.h;
    return buttons;
}
module.exports={drawHome,draw,dot};
