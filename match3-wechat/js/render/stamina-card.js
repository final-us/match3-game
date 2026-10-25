'use strict';
const assets = require('./assets');
const type = require('./typography');
const art = require('./illustration-art');
const SERIF = '"Songti SC","STSong","Noto Serif CJK SC",Georgia,serif';

function image(ctx,key,x,y,w,h) {
    const img=assets.get(key);
    if(!img||!img.width||!img.height)return false;
    const scale=Math.min(w/img.width,h/img.height);
    ctx.drawImage(img,x+(w-img.width*scale)/2,y+(h-img.height*scale)/2,img.width*scale,img.height*scale);
    return true;
}
function label(ctx,value,x,y,w,size,color) {
    ctx.fillStyle=color;
    type.drawFit(ctx,String(value),x,y,w,{size,minSize:Math.max(10,size-3),align:'center',weight:'bold',family:SERIF});
}
function video(ctx,x,y,size) {
    ctx.save();ctx.strokeStyle='#17365E';ctx.fillStyle='#17365E';ctx.lineWidth=1.8;
    ctx.strokeRect(x+2,y+4,size-4,size-8);
    ctx.beginPath();ctx.moveTo(x+size*.42,y+size*.28);ctx.lineTo(x+size*.72,y+size*.5);ctx.lineTo(x+size*.42,y+size*.72);ctx.closePath();ctx.fill();ctx.restore();
}
function infoFrame(ctx,x,y,w,h) {
    const r=h*.45;
    ctx.save();ctx.fillStyle='rgba(255,252,240,.78)';ctx.strokeStyle='#E3B984';ctx.lineWidth=.8;
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+h/2);
    ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h/2);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();ctx.fill();ctx.stroke();
    for(const px of [x+4,x+w-4]){
        ctx.beginPath();ctx.moveTo(px,y+h/2-7);ctx.lineTo(px+5,y+h/2);ctx.lineTo(px,y+h/2+7);ctx.lineTo(px-5,y+h/2);ctx.closePath();ctx.stroke();
    }
    ctx.restore();
}
function draw(ctx,screen,options) {
    options=options||{};
    const cx=screen.width/2,top=Math.max(screen.contentTop||0,(screen.safeTop||0)+12);
    const available=screen.height-top-(screen.safeBottom||0)-12,compact=available<550;
    const w=Math.min(360,screen.width-24),heroSpace=compact?88:140,frameH=compact?326:380;
    const h=heroSpace+frameH,x=cx-w/2,y=top+(available-h)/2,frameY=y+heroSpace;
    const titleY=frameY+(compact?90:110),infoY=frameY+(compact?118:142);
    const actionY=frameY+(compact?188:222),actionH=compact?54:64;
    ctx.save();ctx.fillStyle='rgba(19,26,53,.64)';ctx.fillRect(0,0,screen.width,screen.height);
    art.paperFrame(ctx,x,frameY,w,frameH);
    // The same sad moon and fallback as the loss result; it covers the unused
    // frame title plate while the editable heading sits on the cream body.
    const heroH=heroSpace+w*.18;
    if(!image(ctx,'uiResultLoseMoon',x+w*.07,y,w*.86,heroH))image(ctx,'uiResultSadCat',x+w*.14,y+8,w*.72,heroH-8);
    label(ctx,'体力不足',cx,titleY,w*.72,compact?32:38,'#283468');
    const infoW=w*.66,infoH=compact?58:66;
    infoFrame(ctx,cx-infoW/2,infoY,infoW,infoH);
    if(options.storageReady===false){
        label(ctx,'体力记录暂不可用',cx,infoY+infoH*.33,infoW-16,12,'#55486E');
        label(ctx,'请稍后重试',cx,infoY+infoH*.70,infoW-16,12,'#55486E');
    } else {
        label(ctx,'下一点体力',cx,infoY+(compact?13:16),infoW-16,compact?13:15,'#44416F');
        const time=options.timeLeftText||'--:--',value=time+' 后恢复';
        const size=type.fitFontSize(ctx,value,infoW-16,compact?21:25,compact?18:22,'bold',false,SERIF);
        type.set(ctx,size,'bold',false,'center','middle',SERIF);
        const textW=type.measure(ctx,value),split=type.measure(ctx,time+' ')/textW;
        const color=ctx.createLinearGradient(cx-textW/2,0,cx+textW/2,0);
        color.addColorStop(0,'#C12D70');color.addColorStop(Math.max(0,split-.002),'#C12D70');color.addColorStop(split,'#30386A');color.addColorStop(1,'#30386A');
        label(ctx,value,cx,infoY+(compact?38:44),infoW-16,size,color);
    }
    const hasAd=!!options.canAd,canBuy=options.canBuy!==false,gap=12;
    const actionW=hasAd?(w-48-gap)/2:w-64,buyX=hasAd?x+24:cx-actionW/2;
    art.button(ctx,buyX,actionY,actionW,actionH,'',canBuy?'pink':'muted');
    const icon=compact?28:34;
    if(!image(ctx,'uiIllustrationCoins',buyX+4,actionY+8,icon+10,actionH-16))image(ctx,'uiCoin',buyX+7,actionY+(actionH-icon)/2,icon,icon);
    const buyCopyW=actionW-icon-19,buyCopyX=buyX+icon+11+buyCopyW/2;
    label(ctx,canBuy?(Number(options.staminaPrice)||1000)+'金币':'金币不足',buyCopyX,actionY+actionH*.32,buyCopyW,compact?13:16,canBuy?'#493454':'#5E6380');
    label(ctx,'＋1体力',buyCopyX,actionY+actionH*.70,buyCopyW,compact?14:17,canBuy?'#493454':'#5E6380');
    const buttons={buy:{x:buyX,y:actionY,w:actionW,h:actionH}};
    if(hasAd){
        const adX=buyX+actionW+gap;
        art.button(ctx,adX,actionY,actionW,actionH,'','ad');
        video(ctx,adX+8,actionY+(actionH-icon)/2,icon);
        const copyW=actionW-icon-18,copyX=adX+icon+10+copyW/2;
        label(ctx,'看广告',copyX,actionY+actionH*.32,copyW,compact?15:18,'#17365E');
        label(ctx,'＋1体力',copyX,actionY+actionH*.70,copyW,compact?14:17,'#17365E');
        buttons.ad={x:adX,y:actionY,w:actionW,h:actionH};
    }
    const closeY=actionY+actionH+12;
    art.decoratedButton(ctx,cx-78,closeY,156,44,'稍后再说','blue',compact?16:18);
    buttons.close={x:cx-78,y:closeY,w:156,h:44};
    ctx.restore();return buttons;
}
module.exports={draw};
