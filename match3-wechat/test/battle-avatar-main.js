'use strict';
const assert = require('assert');
const { fixture, flush } = require('./battle-client');

(async () => {
    for(const invited of [false,true]){
        let entered=0;
        const entry=fixture({profile:{clearRoomProfile(){},beginRoom(){entered++;}}});
        entry.app.retireSoloReport=()=>{};
        if(invited)entry.app.joinBattle('R12345678abcdef0123');else entry.app.startBattle();
        entry.requests[0].resolve({ok:true,roomId:'R12345678abcdef0123',protocolVersion:2,roundId:1});await flush();
        assert.equal(entry.app.state,'battle_wait');assert.equal(entered,1,'created and invited rooms both initiate the portrait consent check');
    }
    // Render the real Main routes, including portrait clearing between frames.
    const BattleUI = require('../js/render/battle-ui');
    const methods=['drawTop','drawResult','drawItems','drawEffects'];
    const originals=Object.fromEntries(methods.map(k=>[k,BattleUI[k]]));
    const frames={};
    const mine={width:96,height:96,id:'chosen-local'},other={width:96,height:96,id:'room-peer'};
    let peer=other;
    const rendering=fixture({profile:{destroyButton(){},getAvatarImage:()=>mine,getOpponentAvatarImage:url=>url==='room-avatar'?peer:null}});
    try {
        for(const key of methods)BattleUI[key]=(_ctx,_screen,data)=>{frames[key]=data;return {};};
        const b=rendering.playing();b.oppAvatarUrl='room-avatar';b.itemRulesVersion=3;b.itemCooldowns={freeze:15000,disturb:0,reflect:0,cheer:0};
        rendering.app.ctx={};rendering.app.screen={width:390,height:844};rendering.app.battleBoard.draw=()=>{};
        rendering.app.battleNow=()=>rendering.clock.now;
        rendering.app.reportHomeFrame=rendering.app.reportActivationFrame=()=>{};
        rendering.app.render();
        assert.strictEqual(frames.drawTop.myAvatar,mine);
        assert.strictEqual(frames.drawTop.oppAvatar,other);
        assert.strictEqual(frames.drawItems.sharedCooldown,false);
        assert.strictEqual(frames.drawItems.cooldowns.freeze,10000);
        assert.strictEqual(frames.drawItems.cooldowns.cheer,0,'other item stays available during freeze cooldown');
        for(const result of ['win','lose','draw']){
            b.result=result;rendering.app.state='battle_result';rendering.app.render();
            assert.strictEqual(frames.drawResult.myAvatar,mine);
            assert.strictEqual(frames.drawResult.oppAvatar,other);
        }
        peer=null;rendering.app.render();assert.strictEqual(frames.drawResult.oppAvatar,null,'cleared/unavailable portrait reaches fallback instead of stale image');
    } finally { for(const key of methods)BattleUI[key]=originals[key]; }
    let url = 'https://thirdwx.qlogo.cn/avatar/example/132', clears = 0;
    const profile = { getSharedAvatarUrl: () => url, clearRoomProfile: () => { clears++; url = ''; } };
    const f = fixture({ profile }), b = f.playing();
    b.protocolVersion = 2; b.roundId = 3; b.itemRulesVersion = 3;
    f.app.state = 'battle_wait'; b.myReady = true; b.myScore = 720;
    const items = JSON.stringify(b.items);
    f.app.syncBattleAvatar(); f.app.syncBattleAvatar();
    assert.strictEqual(f.requests.length, 1, 'one portrait write at a time');
    assert.strictEqual(f.requests[0].action, 'profile');
    assert.strictEqual(f.requests[0].data.avatarUrl, url);
    assert.strictEqual(f.requests[0].data.roundId, 3);
    assert.strictEqual(b.actionPending, false, 'portrait never locks ready or items');
    f.requests[0].reject(new Error('offline')); await flush();
    assert(b.avatarProfileError);
    assert.strictEqual(b.myReady, true);
    assert.strictEqual(b.myScore, 720);
    assert.strictEqual(JSON.stringify(b.items), items);
    f.app.battleButtons = { avatar: {x:10,y:10,w:44,h:44} };
    f.app.handleTouchStart({touches:[{clientX:20,clientY:20}]});
    assert.strictEqual(f.requests[1].action, 'profile', 'failed write can retry through actual avatar hit');
    f.requests[1].resolve({ok:true}); await flush();
    assert.strictEqual(b.avatarProfileError, false);
    f.app.syncBattleAvatar();
    const prior = url;
    url = 'https://wx.qlogo.cn/new-choice/132';
    f.app.syncBattleAvatar();
    assert.strictEqual(f.requests.length, 3);
    assert.strictEqual(f.requests[2].data.avatarUrl, prior);
    f.requests[2].resolve({ok:true}); await flush();
    assert.strictEqual(f.requests[3].data.avatarUrl, url, 'newer choice flushes after a pending write');
    f.requests[3].resolve({ok:true}); await flush();
    f.app.applyPoll({protocolVersion:2,roundId:3,itemRulesVersion:3,myReady:true,
        opp:{nickname:'好友',ready:true,score:640,avatarUrl:'https://wx.qlogo.cn/other/132'}});
    assert.strictEqual(b.oppAvatarUrl, 'https://wx.qlogo.cn/other/132');
    b.completedTracked = true;
    f.app.applyPoll({protocolVersion:2,roundId:3,itemRulesVersion:3,opp:{avatarUrl:''}});
    assert.strictEqual(b.oppAvatarUrl, '', 'a cleared portrait propagates to results');
    b.completedTracked = false;
    f.app.syncBattleAvatar();
    const late = f.requests[4];
    f.app.battle = f.app.newBattleState(true);
    late.reject(new Error('late old room')); await flush();
    assert.strictEqual(f.app.battle.avatarProfileError, false, 'late portrait callback cannot affect another room');
    f.app.battle = b; f.app.battleCancel();
    assert.strictEqual(clears, 1, 'actual leave revokes room sharing consent');
    assert.strictEqual(url, '');

    for (const state of ['battle_playing', 'battle_result']) {
        for (const failed of [false, true]) {
            let selected = 'https://wx.qlogo.cn/first/132';
            const g = fixture({profile: {getSharedAvatarUrl: () => selected}});
            const round = g.playing(); round.protocolVersion = 2; round.roundId = 3; round.itemRulesVersion = 3;
            g.app.state = 'battle_wait';
            g.app.syncBattleAvatar();
            selected = 'https://wx.qlogo.cn/latest/132';
            g.app.syncBattleAvatar();
            g.app.state = state;
            if (failed) g.requests[0].reject(new Error('old portrait failed'));
            else g.requests[0].resolve({ok:true});
            await flush();
            assert.strictEqual(g.requests[1].data.avatarUrl, selected, 'latest explicit choice flushes after leaving preparation');
            assert.strictEqual(round.actionPending, false);
            g.requests[1].resolve({ok:true}); await flush();
            assert.strictEqual(round.avatarProfileError, false);
        }
    }

    let chosen = 'https://wx.qlogo.cn/first/132';
    const h = fixture({profile: {getSharedAvatarUrl: () => chosen}});
    const old = h.playing(); old.protocolVersion = 2; old.roundId = 3; old.itemRulesVersion = 3;
    h.app.state = 'battle_wait'; h.app.syncBattleAvatar();
    chosen = 'https://wx.qlogo.cn/latest/132';
    h.app.applyPoll({protocolVersion:2,roundId:4,itemRulesVersion:3,status:'waiting',opp:null});
    assert.strictEqual(h.requests[1].data.roundId, 4);
    assert.strictEqual(h.requests[1].data.avatarUrl, chosen, 'same-room rematch retains consent and flushes current selection');
    const current = h.app.battle;
    h.requests[0].reject(new Error('late old round')); await flush();
    assert.strictEqual(current.avatarProfileError, false);
    assert(current.avatarProfileRequest, 'old callback cannot clear current portrait request');
    h.requests[1].resolve({ok:true}); await flush();
    console.log('battle avatar Main integration passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
