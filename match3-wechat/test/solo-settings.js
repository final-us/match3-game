'use strict';
// Real Main/Core routes; only platform modal, audio and persistence boundary are isolated.
const assert=require('assert');
const {fixture}=require('./battle-client');
const GameCore=require('../js/core/game-core');
const UI=require('../js/render/ui'),layout=require('../js/render/game-layout');
let music=true,sfx=true,closeOk=true,closed=0,retired=0;
const f=fixture({audio:{unlock(){},click(){},isMusicEnabled:()=>music,isSfxEnabled:()=>sfx,setMusicEnabled:v=>{music=v;},setSfxEnabled:v=>{sfx=v;}},
    soloResume:{close(){closed++;return {ok:closeOk};}}});
const a=f.app;
const core=a.core=new GameCore({id:1,rows:8,columns:8,moveCount:20,timeLimitSec:60,goals:[{type:'score',target:999999}]},{});
core.timerStarted=true;
let cancelled=0,updates=0;
a.board={onTouchCancel(){cancelled++;},update(){updates++;}};
a.state='playing';a.runtimeState='solo_settings';a.syncSoloReportClock=()=>{};
a.retireSoloReport=()=>{retired++;};
a.openSoloSettings();assert.equal(a.state,'solo_settings');assert(core.timerPaused);assert.equal(cancelled,1);
const before=core.timeLeftMs;a.update(8000);assert.equal(core.timeLeftMs,before,'settings pauses the actual countdown');assert.equal(updates,0);
a.soloSettingsButtons={music:{x:0,y:0,w:44,h:44},sfx:{x:50,y:0,w:44,h:44},resume:{x:100,y:0,w:44,h:44},home:{x:150,y:0,w:44,h:44}};
a.handleStaminaDialogTouch=()=>false;
const tap=x=>a.handleTouchStart({touches:[{clientX:x,clientY:20}]});
tap(20);tap(70);assert(!music&&!sfx,'in-game switches use the shared audio controls');
tap(120);assert.equal(a.state,'playing');assert(!core.timerPaused);
a.runtimeState='playing';a.guide={};a.update(1000);assert.equal(core.timeLeftMs,before-1000);a.guide=null;
core.processing=true;a.openSoloSettings();assert.equal(a.state,'playing','do not interrupt resolution or persistence');core.processing=false;
a.openSoloSettings();a.exitSoloSettings();assert.equal(f.modals.length,1);a.exitSoloSettings();assert.equal(f.modals.length,1,'one exit confirmation at a time');
f.modals[0].success({confirm:false});f.modals[0].complete();assert.equal(a.state,'playing');assert.equal(retired,0);
a.openSoloSettings();a.soloResumeRecord={id:'existing'};closeOk=false;
a.exitSoloSettings();f.modals[1].success({confirm:true});f.modals[1].complete();assert.equal(a.state,'solo_settings');assert(a.soloResumeRecord);assert.equal(retired,0,'failed close cannot discard the run');
closeOk=true;a.exitSoloSettings();f.modals[2].success({confirm:true});f.modals[2].complete();
assert.equal(a.state,'menu');assert.equal(a.core,null);assert.equal(a.board,null);assert.equal(a.soloResumeRecord,null);assert.equal(retired,1);assert.equal(closed,2);
const ctx=new Proxy({}, {get(t,k){if(k==='measureText')return text=>({width:String(text).length*12});if(k==='createLinearGradient'||k==='createRadialGradient')return ()=>({addColorStop(){}});return t[k]||(()=>{});},set(t,k,v){t[k]=v;return true;}});
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const moon=require('../js/render/moon-controls'),drawButton=moon.button;
let paintedButton;
moon.button=function(ctx,x,y,w,h,...rest){paintedButton={x,y,w,h};return drawButton.call(this,ctx,x,y,w,h,...rest);};
for(const [width,height]of [[320,568],[390,844],[430,932]]){
  for(const insets of [{safeTop:0,contentTop:0,safeBottom:0},
    {safeTop:24,contentTop:68,safeBottom:0,menuButtonRect:{x:width-97,y:32,w:87,h:32}},
    {safeTop:47,contentTop:91,safeBottom:34,menuButtonRect:{x:width-97,y:55,w:87,h:32}},
    {safeTop:59,contentTop:105,safeBottom:34,menuButtonRect:{x:width-97,y:69,w:87,h:32}},
    {safeTop:47,contentTop:91,safeBottom:34,safeLeft:8,safeRight:8,menuButtonRect:{x:width-97,y:55,w:87,h:32}}]){
    const screen={width,height,...insets};
    const button=UI.drawSoloSettingsButton(ctx,screen),hud=layout.solo(screen,8,8,{});
    assert(button.w>=44&&button.h>=44&&button.y>=0&&button.y+button.h<=hud.hudY,
        'settings hit area stays above the original HUD');
    assert(paintedButton.y>=0&&paintedButton.y+paintedButton.h<=hud.hudY,'visible button does not cover the HUD');
    if(screen.menuButtonRect){
        const capsule=screen.menuButtonRect;
        assert.strictEqual(paintedButton.y+paintedButton.h/2,capsule.y+capsule.h/2,'align to the actual native capsule center');
        assert(paintedButton.x+paintedButton.w<capsule.x,'left button cannot overlap native capsule');
    }
    assert(!intersects(button,{x:0,y:hud.goalsY,w:width,h:hud.goalsH}),'settings cannot cover targets/timer');
    assert(UI.hitTest(button.x+button.w/2,button.y+button.h/2,button),'drawn control remains clickable at its center');
    for(const buttons of [UI.drawSoloSettings(ctx,screen,{musicEnabled:true,sfxEnabled:false}),UI.drawAvatarConsent(ctx,screen,true)]){
        const list=Object.values(buttons);for(const r of list)assert(r.w>=44&&r.h>=44&&r.x>=0&&r.x+r.w<=width&&r.y+r.h<=height-screen.safeBottom);
        for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++)assert(!intersects(list[i],list[j]));
    }
  }
}
moon.button=drawButton;
console.log('solo settings: pause/resume, audio, busy guard, exit/cancel/save failure and three viewport controls passed');
