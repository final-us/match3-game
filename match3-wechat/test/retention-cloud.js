'use strict';

const assert = require('assert');
const crypto = require('crypto');
const retention = require('../cloudfunctions/battle/retention');
const dailyEngine = require('../cloudfunctions/battle/daily-engine/daily-challenge');
const fixtureModule = require('./helpers/retention-db');

let time = Date.UTC(2026, 8, 21, 4, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const fixture = fixtureModule.createRetentionDb();
const db = fixture.db; const docs = fixture.docs; const copy = fixtureModule.copy;
const service = retention.createService(db, crypto, function () { return time; });

function solo(id, cleared, date) {
    return { id: 'solo:install:' + id, mode: 'solo', date: date || retention.beijingDate(time),
        cleared: cleared, validMove: true, completed: true, levelId: 1 };
}
async function sign(openid) { return service.sign(openid, { date: retention.beijingDate(time) }); }
async function record(openid, event) { return service.record(openid, { event: event }); }
function nextMove(core) {
    for (let row = 0; row < 8; row++) for (let column = 0; column < 8; column++) {
        const candidates = [{ row: row, column: column + 1 }, { row: row + 1, column: column }];
        for (let index = 0; index < candidates.length; index++) {
            const to = candidates[index];
            if (to.row < 8 && to.column < 8 && core.validateMove({ row: row, column: column }, to)) {
                return { from: { row: row, column: column }, to: to };
            }
        }
    }
    throw new Error('no valid daily move');
}
async function completedDaily(openid, date, runId) {
    const challenge = dailyEngine.challengeForDate(date); const core = dailyEngine.createCore(challenge); const moves = [];
    while (!core.ended) { const move = nextMove(core); await core.trySwap(move.from, move.to); moves.push(move); }
    docs.daily_runs[runId] = { _id: runId, kind: 'daily_run', owner: service.ownerId(openid), date: date,
        challenge: challenge, moves: moves, completed: true, result: { score: core.score } };
    return { id: 'daily:' + runId, mode: 'daily', date: 'forged-date', cleared: 0, validMove: false, runId: runId };
}

(async function run() {
    const initial = await service.info('alice');
    assert.strictEqual(initial.state.serverNow, time);
    assert.strictEqual(initial.state.date, '2026-09-21');
    assert.deepStrictEqual(initial.state.taskProgress, [0, 0, 0]);

    const concurrentSign = await Promise.all([sign('alice'), sign('alice')]);
    assert.strictEqual(concurrentSign[0].state.activity, 20);
    assert.strictEqual(concurrentSign[1].state.activity, 20);
    assert.strictEqual((await service.info('alice')).receipts.length, 1, 'concurrent sign duplicated receipt');
    const signReceipt = (await service.info('alice')).receipts[0];
    assert.deepStrictEqual(signReceipt.items, { hammer: 0 });
    await service.ack('alice', { receiptIds: [signReceipt.id] });
    assert.strictEqual((await sign('alice')).receipts.length, 0, 'acknowledged same-day retry re-emitted receipt');

    const first = await record('alice', solo('one', 40));
    assert.deepStrictEqual(first.state.taskProgress, [1, 1, 40]);
    const raced = await Promise.all([record('alice', solo('two', 40)), record('alice', solo('two', 40))]);
    assert.deepStrictEqual(raced[0].state.taskProgress, [1, 2, 80]);
    assert.deepStrictEqual(raced[1].state.taskProgress, [1, 2, 80]);
    assert.strictEqual((await service.info('alice')).state.activity, 100);
    assert.strictEqual(Object.values(docs.retention_events).filter(function (value) { return value.owner === service.ownerId('alice'); }).length, 2);
    assert.strictEqual((await record('alice', solo('forged-extra', 80))).eventStatus, 'capped', 'completed day must bound forged event persistence');

    const staleSign = await service.sign('alice', { date: '2026-09-20' });
    assert.strictEqual(staleSign.eventStatus, 'expired');
    const invalidSolo = await record('alice', Object.assign(solo('bad', 1), { validMove: false }));
    assert.strictEqual(invalidSolo.terminal, true);
    assert.strictEqual(invalidSolo.code, 'INVALID_SOLO_EVENT');

    const gapFirst = await sign('missed-days'); const gapReceipt = gapFirst.receipts.find(function (value) { return value.kind === 'signin'; });
    time += 2 * DAY;
    assert.strictEqual((await service.sign('missed-days', { date: '2026-09-21' })).eventStatus, 'recorded',
        'confirmed stale sign retry was reported expired');
    assert((await service.info('missed-days')).receipts.some(function (value) { return value.id === gapReceipt.id; }));
    assert.strictEqual((await sign('missed-days')).state.signDay, 2, 'missed day reset cumulative sign progress');
    time -= 2 * DAY;

    const dailyEvent = await completedDaily('daily-owner', '2026-09-21', 'D12345678abcdefabcdefabcd');
    const dailyResult = await record('daily-owner', dailyEvent);
    assert.strictEqual(dailyResult.ok, true);
    assert(dailyResult.state.taskProgress[2] > 0, 'daily replay did not count actual removed pieces');
    assert.strictEqual((await record('other-owner', dailyEvent)).code, 'DAILY_OWNER_MISMATCH');
    time += 2 * 60 * 60 * 1000;
    assert.strictEqual((await record('daily-owner', dailyEvent)).eventStatus, 'recorded', 'confirmed old daily retry lost dedupe result');
    delete docs.daily_runs[dailyEvent.runId];
    assert.strictEqual((await record('daily-owner', dailyEvent)).eventStatus, 'recorded', 'daily cleanup broke confirmed retry');
    const oldDaily = await completedDaily('old-daily', '2026-09-20', 'D12345678bbbbbbbbbbbbbbbb');
    assert.strictEqual((await record('old-daily', oldDaily)).eventStatus, 'expired');

    const room = { protocolVersion: 2, retentionEnabled: true, status: 'finished', finishReason: 'leave', roundId: 7, finishedAt: time,
        players: [{ openid: 'pvp-good', score: 10 }, { openid: 'pvp-quit', score: 500 }] };
    await db.runTransaction(function (tx) { return service.captureBattleEvidence(tx, room, 'R12345678abcdef0123', 'pvp-quit'); });
    room.players[0].score = 9999;
    await db.runTransaction(function (tx) { return service.captureBattleEvidence(tx, room, 'R12345678abcdef0123', ''); });
    const pvpEvent = { id: 'pvp:R12345678abcdef0123:7', mode: 'pvp', date: 'ignored', cleared: 75,
        validMove: true, roomId: 'R12345678abcdef0123', roundId: 7 };
    assert.strictEqual((await record('pvp-good', pvpEvent)).ok, true);
    assert.strictEqual((await record('pvp-quit', pvpEvent)).code, 'PVP_NOT_ELIGIBLE');
    assert.strictEqual(Object.values(docs.retention_battle_evidence).find(function (value) {
        return value.owner === service.ownerId('pvp-good');
    }).score, 10, 'later rematch state overwrote stable round proof');

    // Complete five active days to reach every weekly chest, including day-7 and next-cycle boundaries.
    time = Date.UTC(2026, 8, 21, 4, 0, 0);
    for (let day = 0; day < 7; day++) {
        if (day) time += 24 * 60 * 60 * 1000;
        const signed = await sign('weekly');
        assert.strictEqual(signed.state.signDay, day + 1);
        await record('weekly', solo('d' + day + 'a', 40));
        await record('weekly', solo('d' + day + 'b', 40));
    }
    const day7 = await service.info('weekly');
    const day7Receipt = day7.receipts.find(function (value) { return value.kind === 'signin' && value.items.hammer === 1; });
    assert(day7Receipt, 'day 7 hammer receipt missing');
    assert.strictEqual(day7.state.activity, 700);
    const claims = await Promise.all([0, 1, 2].map(function (index) {
        return service.claim('weekly', { week: '2026-09-21', index: index });
    }));
    assert(claims.every(function (value) { return value.ok; }));
    assert.strictEqual((await service.claim('weekly', { week: '2026-09-21', index: 2 })).receipts.filter(function (value) {
        return value.kind === 'weekly' && value.coins === 1000;
    }).length, 1, 'weekly retry duplicated receipt');

    time += 24 * 60 * 60 * 1000;
    const nextCycle = await sign('weekly');
    assert.strictEqual(nextCycle.state.signDay, 1, 'day after day 7 did not begin a new cumulative cycle');
    assert(nextCycle.state.previousWeek);
    assert.deepStrictEqual(nextCycle.state.previousWeek.available, [true, true, true]);

    const carryUser = 'carry';
    time = Date.UTC(2026, 8, 21, 4, 0, 0);
    for (let day = 0; day < 2; day++) {
        if (day) time += DAY;
        await sign(carryUser); await record(carryUser, solo('c' + day + 'a', 40)); await record(carryUser, solo('c' + day + 'b', 40));
    }
    time = Date.UTC(2026, 8, 28, 4, 0, 0);
    const carry = await service.info(carryUser);
    assert.deepStrictEqual(carry.state.previousWeek.available, [true, false, false]);
    assert.strictEqual((await service.claim(carryUser, { week: '2026-09-21', index: 0 })).ok, true);
    time = Date.UTC(2026, 9, 5, 4, 0, 0);
    assert.strictEqual((await service.claim(carryUser, { week: '2026-09-21', index: 0 })).eventStatus, 'recorded',
        'confirmed unacknowledged weekly claim did not survive carry expiry');
    assert.strictEqual((await service.claim(carryUser, { week: '2026-09-21', index: 1 })).eventStatus, 'expired');

    const aliceProfileId = Object.keys(docs.retention_profiles).find(function (id) {
        return docs.retention_profiles[id].owner === service.ownerId('alice');
    });
    const validAlice = copy(docs.retention_profiles[aliceProfileId]);
    docs.retention_profiles[aliceProfileId].day.games = -1;
    const corruptBefore = copy(docs);
    await assert.rejects(service.info('alice'), /retention profile is corrupt/);
    assert.deepStrictEqual(docs, corruptBefore, 'corrupt persisted profile was reset or rewritten');
    docs.retention_profiles[aliceProfileId] = copy(validAlice);
    docs.retention_profiles[aliceProfileId].day.date = '2026-09-23';
    docs.retention_profiles[aliceProfileId].currentWeek.week = '2026-09-15';
    docs.retention_profiles[aliceProfileId].currentWeek.activity = 350;
    const impossibleWeek = copy(docs);
    await assert.rejects(service.info('alice'), /retention profile is corrupt/);
    assert.deepStrictEqual(docs, impossibleWeek, 'impossible stored week reset earned activity');
    docs.retention_profiles[aliceProfileId] = copy(validAlice);

    const beforeFailure = copy(docs);
    fixture.failNextRead();
    await assert.rejects(service.info('failure-user'), /temporary database failure/);
    assert.deepStrictEqual(docs, beforeFailure, 'service failure reset or partially committed retention state');

    const pendingBeforeCleanup = Object.values(docs.retention_receipts).find(function (value) { return !value.acknowledged; });
    assert(pendingBeforeCleanup);
    time += 36 * DAY;
    await service.cleanup(time);
    assert(docs.retention_receipts[pendingBeforeCleanup._id], 'cleanup removed an unacknowledged receipt');
    assert.strictEqual(docs.retention_receipts[signReceipt.id], undefined, 'cleanup retained an old acknowledged receipt');
    const lateAckRetry = await service.ack('alice', { receiptIds: [signReceipt.id] });
    assert.strictEqual(lateAckRetry.ok, true, 'lost ACK response could not recover after acknowledged receipt cleanup');
    assert.strictEqual(lateAckRetry.receipts.some(function (value) { return value.id === signReceipt.id; }), false);
    const foreignReceipt = Object.values(docs.retention_receipts).find(function (value) {
        return value.owner !== service.ownerId('alice');
    });
    assert(foreignReceipt);
    assert.strictEqual((await service.ack('alice', { receiptIds: [foreignReceipt._id] })).code, 'RECEIPT_OWNER_MISMATCH');

    const deniedDb = Object.assign({}, db, { collection: function (name) {
        if (name === 'retention_events') {
            const error = new Error('permission denied'); error.code = 'DATABASE_PERMISSION_DENIED'; throw error;
        }
        return db.collection(name);
    } });
    await assert.rejects(retention.createService(deniedDb, crypto, function () { return time; }).cleanup(time),
        /permission denied/, 'cleanup hid a non-missing-collection failure');

    console.log('retention cloud: transactions, retries, day7/reset/missed days, weekly carry/expiry, evidence, ACK/recovery and cleanup passed');
})().catch(function (error) { console.error(error); process.exitCode = 1; });
