'use strict';

// Queue acceptance regressions plus explicitly synthetic diagnostic evidence.
// Real Main + actual local cloud handler; synthetic scores/latency, no accounts/network.
const assert = require('assert');
const { fixture, flush } = require('./battle-client');
const items = require('../js/net/battle-items');
const { createBattleLocal } = require('./helpers/battle-local');
const realNow = Date.now;

async function playing(options = {}) {
    const f = fixture(), app = f.app;
    f.clock.now = 1800000000000;
    Date.now = () => f.clock.now;
    const server = createBattleLocal(Date.now);
    let cursor = 0;
    function take(action) {
        const req = f.requests[cursor++];
        assert(req && req.action === action, 'expected ' + action);
        return req;
    }
    async function reply(req) {
        const res = await server.call('host', { action: req.action, ...req.data });
        if (options.oldServer) {
            delete res.scoreCloseAt;
            delete res.myScoreFinalized;
        }
        req.resolve(res);
        await flush();
        return res;
    }
    const deliver = action => reply(take(action));
    const peer = (action, extra = {}) => server.call('guest', {
        action, roomId: app.battle.roomId, protocolVersion: 2, itemRulesVersion: 3,
        roundId: app.battle.roundId, ...extra
    });
    app.startBattle();
    const created = await deliver('create');
    const joined = await peer('join');
    assert.strictEqual(created.protocolVersion, joined.protocolVersion);
    assert.strictEqual(created.itemRulesVersion, joined.itemRulesVersion);
    assert.strictEqual(joined.roundId, 2);
    app.pollRoom(); await deliver('query');
    const b = app.battle;
    assert.strictEqual(b.roundId, joined.roundId);
    app.battleReady(); await deliver('ready');
    await peer('ready', { ready: true });
    app.startBattleBoard = () => {
        app.battleCore = { score: 0, minMatchCount: 3 };
        app.battleBoard = { onTouchEnd() {} };
    };
    app.pollRoom(); await deliver('query');
    f.clock.now = b.startTime + 100;
    assert.strictEqual(app.state, 'battle_playing');
    return { f, app, b, server, take, reply, deliver, peer };
}

async function advance(context, target) {
    const { f, app, deliver, peer } = context;
    while (f.clock.now < target) {
        f.clock.now = Math.min(target, f.clock.now + 2000);
        await peer('query');
        app.pollRoom(); await deliver('query');
    }
}

async function lateItemDeadline() {
    const { f, app, b, server, take, deliver, peer } = await playing();
    // Keep both players online while advancing to the final window.
    while (f.clock.now < b.endTime - 1500) {
        f.clock.now = Math.min(b.endTime - 1500, f.clock.now + 2000);
        await peer('query');
        app.pollRoom(); await deliver('query');
    }
    const control = fixture(), other = control.app, otherBattle = control.playing();
    Object.assign(otherBattle, { roomId: b.roomId, protocolVersion: 2, roundId: b.roundId,
        startTime: b.startTime, endTime: b.endTime });
    items.configure(otherBattle, { itemRulesVersion: 3 });
    items.status(otherBattle, { scoreCloseAt: b.scoreCloseAt }, f.clock.now);
    control.clock.now = f.clock.now;
    async function controlReply(req) {
        const response = await server.call('guest', { action: req.action, ...req.data });
        req.resolve(response); await flush();
        return response;
    }
    // Legal synthetic match-score inputs; real Main request/lock/deadline behavior.
    // They model 100 + 100 raw points, never a ceiling violation or a real play trace.
    items.sample(b, 100);
    app.battleUseItem('reflect');
    const cast = take('useItem');
    const accepted = await server.call('host', { action: cast.action, ...cast.data });
    assert.strictEqual(accepted.ok, true);
    assert.strictEqual(accepted.rawScore, 100);
    assert.strictEqual(accepted.items.reflect, 0);
    items.sample(otherBattle, 100);
    other.updateBattle(control.clock.now);
    assert.strictEqual((await controlReply(control.requests[0])).myScore, 100);

    f.clock.now = b.endTime - 500;
    control.clock.now = f.clock.now;
    items.sample(b, 200);
    const before = f.requests.length;
    app.updateBattle(f.clock.now);
    assert.strictEqual(b.actionPending, true);
    assert.strictEqual(b.myScore, 200);
    assert.strictEqual(f.requests.length, before, 'pending item blocks legal final score submission');
    items.sample(otherBattle, 200);
    other.updateBattle(control.clock.now);
    assert.strictEqual(control.requests[1].action, 'syncScore');
    assert.strictEqual((await controlReply(control.requests[1])).myScore, 200);

    f.clock.now = b.endTime + 500; // Item was accepted before end; only its reply is late.
    control.clock.now = f.clock.now;
    cast.resolve(accepted); await flush();
    assert.strictEqual(b.actionPending, false);
    assert.strictEqual(b.confirmedScore, 100);
    app.updateBattle(f.clock.now);
    assert.strictEqual(b.inputClosed, true);
    assert.strictEqual(f.requests.length, before + 1, 'advertised close window submits tail sample');
    assert.deepStrictEqual(Array.from(b.scoreSamples, s => s.seq), [2]);
    const final = take('syncScore');
    assert.strictEqual(final.data.final, true);
    assert.strictEqual(final.data.samples[0].score, 200);
    const finalResponse = await server.call('host', { action: final.action, ...final.data });
    assert.strictEqual(finalResponse.myScore, 200);
    final.resolve(finalResponse); await flush();
    assert.strictEqual(b.scoreFinalized, true);
    other.updateBattle(control.clock.now);
    assert.strictEqual(control.requests[2].data.final, true);
    assert.strictEqual(control.requests[2].data.samples.length, 0);
    await controlReply(control.requests[2]);
    const result = await deliver('query'); // Automatically requested by successful final.
    assert.strictEqual(result.status, 'finished', 'both final flags settle before closeAt');
    assert.strictEqual(f.clock.now, b.endTime + 500);
    assert.strictEqual(result.result.myScore, 200);
    assert.strictEqual(result.result.oppScore, 200);
    assert.strictEqual(app.state, 'battle_result');
    assert.strictEqual(b.myScore, 200);
    await controlReply(control.requests[3]); // Other Main also auto-queries its final.
    assert.strictEqual(other.state, 'battle_result');
    assert.strictEqual(otherBattle.myScore, 200);
    console.log('late item fixed: tail sample finalized after delayed item reply; same-room 200 vs 200; both finals settle at end+500ms');
}

