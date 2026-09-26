'use strict';

const assert=require('assert');
const catalog=require('../js/platform/catalog-preview');

assert.deepStrictEqual(catalog.stages,[
    {name:'初见',threshold:0},{name:'熟悉',threshold:4},{name:'信任',threshold:10},
    {name:'依恋',threshold:20},{name:'挚友',threshold:42}
]);

for(const [before,after,expected] of [[3,4,1],[9,10,2],[19,20,3],[41,42,4]]){
    const model=catalog.create('growth');
    model.affection.cream=before;model.fish=1;
    catalog.activate(model,'feed');
    assert.deepStrictEqual(model.overlay,{kind:'feed',catId:'cream'});
    catalog.activate(model,'confirm-feed');
    assert.strictEqual(model.affection.cream,after);
    assert.strictEqual(catalog.stageFor(model,'cream'),expected);
    assert.strictEqual(model.displayStages.cream,expected);
    assert.deepStrictEqual(model.overlay,{kind:'unlock',catId:'cream',stage:expected});
    assert.strictEqual(model.message,'','stage unlock owns the feedback surface');
    catalog.activate(model,'confirm-feed');
    assert.strictEqual(model.affection.cream,after,'repeated confirmation must not feed twice');
    assert.strictEqual(model.fish,0,'one confirmed feed consumes exactly one fish');
}

{
    const model=catalog.create('growth');
    catalog.activate(model,'feed');catalog.activate(model,'confirm-feed');
    assert.strictEqual(model.affection.cream,4);
    assert.strictEqual(model.message,'');
    catalog.activate(model,'dismiss');
    catalog.activate(model,'feed');catalog.activate(model,'confirm-feed');
    assert.strictEqual(model.affection.cream,5);
    assert.strictEqual(model.message,'奶糖吃得很开心 · 亲密度 +1');
}

{
    const model=catalog.create('growth');
    catalog.activate(model,'feed');
    catalog.activate(model,'dismiss');
    catalog.activate(model,'confirm-feed');
    assert.strictEqual(model.affection.cream,3,'dismissed feed must not change affection');
    assert.strictEqual(model.fish,2,'dismissed feed must not consume fish');
}

{
    const model=catalog.create('growth');
    catalog.activate(model,'feed');
    model.selectedId='ragdoll';
    catalog.activate(model,'confirm-feed');
    assert.strictEqual(model.affection.cream,3,'selection changes must invalidate confirmation');
    assert.strictEqual(model.fish,2);
    assert.deepStrictEqual(model.overlay,{kind:'feed',catId:'cream'},'invalid confirmation remains dismissible');
    model.selectedId='cream';
    model.owned.unshift('ragdoll');
    catalog.activate(model,'confirm-feed');
    assert.strictEqual(model.affection.cream,3,'only the first adopted cat may grow in the sample');
}

{
    const model=catalog.create('stages');
    const before=catalog.growthFor(model,'cream');
    catalog.activate(model,'stage:4');
    assert.deepStrictEqual(model.overlay,{kind:'gallery',catId:'cream',stage:4},'locked art must expose its threshold');
    catalog.activate(model,'show-stage');
    assert.strictEqual(model.displayStages.cream,before.displayStage,'locked art cannot become the display art');
    assert(model.overlay,'rejected selection keeps the gallery open');
    catalog.activate(model,'dismiss');
    catalog.activate(model,'stage:1');
    catalog.activate(model,'show-stage');
    assert.strictEqual(model.displayStages.cream,1,'unlocked art can be selected');
    assert.strictEqual(model.overlay,null);
    assert.strictEqual(model.affection.cream,before.affection,'reviewing old art must not reduce progress');
    assert.strictEqual(catalog.stageFor(model,'cream'),before.stage);
}

{
    const model=catalog.create('hungry');
    catalog.activate(model,'feed');
    assert.deepStrictEqual(model.overlay,{kind:'food',catId:'cream'});
    catalog.activate(model,'confirm-feed');
    assert.strictEqual(model.fish,0);assert.strictEqual(model.affection.cream,3);
    assert.strictEqual(catalog.activate(model,'go-play'),'play');
    assert.strictEqual(model.overlay,null);
}

{
    const model=catalog.create('growth');
    model.fish=1;catalog.activate(model,'feed');model.fish=0;
    catalog.activate(model,'confirm-feed');
    assert.strictEqual(model.affection.cream,3);assert.strictEqual(model.fish,0);
    assert.deepStrictEqual(model.overlay,{kind:'feed',catId:'cream'},'late resource loss keeps confirmation dismissible');
}

{
    const model=catalog.create('maxed');
    const fish=model.fish;
    catalog.activate(model,'interaction');
    assert.strictEqual(model.fish,fish,'max-level interaction must not consume fish');
    assert.strictEqual(model.affection.cream,42);
    assert.strictEqual(model.overlay,null);
    assert(model.message.indexOf('互动')>=0);
}

{
    const model=catalog.create('growth');
    catalog.activate(model,'interaction');
    assert.strictEqual(model.message,'','interaction is available only at max level');
    catalog.activate(model,'feed');
    const overlay=model.overlay;
    model.view='list';
    catalog.activate(model,'cat:ragdoll');catalog.activate(model,'adopt');catalog.activate(model,'stage:0');catalog.activate(model,'feed');
    assert.strictEqual(model.selectedId,'cream','modal blocks underlying cat navigation');
    assert.deepStrictEqual(model.owned,['cream'],'modal blocks underlying adoption');
    assert.deepStrictEqual(model.overlay,overlay,'underlying actions cannot replace a modal');
}

{
    const model=catalog.create();
    catalog.completeRound(model,true);
    assert.strictEqual(model.roundsToday,1);assert.strictEqual(model.fish,3);
    assert.strictEqual(model.days,0,'rounds before the first adoption do not count active days');
    model.view='detail';model.selectedId='cream';catalog.activate(model,'adopt');
    catalog.completeRound(model,false);
    assert.strictEqual(model.roundsToday,1,'active exits must not count');
    catalog.completeRound(model,true);
    assert.strictEqual(model.roundsToday,2);assert.strictEqual(model.fish,3);assert.strictEqual(model.days,1);
    catalog.completeRound(model,true);
    assert.strictEqual(model.roundsToday,3);assert.strictEqual(model.fish,4);assert.strictEqual(model.days,1);
    catalog.completeRound(model,true);
    assert.strictEqual(model.roundsToday,4);assert.strictEqual(model.fish,4,'daily reward is capped at two fish');
    catalog.nextDay(model);
    assert.strictEqual(model.previewDay,2);assert.strictEqual(model.roundsToday,0);
    catalog.completeRound(model,true);
    assert.strictEqual(model.fish,5);assert.strictEqual(model.days,2,'the next preview day may count once');
}

{
    const model=catalog.create('adopted');
    assert.strictEqual(catalog.growthFor(model,'cream').enabled,true);
    assert.strictEqual(catalog.growthFor(model,'ragdoll').enabled,false);
    model.selectedId='ragdoll';model.view='detail';
    catalog.activate(model,'feed');catalog.activate(model,'stage:0');
    assert.strictEqual(model.overlay,null,'later adopted cats remain outside the growth sample');
}

{
    const model=catalog.create('growth');
    catalog.activate(model,'feed');
    catalog.activate(model,'back');
    assert.strictEqual(model.view,'detail','back closes an overlay before navigating');
    assert.strictEqual(model.overlay,null);
    catalog.activate(model,'back');
    assert.strictEqual(model.view,'list');
}

console.log('catalog growth logic passed');
