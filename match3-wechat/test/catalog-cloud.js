'use strict';
const assert=require('assert'),crypto=require('crypto');
const {createRetentionDb,copy}=require('./helpers/retention-db');
const retention=require('../cloudfunctions/battle/retention');
const f=createRetentionDb();let now=Date.UTC(2026,8,27,4),seq=0;
const service=retention.createService(f.db,crypto,()=>now),user='catalog-test';
const info=async(owner=user)=>(await service.catalogRequest(owner,'info',{})).state;
const input=(s,id)=>({catId:id,requestId:'catalog_request_'+String(++seq).padStart(8,'0'),expectedRevision:s.revision,expectedOwner:s.owner});
const solo=id=>({id:'solo:test:'+id,mode:'solo',date:retention.beijingDate(now),levelId:1,validMove:true,completed:true,cleared:80});
const record=event=>service.record(user,{event});
(async()=>{
    assert.deepEqual((await info()).owned,[]);assert.equal((await info()).fish,0);
    const original=await info();
    assert.equal((await service.catalogRequest(user,'adopt',{...input(original,'cream'),requestId:1234567890123456})).ok,false,'request ID must be a string, not a coerced numeric value');
    assert.equal((await service.catalogRequest(user,'adopt',input(original,'cream'))).code,'NOT_ELIGIBLE');
    await service.sign(user,{date:retention.beijingDate(now)});
    assert.equal((await info()).days,0,'sign/query do not count activity');
    assert.equal((await record({...solo('quit'),completed:false})).terminal,true);
    for(let day=1;day<=28;day++){
        if(day>1)now+=86400000*(day===2?2:1); // non-consecutive days count normally
        const one=solo(day+'a');
        await Promise.all([record(one),record(one)]);
        let s=await info();assert.equal(s.days,day);assert.equal(s.roundsToday,1);
        const fishBefore=s.fish;
        await record(solo(day+'b'));assert.equal((await info()).fish,fishBefore);
        const r=await record(solo(day+'c'));assert.equal(r.eventStatus,'recorded');
        s=await info();assert.equal(s.fish,fishBefore+1);assert.equal(s.roundsToday,3);
        assert.equal((await record(solo(day+'d'))).eventStatus,'capped');
        if([6,13,20,27].includes(day))assert.equal((await service.catalogRequest(user,'adopt',input(s,['calico','siamese','ragdoll','cream'][Math.floor(day/7)]))).code,'NOT_ELIGIBLE');
        if(day%7===0){
            const id=['calico','siamese','ragdoll','cream'][day/7-1],p=input(s,id);
            const pair=await Promise.all([service.catalogRequest(user,'adopt',p),service.catalogRequest(user,'adopt',p)]);
            assert(pair.every(r=>r.ok));assert.equal((await info()).owned.length,day/7);
            assert.equal((await service.catalogRequest('different-user','adopt',p)).code,'CATALOG_OWNER_CHANGED');
            const before=await info(),feed=input(before,id);
            assert((await service.catalogRequest(user,'feed',feed)).ok);
            assert((await service.catalogRequest(user,'feed',feed)).ok);
            const after=await info();assert.equal(after.fish,before.fish-1);assert.equal(after.affection[id],1);
            assert.equal((await service.catalogRequest(user,'feed',{...feed,catId:id==='cream'?'calico':'cream'})).ok,false);
        }
    }
    let s=await info();const p=input(s,'calico'),p2=input(s,'siamese');
    const raced=await Promise.all([service.catalogRequest(user,'feed',p),service.catalogRequest(user,'feed',p2)]);
    assert.equal(raced.filter(r=>r.ok).length,1);assert.equal(raced[1].code,'STATE_CHANGED');
    const newer=input(await info(),'ragdoll');assert((await service.catalogRequest(user,'feed',newer)).ok);
    assert.equal((await service.catalogRequest(user,'feed',p)).code,'STATE_CHANGED','old replay never spends again after later operation');
    assert.equal((await service.catalogRequest(user,'feed',{...input(await info(),'calico'),expectedRevision:99999})).ok,false);
    // Grow every owned cat normally; no hardcoded first-cat eligibility.
    for(const id of s.owned)assert((await service.catalogRequest(user,'feed',input(await info(),id))).ok);
    while((await info()).affection.calico<42)assert((await service.catalogRequest(user,'feed',input(await info(),'calico'))).ok);
    s=await info();assert.equal((await service.catalogRequest(user,'feed',input(s,'calico'))).code,'NOT_ELIGIBLE');
    assert.equal((await info()).fish,s.fish,'full cat consumes no fish');
    while((await info()).fish>0)assert((await service.catalogRequest(user,'feed',input(await info(),'siamese'))).ok);
    assert.equal((await service.catalogRequest(user,'feed',input(await info(),'cream'))).code,'NOT_ELIGIBLE');
    const yesterday=solo('late');now+=86400000;
    assert.equal((await record(yesterday)).eventStatus,'expired');
    const old=(await info()).days;await record(solo('new-day'));assert.equal((await info()).days,old+1);
    const stale=input(await info(),'cream');await record(solo('new-day2'));
    assert.equal((await service.catalogRequest(user,'feed',stale)).code,'STATE_CHANGED','activity participates in revision');
    const crossDay=input(await info(),'cream');assert((await service.catalogRequest(user,'feed',crossDay)).ok);
    const committed=await info();now+=86400000;
    assert((await service.catalogRequest(user,'feed',crossDay)).ok,'previous-day committed operation can still be acknowledged');
    const recovered=await info();assert.equal(recovered.fish,committed.fish);assert.deepEqual(recovered.affection,committed.affection);
    assert.equal(recovered.days,committed.days);assert.equal(recovered.roundsToday,0,'retry alone does not earn activity');
    const existing=Object.values(f.docs.retention_profiles).find(p=>p.owner===service.ownerId(user));
    const saved=copy(existing);existing.catalog.fish=-1;
    await assert.rejects(info,/catalog profile is corrupt/);assert.equal(existing.catalog.fish,-1,'corruption not reset');
    f.docs.retention_profiles[saved._id]=saved;
    await service.info('legacy');const legacy=Object.values(f.docs.retention_profiles).find(p=>p.owner===service.ownerId('legacy'));
    delete legacy.catalog;legacy.extra='preserve';
    assert.equal((await info('legacy')).days,0);assert.equal(Object.values(f.docs.retention_profiles).find(p=>p.owner===service.ownerId('legacy')).extra,'preserve');
    const beforeCleanup=await info();await service.cleanup(now+40*86400000);assert.deepEqual(await info(),beforeCleanup,'cleanup does not delete growth');
    console.log('catalog cloud: 28 active days, all cats, fish cap, nonconsecutive days, CAS/replay, corruption/migration/cleanup passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
