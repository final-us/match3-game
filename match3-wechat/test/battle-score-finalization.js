'use strict';
const assert = require('assert');
const { createBattleLocal } = require('./helpers/battle-local');
const { CONFIG } = require('../cloudfunctions/battle/logic');
let clock = 1800000000000;
const local = createBattleLocal(() => clock);
const rooms = () => local.storage.docs.battle_rooms;
const player = (id, who) => rooms()[id].players.find(p => p.openid === who);
async function setup(v3 = true) {
    clock += 120000;
    const identity = v3 ? { protocolVersion: 2, itemRulesVersion: 3 } : { protocolVersion: 2 };
    const created = await local.call('a', { action: 'create', retentionEnabled: true, ...identity });
    assert(created.ok);
    const id = created.roomId;
    const joined = await local.call('b', { action: 'join', roomId: id, ...identity });
    const event = (action, extra = {}) => ({ action, roomId: id, roundId: joined.roundId, ...identity, ...extra });
    for (const who of ['a', 'b']) assert((await local.call(who, event('ready', { ready: true }))).ok);
    const start = rooms()[id].startTime;
    clock = start;
    return { id, start, end: start + 60000, close: start + 70000, event };
}
async function rejectedWithoutWrite(who, event) {
    const before = local.storage.copy(local.storage.docs);
    const result = await local.call(who, event);
    assert.strictEqual(result.ok, false);
    assert.deepStrictEqual(local.storage.docs, before, result.err);
    return result;
}
(async () => {
    const r = await setup();
    const sample = { seq: 1, score: 100, at: r.end - 1 };
    clock = r.end - 1;
    await rejectedWithoutWrite('a', r.event('syncScore', { samples: [sample], final: true }));
    await rejectedWithoutWrite('a', r.event('syncScore', { samples: [sample], final: 'true' }));
    await rejectedWithoutWrite('a', r.event('syncScore', { samples: [] }));
    await rejectedWithoutWrite('a', r.event('syncScore', { samples: [{ ...sample, seq: 2 }] }));
    await rejectedWithoutWrite('a', r.event('syncScore', { samples: [{ ...sample, at: clock + 1501 }] }));
    await rejectedWithoutWrite('a', r.event('syncScore', { samples: [{ ...sample, score: 10001 }] }));
    await rejectedWithoutWrite('a', r.event('syncScore', { samples: [
        { seq: 1, score: 5000, at: r.start }, { seq: 2, score: 10000, at: r.start }
    ] }));
    clock = r.end;
    const view = await local.call('a', r.event('query'));
    assert.strictEqual(view.status, 'playing', 'expired heartbeat cannot finish confirmation window');
    assert.strictEqual(view.scoreCloseAt, r.close);
    assert.strictEqual(view.myScoreFinalized, false);
    await rejectedWithoutWrite('a', r.event('useItem', { item: 'cheer', requestId: 'after-deadline-1', samples: [sample] }));
    await rejectedWithoutWrite('a', r.event('syncScore', { samples: [sample, { seq: 2, score: 200, at: r.end }], final: true }));
    const ack = await local.call('a', r.event('syncScore', { samples: [sample], final: true }));
    await rejectedWithoutWrite('b', r.event('syncScore', { samples: [
        { seq: 1, score: 10, at: r.end - 1 }, { seq: 2, score: 20, at: r.end - 2 }
    ] }));
    assert.strictEqual(ack.myScore, 100); assert.strictEqual(ack.myScoreFinalized, true); assert.strictEqual(ack.scoreCloseAt, r.close);
    assert((await local.call('a', r.event('syncScore', { samples: [sample], final: true }))).ok);
    assert((await local.call('a', r.event('syncScore', { samples: [], final: true }))).ok);
    await rejectedWithoutWrite('a', r.event('syncScore', { samples: [{ seq: 2, score: 200, at: r.end - 1 }] }));
    player(r.id, 'b').cheerWindows = [{ at: r.end - 200, until: r.end + 4800 }];
    clock = r.end + 9000;
    const finalB = { seq: 1, score: 80, at: r.end - 100 };
    assert.strictEqual((await local.call('b', r.event('syncScore', { samples: [finalB], final: true }))).myScore, 160);
    assert.strictEqual(rooms()[r.id].status, 'finished');
    assert.strictEqual(rooms()[r.id].result.b.result, 'win');
    assert.strictEqual(player(r.id, 'b').wins, 1);
    const evidence = local.storage.copy(local.storage.docs.retention_battle_evidence);
    assert.strictEqual(Object.keys(evidence).length, 2);
    assert(Object.values(evidence).every(e => e.quit === false));
    assert((await local.call('b', r.event('syncScore', { samples: [finalB], final: true }))).ok, 'lost confirmation response retries after settlement');
    await local.call('a', r.event('query')); await local.call('b', r.event('query'));
    assert.strictEqual(player(r.id, 'b').wins, 1);
    assert.deepStrictEqual(local.storage.docs.retention_battle_evidence, evidence);
    await local.call('a', r.event('rematch', { accept: true }));
    const next = await local.call('b', r.event('rematch', { accept: true }));
    assert.strictEqual(next.myScoreFinalized, false); assert.strictEqual(next.myScoreSeq, 0);
    await rejectedWithoutWrite('a', r.event('syncScore', { samples: [], final: true }));
    await local.call('b', { ...r.event('leave'), roundId: next.roundId });
    const joined = await local.call('c', r.event('join'));
    assert(joined.ok); assert(rooms()[r.id].players.every(p => p.scoreFinalized === false));

    const batch = await setup();
    rooms()[batch.id].players.forEach(p => { delete p.scoreFinalized; }); // Existing v3 rooms need no migration.
    clock = batch.end + 1;
    const samples = Array.from({ length: 33 }, (_, i) => ({ seq: i + 1, score: (i + 1) * 10, at: batch.start + 1000 + i }));
    await rejectedWithoutWrite('a', batch.event('syncScore', { samples }));
    assert.strictEqual((await local.call('a', batch.event('syncScore', { samples: samples.slice(0, 32) }))).ackSeq, 32);
    assert.strictEqual((await local.call('a', batch.event('syncScore', { samples: samples.slice(32), final: true }))).ackSeq, 33);
    clock = batch.close - 1;
    assert.strictEqual((await local.call('b', batch.event('query'))).status, 'playing');
    await local.call('a', batch.event('leave'));
    assert.strictEqual(rooms()[batch.id].status, 'playing');
    clock = batch.close;
    await rejectedWithoutWrite('b', batch.event('syncScore', { samples: [], final: true }));
    assert.strictEqual((await local.call('b', batch.event('query'))).status, 'finished');
    assert.strictEqual(rooms()[batch.id].finishReason, 'time');
    assert.strictEqual(rooms()[batch.id].result.a.result, 'win', 'post-time leave does not forfeit');
    assert(Object.values(local.storage.docs.retention_battle_evidence).filter(e => e.roomId === batch.id).every(e => !e.quit));
    await rejectedWithoutWrite('b', batch.event('syncScore', { samples: [{ seq: 1, score: 10, at: batch.end - 1 }] }));

    const earlyLeave = await setup(); clock += 100;
    await local.call('a', earlyLeave.event('leave'));
    assert.strictEqual(rooms()[earlyLeave.id].finishReason, 'leave');
    const offline = await setup(); clock += CONFIG.OFFLINE_GRACE_MS + 1;
    assert.strictEqual((await local.call('a', offline.event('query'))).status, 'finished');
    assert.strictEqual(rooms()[offline.id].finishReason, 'offline');
    const legacy = await setup(false); clock = legacy.end;
    await rejectedWithoutWrite('a', legacy.event('syncScore', { score: 10 }));
    const legacyView = await local.call('a', legacy.event('query'));
    assert.strictEqual(legacyView.status, 'finished'); assert.strictEqual(legacyView.scoreCloseAt, undefined);
    console.log('battle score finalization tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
