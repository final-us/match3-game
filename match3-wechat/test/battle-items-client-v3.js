'use strict';
const assert = require('assert');
const { fixture, flush } = require('./battle-client');
const items = require('../js/net/battle-items');
const { createBattleLocal } = require('./helpers/battle-local');
const realNow = Date.now;

(async () => {
    const f = fixture(), app = f.app;
    f.clock.now = 1800000000000;
    Date.now = () => f.clock.now;
    const server = createBattleLocal(Date.now);
    let cursor = 0;
    async function deliver(lose = false) {
        const req = f.requests[cursor++];
        assert(req, 'expected client request');
        const response = await server.call('host', { action: req.action, ...req.data });
        if (lose) req.reject(new Error('lost response'));
        else req.resolve(response);
        await flush();
        return { req, response };
    }
    const peer = (action, data = {}) => server.call('guest', {
        roomId: app.battle.roomId, protocolVersion: 2, itemRulesVersion: 3,
        roundId: app.battle.roundId, action, ...data
    });
    async function advance(target) {
        while (f.clock.now < target) {
            f.clock.now = Math.min(target, f.clock.now + 2000);
            await peer('query');
            app.pollRoom(); await deliver();
        }
    }
    app.startBattle();
    assert.strictEqual(f.requests[0].data.itemRulesVersion, 3);
    await deliver();
    assert.strictEqual(app.battle.itemRulesVersion, 3);
    assert.strictEqual((await peer('join')).ok, true);
    app.pollRoom(); await deliver();
    let b = app.battle;
    assert.strictEqual(b.roundId, 2);
    app.battleAdjustItem('freeze', -1);
    await deliver();
    assert.strictEqual(b.items.freeze, 1);
    assert.strictEqual(b.myReady, false);
    const count = f.requests.length;
    app.battleReady();
    assert.strictEqual(f.requests.length, count, 'must allocate all five before ready');
    app.battleAdjustItem('cheer', 1); await deliver();
    assert.strictEqual(b.items.cheer, 2);
    app.battleReady(); await deliver();
    assert.strictEqual(b.myReady, true);
    await peer('configureItems', { items: { freeze: 2, disturb: 1, reflect: 1, cheer: 1 } });
    app.pollRoom(); await deliver();
    assert.strictEqual(b.myReady, true, 'opponent edits never change own ready');
    await peer('ready', { ready: true });
    // Real Main callbacks with a minimal board adapter; visual/real core covered by preview.
    app.startBattleBoard = () => {
        app.battleCore = { score: 0, minMatchCount: 3 };
        app.battleBoard = { onTouchEnd() {} };
    };
    app.pollRoom(); await deliver();
    f.clock.now = b.startTime + 100;
    assert.strictEqual(app.state, 'battle_playing');
    items.sample(b, 100);
    app.battleUseItem('cheer');
    const cast = await deliver(true);
    assert.strictEqual(cast.response.myScore, 100, 'pre-cheer backlog remains raw');
    assert.strictEqual(cast.response.items.cheer, 1);
    assert(b.pendingItem && b.offline);
    app.pollRoom(); await deliver();
    assert.strictEqual(b.pendingItem, null, 'query reconciles lost item ack');
    assert.strictEqual(b.items.cheer, 1);
    assert.strictEqual(b.scoreSamples.length, 0);
    f.clock.now += 100;
    items.sample(b, 200);
    assert.strictEqual(items.displayScore(b), 300);
    app.updateBattle(f.clock.now);
    await deliver(true);
    assert.strictEqual(b.scoreUncertain, true);
    await deliver(); // failure requests query before retrying score
    assert.strictEqual(b.confirmedScore, 300);
    assert.strictEqual(b.scoreSamples.length, 0, 'lost score ack never double counts');
    assert.strictEqual(b.scoreUncertain, false);
    await advance(b.itemCooldownUntil + 1);
    const shield = await peer('useItem', { item: 'reflect', requestId: 'guest-shield-01' });
    assert.strictEqual(shield.ok, true);
    app.battleUseItem('freeze'); await deliver();
    app.pollRoom(); await deliver();
    assert(app.isFrozen(), 'own attack is returned through server response');
    const noCast = f.requests.length;
    app.battleUseItem('reflect');
    assert.strictEqual(f.requests.length, noCast);
    await advance(b.itemCooldownUntil + 1);
    app.battleUseItem('reflect');
    const ownShield = await deliver();
    await peer('useItem', { item: 'disturb', requestId: 'guest-disturb-01' });
    app.pollRoom(); await deliver();
    assert(b.reflectUntil <= f.clock.now, 'consumed shield is gone');
    app.applyEffect(ownShield.response.effect);
    assert(b.reflectUntil <= f.clock.now, 'historical grant cannot restore shield');
    await advance(b.itemCooldownUntil + 1);
    // Request fails before arrival: reconnect then retry the exact stable identifier.
    app.battleUseItem('cheer');
    const uncertain = f.requests[cursor++];
    uncertain.reject(new Error('not delivered')); await flush();
    app.pollRoom(); await deliver();
    assert(b.pendingItem);
    assert(app.isBattleInputOpen(app.battleNow()), JSON.stringify({state: app.state, now: app.battleNow(), b}));
    items.sample(b, 300);
    app.updateBattle(f.clock.now);
    await deliver();
    assert.strictEqual(b.confirmedScore, 400);
    f.clock.now += 1;
    items.sample(b, 400);
    app.battleUseItem('cheer');
    const retried = await deliver();
    assert.strictEqual(retried.req.data.requestId, uncertain.data.requestId);
    assert.strictEqual(retried.req.data.samples[0].seq, 4, 'retry sends current unacknowledged samples');
    assert.strictEqual(b.items.cheer, 0);
    // Same-millisecond pre-cast matches are flushed before the new cheer window.
    assert.strictEqual(b.confirmedScore, 500);
    // Clone-based DB check: rejected cast must not persist score samples.
    const before = b.confirmedScore;
    const failed = await server.call('host', { action: 'useItem', ...app.battleRequestData(b),
        item: 'cheer', requestId: 'invalid-cheer-01', samples: [{ seq: 5, score: 500, at: f.clock.now }] });
    assert.strictEqual(failed.ok, false);
    app.pollRoom(); await deliver();
    assert.strictEqual(b.confirmedScore, before);
    await advance(b.endTime - 100);
    b.lastScoreSyncAt = f.clock.now - 50;
    items.sample(b, 500);
    app.updateBattle(f.clock.now);
    const finalScore = await deliver();
    assert.strictEqual(finalScore.req.action, 'syncScore', 'final 800ms bypasses throttle');
    assert.strictEqual(b.confirmedScore, 600);
    f.clock.now = b.endTime + 1;
    app.pollRoom(); await deliver();
    assert.strictEqual(app.state, 'battle_result');
    await peer('rematch', { accept: true });
    app.battleAgain(); await deliver();
    assert.notStrictEqual(app.battle, b);
    assert.strictEqual(app.battle.scoreSamples.length, 0);
    assert.strictEqual(app.battle.confirmedScore, 0);
    assert.strictEqual(app.battle.items.cheer, 1);
    assert.strictEqual(app.battle.reflectUntil, 0);
    assert.strictEqual(app.battle.itemRulesVersion, 3);
    // A delayed reply cannot rewind an already calibrated clock into a cheer window.
    const clockState = app.newBattleState(true);
    items.status(clockState, { serverTime: f.clock.now + 500 }, f.clock.now);
    const sent = f.clock.now;
    f.clock.now += 4000;
    items.status(clockState, { serverTime: sent + 500, myCheerUntil: sent + 3500 }, sent);
    assert.strictEqual(clockState.serverOffset, 500);
    assert(items.serverNow(clockState) > clockState.cheerUntil);
    console.log('battle items client/server v3 integration passed');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Date.now = realNow; });
