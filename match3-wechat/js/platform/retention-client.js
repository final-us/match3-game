'use strict';

// Server eligibility + local receipt application. This is not a cloud wallet.
const KEY = 'match3_retention_v1';
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const clone = value => JSON.parse(JSON.stringify(value));
const count = value => Number.isSafeInteger(value) && value >= 0;
const vector = (value, test) => Array.isArray(value) && value.length === 3 && value.every(test);
const bool = value => typeof value === 'boolean';
function beijingDate(at) { return new Date(at + 8 * 3600000).toISOString().slice(0, 10); }
function hasClaimable(model, at) {
    if(!model || !model.real || model.status!=='ready' || model.date!==beijingDate(at) || at>=model.weekEndsAt)return false;
    return !model.signed || [200,350,500].some((n,i)=>model.activity>=n&&!model.claimed[i]) ||
        !!(model.previousWeek && at<model.previousWeek.expiresAt && model.previousWeek.available.some((v,i)=>v&&!model.previousWeek.claimed[i]));
}
function validState(s) {
    return s && datePattern.test(s.date) && datePattern.test(s.week) && Number.isFinite(s.serverNow) &&
        Number.isFinite(s.weekEndsAt) && Number.isInteger(s.signDay) && s.signDay >= 1 && s.signDay <= 7 &&
        bool(s.signed) && vector(s.taskProgress,count) && count(s.activity) && s.activity <= 700 && vector(s.claimed,bool) &&
        (!s.previousWeek || (datePattern.test(s.previousWeek.week) && Number.isFinite(s.previousWeek.expiresAt) &&
            vector(s.previousWeek.available,bool) && vector(s.previousWeek.claimed,bool)));
}
function validReceipt(r) {
    if (!r || typeof r.id !== 'string' || !r.id || r.id.length > 160 || !datePattern.test(r.date) ||
        !r.items || !count(r.items.hammer) || Object.keys(r.items).some(k => k !== 'hammer')) return false;
    if (r.kind === 'signin') return [100,150,200].includes(r.coins) && r.items.hammer === (r.coins === 200 ? 1 : 0);
    if (r.kind === 'task') return [40,60].includes(r.coins) && r.items.hammer === 0;
    return r.kind === 'weekly' && [300,500,1000].includes(r.coins) && r.items.hammer === 0;
}

