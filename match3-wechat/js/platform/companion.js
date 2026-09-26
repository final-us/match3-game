'use strict';

const catalog=require('./catalog-preview');
const KEY='match3_companion_display_v1';
const known=catalog.cats.map(cat=>cat.id);

function valid(selection){
    return selection===null || (!!selection && typeof selection==='object' &&
        known.indexOf(selection.id)>=0 && Number.isInteger(selection.stage) &&
        Number.isInteger(selection.unlocked) && selection.stage>=0 &&
        selection.stage<=selection.unlocked && selection.unlocked<catalog.stages.length);
}

function validRead(read){
    return read===undefined || (!!read && typeof read==='object' && !Array.isArray(read) &&
        Object.keys(read).every(id=>known.indexOf(id)>=0 && Number.isInteger(read[id]) &&
            read[id]>=0 && read[id]<32));
}

function create(api){
    const state={selection:null,read:{},error:''};
    let persisted=false;
    const storageReady=!!api && typeof api.getStorageSync==='function' && typeof api.setStorageSync==='function';
    if(!storageReady){
        state.error='陪伴展示存储不可用';
    } else {
        try {
            const saved=api.getStorageSync(KEY);
            if(saved!==undefined && saved!==null && saved!==''){
                if(!saved || typeof saved!=='object' || saved.version!==1 ||
                    !valid(saved.selection) || !validRead(saved.read))
                    throw new Error('invalid snapshot');
                state.selection=saved.selection && {id:saved.selection.id,stage:saved.selection.stage,
                    unlocked:saved.selection.unlocked};
                state.read=Object.assign({},saved.read);
                persisted=true;
            }
        } catch(error){state.error='陪伴展示记录读取失败，请重试';}
    }

    function save(selection,read){
        if(persisted && JSON.stringify(state.selection)===JSON.stringify(selection) &&
            JSON.stringify(state.read)===JSON.stringify(read)){
            state.error='';return true;
        }
        if(!storageReady){
            state.error='陪伴展示存储不可用';return false;
        }
        try {
            const snapshot={version:1,selection};
            if(Object.keys(read).length)snapshot.read=read;
            if(api.setStorageSync(KEY,snapshot)===false)throw new Error('write failed');
        } catch(error){state.error='陪伴展示保存失败，请重试';return false;}
        state.selection=selection;state.read=read;state.error='';persisted=true;return true;
    }

    state.select=function(model,id){
        if(!model || model.status!=='ready' || !Array.isArray(model.owned) ||
            known.indexOf(id)<0 || model.owned.indexOf(id)<0){
            state.error='请先领养这只猫咪';return false;
        }
        const growth=catalog.growthFor(model,id);
        return save({id,stage:growth.enabled?growth.displayStage:0,
            unlocked:growth.enabled?growth.stage:0},state.read);
    };
    state.restoreDefault=function(){return save(null,state.read);};
    state.markRead=function(id,stage,unlocked){
        if(known.indexOf(id)<0 || !Number.isInteger(stage) || !Number.isInteger(unlocked) ||
            stage<0 || stage>unlocked || unlocked>=catalog.stages.length){
            state.error='该章节尚不可阅读';return false;
        }
        const bit=1<<stage;
        if((state.read[id]||0)&bit){state.error='';return true;}
        return save(state.selection,Object.assign({},state.read,{[id]:(state.read[id]||0)|bit}));
    };
    state.firstUnread=function(model,id){
        if(known.indexOf(id)<0)return null;
        let unlocked=-1;
        if(model && model.status==='ready' && Array.isArray(model.owned) &&
            model.owned.indexOf(id)>=0){
            const growth=catalog.growthFor(model,id);
            unlocked=growth.enabled?growth.stage:0;
        }
        if(state.selection && state.selection.id===id)
            unlocked=Math.max(unlocked,state.selection.unlocked);
        for(let stage=0;stage<=unlocked;stage++)if(!((state.read[id]||0)&(1<<stage)))return stage;
        return null;
    };
    state.hasUnread=function(model,id){
        return id===undefined?known.some(cat=>state.firstUnread(model,cat)!==null):
            state.firstUnread(model,id)!==null;
    };
    return state;
}

module.exports={create};
