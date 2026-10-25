'use strict';
// Actual Main lifecycle/inputs; visual functions stubbed to observe paint order.
// SDK and storage are isolated; this is not visual or native-device acceptance.
const assert = require('assert'), fs = require('fs'), vm = require('vm');
const mainFile = require.resolve('../js/main');
const realRequire = require('module').createRequire(mainFile);
const homeAnalytics = require('../js/platform/home-analytics');
const settings = { enabled: true, testOnly: true, branches: { solo: 'test-solo', pvp: 'test-pvp' } };
const solo = {x:10,y:10,w:70,h:45}, pvp = {x:110,y:10,w:70,h:45};
const storage = {}; let calls, paints, sdkThrows;
global.wx = {
    getAccountInfoSync: () => ({miniProgram:{envVersion:'develop'}}),
    getStorageSync: key => storage[key] || '', setStorageSync: (key,value) => {storage[key]=value;},
    reportUserBehaviorBranchAnalytics(payload) {
        assert(paints > 0, 'exposure cannot precede the first painted home frame');
        if(sdkThrows)throw Error('isolated SDK failure');
        calls.push({...payload});
    }
};
const hit = (x,y,r) => !!r && x>=r.x && y>=r.y && x<=r.x+r.w && y<=r.y+r.h;
const ui = {
    drawMenu() { paints++; return {start:solo,battle:pvp}; },
    drawStaminaEmpty: () => ({}), drawSettings: () => ({}), drawLevelSelect: () => ({}),
    hitTest: hit
};
const audio = new Proxy({}, {get:()=>()=>{}});
const ad = {isRewardedAvailable:()=>false,isRealRewardedAvailable:()=>false,getDiagnosticLines:()=>[],onShow(){},onHide(){}};
const loaded = {exports:{}};
vm.runInNewContext(fs.readFileSync(mainFile,'utf8'), {
    module:loaded, wx:global.wx,
    require:name => name==='./render/ui'?ui:name==='./audio'?audio:name==='./core/ad'?ad:
        name==='./render/ad-diagnostics'?()=>{}:
        name==='./render/onboarding'?{draw:()=>null}:
        name==='./platform/user-profile'?{destroyButton(){}}:
        name==='./render/daily-ui'?{drawDetail:()=>({})}:
        name==='./render/retention-ui'?{draw:()=>({})}:
        name==='./core/runtime'?{maybePromptUpdate(){}}:realRequire(name)
}, {filename:mainFile});
function app(config=settings) {
    calls=[];paints=0;sdkThrows=false;
    const a=Object.assign(Object.create(loaded.exports.prototype), {
        state:'menu',screen:{width:375,height:667},ctx:{},progress:{unlockedLevel:1},
        core:null,board:null,guide:null,guideQueue:[],hearts:5,backgrounded:false,
        homeReporter:homeAnalytics.create(global.wx,config),
        heartView(){return {state:{count:this.hearts},timeLeftText:''};},
        readHeartState(){return {count:this.hearts};},
        recoverAdRewards(){},offerSoloResume(){return false;},showBattleNotice(){},
        guideContext(){return null;}
    });
    return a;
}
const tap=(a,r)=>a.handleTouchStart({touches:[{clientX:r.x+10,clientY:r.y+10,identifier:1}]});
const types=()=>calls.map(x=>x.branchId+':'+x.eventType);

let a=app();
assert.deepStrictEqual(calls,[]);
a.render();for(let i=0;i<10;i++)a.render();
assert.deepStrictEqual(types(),['test-solo:1','test-pvp:1']);
tap(a,solo);assert.strictEqual(a.state,'levelselect');
assert.deepStrictEqual(types(),['test-solo:1','test-pvp:1','test-solo:2']);
a.render();a.state='menu';a.render();
assert.deepStrictEqual(types().slice(-2),['test-solo:1','test-pvp:1']);
tap(a,pvp);tap(a,pvp);
assert.strictEqual(types().filter(x=>x==='test-pvp:2').length,1,'queued press must not multiply clicks');
a.handleHide();const before=calls.length;a.render();assert.strictEqual(calls.length,before);
a.handleShow({query:{}});a.render();
assert.deepStrictEqual(types().slice(-2),['test-solo:1','test-pvp:1'],'foreground return starts one new home visit');
a.render();assert.strictEqual(calls.length,before+2);