function create(api, call, wallet, notify, clock) {
    const now = clock || Date.now;
    const model = { real:true, tab:'signin',offset:0,rules:false,status:'loading',message:'',
        signDay:1,signed:false,taskProgress:[0,0,0],activity:0,claimed:[false,false,false] };
    let syncing = null;
    let unsaved = null;
    let serverOffset = 0;
    function read() {
        const s = api.getStorageSync(KEY);
        if (s == null || s === '') return { version:1,installation:now().toString(36)+Math.random().toString(36).slice(2,12),sequence:0,
            pending:[],receipts:[],acks:[],state:null,clockOffset:0,solo:null };
        if (!s || s.version !== 1 || typeof s.installation !== 'string' || !count(s.sequence) ||
            !Array.isArray(s.pending) || s.pending.some(p=>!p||!['retentionSign','retentionClaim','retentionRecord'].includes(p.action)||!p.input) ||
            !Array.isArray(s.receipts) || !s.receipts.every(validReceipt) || !Array.isArray(s.acks) ||
            !s.acks.every(id=>typeof id==='string') || (s.state && !validState(s.state)) ||
            !Number.isFinite(s.clockOffset) || (s.solo && (!s.solo.id || !count(s.solo.cleared)))) throw Error('retention_storage_invalid');
        return clone(s);
    }
    function write(s) { api.setStorageSync(KEY,clone(s)); }
    function show(s) {
        serverOffset=s.clockOffset;
        if (s.state) {delete model.previousWeek;Object.assign(model,s.state);}
        model.real = true;
    }
    function failure(error) {
        model.status = error && error.network ? 'offline' : 'error';
        model.message = error && error.message === 'retention_storage_invalid' ? '记录暂时无法读取，请重试' :
            error && error.network ? '任务与领奖待同步，联网后重试' : '奖励暂未保存或确认，请重试';
        // A prior event in the same batch may already have succeeded. Replace
        // its notice if later requests/receipts remain unresolved.
        try {
            const s=read();
            if(notify&&(s.pending.length||s.receipts.length||s.acks.length))
                notify(s.pending.length||s.receipts.length?'每日任务或奖励待同步，请重试':'奖励已入账，领取状态待同步');
        } catch(ignore) { /* The storage error is already visible in model. */ }
        return {ok:false,reason:error && error.message};
    }
    function date() {
        try { return beijingDate(now()+read().clockOffset); } catch(e) { return beijingDate(now()); }
    }
    function enqueue(action,input) {
        try {
            const s=read();
            const signature=JSON.stringify({action,input});
            if (!s.pending.some(p=>JSON.stringify(p)===signature)) {
                if(s.pending.length>=200)throw Error('retention_outbox_full');
                s.pending.push({action,input:clone(input)});write(s);
            }
            model.status='pending';return {ok:true};
        } catch(e) { unsaved={action,input:clone(input)}; return failure(e); }
    }
    async function request(action,input) {
        let r;
        try { r=await call(action,input,{timeoutMs:12000}); }
        catch(e) { const error=Error('retention_network');error.network=true;throw error; }
        if(r&&r.ok===false&&r.terminal===true)return r;
        if(!r||!r.ok) { const e=Error(r&&r.err||'retention_service');e.code=r&&r.code;throw e; }
        if(!validState(r.state)||!Array.isArray(r.receipts)||!r.receipts.every(validReceipt))throw Error('retention_response_invalid');
        return r;
    }
    function accept(response, processed, acked) {
        const s=read();
        s.state=clone(response.state);s.clockOffset=response.state.serverNow-now();
        if(processed) {
            const key=JSON.stringify(processed);
            s.pending=s.pending.filter(p=>JSON.stringify(p)!==key);
        }
        if(acked) s.acks=s.acks.filter(id=>!acked.includes(id));
        response.receipts.forEach(r=>{
            if(!s.receipts.some(p=>p.id===r.id)&&!s.acks.includes(r.id))s.receipts.push(clone(r));
        });
        write(s);show(s);
        if(response.eventStatus==='expired') {
            model.message=processed&&processed.action==='retentionSign'?'签到日期已更新，请领取今日奖励':
                processed&&processed.action==='retentionClaim'?'该周宝箱已过期，请查看本周进度':'上次未确认的任务已过期，仅当天可同步';
            if(notify)notify(model.message);
        }
    }
    function applyReceipts() {
        let total=0,hammer=0;
        for (;;) {
            const s=read(),r=s.receipts[0];if(!r)break;
            const credit=wallet.creditRewardOnce(r.id,{coins:r.coins,items:r.items});
            if(!credit.ok)throw Error('retention_reward_storage');
            if(credit.credited){total+=r.coins;hammer+=r.items.hammer;}
            s.receipts.shift();if(!s.acks.includes(r.id))s.acks.push(r.id);write(s);
        }
        if(total||hammer) {
            model.message='每日金币 +'+total+'金币'+(hammer?' · 锤子×'+hammer:'');
            if(notify)notify(model.message);
        }
        return total>0||hammer>0;
    }
    async function run() {
        try {
            if(unsaved){const p=unsaved;unsaved=null;if(!enqueue(p.action,p.input).ok)throw Error('retention_outbox_storage');}
            const initial=read();show(initial);model.message='';
            model.status=initial.pending.length||initial.receipts.length||initial.acks.length||
                (initial.solo&&initial.solo.completed&&initial.solo.recoverable)?'pending':'loading';
            // A completed solo draft survives quitting at the result screen. A revived
            // draft is cleared before resuming, so it can never count an unfinished run.
            if(initial.solo && initial.solo.completed && initial.solo.recoverable) {
                if(initial.solo.validMove&&!enqueue('retentionRecord',{event:initial.solo}).ok)throw Error('retention_outbox_storage');
                const s=read();s.solo=null;write(s);
            }
            applyReceipts();
            let fetched=false;
            for (;;) {
                const s=read();
                if(s.acks.length) {
                    const ids=s.acks.slice(0,32);
                    const response=await request('retentionAck',{receiptIds:ids});accept(response,null,ids);applyReceipts();
                } else if(s.pending.length) {
                    const p=s.pending[0],response=await request(p.action,p.input);
                    if(response.terminal) {
                        const latest=read();latest.pending=latest.pending.filter(x=>JSON.stringify(x)!==JSON.stringify(p));write(latest);
                        model.message=response.err||'本次任务未计入，请完成一局后再试';
                        if(notify)notify(model.message);
                    } else {
                        accept(response,p);
                        const awarded=applyReceipts();
                        if(!awarded&&p.action==='retentionRecord'&&response.eventStatus!=='expired') {
                            model.message='每日任务已同步 · '+response.state.date.slice(5).replace('-','.');
                            if(notify)notify(model.message);
                        }
                    }
                } else if(!fetched) {
                    accept(await request('retentionInfo',{}));applyReceipts();fetched=true;
                } else break;
            }
            model.status='ready';return {ok:true};
        } catch(e) {return failure(e);}
    }
    function sync() {
        if(syncing)return syncing;
        syncing=run().finally(()=>{syncing=null;});return syncing;
    }
    function activate(action) {
        if(action==='close')return 'close';
        if(action==='rules'){model.rules=!model.rules;model.offset=0;return;}
        if(action==='signinTab'||action==='tasksTab'){model.tab=action==='signinTab'?'signin':'tasks';model.rules=false;model.offset=0;return;}
        if(model.rules)return;
        if(action==='primary'&&['offline','error','pending'].includes(model.status)){model.offset=0;sync();return;}
        if(model.status!=='ready')return;
        if(action==='primary') {
            if(model.tab==='tasks')return 'play';
            if(!model.signed&&enqueue('retentionSign',{date:model.date}).ok)sync();
        }
        const m=/^(weekly|previous)([0-2])$/.exec(action);
        if(m) {
            const week=m[1]==='previous'?model.previousWeek&&model.previousWeek.week:model.week;
            if(week&&enqueue('retentionClaim',{week,index:Number(m[2])}).ok)sync();
        }
    }
    function startSolo(levelId) {
        let event={id:'solo:pending:'+now().toString(36)+Math.random().toString(36).slice(2,12),mode:'solo',
            levelId,cleared:0,validMove:false,completed:false,date:date()};
        try {
            const s=read();
            // Persist a previous final result before allocating a new run.
            if(s.solo&&s.solo.completed&&s.solo.validMove) {
                if(s.pending.length>=200)throw Error('retention_outbox_full');
                s.pending.push({action:'retentionRecord',input:{event:s.solo}});
            }
            s.sequence++;
            // Random suffix also keeps identity unique if allocating the sequence
            // failed before persistence and a later game reuses that number.
            event.id='solo:'+s.installation+':'+s.sequence+':'+Math.random().toString(36).slice(2,12);
            s.solo=event;
            write(s);return clone(s.solo);
        } catch(e){
            failure(e);
            if(notify)notify('任务记录待保存，将在结算时重试');
            return event;
        }
    }
    function saveSolo(event,completed) {
        try {const s=read();s.solo=Object.assign({},event,{completed:!!completed,recoverable:false});write(s);return {ok:true};}
        catch(e){return failure(e);}
    }
    function finishSolo(event) {
        if(!event||!event.validMove)return {ok:true};
        const result=enqueue('retentionRecord',{event:Object.assign({},event,{completed:true})});
        if(result.ok) {
            try {const s=read();if(s.solo&&s.solo.id===event.id)s.solo=null;write(s);}catch(e){return failure(e);}
            sync();
        }
        return result;
    }
    function record(event) {const r=enqueue('retentionRecord',{event});if(r.ok)sync();return r;}
    // Only a new controller instance may recover a completed result draft.
    try {const s=read();if(s.solo&&s.solo.completed){s.solo.recoverable=true;write(s);}show(s);}catch(e){failure(e);}
    return {model,date,sync,activate,startSolo,saveSolo,finishSolo,record,hasClaimable:()=>hasClaimable(model,now()+serverOffset)};
}
module.exports={KEY,create,validState,validReceipt,beijingDate,hasClaimable};
