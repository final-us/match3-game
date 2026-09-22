'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const file=require.resolve('../js/main'),req=require('module').createRequire(file);
const engine=req('./core/daily-challenge');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
    const requests=[],checkpoints=[],notices=[],store={},timers=[];
    const setTimeout=(callback,ms)=>{const timer={callback,ms,cleared:false};timers.push(timer);return timer;};
    const clearTimeout=timer=>{if(timer)timer.cleared=true;};
    const wx={
        getStorageSync:k=>store[k]===undefined?'':JSON.parse(JSON.stringify(store[k])),
        setStorageSync:(k,v)=>{store[k]=JSON.parse(JSON.stringify(v));},
        showToast:o=>notices.push(o.title),
        cloud:{init(){},callFunction:options=>{
            if (options.data.action === 'dailyCheckpoint') { checkpoints.push(options.data); options.success({result:{ok:true,runId:options.data.runId,moves:options.data.moves}}); return; }
            const request={action:options.data.action,data:options.data,options};
            request.resolve=value=>options.success({result:value});
            request.reject=error=>options.fail(error);
            requests.push(request);
        }}
    };
    const module={exports:{}};
    const cache={};
    function local(relative){
        const target=req.resolve(relative);
        if(cache[target])return cache[target].exports;
        const m=cache[target]={exports:{}};
        vm.runInNewContext(fs.readFileSync(target,'utf8'),{module:m,wx,setTimeout,clearTimeout,require:require('module').createRequire(target)},{filename:target});
        return m.exports;
    }
    const coin=local('./core/coin');
    const progressModule={exports:{}};
    vm.runInNewContext(fs.readFileSync(req.resolve('./core/daily-progress'),'utf8'),{module:progressModule,wx,require:name=>{if(name==='./coin')return coin;if(name==='./daily-challenge')return engine;throw new Error('Unexpected progress dependency: '+name);}});
    const progress=progressModule.exports;
    vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,wx,setTimeout,clearTimeout,setInterval,clearInterval,require:name=>{
        if(name==='./net/cloud-battle')return local('./net/cloud-battle');
        if(name==='./core/daily-progress')return progress;
        if(name==='./render/board-render')return class {setGame(){} animateSwap(){} animateInvalidSwap(){} animateMatch(){} animateGravity(){} animateFill(){} animateColorChange(){} animateReshuffle(){}};
        if(name==='./audio')return new Proxy({},{get:()=>()=>{}});
        if(name==='./core/analytics')return {track(){}};
        return req(name);
    }},{filename:file});
    const app=Object.create(module.exports.prototype);app.state='menu';
    return {app,requests,checkpoints,notices,progress,store,timers,expireLatest(){
        const timer=timers.slice().reverse().find(item=>!item.cleared);
        assert(timer,'expected a pending request timeout');
        assert.strictEqual(timer.ms,12000,'daily requests use the shared 12-second timeout');
        timer.callback();
    }};
}
(async()=>{
    const c=engine.challengeForDate('2026-09-22');
    {
        const f=fixture();f.app.openDaily();
        f.requests[0].resolve({ok:false,err:'未知操作'});await flush();
        assert.strictEqual(f.app.daily.error,'每日挑战暂未开放');
        assert.strictEqual(f.app.daily.challenge,null,'old server must not start a locally invented run');
        f.app.dailyPrimary();assert.strictEqual(f.requests[1].action,'dailyInfo');
        f.requests[1].resolve({ok:true,challenge:{...c,reward:100}});await flush();
        assert.strictEqual(f.app.daily.error,'挑战内容暂时不匹配，请稍后重试');
        assert.strictEqual(f.store.match3_coin_v1,undefined,'incompatible challenge cannot grant coins');
    }

    {
        const f=fixture();f.app.openDaily();assert.strictEqual(f.requests[0].action,'dailyInfo');
        f.requests[0].reject(new Error('offline'));await flush();
        assert(f.app.daily.error);assert.strictEqual(f.app.daily.loading,false);
        f.app.dailyPrimary();assert.strictEqual(f.requests[1].action,'dailyInfo');
        f.requests[1].resolve({ok:true,challenge:c,claimed:false});await flush();
        assert.strictEqual(f.app.daily.challenge.date,c.date);
        f.app.dailyPrimary();assert.strictEqual(f.requests[2].action,'dailyStart');
        f.app.leaveDaily();
        f.requests[2].resolve({ok:true,runId:'stale',challenge:c});await flush();
        assert.strictEqual(f.app.state,'menu','late start must not enter a game after back');
    }
    {
        const f=fixture();f.app.openDaily();const old=f.app.daily;
        f.app.openDaily();f.requests[0].resolve({ok:true,challenge:c});await flush();
        assert.notStrictEqual(f.app.daily,old);assert.strictEqual(f.app.daily.challenge,null,'old info ignored');
    }
    {
        const f=fixture();
        const pending={runId:'pending',challenge:c,moves:Array.from({length:25},()=>({from:{row:0,column:0},to:{row:0,column:1}})),score:500,maxCascade:2,specialComboCount:0};
        assert(f.progress.savePending(pending).ok);
        f.app.openDaily();f.requests[0].resolve({ok:true,challenge:c,claimed:false});await flush();
        f.app.dailyPrimary();assert.strictEqual(f.requests[1].action,'dailySubmit','pending blocks starting another run');
        f.requests[1].reject(new Error('offline'));await flush();assert(f.progress.read().pending);
        f.app.dailyPrimary();f.requests[2].resolve({ok:true,date:c.date,score:500,qualified:false,coinReward:0});await flush();
        assert.strictEqual(f.progress.read().pending,null,'nonqualifying result is complete');
        assert.strictEqual(f.progress.read().best[c.date],500);assert.strictEqual(f.store.match3_coin_v1,undefined);
    }
    {
        const f=fixture(),yesterday=engine.challengeForDate('2026-09-21');
        f.app.openDaily();
        f.requests[0].resolve({ok:true,challenge:yesterday,claimed:true,settlementId:'yesterday-reward',coinReward:500});await flush();
        assert.strictEqual(f.app.daily.claimed,true);assert.strictEqual(f.store.match3_coin_v1,500,'dailyInfo restores the configured reward');
        f.app.daily.best=6000;
        f.app.loadDailyInfo(); f.requests[1].resolve({ok:true,challenge:c,claimed:false,completed:false}); await flush();
        f.app.dailyPrimary();f.requests[2].resolve({ok:true,runId:'new-day',challenge:c,moves:[]});await flush();
        assert.strictEqual(f.app.daily.claimed,false,'new-day run cannot reuse yesterday claimed state');
        assert.strictEqual(f.app.daily.best,0);
        for(let i=0;i<25;i++) {
            const core=f.app.dailyCore;let move=null;
            for(let r=0;r<8&&!move;r++)for(let col=0;col<8&&!move;col++)for(const to of [{row:r,column:col+1},{row:r+1,column:col}]) {
                if(to.row<8&&to.column<8&&core.validateMove({row:r,column:col},to)){move={from:{row:r,column:col},to};break;}
            }
            assert(move);assert(await core.trySwap(move.from,move.to));
        }
        assert.strictEqual(f.requests[3].action,'dailySubmit');
        assert.strictEqual(f.checkpoints.length,25);
        f.requests[3].reject(new Error('new-day offline'));await flush();
        assert.strictEqual(f.app.state,'daily_detail');assert.strictEqual(f.app.daily.claimed,false);
        assert.strictEqual(f.app.daily.best,0);assert(f.app.daily.pending);
    }
    {
        const f=fixture();f.app.openDaily();assert.strictEqual(f.requests[0].action,'dailyInfo');
        f.expireLatest();await flush();
        assert.strictEqual(f.app.daily.loading,false,'timed-out daily info unlocks retry');
        assert.strictEqual(f.app.daily.error,'连接超时，请稍后重试');
        f.requests[0].resolve({ok:true,challenge:c,claimed:true,settlementId:'late-info',coinReward:500});await flush();
        assert.strictEqual(f.app.daily.challenge,null,'late info success must not mutate daily state');
        assert.strictEqual(f.store.match3_coin_v1,undefined,'late info success must not credit coins');
        f.app.dailyPrimary();assert.strictEqual(f.requests[1].action,'dailyInfo','timed-out info can retry');
    }
    {
        const f=fixture();f.app.openDaily();f.requests[0].resolve({ok:true,challenge:c,claimed:false});await flush();
        f.app.dailyPrimary();assert.strictEqual(f.requests[1].action,'dailyStart');
        f.expireLatest();await flush();
        assert.strictEqual(f.app.daily.starting,false,'timed-out daily start unlocks retry');
        f.requests[1].resolve({ok:true,runId:'late-start',challenge:c});await flush();
        assert.strictEqual(f.app.state,'daily_detail','late start success must not enter a game');
        assert.strictEqual(f.app.daily.run,undefined);
        f.app.dailyPrimary();assert.strictEqual(f.requests[2].action,'dailyInfo','timed-out start can retry');
    }
    {
        const f=fixture();
        const pending={runId:'timeout-pending',challenge:c,moves:Array.from({length:25},()=>({from:{row:0,column:0},to:{row:0,column:1}})),score:500,maxCascade:2,specialComboCount:0};
        assert(f.progress.savePending(pending).ok);
        f.app.openDaily();f.requests[0].resolve({ok:true,challenge:c,claimed:false});await flush();
        f.app.dailyPrimary();assert.strictEqual(f.requests[1].action,'dailySubmit');
        f.expireLatest();await flush();
        assert.strictEqual(f.app.daily.loading,false,'timed-out submit unlocks retry');
        assert(f.progress.read().pending,'timed-out submit preserves pending receipt');
        f.requests[1].resolve({ok:true,date:c.date,score:500,qualified:true,coinReward:500,settlementId:'late-submit'});await flush();
        assert(f.progress.read().pending,'late submit success must not consume pending receipt');
        assert.strictEqual(f.store.match3_coin_v1,undefined,'late submit success must not credit coins');
        f.app.dailyPrimary();assert.strictEqual(f.requests[2].action,'dailySubmit','timed-out submit can retry');
    }
    console.log('daily client loading/retry/stale responses/pending tests passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
