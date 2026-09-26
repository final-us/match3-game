'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const Module=require('module');
const catalog=require('../js/platform/catalog-preview');
const companionModule=require('../js/platform/companion');
const stories=require('../js/core/cat-stories');
const retention=require('../js/platform/retention-client');
const CompanionUI=require('../js/render/companion-ui');
const CatalogUI=require('../js/render/catalog-ui');
const assets=require('../js/render/assets');
const typography=require('../js/render/typography');

const root=path.join(__dirname,'..');
const mainFile=path.join(root,'js/main.js');
const KEY='match3_companion_display_v1';
const screen={width:390,height:844,safeTop:47,contentTop:91,safeBottom:34,safeLeft:0,safeRight:0};

function storage(initial,fail){
    let value=initial,writes=0;
    return {
        getStorageSync(key){assert.strictEqual(key,KEY);return value;},
        setStorageSync(key,next){assert.strictEqual(key,KEY);if(fail.value)throw Error('write');value=next;writes++;},
        get value(){return value;},get writes(){return writes;}
    };
}
function context(){
    const trace={drawImages:[]};
    const ctx=new Proxy({},{
        get(target,key){
            if(key in target)return target[key];
            if(key==='measureText')return text=>({width:String(text).length*7});
            if(key==='createLinearGradient'||key==='createRadialGradient')return()=>({addColorStop(){}});
            if(key==='drawImage')return(...args)=>trace.drawImages.push(args);
            return()=>{};
        },
        set(target,key,value){target[key]=value;return true;}
    });
    return {ctx,trace};
}
function sameRect(a,b){return a&&b&&a.x===b.x&&a.y===b.y&&a.w===b.w&&a.h===b.h;}
function center(rect,id=7){return{clientX:rect.x+rect.w/2,clientY:rect.y+rect.h/2,identifier:id};}
function assertTargets(buttons,label){
    for(const [key,r] of Object.entries(buttons)){
        if(key==='viewport'||key==='maxScroll')continue;
        assert(r.w>=44&&r.h>=44,label+' '+key+' must be at least 44px');
    }
}
function loadMain(assetFixture){
    const moduleFixture={exports:{}},req=Module.createRequire(mainFile);
    vm.runInNewContext(fs.readFileSync(mainFile,'utf8'),{
        module:moduleFixture,wx:{},
        require(name){
            if(name==='./render/assets')return assetFixture;
            if(name==='./audio')return{click(){},unlock(){},setScene(){}};
            if(name==='./platform/user-profile')return{destroyButton(){}};
            return req(name);
        }
    },{filename:mainFile});
    return moduleFixture.exports;
}

const originalGet=assets.get;
const originalCatalogState=assets.getCatalogState;
const originalDrawFit=typography.drawFit;
const originalStageArt=CatalogUI.stageArt;
const images={};
for(const key of Object.keys(assets.ASSETS).concat(Object.keys(assets.CATALOG_ASSETS)))
    images[key]={key,width:512,height:512};
let labels=[],stageCalls=[];
assets.get=key=>images[key];
typography.drawFit=(ctx,text,...rest)=>{labels.push(String(text));return originalDrawFit(ctx,text,...rest);};
CatalogUI.stageArt=(...args)=>{stageCalls.push(args);return originalStageArt(...args);};

let resourceState={status:'ready',progress:100,message:''};
assets.getCatalogState=()=>resourceState;
const assetFixture={
    loads:0,
    loadCatalog(){this.loads++;return Promise.resolve(resourceState);},
    getCatalogState(){return resourceState;},
    preload(){},get(){}
};
const Main=loadMain(assetFixture);
function appWith(display,model){
    const app=Object.create(Main.prototype);
    Object.assign(app,{
        state:'menu',runtimeState:'menu',audioScene:'calm',
        companion:display,companionView:null,companionButtons:null,companionTouch:null,
        catalogPreview:model,catalogPreviewEnabled:true,catalogButtons:null,catalogTouch:null,
        menuButtons:null,menuBattlePress:null,privacyTouch:null,retentionTouch:null,
        handleGuideTouch:()=>false,handleStaminaDialogTouch:()=>false,battleCreating:false,
        lastTime:0,screen,ctx:context().ctx
    });
    return app;
}

