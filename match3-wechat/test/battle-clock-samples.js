'use strict';
// Actual Main/helper/handler with controlled clocks; no production payload/network.
const assert = require('assert');
const { fixture, flush } = require('./battle-client');
const { createBattleLocal } = require('./helpers/battle-local');
const items = require('../js/net/battle-items');
const realNow = Date.now;

async function clockCase(rtt, outbound) {
    const f = fixture(), app = f.app;
    f.clock.now = 1800000000000;
    Date.now = () => f.clock.now;
    const server = createBattleLocal(Date.now);
    const created = await server.call('host', { action: 'create', protocolVersion: 2, itemRulesVersion: 3 });
    const joined = await server.call('guest', { action: 'join', roomId: created.roomId, protocolVersion: 2, itemRulesVersion: 3 });
    const data = { roomId: created.roomId, protocolVersion: 2, itemRulesVersion: 3, roundId: joined.roundId };
    await server.call('host', { action: 'ready', ...data, ready: true });
    await server.call('guest', { action: 'ready', ...data, ready: true });
    const initial = await server.call('host', { action: 'query', ...data });
    const b = f.playing();
    Object.assign(b, { ...data, startTime: initial.startTime, endTime: initial.startTime + 60000 });
    // First actual query observation: inbound-only RTT creates a fractional midpoint.
    f.clock.now = b.startTime + 1000;
    const sent = f.clock.now;
    if (outbound) f.clock.now += rtt;
    const observed = await server.call('host', { action: 'query', ...data });
    if (!outbound) f.clock.now += rtt;
    app.applyPoll(observed, sent);
    assert.strictEqual(b.serverOffset, (outbound ? 1 : -1) * rtt / 2);
    items.sample(b, 100);
    const sampledAt = b.scoreSamples[0].at;
    assert(Number.isSafeInteger(sampledAt), 'RTT=' + rtt + ' produced fractional sample.at=' + sampledAt);
    let cursor = 0;
    async function deliver(action) {
        const request = f.requests[cursor++];
        assert(request && request.action === action);
        const response = await server.call('host', { action, ...request.data });
        request.resolve(response); await flush();
        return response;
    }
    app.updateBattle(f.clock.now);
    const score = await deliver('syncScore');
    assert.strictEqual(score.ok, true);
    assert.strictEqual(b.scoreAckSeq, 1);
    assert.strictEqual(b.confirmedScore, 100);
    assert.strictEqual(b.scoreSamples.length, 0);
    app.battleUseItem('reflect');
    assert.strictEqual((await deliver('useItem')).ok, true);
    console.log('RTT=' + rtt + ' ' + (outbound ? 'outbound' : 'inbound') + ': integer sample; score=100; ack=1; item succeeds');
}

function boundaries() {
    for (const row of [
        { now: 1000, offset: -0.5, accepted: false },
        { now: 1000, offset: 0.5, accepted: true },
        { now: 2000, offset: -0.5, accepted: true },
        { now: 2000, offset: 0.5, accepted: false }
    ]) {
        const f = fixture(), b = f.playing();
        Date.now = () => f.clock.now;
        items.configure(b, { itemRulesVersion: 3 });
        Object.assign(b, { startTime: 1000, endTime: 2000, serverOffset: row.offset });
        f.clock.now = row.now;
        items.sample(b, 100);
        assert.strictEqual(b.scoreSamples.length, row.accepted ? 1 : 0);
        if (row.accepted) {
            assert(Number.isSafeInteger(b.scoreSamples[0].at));
            assert(b.scoreSamples[0].at >= b.startTime && b.scoreSamples[0].at < b.endTime);
        } else {
            assert.strictEqual(b.nextScoreSeq, 0);
            assert.strictEqual(b.lastSampleScore, 0);
        }
    }
    const f = fixture(), b = f.playing();
    Date.now = () => f.clock.now;
    items.configure(b, { itemRulesVersion: 3 });
    Object.assign(b, { startTime: 1000, endTime: 2000, serverOffset: 0.5 });
    f.clock.now = 1500;
    items.sample(b, 100);
    f.clock.now = 1400;
    items.sample(b, 200);
    assert.strictEqual(b.scoreSamples.length, 2);
    assert(b.scoreSamples.every(s => Number.isSafeInteger(s.at)));
    assert(b.scoreSamples[1].at >= b.scoreSamples[0].at, 'backward clock correction preserves monotonic samples');
    console.log('boundaries: half-ms before/after start/end preserve window; backward clock correction preserves integer monotonic samples');
}

(async () => {
    for (const rtt of [1, 301, 2, 302]) await clockCase(rtt, false);
    for (const rtt of [1, 301]) await clockCase(rtt, true);
    boundaries();
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Date.now = realNow; });
