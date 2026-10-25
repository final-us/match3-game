'use strict';
const assert=require('assert');
const stamina=require('../js/render/stamina-card');
const assets=require('../js/render/assets');
const art=require('../js/render/illustration-art');
const text=[],images=[],paintedButtons=[];
const saved=[];
const fontSize=font=>Number(String(font).match(/(\d+)px/)[1]);
const ctx=new Proxy({}, {get(target,key){
    if(key in target)return target[key];
    if(key==='save')return ()=>saved.push({...target});
    if(key==='restore')return ()=>Object.assign(target,saved.pop());
    if(key==='measureText')return value=>({width:Array.from(String(value)).reduce((sum,ch)=>sum+(/[\u3000-\uffff]/.test(ch)?1:.56)*fontSize(target.font),0)});
    if(key==='fillText')return (value,x,y)=>text.push({value:String(value),x,y,font:target.font});
    if(key==='drawImage')return (...args)=>images.push(args);
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
    return ()=>{};
},set(target,key,value){target[key]=value;return true;}});
const get=assets.get,frame={width:512,height:680},hero={width:640,height:480},fallback={width:480,height:480};
const originalButton=art.button, originalDecorated=art.decoratedButton;
art.button=(ctx,x,y,w,h,label,...rest)=>{paintedButtons.push({x,y,w,h,label});return originalButton(ctx,x,y,w,h,label,...rest);};
art.decoratedButton=(ctx,x,y,w,h,label,tone,...rest)=>{paintedButtons.push({x,y,w,h,label,tone});return originalDecorated(ctx,x,y,w,h,label,tone,...rest);};
try {
    for(const artwork of ['none','fallback','full'])for(const [width,height] of [[320,568],[390,844],[430,932]]) {
        assets.get=key=>artwork==='none'?null:key==='uiIllustrationFrame'?frame:key==='uiResultLoseMoon'&&artwork==='full'?hero:key==='uiResultSadCat'?fallback:null;
        const screen={width,height,contentTop:91,safeBottom:34};
        for(const canAd of [false,true])for(const canBuy of [false,true])for(const storageReady of [false,true]) {
            text.length=images.length=paintedButtons.length=0;
            const b=stamina.draw(ctx,screen,{canAd,canBuy,storageReady,staminaPrice:1234,timeLeftText:'12:34'});
            assert.equal(!!b.ad,canAd);
            assert(b.buy&&b.close);
            assert(text.some(t=>t.value===(storageReady?'12:34 后恢复':'体力记录暂不可用')));
            assert(text.some(t=>t.value===(canBuy?'1234金币':'金币不足')));
            const title=text.find(t=>t.value==='体力不足'),titleH=fontSize(title.font),titleW=titleH*4;
            assert(title.font.includes('Songti SC'),'reference serif heading');
            assert(!text.some(t=>t.value==='体力耗尽'),'accepted insufficient-stamina copy');
            assert(paintedButtons.some(b=>b.label==='稍后再说'&&b.tone==='blue'),'dismissal uses the shared light-blue role');
            assert.equal(paintedButtons.length,canAd?3:2,'purchase, optional ad and explicit dismissal');
            if(artwork!=='none'){
                const tiles=images.filter(a=>a[0]===frame);
                assert.equal(tiles.length,9,'shared paper frame');
                const titleBox={x:title.x-titleW/2,y:title.y-titleH/2,w:titleW,h:titleH};
                for(const [px,py] of [[titleBox.x,titleBox.y],[titleBox.x+titleBox.w,titleBox.y],[titleBox.x,titleBox.y+titleBox.h],[titleBox.x+titleBox.w,titleBox.y+titleBox.h]]){
                    const tile=tiles.find(a=>px>=a[5]&&px<=a[5]+a[7]&&py>=a[6]&&py<=a[6]+a[8]);
                    assert(tile,'complete title covered by paper');
                    const sx=tile[1]+(px-tile[5])/tile[7]*tile[3],sy=tile[2]+(py-tile[6])/tile[8]*tile[4];
                    assert(sx>=110&&sx<=402&&sy>=108&&sy<=550,'complete title in undecorated cream paper');
                }
                const cat=images.find(a=>a[0]===(artwork==='full'?hero:fallback));
                assert(cat,'sad moon or sad-cat fallback');
                assert(cat[2]+cat[4]+6<=titleBox.y,'cat and complete heading are separate');
            }
            const info=text.find(t=>t.value===(storageReady?'下一点体力':'体力记录暂不可用'));
            assert(title.y+titleH/2+4<=info.y-fontSize(info.font)/2,'title and status have distinct baselines');
            const lastInfo=storageReady?text.find(t=>t.value==='12:34 后恢复'):text.find(t=>t.value==='请稍后重试');
            assert(lastInfo.y+fontSize(lastInfo.font)/2+8<=b.buy.y,'status/countdown does not crowd actions');
            const entries=Object.values(b);
            for(const r of entries)assert(r.w>=44&&r.h>=44&&r.x>=0&&r.x+r.w<=width&&r.y>=91&&r.y+r.h<=height-34);
            for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++) {
                const a=entries[i],c=entries[j];
                assert(!(a.x<c.x+c.w&&a.x+a.w>c.x&&a.y<c.y+c.h&&a.y+a.h>c.y));
            }
        }
    }
} finally {assets.get=get;art.button=originalButton;art.decoratedButton=originalDecorated;}
console.log('stamina card: three safe viewports, paper/serif title, shared sad moon/fallback, light-blue dismissal, text/action spacing and optional-art fallback passed');
