'use strict';

const assert=require('assert');
const catalog=require('../js/platform/catalog-preview');
const companion=require('../js/platform/companion');
const stories=require('../js/core/cat-stories');
const KEY='match3_companion_display_v1';

function storage(initial){
    let value=initial,writes=0,failRead=false,failWrite=false;
    return {
        getStorageSync(key){assert.strictEqual(key,KEY);if(failRead)throw new Error('read');return value;},
        setStorageSync(key,next){assert.strictEqual(key,KEY);if(failWrite)throw new Error('write');value=next;writes++;},
        get value(){return value;},get writes(){return writes;},
        set failRead(next){failRead=next;},set failWrite(next){failWrite=next;}
    };
}

{
    const api=storage(),display=companion.create(api),model=catalog.create('stages');
    model.displayStages.cream=1;
    const before=JSON.stringify(model);
    assert.strictEqual(display.select(model,'cream'),true);
    assert.deepStrictEqual(api.value,{version:1,selection:{id:'cream',stage:1,unlocked:3}});
    assert.strictEqual(JSON.stringify(model),before,'display choice cannot change growth or wallet');
    assert.strictEqual(display.select(model,'cream'),true);
    assert.strictEqual(api.writes,1,'unchanged choice needs no duplicate write');
    const restored=companion.create(api);
    assert.deepStrictEqual(restored.selection,{id:'cream',stage:1,unlocked:3});
    assert.strictEqual(stories[restored.selection.id][restored.selection.unlocked].title,'听见你的脚步');
    assert.strictEqual(restored.restoreDefault(),true);
    assert.deepStrictEqual(api.value,{version:1,selection:null});
    assert.strictEqual(companion.create(api).selection,null);
    assert.strictEqual(restored.restoreDefault(),true);
    assert.strictEqual(api.writes,2);
}

{
    const api=storage(),display=companion.create(api),model=catalog.create('adopted');
    model.affection.ragdoll=42;model.displayStages.ragdoll=4;
    assert.strictEqual(display.select(model,'ragdoll'),true);
    assert.deepStrictEqual(display.selection,{id:'ragdoll',stage:0,unlocked:0},
        'later adopted cats have no growth stages enabled');
    const previous=display.selection;
    assert.strictEqual(display.select(model,'calico'),false);
    assert.strictEqual(display.select(model,'unknown'),false);
    model.status='loading';
    assert.strictEqual(display.select(model,'cream'),false);
    assert.strictEqual(display.selection,previous);
    assert.strictEqual(api.writes,1);
}

{
    const api=storage(),display=companion.create(api),model=catalog.create('growth');
    api.failWrite=true;
    assert.strictEqual(display.select(model,'cream'),false);
    assert.strictEqual(display.selection,null);
    assert(display.error.includes('保存失败'));
    api.failWrite=false;assert.strictEqual(display.select(model,'cream'),true);
    api.failWrite=true;assert.strictEqual(display.restoreDefault(),false);
    assert.strictEqual(display.selection.id,'cream');
    assert(display.error.includes('保存失败'));
}

{
    const old={version:1,selection:{id:'cream',stage:1,unlocked:2}};
    const api=storage(old),display=companion.create(api),model=catalog.create();
    assert.deepStrictEqual(display.read,{},'old display snapshots load without a read map');
    assert.strictEqual(display.firstUnread(model,'cream'),0,
        'saved story range remains readable without restoring ownership');
    assert.strictEqual(model.owned.length,0);
    assert.strictEqual(display.hasUnread(model,'ragdoll'),false);
    model.status='error';model.owned=['ragdoll'];
    assert.strictEqual(display.firstUnread(model,'ragdoll'),null,
        'failed catalog data cannot expose live-owned chapters');
    assert.strictEqual(display.firstUnread(model,'cream'),0,
        'saved selection remains readable while catalog data fails');
    model.owned=[];model.status='ready';
    assert.strictEqual(display.markRead('cream',0,2),true);
    assert.deepStrictEqual(api.value,{...old,read:{cream:1}});
    assert.strictEqual(display.firstUnread(model,'cream'),1);
    assert.strictEqual(display.markRead('cream',3,2),false,'locked chapter cannot be marked');
    assert.strictEqual(display.markRead('cream',4,5),false);
    assert.strictEqual(display.markRead('alien',0,0),false);
    assert.deepStrictEqual(api.value.read,{cream:1});
    assert.strictEqual(display.markRead('cream',0,2),true);
    assert.strictEqual(api.writes,1,'repeated read does not write again');
    assert.strictEqual(display.restoreDefault(),true);
    assert.deepStrictEqual(api.value,{version:1,selection:null,read:{cream:1}});
    const reloaded=companion.create(api);
    assert.strictEqual(reloaded.hasUnread(model,'cream'),false,
        'read marks alone never grant story access or adoption');
    assert.strictEqual(model.owned.length,0);
}

