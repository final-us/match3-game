'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'../js/render/assets.js'),'utf8');
function fixture(mode) {
    const images=[],jobs=[],timers=new Map();let id=0;
    const wx={createImage(){if(mode==='image-throw')throw Error('decode');const image={};images.push(image);return image;},
        loadSubpackage(job){if(mode==='download-throw')throw Error('offline');jobs.push(job);}};
    const box={module:{exports:{}},wx:mode==='unavailable'?{createImage:wx.createImage}:wx,
        setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout(key){timers.delete(key);}};
    vm.runInNewContext(source,box);
    return {api:box.module.exports,images,jobs,timers};
}
function loaded(image){image.width=640;image.height=480;image.onload();}
(async()=>{
    let f=fixture(),p=f.api.loadResultArt();
    assert.strictEqual(f.api.loadResultArt(),p,'concurrent calls share one download');
    assert.strictEqual(f.jobs[0].name,'result-art');f.jobs[0].success();f.jobs[0].success();
    const keys=Object.keys(f.api.RESULT_ASSETS);
    assert.strictEqual(f.images.length,keys.length,'duplicate success cannot duplicate decodes');
    f.images.slice(0,-1).forEach(loaded);
    assert(keys.every(key=>!f.api.get(key)),'partial art must not become ready');loaded(f.images[f.images.length-1]);
    assert.strictEqual((await p).status,'ready');assert(keys.every(key=>f.api.get(key).width===640));
    assert.strictEqual((await f.api.loadResultArt()).status,'ready');assert.strictEqual(f.jobs.length,1);
    assert.strictEqual(f.timers.size,0);

    f=fixture();p=f.api.loadResultArt();f.jobs[0].success();
    const late=f.images[0].onload;f.images[1].onerror();
    assert.strictEqual((await p).status,'error');assert(keys.every(key=>!f.api.get(key)));
    const retry=f.api.loadResultArt();f.jobs[1].success();late();
    assert.strictEqual(f.api.getResultArtState().status,'loading','late failed-attempt callback stays retired');
    f.images.slice(keys.length).forEach(loaded);assert.strictEqual((await retry).status,'ready');

    f=fixture();p=f.api.loadResultArt();const lateDownload=f.jobs[0].success;
    [...f.timers.values()][0]();assert.strictEqual((await p).status,'error');lateDownload();assert.strictEqual(f.images.length,0);
    p=f.api.loadResultArt();f.jobs[1].fail();assert.strictEqual((await p).status,'error');
    for(const mode of ['download-throw','image-throw','unavailable']) {
        f=fixture(mode);p=f.api.loadResultArt();if(mode==='image-throw')f.jobs[0].success();
        assert.strictEqual((await p).status,mode==='unavailable'?'unavailable':'error');
    }
    f=fixture();p=f.api.loadResultArt();f.jobs[0].success();f.images[0].width=0;f.images[0].height=1;f.images[0].onload();
    assert.strictEqual((await p).status,'error','invalid decoded dimensions cannot become ready');
    console.log('result-art-loader: download/decode/atomic publication/timeout/retry/late callbacks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