async function finalization() {
    for (const count of [0, 33]) {
        const context = await playing(), { f, app, b, take, reply, deliver, peer } = context;
        await advance(context, b.endTime - 100);
        for (let seq = 1; seq <= count; seq++) items.sample(b, seq * 10);
        f.clock.now = b.endTime;
        b.queuedItem = 'reflect';
        const sampledBefore = b.nextScoreSeq;
        items.sample(b, 1000); // Simulated late animation callback must not create score.
        assert.strictEqual(b.nextScoreSeq, sampledBefore);
        app.battleUseItem('reflect');
        app.updateBattle(f.clock.now);
        assert.strictEqual(b.queuedItem, null);
        const first = take('syncScore');
        assert.strictEqual(first.data.samples.length, Math.min(count, 32));
        assert.strictEqual(first.data.final, count <= 32 ? true : undefined);
        await reply(first);
        if (count > 32) {
            assert.strictEqual(b.scoreFinalized, false);
            app.updateBattle(f.clock.now);
            const last = take('syncScore');
            assert.strictEqual(last.data.final, true);
            assert.strictEqual(last.data.samples.length, 1);
            assert.strictEqual(last.data.samples[0].seq, 33);
            await reply(last);
        }
        assert.strictEqual(b.scoreFinalized, true);
        assert.strictEqual(b.confirmedScore, count * 10);
        assert.strictEqual(f.requests.filter(req => req.action === 'useItem').length, 0);
        await peer('syncScore', { samples: [], final: true });
        await deliver('query');
        assert.strictEqual(app.state, 'battle_result');
        assert.strictEqual(b.myScore, count * 10);
    }
    console.log('finalization: empty final and 33 samples (32 + final 1); no post-deadline sample or cast');
    for (const reachedServer of [false, true]) {
        const context = await playing(), { f, app, b, server, take, reply, deliver, peer } = context;
        await advance(context, b.endTime - 100);
        items.sample(b, 100);
        f.clock.now = b.endTime + 1;
        app.updateBattle(f.clock.now);
        const final = take('syncScore');
        assert.strictEqual(final.data.final, true);
        if (reachedServer) assert.strictEqual((await server.call('host', { action: final.action, ...final.data })).ok, true);
        final.reject(new Error('synthetic lost final response')); await flush();
        assert.strictEqual(b.scoreUncertain, true);
        await deliver('query');
        assert.strictEqual(b.scoreFinalized, reachedServer);
        assert.strictEqual(b.scoreUncertain, false);
        const before = f.requests.length;
        app.updateBattle(f.clock.now);
        if (!reachedServer) {
            const retry = take('syncScore');
            assert.strictEqual(retry.data.final, true);
            assert.strictEqual(JSON.stringify(retry.data.samples), JSON.stringify(final.data.samples));
            await reply(retry);
        } else assert.strictEqual(f.requests.length, before, 'query finalized flag prevents duplicate final');
        assert.strictEqual(b.confirmedScore, 100);
        assert.strictEqual(b.scoreAckSeq, 1);
        await peer('syncScore', { samples: [], final: true });
        if (reachedServer) app.pollRoom();
        await deliver('query');
        assert.strictEqual(app.state, 'battle_result');
        assert.strictEqual(b.myScore, 100);
    }
    console.log('final loss: query distinguishes accepted/undelivered final; safe retry only when unfinalized');
    {
        const context = await playing(), { f, app, b, server, take } = context;
        await advance(context, b.endTime - 100);
        items.sample(b, 100);
        f.clock.now = b.endTime + 1;
        app.updateBattle(f.clock.now);
        const final = take('syncScore');
        const response = await server.call('host', { action: final.action, ...final.data });
        assert.strictEqual(response.myScoreFinalized, true);
        app.applyPoll({ ok: true, protocolVersion: 2, itemRulesVersion: 3,
            roundId: b.roundId + 1, status: 'waiting', myScoreSeq: 0,
            myRawScore: 0, myScore: 0 }, f.clock.now);
        const next = app.battle, before = f.requests.length;
        final.resolve(response); await flush();
        items.sample(b, 200); // Old board's post-cutoff score cannot enter its tail queue.
        assert.strictEqual(b.nextScoreSeq, 1);
        assert.strictEqual(app.battle, next);
        assert.strictEqual(next.scoreFinalized, false);
        assert.strictEqual(next.scoreCloseAt, 0);
        assert.strictEqual(next.scoreAckSeq, 0);
        assert.strictEqual(next.scoreSamples.length, 0);
        app.battleUseItem('reflect');
        app.updateBattle(f.clock.now);
        assert.strictEqual(f.requests.length, before, 'old final callback sends no new-round query/item');
    }
    console.log('round isolation: delayed old final cannot mark next round finalized, query or cast; old post-cutoff score excluded');
    {
        // New local handler with advertised fields removed models the old response contract.
        // This verifies client compatibility, not an archived backend implementation.
        const context = await playing({ oldServer: true }), { f, app, b } = context;
        await advance(context, b.endTime - 100);
        items.sample(b, 100);
        assert.strictEqual(b.scoreCloseAt, 0);
        f.clock.now = b.endTime;
        const before = f.requests.length;
        app.updateBattle(f.clock.now);
        app.battleUseItem('reflect');
        assert.strictEqual(f.requests.length, before, 'old server receives no post-deadline score/item');
    }
    console.log('old response contract: absent closeAt keeps original cutoff with no final request');
}

