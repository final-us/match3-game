'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const preview=require('../js/platform/retention-preview');
const UI=require('../js/render/retention-ui');
const home=require('../js/render/ui');
const assets=require('../js/render/assets');
assets.preload();
const drawnText=[],drawnLabels=[],drawnShapes=[],canvasStates=[];
let pathPoints=[];
function fontHeight(target){return parseFloat((target.font||'0px').match(/[\d.]+px/)[0]);}
function textWidth(value,target){return Array.from(String(value)).reduce((sum,char)=>sum+fontHeight(target)*(/[^\x00-\xff]/.test(char)?1:.56),0);}
const ctx=new Proxy({}, {get(target,key){
    if(key==='save')return ()=>canvasStates.push({...target});
    if(key==='restore')return ()=>{const saved=canvasStates.pop();for(const name of Object.keys(target))delete target[name];Object.assign(target,saved);};
    if(key in target)return target[key];
    if(key==='measureText')return s=>({width:textWidth(s,target)});
    if(key==='fillText'||key==='strokeText')return (s,x,y)=>{
        drawnText.push(String(s));drawnLabels.push({value:String(s),x,y,font:target.font,align:target.textAlign,shadowColor:target.shadowColor,shadowBlur:target.shadowBlur,height:fontHeight(target),width:textWidth(s,target)});
    };
    if(key==='beginPath')return ()=>{pathPoints=[];};
    if(['moveTo','lineTo','quadraticCurveTo'].includes(key))return (...values)=>{for(let i=0;i<values.length;i+=2)pathPoints.push([values[i],values[i+1]]);};
    if(key==='fill')return ()=>{if(pathPoints.length){const xs=pathPoints.map(p=>p[0]),ys=pathPoints.map(p=>p[1]);drawnShapes.push({x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)});}};
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
render();assert(!app.retentionButtons.rules,'rules entry removed');
tap('close');assert.equal(app.state,'menu');app.openRetentionPreview();
app.retentionPreview.status='offline';app.retentionPreview.offset=20;tap('primary');assert.equal(app.retentionPreview.status,'ready');assert.equal(app.retentionPreview.offset,0);
app.retentionPreview.status='pending';render();assert(!app.retentionButtons.primary);tap('close');assert.equal(app.state,'menu');

for(const [width,height] of [[320,568],[390,844],[430,932]]){
    const s={...screen,width,height};
    const taskPage={...preview.create(),tab:'tasks',activity:500,taskProgress:[1,2,80]};
    drawnLabels.length=0;drawnShapes.length=0;
    const taskButtons=UI.draw(ctx,s,taskPage);
    const l=UI.layout(s);
    const title=drawnLabels.find(label=>label.value==='每日金币');
    const subtitle=drawnLabels.find(label=>label.value==='完成任务领金币');
    assert(title.y-title.height/2>=taskButtons.close.y+taskButtons.close.h+2,'title clears the close control');
    assert(subtitle.y-subtitle.height/2>=title.y+title.height/2+2,'subtitle clears title');
    assert(subtitle.y+subtitle.height/2<=taskButtons.tasksTab.y-4,'subtitle clears tabs');
    assert(title.y+title.height/2<l.frameY,'heading stays above the paper frame');
    assert(subtitle.y+subtitle.height/2<l.frameY+l.w*.04,'subtitle clears the topmost paper ornaments');
    assert.equal(taskButtons.signinTab.y+22,l.frameY+l.w*.13,'tabs occupy the blank blue plaque');
    assert(taskButtons.viewport.y>=l.frameY+l.w*.24,'body starts on quiet warm paper');
    assert(taskButtons.viewport.y+taskButtons.viewport.h<=l.bottom-l.w*.18,'body clears bottom flower decoration');
    for(const value of ['1/1','2/2','80/80']){
        const label=drawnLabels.find(item=>item.value===value);
        assert(drawnShapes.some(r=>r.h>=label.height&&r.h<=18&&r.w>=44&&label.x-label.width/2>=r.x&&label.x+label.width/2<=r.x+r.w&&label.y-label.height/2>=r.y&&label.y+label.height/2<=r.y+r.h),'task progress is readable inside its progress bar');
    }
    for(const label of drawnLabels.filter(item=>/每日金币|完成任务领金币|累计|完成1局|活跃|金币/.test(item.value)))assert(label.height>=11,'important labels keep readable type');
    if(width>=390){
        assert.equal(taskButtons.maxScroll,0,'standard phones show all tasks and complete weekly chests without scrolling');
        for(const key of ['task0','task1','task2','primary','weekly0','weekly1','weekly2'])assert(taskButtons[key],key+' visible on first page');
    }else{
        assert(taskButtons.maxScroll>0,'short screens retain scrolling');
        const bottom=UI.draw(ctx,s,{...taskPage,offset:taskButtons.maxScroll});
        for(const key of ['weekly0','weekly1','weekly2'])assert(bottom[key],key+' fully visible at scroll bottom');
    }
    for(const tab of ['signin','tasks'])for(const status of ['ready','loading','offline','error','pending'])for(const offset of [0,9999]){
        const data={...preview.create(),tab,status,offset,activity:500,taskProgress:[1,2,80]};
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
app.openRetentionPreview();app.retentionPreview={...preview.create(),tab:'tasks',taskProgress:[1,2,80]};
tap('task0');assert(app.retentionPreview.taskClaimed[0]);assert.equal(app.retentionPreview.activity,20);
render();assert(!app.retentionButtons.task0);tap('task1');assert.equal(app.retentionPreview.activity,50);
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
const art=require('../js/render/illustration-art'),paperFrame=art.paperFrame,oldFrame=art.drawFrame,card=art.card;
try {
    const frames=[],cards=[];
    art.paperFrame=(...args)=>{frames.push(args.slice(1));return paperFrame(...args);};
    art.drawFrame=()=>{throw Error('retention must not reuse the result podium frame');};
    art.card=(...args)=>{cards.push(args.slice(1));return card(...args);};
    for(const [width,height] of [[320,568],[390,844],[430,932]]){
        frames.length=cards.length=drawnLabels.length=0;
        const s={...screen,width,height},l=UI.layout(s);
        const buttons=UI.draw(ctx,s,{...preview.create(),signDay:3});
        assert.deepEqual(frames,[[l.x,l.frameY,l.w,l.bottom-l.frameY]],'retention uses its dedicated paper frame');
        assert.equal(cards.length,7,'six sign cards and one wide day-seven card');
        assert.equal(cards.filter(c=>c[4]).length,1,'today has the single selected gold card');
        assert.equal(drawnLabels.filter(label=>label.value==='已领').length,2,'claimed days retain pink ribbon labels');
        assert.equal(drawnLabels.filter(label=>label.value==='100').length,4,'claimed days retain the actual reward number');
        assert(!drawnLabels.some(item=>item.value.includes('连续签到')),'累计签到不应暗示漏签清零');
        for(const value of ['每日金币','签到领好礼','第1天','100']){
            const labels=drawnLabels.filter(item=>item.value===value);
            assert(labels.length>0);
            for(const label of labels){
                assert(label.font.includes('Songti'),'heading, dates and reward amounts use the system serif stack');
                assert(!label.shadowBlur,'paper layout needs no shadow to conceal a title collision');
            }
        }
        if(width>=390)assert.equal(buttons.maxScroll,0,'standard phones show the complete sign-in and weekly rewards');
        assert.equal(canvasStates.length,0,'Canvas state remains balanced');
    }
} finally {art.paperFrame=paperFrame;art.drawFrame=oldFrame;art.card=card;}
app.openRetentionPreview();app.retentionPreview={...previous,offset:9999};tap('previous2');
assert(app.retentionPreview.previousWeek.claimed[2],'Main dispatches previous-week claims');assert.equal(app.retentionPreview.activity,20);
for(const [width,height] of [[320,568],[390,844],[430,932]]){
    const s={...screen,width,height},base={...preview.create(),real:true,loaded:true,tab:'tasks',taskClaimMode:'manual-v1',taskProgress:[1,2,80],taskClaimed:[false,false,false],offset:9999};
    const ready=UI.draw(ctx,s,{...base,status:'ready'});
    drawnText.length=0;
    const pending=UI.draw(ctx,s,{...base,status:'pending',busy:true,pendingAction:'task0'});
    assert.equal(pending.maxScroll,ready.maxScroll,'claim keeps the original scroll plane');
    assert(drawnText.includes('每周宝箱')&&drawnText.includes('正在确认领取…'),'reward cards remain under the inline pending notice');
    assert(!pending.task0&&!pending.primary&&!pending.weekly0,'pending claims cannot be activated twice');
    assert(!drawnText.includes('猫咪正在整理金币'),'no replacement loading page');
    drawnText.length=0;
    UI.draw(ctx,s,{...base,status:'loading',loaded:false,offset:0});
    assert(drawnText.includes('完成1局游戏')&&drawnText.includes('正在同步进度…'),'first visit renders the ordinary page shell');
    assert(drawnText.includes('—/1'),'unconfirmed progress is not shown as a real zero');
    assert(drawnText.includes('同步中')&&!drawnText.includes('未完成'),'unconfirmed eligibility is not labeled failed or incomplete');
    drawnText.length=0;
    const failed=UI.draw(ctx,s,{...base,status:'offline',busy:false,message:'请检查网络'});
    assert(failed.primary&&drawnText.includes('网络连接暂时失败'),'real failure still provides recovery');
}
console.log('retention preview: channel isolation, temporary claims, touch/scroll/cancel, safe targets and fixed rewards passed');
assert(!drawnText.some(s=>/北京时间|刷新|规则|漏签不清零|当日领取|到期/.test(s)),'removed explanatory copy must not render');