{
    const api=storage(),display=companion.create(api),model=catalog.create('adopted');
    assert.strictEqual(display.hasUnread(model),true);
    assert.strictEqual(display.firstUnread(model,'cream'),0);
    assert.strictEqual(display.firstUnread(model,'ragdoll'),0);
    assert.strictEqual(display.firstUnread(model,'siamese'),null);
    assert.strictEqual(display.markRead('cream',0,0),true);
    assert.strictEqual(display.hasUnread(model,'cream'),false);
    assert.strictEqual(display.hasUnread(model),true,'another owned cat remains unread');
    assert.strictEqual(display.markRead('ragdoll',0,0),true);
    assert.strictEqual(display.hasUnread(model),false);
    assert.strictEqual(display.select(model,'ragdoll'),true);
    assert.deepStrictEqual(api.value.read,{cream:1,ragdoll:1},'select retains all read marks');
    model.affection.cream=10;
    assert.strictEqual(display.firstUnread(model,'cream'),1);
    const before=JSON.stringify(model);
    assert.strictEqual(display.markRead('cream',1,2),true);
    assert.strictEqual(display.markRead('cream',2,2),true);
    assert.strictEqual(display.firstUnread(model,'cream'),null);
    assert.strictEqual(JSON.stringify(model),before,'reading cannot modify affection or fish');
}

{
    const api=storage(),display=companion.create(api),model=catalog.create('growth');
    assert.strictEqual(display.select(model,'cream'),true);
    api.failWrite=true;
    assert.strictEqual(display.markRead('cream',0,0),false);
    assert.deepStrictEqual(display.read,{});
    assert.strictEqual(display.selection.id,'cream');
    assert(display.error.includes('保存失败'));
    api.failWrite=false;assert.strictEqual(display.markRead('cream',0,0),true);
    assert.deepStrictEqual(companion.create(api).read,{cream:1});
}

for(const saved of [
    {version:2,selection:null},{version:1,selection:{id:'cream',stage:2,unlocked:1}},
    {version:1,selection:{id:'cream',stage:-1,unlocked:0}},
    {version:1,selection:{id:'cream',stage:0.5,unlocked:2}},
    {version:1,selection:{id:'alien',stage:0,unlocked:0}},
    {version:1,selection:null,read:{alien:1}},
    {version:1,selection:null,read:{cream:32}},
    {version:1,selection:null,read:{cream:1.5}}
]){
    const api=storage(saved),display=companion.create(api);
    assert.strictEqual(display.selection,null);
    assert(display.error.includes('读取失败'));
    assert.strictEqual(api.writes,0,'invalid reads must not overwrite storage');
}
{
    const api=storage();api.failRead=true;
    const display=companion.create(api);
    assert(display.error.includes('读取失败'));
    assert.strictEqual(api.writes,0);
    assert.strictEqual(companion.create(null).restoreDefault(),false);
    assert.strictEqual(companion.create({getStorageSync(){}}).select(catalog.create('growth'),'cream'),false);
}

assert.deepStrictEqual(Object.keys(stories),catalog.cats.map(cat=>cat.id));
for(const entries of Object.values(stories)){
    assert.strictEqual(entries.length,5);
    for(const entry of entries){
        assert(entry.title && typeof entry.title==='string');
        assert.strictEqual(entry.lines.length,3);
        for(const line of entry.lines)assert(line && line.length<=22,'mobile story line should stay short');
    }
}
assert.deepStrictEqual(stories.cream[2],{title:'第一次安心睡在你身边',lines:[
    '那天，你没有急着离开。','奶糖把脑袋轻轻放下，','第一次，在你身边安心打起了盹。'
]});

console.log('companion storage and stories passed');
