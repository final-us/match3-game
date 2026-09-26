/** Develop-only, memory-only catalog sample. Never reads saves or calls a service. */
const cats = [
    { id:'cream', name:'奶糖', breed:'英国短毛猫', note:'慢慢靠近，听见它轻轻的呼噜声。', tone:'#E6ADBE', crop:[0,0,350,350] },
    { id:'ragdoll', name:'团子', breed:'布偶猫', note:'像一朵软绵绵的云，静静陪在身边。', tone:'#A9BDD9', crop:[350,0,350,350] },
    { id:'siamese', name:'芝麻', breed:'暹罗猫', note:'好奇的小耳朵，总能发现新的乐趣。', tone:'#B7A5D4', crop:[0,388,350,388] },
    { id:'calico', name:'布丁', breed:'短毛三花', note:'找个舒服的角落，和你一起发一会儿呆。', tone:'#D5B490', crop:[350,388,350,388] }
];

const stages = [
    { name:'初见', threshold:0 },
    { name:'熟悉', threshold:4 },
    { name:'信任', threshold:10 },
    { name:'依恋', threshold:20 },
    { name:'挚友', threshold:42 }
];

function isEnabled(api) {
    try { return !!api && api.getAccountInfoSync().miniProgram.envVersion === 'develop'; }
    catch (error) { return false; }
}

function create(preset) {
    const model = {view:'list', selectedId:null, offset:0, listOffset:0,
        owned:[], days:0, fish:2, status:'ready', message:'', affection:{},
        displayStages:{}, overlay:null, previewDay:1, roundsToday:0,
        lastActivePreviewDay:null};
    if (preset === 'mixed' || preset === 'locked' || preset === 'adopted') {
        model.owned = preset === 'adopted' ? ['cream','ragdoll'] : ['cream'];
        model.days = preset === 'locked' ? 3 : 7;
    }
    if (['growth','hungry','maxed','stages'].indexOf(preset) >= 0) {
        model.owned=['cream'];model.selectedId='cream';model.view='detail';
        model.affection.cream=preset==='maxed'?42:preset==='stages'?20:3;
        model.displayStages.cream=stageFor(model,'cream');
        if (preset==='hungry') model.fish=0;
    }
    if (['loading','offline','error'].indexOf(preset) >= 0) model.status = preset;
    return model;
}

function stageFor(model, id) {
    const affection=Math.max(0,Number(model && model.affection && model.affection[id])||0);
    for(let index=stages.length-1;index>0;index--) {
        if(affection>=stages[index].threshold)return index;
    }
    return 0;
}

function growthFor(model, id) {
    const affection=Math.max(0,Number(model && model.affection && model.affection[id])||0);
    const stage=stageFor(model,id);
    const stored=Number(model && model.displayStages && model.displayStages[id]);
    const displayStage=Number.isInteger(stored) && stored>=0 && stored<=stage?stored:stage;
    const owned=!!model && Array.isArray(model.owned)?model.owned:[];
    return {affection,stage,displayStage,enabled:owned[0]===id && owned.indexOf(id)>=0};
}

function statusFor(model, id) {
    if (!cats.some(cat=>cat.id===id)) return 'locked';
    if (model.owned.indexOf(id)>=0) return 'owned';
    if (!model.owned.length || (model.owned.length === 1 && model.days >= 7)) return 'adoptable';
    return 'locked';
}

function condition(model) {
    if (!model.owned.length) return '首次可任选一只，免费领养';
    if (model.owned.length === 1) return '累计陪伴 ' + Math.min(7,model.days) + '/7 天';
    return '后续解锁条件待确定';
}

