'use strict';
const catalog=require('./catalog-preview');
const KEY='match3_catalog_pending_v1';
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const clone=value=>JSON.parse(JSON.stringify(value));
const ids=catalog.cats.map(cat=>cat.id);
function validState(s){
    return s && /^U[0-9a-f]{30}$/.test(s.owner) && integer(s.revision) && integer(s.days) && integer(s.fish) &&
        Number.isFinite(s.serverNow) && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && integer(s.roundsToday)&&s.roundsToday<=3 &&
        Array.isArray(s.owned)&&s.owned.length<=4&&new Set(s.owned).size===s.owned.length&&s.owned.every(id=>ids.includes(id)) &&
        s.affection&&typeof s.affection==='object'&&!Array.isArray(s.affection)&&Object.keys(s.affection).length===s.owned.length &&
        s.owned.every(id=>integer(s.affection[id])&&s.affection[id]<=42)&&Object.keys(s.affection).every(id=>s.owned.includes(id)) &&
        s.days>=s.owned.length*7 && s.fish+Object.values(s.affection).reduce((a,b)=>a+b,0)<=s.days*2;
}
function create(api,call,onState){
    const model=Object.assign(catalog.create(),{real:true,fish:0,status:'loading'});
    let running=null;
    function read(){
        const v=api.getStorageSync(KEY);
        if(v==null||v==='')return {version:1,pending:null};
        const p=v&&v.pending,i=p&&p.input;
        if(v.version!==1 || (p!==null && (!p||!['catalogAdopt','catalogFeed'].includes(p.action)||!i||
            !ids.includes(i.catId)||typeof i.requestId!=='string'||!/^[A-Za-z0-9_-]{16,96}$/.test(i.requestId)||!integer(i.expectedRevision)||
            !/^U[0-9a-f]{30}$/.test(i.expectedOwner))))throw Error('catalog_storage');
        return clone(v);
    }
    function write(v){if(api.setStorageSync(KEY,clone(v))===false)throw Error('catalog_storage');}
    function show(s){
        if(!validState(s))throw Error('catalog_response');
        Object.assign(model,clone(s));
        Object.keys(model.displayStages).forEach(id=>{
            if(!model.owned.includes(id))delete model.displayStages[id];
            else model.displayStages[id]=Math.min(model.displayStages[id],catalog.stageFor(model,id));
        });
        if(onState)onState(model);
    }
    async function request(action,input){
        let r;
        try{r=await call(action,input,{timeoutMs:12000});}catch(e){throw Error('catalog_network');}
        if(!r || (!r.ok&&!r.terminal))throw Error('catalog_service');
        if(!validState(r.state))throw Error('catalog_response');
        return r;
    }
    async function run(){
        try{
            const saved=read(),pending=saved.pending;
            model.status=pending?'pending':'loading';
            const before=pending&&catalog.stageFor(model,pending.input.catId);
            const r=await request(pending?pending.action:'catalogInfo',pending?pending.input:{});
            // Save acknowledgement before allowing any fresh operation. If this
            // fails, the same id/revision survives and is safely retried.
            if(pending)write({version:1,pending:null});
            show(r.state);model.status='ready';
            if(pending){
                const id=pending.input.catId;
                model.message=r.ok?(pending.action==='catalogAdopt'?'领养成功 · 已保存云端':'喂食成功 · 已保存云端'):
                    r.code==='STATE_CHANGED'?'进度已更新，请核对后重新操作':r.code==='CATALOG_OWNER_CHANGED'?'账号已变化，旧操作未重放':'未满足条件，请核对后重试';
                const stage=catalog.stageFor(model,id);
                if(r.ok&&pending.action==='catalogFeed'&&stage>before&&model.view==='detail'&&model.selectedId===id){
                    model.displayStages[id]=stage;model.overlay={kind:'unlock',catId:id,stage};
                }
            }
            return {ok:r.ok};
        }catch(e){
            model.status=e.message==='catalog_network'?'offline':'error';
            model.message=e.message==='catalog_storage'?'操作记录未保存，请重试':
                e.message==='catalog_network'?'连接中断，联网后重试确认进度':'暂未取得有效云端进度，请重试';
            return {ok:false};
        }
    }
    function sync(){if(running)return running;running=run().finally(()=>{running=null;});return running;}
    function mutate(action,id){
        if(model.status!=='ready'||running)return;
        try{
            if(read().pending){sync();return;}
            const input={catId:id,expectedOwner:model.owner,expectedRevision:model.revision,
                requestId:'c_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12)+'_'+Math.random().toString(36).slice(2,12)};
            write({version:1,pending:{action,input}});model.overlay=null;model.message='';model.status='pending';sync();
        }catch(e){model.status='error';model.message='操作尚未发送，记录保存失败，请重试';}
    }
    function activate(action){
        if(action==='retry'){sync();return;}
        if(action==='adopt'&&model.view==='detail'&&!model.overlay&&catalog.statusFor(model,model.selectedId)==='adoptable'){
            mutate('catalogAdopt',model.selectedId);return;
        }
        if(action==='confirm-feed'){
            const id=model.selectedId,g=catalog.growthFor(model,id);
            if(model.view==='detail'&&model.overlay&&model.overlay.kind==='feed'&&model.overlay.catId===id&&
                g.enabled&&g.affection<42&&model.fish>0)mutate('catalogFeed',id);
            return;
        }
        return catalog.activate(model,action);
    }
    return {model,sync,activate};
}
module.exports={KEY,validState,create};
