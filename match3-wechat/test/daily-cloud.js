'use strict';

const assert = require('assert');
const crypto = require('crypto');
const dailyEngine = require('../cloudfunctions/battle/daily-engine/daily-challenge');
const dailyModule = require('../cloudfunctions/battle/daily');

let time = Date.UTC(2026, 8, 22, 15, 59, 0);
const docs = { daily_runs: Object.create(null), daily_progress: Object.create(null) };
let tail = Promise.resolve();

function copy(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function makeRef(store, collection, id) {
    return {
        get: () => Promise.resolve({ data: copy(store[collection][id]) || null }),
        set: o => { store[collection][id] = Object.assign({ _id: id }, copy(o.data)); return Promise.resolve({}); },
        update: o => {
            if (!store[collection][id]) throw new Error('DATABASE_DOCUMENT_NOT_EXIST');
            Object.assign(store[collection][id], copy(o.data)); return Promise.resolve({});
        }
    };
}
function transaction(handler) {
    const pending = tail.then(async function () {
        const staged = copy(docs);
        const tx = { collection: name => ({ doc: id => makeRef(staged, name, id) }) };
        const result = await handler(tx);
        Object.keys(docs).forEach(function (name) { docs[name] = staged[name]; });
        return result;
    });
    tail = pending.catch(() => {});
    return pending;
}
const db = {
    command: { lt: value => ({ lt: value }) },
    collection: name => ({ doc: id => makeRef(docs, name, id), where: () => ({ remove: () => Promise.resolve({ stats: { removed: 0 } }) }) }),
    runTransaction: transaction
};
const service = dailyModule.createService(db, crypto, () => time);

function nextMove(core) {
    for (let row = 0; row < 8; row++) for (let column = 0; column < 8; column++) {
        for (const to of [{ row: row, column: column + 1 }, { row: row + 1, column: column }]) {
            if (to.row < 8 && to.column < 8 && core.validateMove({ row: row, column: column }, to)) {
                return { from: { row: row, column: column }, to: to };
            }
        }
    }
    throw new Error('daily engine produced no valid move');
}
async function moves(challenge) {
    const core = dailyEngine.createCore(challenge); const out = [];
    while (!core.ended) { const item = nextMove(core); await core.trySwap(item.from, item.to); out.push(item); }
    return out;
}

(async () => {
    assert.strictEqual(dailyModule.beijingDate(time), '2026-09-22');
    time += 2 * 60 * 1000; assert.strictEqual(dailyModule.beijingDate(time), '2026-09-23');
    time = Date.UTC(2026, 8, 22, 4, 0, 0);

    const starts = await Promise.all([service.start('alice'), service.start('alice')]);
    assert.strictEqual(starts[0].runId, starts[1].runId, 'same date concurrent starts created multiple runs');
    const started = starts[0];
    assert.strictEqual(started.challenge.reward, 500);
    assert.deepStrictEqual(started.moves, []);
    const actions = await moves(started.challenge); assert.strictEqual(actions.length, 25);
    const initial = await service.checkpoint('alice', { runId: started.runId, moves: [] });
    assert.deepStrictEqual(initial.moves, []);
    const saved = await service.checkpoint('alice', { runId: started.runId, moves: actions.slice(0, 1) });
    assert.deepStrictEqual(saved.moves, actions.slice(0, 1));
    const retry = await service.checkpoint('alice', { runId: started.runId, moves: actions.slice(0, 1) });
    assert.deepStrictEqual(retry.moves, actions.slice(0, 1));
    const rewrite = await service.checkpoint('alice', { runId: started.runId, moves: actions.slice(1, 2) });
    assert.strictEqual(rewrite.err, '操作记录不能改写');
    const bad = await service.submit('bob', { runId: started.runId, moves: actions, score: 999999 });
    assert.strictEqual(bad.err, '挑战身份不符');
    const result = await service.submit('alice', { runId: started.runId, moves: actions, score: 999999 });
    assert.strictEqual(result.ok, true); assert.notStrictEqual(result.score, 999999);
    const duplicate = await Promise.all([
        service.submit('alice', { runId: started.runId, moves: actions }),
        service.submit('alice', { runId: started.runId, moves: actions })
    ]);
    assert.deepStrictEqual(duplicate[0], duplicate[1]);
    assert.strictEqual((await service.start('alice')).err, '今日挑战已完成');
    const info = await service.info('alice');
    assert.strictEqual(info.attempted, true); assert.strictEqual(info.completed, true); assert.strictEqual(info.runId, started.runId);

    const old = await service.start('cross-midnight');
    const oldMoves = await moves(old.challenge);
    await service.checkpoint('cross-midnight', { runId: old.runId, moves: oldMoves.slice(0, 2) });
    time += 24 * 60 * 60 * 1000;
    const resumed = await service.start('cross-midnight', { runId: old.runId });
    assert.strictEqual(resumed.runId, old.runId); assert.deepStrictEqual(resumed.moves, oldMoves.slice(0, 2));
    const freshDate = await service.start('cross-midnight');
    assert.notStrictEqual(freshDate.runId, old.runId);

    time = Date.UTC(2026, 8, 22, 4, 0, 0);
    const legacy = await service.start('legacy');
    docs.daily_runs[legacy.runId].challenge.reward = 300;
    const legacyMoves = await moves(docs.daily_runs[legacy.runId].challenge);
    const legacyResult = await service.submit('legacy', { runId: legacy.runId, moves: legacyMoves });
    assert.strictEqual(legacyResult.coinReward, 300, 'recorded 300-reward runs must keep their receipt value');
    assert.strictEqual((await service.info('legacy')).challenge.reward, 300);
    const legacyProgress = Object.values(docs.daily_progress).find(item => item.activeRunId === legacy.runId);
    delete legacyProgress.activeRunId; delete legacyProgress.completed; delete legacyProgress.result;
    const archivedReceipt = await service.info('legacy');
    assert.strictEqual(archivedReceipt.runId, undefined);
    assert.strictEqual(archivedReceipt.claimed, true);
    assert.strictEqual(archivedReceipt.completed, true);
    assert.strictEqual(archivedReceipt.coinReward, 300);

    const expired = await service.start('expired'); time = expired.expiresAt;
    assert.strictEqual((await service.checkpoint('expired', { runId: expired.runId, moves: [] })).err, '挑战已过期');
    assert.strictEqual((await service.submit('expired', { runId: expired.runId, moves: actions })).err, '挑战已过期');

    await assert.rejects(db.runTransaction(async function (tx) {
        await tx.collection('daily_runs').doc('rollback').set({ data: { kind: 'test' } });
        throw new Error('rollback');
    }), /rollback/);
    assert.strictEqual(docs.daily_runs.rollback, undefined, 'transaction mock leaked a failed write');
    console.log('daily cloud tests passed');
})().catch(e => { console.error(e); process.exitCode = 1; });