for(const blocker of ['guide','staminaDialog','adFlow','battleCreating','soloResumePrompt','soloOperationBusy','soloResumeSaveFailed','backgrounded']) {
    a=app();a[blocker]=blocker==='guide'?{key:'solo'}:true;a.render();
    assert.deepStrictEqual(calls,[],blocker+' must hide home exposure');
    a[blocker]=false;a.render();assert.strictEqual(calls.length,2,blocker+' dismissal allows initial exposure');
    a[blocker]=blocker==='guide'?{key:'solo'}:true;a.reportHomeClick('solo');
    assert.strictEqual(calls.length,2,blocker+' blocks late/stale click');
    a[blocker]=false;a.render();assert.strictEqual(calls.length,2,'modal dismissal is not a new home visit');
}
for(const state of ['daily_detail','retention_preview']) {
    a=app();a.state=state;a.render();
    assert(paints>0);assert.deepStrictEqual(calls,[],state+' paints home backdrop, not an exposed home entry');
    a.state='menu';a.render();assert.strictEqual(calls.length,2);
}
a=app();a.hearts=0;a.render();tap(a,solo);
assert.strictEqual(a.staminaDialog,true);assert.strictEqual(a.state,'menu');
assert.strictEqual(types().at(-1),'test-solo:2','accepted intention still counts when stamina blocks gameplay');
a.render();a.closeStaminaDialog();a.render();
assert.strictEqual(calls.length,3,'closing stamina modal must not inflate exposure');
tap(a,solo);assert.strictEqual(calls.length,4,'independent second accepted tap can count');

a=app();a.menuButtons={start:solo,battle:pvp};tap(a,solo);
assert.deepStrictEqual(calls,[],'stale button geometry without a painted frame is not exposure or click');
a=app();sdkThrows=true;a.render();for(let i=0;i<5;i++)a.render();tap(a,solo);
assert.strictEqual(a.state,'levelselect','failed analytics cannot break entry');
assert.strictEqual(a.homeReporter.diagnostics().attempted,2,'no per-frame failure retries');

a=app(require('../js/core/config').HOME_ANALYTICS_CONFIG);a.render();tap(a,solo);
assert.deepStrictEqual(calls,[
    {branchId:'BCBgAAoXHx5d0hJfR8jiP3',eventType:1},
    {branchId:'BCBgAAoXHx5d0hJfR8jiP0',eventType:1},
    {branchId:'BCBgAAoXHx5d0hJfR8jiP3',eventType:2}
],'actual account configuration must keep the two branches distinct');
assert.strictEqual(a.state,'levelselect');
a=app({...settings,enabled:false});a.render();tap(a,solo);
assert.deepStrictEqual(calls,[],'disabled candidate must remain inert');

// Characterize the native investigation window without changing its report eligibility.
// A tap may navigate after a blocker clears but before another home frame is painted.
const observed = [], savedLog = console.log;
try {
    console.log = line => { if (line.startsWith('[home-analytics] ')) observed.push(JSON.parse(line.slice(17))); };
    a=app({...settings,debug:true});a.render();
    a.guide={key:'solo'};a.render();a.guide=null;
    tap(a,solo);
    assert.strictEqual(a.state,'levelselect');
    assert.deepStrictEqual(types(),['test-solo:1','test-pvp:1']);
    let seen=observed.filter(x=>x.stage==='click_seen').at(-1);
    assert.strictEqual(seen.branch,'solo');assert.strictEqual(seen.eventType,2);
    assert.strictEqual(seen.gates.drawn,false);assert.strictEqual(seen.gates.available,true);
    a=app({...settings,debug:true});a.render();a.handleHide();a.handleShow({query:{}});tap(a,pvp);
    assert.ok(a.menuBattlePress,'actual input still queues PvP navigation');
    assert.deepStrictEqual(types(),['test-solo:1','test-pvp:1']);
    seen=observed.filter(x=>x.stage==='click_seen').at(-1);
    assert.strictEqual(seen.branch,'pvp');assert.strictEqual(seen.gates.drawn,false);
    assert.strictEqual(seen.gates.available,true);assert.strictEqual(seen.gates.backgrounded,false);
} finally { console.log = savedLog; }
console.log('PASS home analytics Main: paint ordering, visits, overlays, foreground, accepted inputs, blocked gameplay, failures and disabled candidate');