(async () => {
    await lateItemDeadline();
    if (process.argv.includes('--late-item-only')) return;
    await finalization();
    if (process.argv.includes('--finalization-only')) return;
    {
        const { f, app, b, take, reply, deliver, peer } = await playing();
        items.sample(b, 100);
        app.updateBattle(f.clock.now);
        const score = take('syncScore'), before = f.requests.length;
        app.battleUseItem('reflect');
        app.battleUseItem('freeze');
        app.battleUseItem('cheer');
        assert.strictEqual(b.queuedItem, 'reflect', 'only first click retained');
        assert.strictEqual(f.requests.length, before, 'no item/score concurrency');
        for (let wave = 2; wave <= 4; wave++) {
            f.clock.now += 500;
            items.sample(b, wave * 100);
            app.updateBattle(f.clock.now);
            assert.strictEqual(f.requests.length, before);
        }
        app.pollRoom();
        assert.strictEqual(b.pollWanted, true);
        f.clock.now += 500; // Controlled 2-second cloud response.
        await peer('query');
        assert.strictEqual((await reply(score)).ok, true);
        assert.strictEqual(b.pollPending, true);
        await deliver('query');
        app.updateBattle(f.clock.now);
        const cast = take('useItem');
        assert.strictEqual(cast.data.item, 'reflect');
        assert.deepStrictEqual(Array.from(cast.data.samples, s => s.seq), [2, 3, 4]);
        app.updateBattle(f.clock.now);
        assert.strictEqual(f.requests.length, before + 2, 'one query and one item, no concurrent score');
        assert.strictEqual((await reply(cast)).ok, true);
        assert.strictEqual(b.confirmedScore, 400);
        assert.strictEqual(b.items.reflect, 0);
        assert.strictEqual(b.items.freeze, 2);
        assert.strictEqual(b.items.cheer, 1);
        assert.strictEqual(b.queuedItem, null);
        app.updateBattle(f.clock.now);
        assert.strictEqual(f.requests.filter(r => r.action === 'useItem').length, 1);
        console.log('slow replies: first click retained; 3 new score samples atomically flushed by exactly one item; deferred query succeeds');
    }
    for (const changed of ['frozen', 'deadline', 'round']) {
        const { f, app, b, take, reply, peer } = await playing();
        items.sample(b, 100);
        app.updateBattle(f.clock.now);
        const score = take('syncScore');
        app.battleUseItem('reflect');
        if (changed === 'frozen') {
            assert.strictEqual((await peer('useItem', { item: 'freeze', requestId: 'guest-freeze-queued' })).ok, true);
            await reply(score);
            assert(app.isFrozen());
        } else if (changed === 'deadline') {
            f.clock.now = b.endTime;
            app.updateBattle(f.clock.now);
            assert.strictEqual(b.queuedItem, null);
            score.reject(new Error('response lost after deadline'));
            await flush();
        } else {
            app.applyPoll({ ok: true, protocolVersion: 2, itemRulesVersion: 3,
                roundId: b.roundId + 1, status: 'waiting', myScoreSeq: 0,
                myRawScore: 0, myScore: 0 }, f.clock.now);
            assert.notStrictEqual(app.battle, b);
            assert.strictEqual(app.battle.queuedItem, null);
            await reply(score); // Old callback must not affect the new round.
        }
        app.updateBattle(f.clock.now);
        assert.strictEqual(f.requests.filter(r => r.action === 'useItem').length, 0, changed + ' cancels queued item');
        if (changed !== 'round') assert.strictEqual(b.queuedItem, null);
    }
    console.log('queue cancellation: server freeze, deadline and synthetic round rollover send no item');
    {
        const { f, app, b, take, reply } = await playing();
        items.sample(b, 10);
        app.updateBattle(f.clock.now);
        const first = take('syncScore');
        app.battleUseItem('reflect');
        for (let seq = 2; seq <= 34; seq++) {
            f.clock.now++;
            items.sample(b, seq * 10);
        }
        await reply(first);
        assert.strictEqual(b.scoreSamples.length, 33);
        f.clock.now += 300;
        app.updateBattle(f.clock.now);
        const second = take('syncScore');
        assert.strictEqual(second.data.samples.length, 32);
        assert.strictEqual(b.queuedItem, 'reflect');
        await reply(second);
        app.updateBattle(f.clock.now);
        const cast = take('useItem');
        assert.strictEqual(cast.data.samples.length, 1);
        assert.strictEqual(cast.data.samples[0].seq, 34);
        assert.strictEqual((await reply(cast)).ok, true);
        assert.strictEqual(b.confirmedScore, 340);
        assert.strictEqual(f.requests.filter(r => r.action === 'useItem').length, 1);
        console.log('backlog: 33 pending samples drain 32 first, then one queued item flushes last sample');
    }
    for (const reachedServer of [false, true]) {
        const { f, app, b, server, take, reply, deliver } = await playing();
        items.sample(b, 100);
        app.updateBattle(f.clock.now);
        const score = take('syncScore');
        app.battleUseItem('reflect');
        if (reachedServer) assert.strictEqual((await server.call('host', { action: score.action, ...score.data })).ok, true);
        score.reject(new Error('synthetic transport loss'));
        await flush();
        assert.strictEqual(b.scoreUncertain, true);
        assert.strictEqual(b.queuedItem, 'reflect');
        app.updateBattle(f.clock.now);
        assert.strictEqual(f.requests.filter(r => r.action === 'useItem').length, 0);
        await deliver('query');
        assert.strictEqual(b.scoreUncertain, false);
        app.updateBattle(f.clock.now);
        const cast = take('useItem');
        assert.strictEqual(cast.data.samples.length, reachedServer ? 0 : 1);
        assert.strictEqual((await reply(cast)).ok, true);
        assert.strictEqual(b.confirmedScore, 100, 'no lost or double-counted score');
        assert.strictEqual(f.requests.filter(r => r.action === 'useItem').length, 1);
    }
    console.log('transport recovery: query reconciles delivered/undelivered score before exactly one queued item');
    {
        const f = fixture(), b = f.playing(), app = f.app;
        Date.now = () => f.clock.now;
        app.updateBattle(f.clock.now);
        assert.strictEqual(f.requests[0].action, 'syncScore');
        assert.strictEqual(f.requests[0].options.timeoutMs, 8000, 'legacy score uses bounded adapter timeout');
        app.battleUseItem('freeze');
        assert.strictEqual(b.queuedItem, 'freeze');
        app.battleCore.score = 1200;
        f.requests[0].resolve({ ok: true }); await flush();
        app.updateBattle(f.clock.now);
        assert.strictEqual(f.requests[1].action, 'useItem');
        app.updateBattle(f.clock.now + 1000);
        assert.strictEqual(f.requests.length, 2, 'legacy action blocks overlapping score request');
        f.requests[1].resolve({ ok: true, items: { freeze: 0, disturb: 2 } });
        await flush();
        assert.strictEqual(b.queuedItem, null);
        console.log('legacy room: score timeout=8000ms; queued item serializes before next score request');
    }
    {
        const { f, app, b, deliver, peer } = await playing();
        // Synthetic onMatch score input: within single-delta cap, above the ceiling
        // at start+100ms (5250). This does not prove a real core can produce it.
        items.sample(b, 6000);
        const original = JSON.stringify(b.scoreSamples);
        for (let retry = 0; retry < 3; retry++) {
            app.updateBattle(f.clock.now);
            if (retry === 0) app.battleUseItem('reflect');
            const res = await deliver('syncScore');
            assert.strictEqual(res.err, '分数增长速度异常');
            assert.strictEqual(b.scoreUncertain, true);
            assert.strictEqual(b.queuedItem, null, 'business rejection cancels queued intent');
            await deliver('query');
            assert.strictEqual(b.scoreUncertain, false, 'valid query clears uncertainty without ack progress');
            assert.strictEqual(b.scoreAckSeq, 0);
            assert.strictEqual(JSON.stringify(b.scoreSamples), original, 'rejected sample retained unchanged');
            f.clock.now += 2000;
            await peer('query');
        }
        app.battleUseItem('reflect');
        assert.strictEqual(f.requests.filter(r => r.action === 'useItem').length, 1, 'only explicit manual retry sends item after business failure');
        const cast = await deliver('useItem');
        assert.strictEqual(cast.err, '分数增长速度异常', 'item carries the same poison sample');
        await deliver('query');
        assert.strictEqual(b.items.reflect, 1);
        assert.strictEqual(b.confirmedScore, 0);
        assert.strictEqual(items.displayScore(b), 6000);
        while (f.clock.now < b.scoreCloseAt + 1) {
            f.clock.now = Math.min(b.scoreCloseAt + 1, f.clock.now + 2000);
            await peer('query');
            app.pollRoom(); await deliver('query');
        }
        assert.strictEqual(app.state, 'battle_result');
        assert.strictEqual(b.myScore, 0, 'settlement replaces speculative display with confirmed score');
        console.log('rejected sample: 3/3 score retries + item rejected; ackSeq=0; local display=6000; settled=0; uncertainty clears on query');
    }
    {
        const f = fixture();
        f.clock.now = 1800000000000;
        Date.now = () => f.clock.now;
        const host = f.app.newBattleState(true), guest = f.app.newBattleState(false);
        const sentAt = f.clock.now;
        f.clock.now += 4000;
        items.status(host, { serverTime: sentAt + 4000 }, sentAt); // outbound delay
        items.status(guest, { serverTime: sentAt }, sentAt); // inbound delay
        assert.strictEqual(host.serverOffset, 2000);
        assert.strictEqual(guest.serverOffset, -2000);
        const startTime = f.clock.now + 1000;
        assert(items.serverNow(host) >= startTime);
        assert(items.serverNow(guest) < startTime);
        // A faster later observation repairs the offset, so the asymmetry is bounded.
        items.status(host, { serverTime: f.clock.now }, f.clock.now);
        items.status(guest, { serverTime: f.clock.now }, f.clock.now);
        assert.strictEqual(host.serverOffset, 0);
        assert.strictEqual(guest.serverOffset, 0);
        console.log('clock: equal 4s RTT with opposite asymmetric delay yields offsets +2000/-2000ms; faster query repairs both');
    }
    console.log('battle score/item diagnostic reproduction passed (local synthetic evidence only)');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Date.now = realNow; });
