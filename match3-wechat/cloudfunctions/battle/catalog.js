'use strict';

const CATS = ['cream', 'ragdoll', 'siamese', 'calico'];
const DAYS = [7, 14, 21, 28];
const integer = n => Number.isSafeInteger(n) && n >= 0;
const clone = value => JSON.parse(JSON.stringify(value));
function invalid() { const e = Error('catalog profile is corrupt'); e.code = 'CORRUPT_CATALOG_STATE'; throw e; }
function normalize(value, date) {
    if (value === undefined) return {version:1,revision:0,days:0,fish:0,owned:[],affection:{},date,roundsToday:0,lastRequest:null};
    if (!value || value.version!==1 || !integer(value.revision) || !integer(value.days) || !integer(value.fish) ||
        !Array.isArray(value.owned) || value.owned.length>4 || new Set(value.owned).size!==value.owned.length ||
        value.owned.some(id=>!CATS.includes(id)) || !value.affection || Array.isArray(value.affection) ||
        Object.keys(value.affection).length!==value.owned.length ||
        value.owned.some(id=>!integer(value.affection[id]) || value.affection[id]>42) ||
        Object.keys(value.affection).some(id=>!value.owned.includes(id)) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(value.date) || value.date>date ||
        !Number.isFinite(Date.parse(value.date+'T00:00:00Z')) ||
        new Date(value.date+'T00:00:00Z').toISOString().slice(0,10)!==value.date ||
        !integer(value.roundsToday) || value.roundsToday>3 ||
        (value.owned.length && value.days<DAYS[value.owned.length-1]) ||
        value.fish+Object.values(value.affection).reduce((a,b)=>a+b,0)>value.days*2 ||
        (value.roundsToday>0 && value.days===0)) invalid();
    const last=value.lastRequest;
    if (last!==null && (!last || !/^[A-Za-z0-9_-]{16,96}$/.test(last.id) ||
        !['adopt','feed'].includes(last.kind) || !CATS.includes(last.catId) ||
        !integer(last.expectedRevision) || last.expectedRevision>=value.revision)) invalid();
    const result=clone(value);
    if(result.date!==date){result.date=date;result.roundsToday=0;}
    return result;
}
function record(state) {
    if(state.roundsToday>=3)return;
    if(state.roundsToday===0)state.days++;
    state.roundsToday++;
    if(state.roundsToday===1 || state.roundsToday===3)state.fish++;
    state.revision++;
}
function publicState(state,owner,at) {
    return {owner,serverNow:at,revision:state.revision,days:state.days,fish:state.fish,
        owned:state.owned.slice(),affection:Object.assign({},state.affection),date:state.date,roundsToday:state.roundsToday};
}
function change(state,owner,kind,input) {
    if(!input || !CATS.includes(input.catId) || typeof input.requestId!=='string' || !/^[A-Za-z0-9_-]{16,96}$/.test(input.requestId) ||
        !integer(input.expectedRevision) || typeof input.expectedOwner!=='string')
        return {ok:false,code:'INVALID_CATALOG_REQUEST',err:'猫咪操作参数无效',terminal:true};
    if(input.expectedOwner!==owner)return {ok:false,code:'CATALOG_OWNER_CHANGED',err:'账号已变化，请重新打开图鉴',terminal:true};
    const last=state.lastRequest;
    if(last && last.id===input.requestId){
        if(last.kind===kind && last.catId===input.catId && last.expectedRevision===input.expectedRevision)return {ok:true};
        return {ok:false,code:'REQUEST_CONFLICT',err:'操作编号冲突，请重新打开图鉴',terminal:true};
    }
    if(input.expectedRevision!==state.revision)return {ok:false,code:'STATE_CHANGED',err:'进度已更新，请核对后重新操作',terminal:true};
    if(kind==='adopt'){
        if(state.owned.includes(input.catId) || state.owned.length>=4 || state.days<DAYS[state.owned.length])
            return {ok:false,code:'NOT_ELIGIBLE',err:'尚未达到领养条件',terminal:true};
        state.owned.push(input.catId);state.affection[input.catId]=0;
    } else {
        if(!state.owned.includes(input.catId) || state.affection[input.catId]>=42 || state.fish<1)
            return {ok:false,code:'NOT_ELIGIBLE',err:'请核对领养、亲密度与小鱼干数量',terminal:true};
        state.fish--;state.affection[input.catId]++;
    }
    state.revision++;
    state.lastRequest={id:input.requestId,kind,catId:input.catId,expectedRevision:input.expectedRevision};
    return {ok:true};
}
module.exports={normalize,record,publicState,change};
