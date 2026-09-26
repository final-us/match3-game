'use strict';

const assert = require('assert');
const crypto = require('crypto');
const helper = require('./helpers/retention-db');
const retention = require('../cloudfunctions/battle/retention');

const at = Date.UTC(2026, 8, 23, 5);

async function verifyCorruptChronologyFailsClosed() {
    const fixture = helper.createRetentionDb();
    const service = retention.createService(fixture.db, crypto, () => at);
    await service.info('profile-corruption');
    const id = Object.keys(fixture.docs.retention_profiles)[0];
    fixture.docs.retention_profiles[id].currentWeek.week = '2026-09-15';
    fixture.docs.retention_profiles[id].currentWeek.activity = 350;
    const before = helper.copy(fixture.docs);
    await assert.rejects(service.info('profile-corruption'), /retention profile is corrupt/);
    assert.deepStrictEqual(fixture.docs, before,
        'invalid profile chronology must not reset or rewrite progress');
}

async function verifyAgedAckRecoveryAndOwnership() {
    const fixture = helper.createRetentionDb();
    const service = retention.createService(fixture.db, crypto, () => at);
    const alice = await service.sign('alice', { date: '2026-09-23' });
    const aliceId = alice.receipts[0].id;
    assert.strictEqual((await service.ack('alice', { receiptIds: [aliceId] })).ok, true);
    delete fixture.docs.retention_receipts[aliceId];
    assert.strictEqual((await service.ack('alice', { receiptIds: [aliceId] })).ok, true,
        'aged-out committed ACK must retry as a no-op');

    const bob = await service.sign('bob', { date: '2026-09-23' });
    const bobId = bob.receipts[0].id;
    const foreign = await service.ack('alice', { receiptIds: [bobId] });
    assert.strictEqual(foreign.code, 'RECEIPT_OWNER_MISMATCH');
    assert.strictEqual(fixture.docs.retention_receipts[bobId].acknowledged, false);
}

(async function run() {
    await verifyCorruptChronologyFailsClosed();
    await verifyAgedAckRecoveryAndOwnership();
    console.log('retention QA recovery: chronology and aged ACK recovery passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
