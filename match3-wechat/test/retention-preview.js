'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const preview=require('../js/platform/retention-preview');
const UI=require('../js/render/retention-ui');
const home=require('../js/render/ui');
const assets=require('../js/render/assets');
assets.preload();
const ctx=new Proxy({}, {get(target,key){
    if(key in target)return target[key];
    if(key==='measureText')return s=>({width:String(s).length*7});
    if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop(){}});
    return ()=>{};
},set(target,key,value){target[key]=value;return true;}});

for(const channel of ['release','trial','',null])assert(!preview.isEnabled({getAccountInfoSync:()=>({miniProgram:{envVersion:channel}})}));
assert(preview.isEnabled({getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}})}));
assert(!preview.isEnabled({getAccountInfoSync(){throw Error('unsupported');}}));
assert(!preview.isEnabled(null));

const file=require.resolve('../js/main'),req=require('module').createRequire(file),moduleFixture={exports:{}};
const blocked=()=>{throw Error('Preview must not access platform state or network');};
vm.runInNewContext(fs.readFileSync(file,'utf8'),{module:moduleFixture,wx:{getStorageSync:blocked,setStorageSync:blocked,cloud:{callFunction:blocked}},require:name=>name==='./audio'?{click(){},unlock(){}}:req(name)}, {filename:file});
const app=Object.create(moduleFixture.exports.prototype);
app.state='menu';app.retentionPreviewEnabled=false;app.openRetentionPreview();assert.equal(app.state,'menu');
app.retentionPreviewEnabled=true;app.openRetentionPreview();assert.equal(app.state,'retention_preview');
app.handleGuideTouch=()=>false;app.handleStaminaDialogTouch=()=>false;
const screen={width:390,height:844,safeTop:47,contentTop:91,safeBottom:34};
function render(){app.retentionButtons=UI.draw(ctx,screen,app.retentionPreview);}
function center(r){return {clientX:r.x+r.w/2,clientY:r.y+r.h/2};}
function tap(key){render();const p=center(app.retentionButtons[key]);app.handleTouchStart({touches:[p]});app.handleTouchEnd({changedTouches:[p]});}
tap('primary');assert(app.retentionPreview.signed);assert.equal(app.retentionPreview.activity,20);
assert(app.retentionPreview.message.includes('未入账'));preview.activate(app.retentionPreview,'primary');assert.equal(app.retentionPreview.activity,20);
app.retentionPreview=preview.create();render();
const p=center(app.retentionButtons.primary);
app.handleTouchStart({touches:[p]});app.handleTouchMove({touches:[{clientX:p.clientX,clientY:p.clientY-35}]});app.handleTouchEnd({changedTouches:[p]});
assert(!app.retentionPreview.signed,'drag that returns to button must not claim');
render();app.handleTouchStart({touches:[center(app.retentionButtons.primary)]});app.handleHide();app.handleTouchEnd({changedTouches:[p]});
assert(!app.retentionPreview.signed,'background cancels pending tap');
tap('tasksTab');assert.equal(app.retentionPreview.tab,'tasks');assert.equal(app.retentionPreview.offset,0);
tap('rules');assert(app.retentionPreview.rules);tap('rules');assert(!app.retentionPreview.rules);assert.equal(app.state,'retention_preview');
tap('rules');tap('close');assert.equal(app.state,'menu');app.openRetentionPreview();
app.retentionPreview.status='offline';app.retentionPreview.offset=20;tap('primary');assert.equal(app.retentionPreview.status,'ready');assert.equal(app.retentionPreview.offset,0);
app.retentionPreview.status='pending';render();assert(!app.retentionButtons.primary);tap('close');assert.equal(app.state,'menu');

for(const [width,height] of [[320,568],[390,844],[430,932]]){
    const s={...screen,width,height};
    for(const tab of ['signin','tasks'])for(const status of ['ready','loading','offline','error','pending'])for(const offset of [0,9999]){
        const data={...preview.create(),tab,status,offset,activity:500};
    const b=UI.draw(ctx,s,data),targets=Object.entries(b).filter(([k])=>!['viewport','maxScroll'].includes(k));
        if(status==='offline'||status==='error')assert(b.primary,'retry must be visible without scrolling');
        for(const [key,r] of targets){
            assert(r.w>=44&&r.h>=44,key+' minimum touch size');
            assert(r.x>=0&&r.x+r.w<=width&&r.y>=s.contentTop&&r.y+r.h<=height-s.safeBottom,key+' safe bounds');
        }
        for(let i=0;i<targets.length;i++)for(let j=i+1;j<targets.length;j++){
            const [ak,a]=targets[i],[bk,b]=targets[j];
            assert(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),ak+' overlaps '+bk);
        }
        assert(Number.isFinite(b.maxScroll)&&b.maxScroll>=0);
    }
    const h=home.drawMenu(ctx,s,5,{count:0,canPlay:false,canAd:true},{coins:1000,retentionPreview:true});
    for(const key of ['shop','daily','retention','settings','addHeart'])assert(h[key].w>=44&&h[key].x>=0&&h[key].x+h[key].w<=width);
    assert(!home.drawMenu(ctx,s,5,{count:5,canPlay:true},{coins:1000}).retention,'default homepage must not expose preview');
}
const day7={...preview.create(),signDay:7};preview.activate(day7,'primary');assert(day7.message.includes('200金币＋锤子×1'));assert(day7.signed);
const weekly={...preview.create(),activity:500};
for(let i=0;i<3;i++){preview.activate(weekly,'weekly'+i);assert(weekly.claimed[i]);assert(weekly.message.includes([300,500,1000][i]+'金币'));}
assert.equal(weekly.activity,500,'claims do not spend activity');
const previous={...preview.create(),activity:20,previousWeek:{available:[true,false,true],claimed:[false,false,false]}};
preview.activate(previous,'previous0');assert(previous.previousWeek.claimed[0]);assert.equal(previous.activity,20);
preview.activate(previous,'previous1');assert(!previous.previousWeek.claimed[1]);
for(const [width,height] of [[320,568],[390,844],[430,932]]){
    const buttons=UI.draw(ctx,{...screen,width,height},{...previous,offset:9999});
    assert(!buttons.previous0&&!buttons.previous1&&buttons.previous2);
    const r=buttons.previous2;assert(r.w>=44&&r.h>=44&&r.y+r.h<=buttons.viewport.y+buttons.viewport.h);
}
app.openRetentionPreview();app.retentionPreview={...previous,offset:9999};tap('previous2');
assert(app.retentionPreview.previousWeek.claimed[2],'Main dispatches previous-week claims');assert.equal(app.retentionPreview.activity,20);
console.log('retention preview: channel isolation, temporary claims, touch/scroll/cancel, safe targets and fixed rewards passed');