function activate(model, action) {
    if (action === 'close') return 'close';
    if (action === 'back') {
        if(model.overlay){model.overlay=null;return;}
        model.view='list';model.selectedId=null;model.offset=model.listOffset;model.message='';return;
    }
    if (model.status !== 'ready') {
        if (action === 'retry' && (model.status === 'offline' || model.status === 'error')) {
            model.status='ready';model.offset=0;model.message='已恢复演示画面';
        }
        return;
    }
    if (action === 'dismiss') { model.overlay=null;return; }
    if (action === 'go-play') {
        if(model.overlay && model.overlay.kind==='food'){model.overlay=null;return 'play';}
        return;
    }
    if (action === 'confirm-feed') {
        const overlay=model.overlay;
        const id=model.selectedId;
        const growth=growthFor(model,id);
        if(!overlay || overlay.kind!=='feed' || overlay.catId!==id || model.view!=='detail' ||
            statusFor(model,id)!=='owned' || !growth.enabled || model.fish<=0 || growth.stage===stages.length-1)return;
        model.overlay=null;
        model.fish-=1;
        model.affection[id]=growth.affection+1;
        const nextStage=stageFor(model,id);
        if(nextStage>growth.stage){
            model.message='';
            model.displayStages[id]=nextStage;
            model.overlay={kind:'unlock',catId:id,stage:nextStage};
        } else {
            const cat=cats.find(item=>item.id===id);
            model.message=(cat?cat.name:'猫咪')+'吃得很开心 · 亲密度 +1';
        }
        return;
    }
    if (action === 'show-stage' || action.indexOf('show-stage:')===0) {
        if(!model.overlay || model.overlay.kind!=='gallery')return;
        const requested=action==='show-stage'?model.overlay.stage:Number(action.slice(11));
        const id=model.overlay.catId;
        if(!Number.isInteger(requested) || requested<0 || requested>stageFor(model,id))return;
        if(model.view!=='detail' || model.selectedId!==id || !growthFor(model,id).enabled)return;
        model.displayStages[id]=requested;model.overlay=null;return;
    }
    if(model.overlay)return;
    if (action === 'interaction' || action === 'feed') {
        const id=model.selectedId;
        const growth=growthFor(model,id);
        if(model.view!=='detail' || statusFor(model,id)!=='owned' || !growth.enabled)return;
        if(growth.stage===stages.length-1){
            const cat=cats.find(item=>item.id===id);
            model.overlay=null;model.message='挚友互动 · '+(cat?cat.name:'猫咪')+'开心地蹭了蹭你';return;
        }
        if(action==='interaction')return;
        model.message='';
        model.overlay=model.fish>0?{kind:'feed',catId:id}:{kind:'food',catId:id};
        return;
    }
    if (action.indexOf('stage:')===0) {
        const requested=Number(action.slice(6)),id=model.selectedId;
        if(!Number.isInteger(requested) || requested<0 || requested>=stages.length)return;
        if(model.view!=='detail' || statusFor(model,id)!=='owned' || !growthFor(model,id).enabled)return;
        model.overlay={kind:'gallery',catId:id,stage:requested};return;
    }
    if (action.indexOf('cat:')===0 && model.view==='list') {
        const id=action.slice(4);
        if (!cats.some(cat=>cat.id===id)) return;
        model.listOffset=model.offset;model.offset=0;model.selectedId=id;model.view='detail';model.message='';model.overlay=null;
    } else if (action==='adopt' && model.view==='detail' && statusFor(model,model.selectedId)==='adoptable') {
        model.owned.push(model.selectedId);
        if(model.affection[model.selectedId]===undefined)model.affection[model.selectedId]=0;
        if(model.displayStages[model.selectedId]===undefined)model.displayStages[model.selectedId]=0;
        model.message='领养成功 · 仅本次预览有效';
    }
}

function completeRound(model, completed) {
    if(completed===false)return;
    model.roundsToday=(Number(model.roundsToday)||0)+1;
    if(model.roundsToday===1 || model.roundsToday===3)model.fish=(Number(model.fish)||0)+1;
    if(model.owned.length && model.lastActivePreviewDay!==model.previewDay){
        model.days=(Number(model.days)||0)+1;
        model.lastActivePreviewDay=model.previewDay;
    }
}

function nextDay(model) {
    model.previewDay=(Number(model.previewDay)||0)+1;
    model.roundsToday=0;
}

module.exports={cats,stages,isEnabled,create,statusFor,condition,stageFor,growthFor,activate,completeRound,nextDay};