try{
    // Naitang stage art now follows the same subpackage readiness contract as every other cat.
    for(const key of ['catalogNaitangFamiliar','catalogNaitangTrust','catalogNaitangAttachment','catalogNaitangBestFriend']){
        assert(!Object.prototype.hasOwnProperty.call(assets.ASSETS,key),key+' must not remain in main preload');
        assert(Object.prototype.hasOwnProperty.call(assets.CATALOG_ASSETS,key),key+' must live in catalog subpackage');
    }

    // Home art and the home story entry both stay on the persisted selection stage.
    {
        const selection={id:'cream',stage:3,unlocked:3};
        stageCalls=[];labels=[];
        CompanionUI.drawHome(context().ctx,screen,{y:220,h:260},selection,{status:'ready',progress:100,message:''});
        assert.strictEqual(stageCalls.length,1);
        assert.strictEqual(stageCalls[0][3],3,'home must draw the persisted selection stage');
        stageCalls=[];labels=[];
        CompanionUI.drawHome(context().ctx,screen,{y:220,h:260},selection,{status:'loading',progress:30,message:''});
        assert.strictEqual(stageCalls.length,0,'subpackage stage art must not draw before ready');
        assert(labels.some(text=>text.includes('正在迎接')));

        const saved={version:1,selection},display=companionModule.create(storage(saved,{value:false}));
        const model=catalog.create('stages');model.displayStages.cream=0;
        const app=appWith(display,model);
        app.openCompanion('story');
        assert.strictEqual(app.companionView.stage,3,'home story must open the displayed companion stage');
        assert.strictEqual(model.displayStages.cream,0);
    }

    // Every switch row opens its image/story modal; closing returns to the switch modal.
    {
        const saved={version:1,selection:{id:'cream',stage:2,unlocked:3}};
        const api=storage(saved,{value:false}),display=companionModule.create(api);
        const model=catalog.create('maxed');
        model.owned=catalog.cats.map(cat=>cat.id);
        for(const cat of catalog.cats){
            const app=appWith(display,model);
            app.state='companion';
            app.companionView={kind:'switch',catId:null,stage:0,unlocked:0,returnState:'menu',offset:0,message:''};
            const before=JSON.stringify(model),writes=api.writes;
            app.companionAction('choose:'+cat.id);
            assert.strictEqual(app.state,'companion',cat.id+' must open a modal instead of returning home');
            assert.strictEqual(app.companionView.kind,'story');
            assert.strictEqual(app.companionView.catId,cat.id);
            assert.strictEqual(app.companionView.backSwitch,true);
            assert.strictEqual(app.companionView.stage,cat.id==='cream'?2:0);
            assert.strictEqual(api.writes,writes,'opening a switch row must not persist a new selection');
            assert.strictEqual(JSON.stringify(model),before);
            app.companionAction('close');
            assert.strictEqual(app.state,'companion');
            assert.strictEqual(app.companionView.kind,'switch');
        }
    }

    // Companion modal owns touch dispatch; closing or tapping its mask cannot fall through to home.
    {
        const display=companionModule.create(storage(undefined,{value:false}));
        const app=appWith(display,catalog.create('growth'));
        app.state='companion';
        app.companionView={kind:'switch',catId:null,stage:0,unlocked:0,returnState:'menu',offset:0,message:''};
        app.companionButtons={close:{x:260,y:80,w:44,h:44},viewport:{x:20,y:140,w:280,h:180},maxScroll:0};
        app.menuButtons={start:{x:0,y:0,w:320,h:568}};
        let started=0;app.startBattle=()=>{started++;};
        app.handleTouchStart({touches:[center(app.companionButtons.close)]});
        app.handleTouchEnd({changedTouches:[center(app.companionButtons.close)],touches:[]});
        assert.strictEqual(started,0);
        assert.strictEqual(app.state,'menu');

        app.state='companion';
        app.companionView={kind:'switch',catId:null,stage:0,unlocked:0,returnState:'menu',offset:0,message:''};
        app.companionButtons={close:{x:260,y:80,w:44,h:44},viewport:{x:20,y:140,w:280,h:180},maxScroll:0};
        const mask={clientX:5,clientY:300,identifier:9};
        app.handleTouchStart({touches:[mask]});
        app.handleTouchEnd({changedTouches:[mask],touches:[]});
        assert.strictEqual(started,0);
        assert.strictEqual(app.state,'companion');
    }

    // Five chapter controls stay fixed and usable at 320px. Locked content routes to feed or catalog.
    {
        const sized=Object.assign({},screen,{width:320,height:568});
        const display=companionModule.create(storage(undefined,{value:false}));
        const model=catalog.create('stages');
        const view={kind:'story',catId:'cream',stage:4,unlocked:3,returnState:'menu',offset:0,message:''};
        labels=[];stageCalls=[];
        let buttons=CompanionUI.draw(context().ctx,sized,view,model,display,{status:'ready',progress:100,message:''});
        for(let stage=0;stage<5;stage++){
            const r=buttons['chapter:'+stage];
            assert(r&&r.w>=44&&r.h>=44,'320 chapter '+stage+' must be fixed and at least 44px');
            assert(r.y>=0&&r.y+r.h<=sized.height);
        }
        assert(labels.includes('这篇故事还没有解锁'));
        assert(labels.some(text=>text.includes('再喂')));
        assert.strictEqual(stageCalls.length,0,'locked chapter must hide art');
        assert(buttons.feed&&!buttons.select&&!buttons.catalog);
        assertTargets(buttons,'320 locked');

        const app=appWith(display,model);
        app.state='companion';app.companionView=view;
        const beforeAffection=model.affection.cream,beforeFish=model.fish;
        app.companionAction('feed');
        assert.strictEqual(app.state,'catalog_preview');
        assert.strictEqual(model.selectedId,'cream');
        assert.deepStrictEqual(model.overlay,{kind:'feed',catId:'cream'});
        assert.strictEqual(model.affection.cream,beforeAffection);
        assert.strictEqual(model.fish,beforeFish);

        const remembered=companionModule.create(storage({version:1,selection:{id:'ragdoll',stage:0,unlocked:0}},{value:false}));
        const reset=catalog.create();
        const readonly={kind:'story',catId:'ragdoll',stage:1,unlocked:0,returnState:'menu',offset:0,message:''};
        buttons=CompanionUI.draw(context().ctx,sized,readonly,reset,remembered,{status:'ready',progress:100,message:''});
        assert(buttons.catalog&&!buttons.feed&&!buttons.select);
    }

    // Unlock overlay offers the new story and returns to the catalog when the reader closes.
    {
        const display=companionModule.create(storage(undefined,{value:false}));
        const model=catalog.create('growth');
        model.affection.cream=4;model.displayStages.cream=1;
        model.overlay={kind:'unlock',catId:'cream',stage:1};
        let buttons=CatalogUI.draw(context().ctx,screen,model,{status:'ready',progress:100,message:''},display);
        assert(buttons['read-unlock']);
        const app=appWith(display,model);
        app.state='catalog_preview';app.catalogButtons=buttons;
        const r=buttons['read-unlock'],p=center(r);
        app.catalogTouch={x:p.clientX,y:p.clientY,lastY:p.clientY,dragged:false,action:'read-unlock',
            model,identifier:p.identifier,view:model.view,selectedId:model.selectedId,status:model.status,overlay:model.overlay};
        app.finishCatalogTouch({changedTouches:[p],touches:[]});
        assert.strictEqual(app.state,'companion');
        assert.strictEqual(app.companionView.stage,1);
        assert.strictEqual(app.companionView.returnState,'catalog_preview');
        assert.strictEqual(model.overlay,null);
        app.companionAction('close');
        assert.strictEqual(app.state,'catalog_preview');
    }

    // A chapter is marked only after ready content is fully visible, once per bit, and survives reload.
    {
        const fail={value:false},api=storage(undefined,fail),display=companionModule.create(api);
        const model=catalog.create('stages');
        const app=appWith(display,model);
        app.state='companion';
        app.companionView={kind:'story',catId:'cream',stage:1,unlocked:3,returnState:'menu',offset:0,message:''};
        resourceState={status:'loading',progress:40,message:''};
        app.render();
        assert.deepStrictEqual(display.read,{});
        assert.strictEqual(api.writes,0,'loading content must not be marked read');
        resourceState={status:'ready',progress:100,message:''};
        app.render();
        assert.deepStrictEqual(display.read,{cream:2});
        assert.strictEqual(api.writes,1);
        app.render();
        assert.strictEqual(api.writes,1,'render loop must not repeatedly write the same chapter');

        app.companionView={kind:'story',catId:'cream',stage:1,unlocked:3,returnState:'menu',offset:0,message:''};
        app.render();
        assert.strictEqual(api.writes,1,'reopening an already read chapter must not write');
        app.companionAction('chapter:2');
        app.render();
        assert.deepStrictEqual(display.read,{cream:6},'read state must be tracked per chapter bit');
        assert.strictEqual(api.writes,2);
        assert.deepStrictEqual(companionModule.create(api).read,{cream:6});
    }

    // Failed read persistence keeps selection/read/model intact and exposes one unambiguous retry action.
    {
        const fail={value:true};
        const saved={version:1,selection:{id:'ragdoll',stage:0,unlocked:0}};
        const api=storage(saved,fail),display=companionModule.create(api),model=catalog.create('growth');
        const beforeModel=JSON.stringify(model),beforeSelection=JSON.stringify(display.selection);
        const app=appWith(display,model);
        app.state='companion';
        app.companionView={kind:'story',catId:'cream',stage:0,unlocked:0,returnState:'menu',offset:0,message:''};
        resourceState={status:'ready',progress:100,message:''};
        app.render();
        assert.deepStrictEqual(display.read,{});
        assert.strictEqual(JSON.stringify(display.selection),beforeSelection);
        assert.strictEqual(JSON.stringify(model),beforeModel);
        assert(display.error.includes('保存失败'));
        app.render();
        const retry=app.companionButtons['retry-save'];
        assert(retry,'failed save must expose retry');
        for(const [key,r] of Object.entries(app.companionButtons)){
            if(key!=='retry-save'&&key!=='viewport'&&key!=='maxScroll')
                assert(!sameRect(r,retry),'retry-save must not overlap another live action: '+key);
        }
        fail.value=false;
        const p=center(retry);
        app.handleTouchStart({touches:[p]});
        app.handleTouchEnd({changedTouches:[p],touches:[]});
        assert.deepStrictEqual(display.read,{cream:1});
        assert.strictEqual(JSON.stringify(display.selection),beforeSelection);
        assert.strictEqual(JSON.stringify(model),beforeModel);
    }

    // Reminder derives only from real, ready, server-dated claim state; task rewards are automatic.
    {
        const at=Date.UTC(2026,8,26,4,0,0);
        const date=retention.beijingDate(at);
        const base={real:true,status:'ready',date,week:'2026-09-21',serverNow:at,weekEndsAt:at+3*86400000,
            signDay:5,signed:true,taskProgress:[0,0,0],activity:0,claimed:[false,false,false]};
        const claimable=overrides=>retention.hasClaimable(Object.assign({},base,overrides),at);
        assert.strictEqual(claimable({signed:false}),true,'today sign-in must show reminder');
        assert.strictEqual(claimable({activity:200}),true,'reached current weekly chest must show reminder');
        assert.strictEqual(claimable({activity:500,claimed:[true,true,true]}),false);
        assert.strictEqual(claimable({previousWeek:{week:'2026-09-14',expiresAt:at+1000,
            available:[true,false,false],claimed:[false,false,false]}}),true);
        assert.strictEqual(claimable({previousWeek:{week:'2026-09-14',expiresAt:at-1,
            available:[true,false,false],claimed:[false,false,false]}}),false);
        assert.strictEqual(claimable({previousWeek:{week:'2026-09-14',expiresAt:at+1000,
            available:[true,false,false],claimed:[true,false,false]}}),false);
        for(const status of ['loading','pending','offline','error'])
            assert.strictEqual(claimable({status,signed:false,activity:500}),false,status+' must not remind');
        assert.strictEqual(claimable({real:false,signed:false}),false);
        assert.strictEqual(retention.hasClaimable(Object.assign({},base,{signed:false}),at+86400000),false,
            'cross-day stale state must not remind');
        assert.strictEqual(retention.hasClaimable(Object.assign({},base,{signed:false,weekEndsAt:at}),at),false,
            'expired current week must not remind');
        assert.strictEqual(claimable({taskProgress:[99,99,99],activity:199}),false,
            'task completion is auto-credited and must not create a pending claim reminder');
    }

    console.log('companion polish independent QA passed');
}finally{
    assets.get=originalGet;
    assets.getCatalogState=originalCatalogState;
    typography.drawFit=originalDrawFit;
    CatalogUI.stageArt=originalStageArt;
}
