'use strict';

const assert = require('assert');
const Module = require('module');
const helper = require('./helpers/retention-db');

const names = [
    'battle_rooms', 'retention_profiles', 'retention_events', 'retention_receipts',
    'retention_battle_evidence', 'daily_runs', 'daily_progress'
];
const fixture = helper.createRetentionDb(names);
let openid = '';
const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test',
    init() {},
    database() { return fixture.db; },
    getWXContext() { return { OPENID: openid }; }
};
const originalLoad = Module._load;
let battle;
let logic;
try {
    Module._load = function (request, parent, isMain) {
        if (request === 'wx-server-sdk') return cloudMock;
        return originalLoad.call(this, request, parent, isMain);
    };
    battle = require('../cloudfunctions/battle/index');
    logic = require('../cloudfunctions/battle/logic');
} finally {
    Module._load = originalLoad;
}

async function call(id, event) {
    openid = id;
    return battle.main(event);
}

function v2(action, roomId, roundId, extra) {
    return Object.assign({ action: action, roomId: roomId, protocolVersion: 2, roundId: roundId }, extra || {});
}

async function createRoom(hostEnabled, guestEnabled, prefix) {
    const created = await call(prefix + '-host', {
        action: 'create', protocolVersion: 2, retentionEnabled: hostEnabled
    });
    const joined = await call(prefix + '-guest', {
        action: 'join', roomId: created.roomId, protocolVersion: 2, retentionEnabled: guestEnabled
    });
    return {
        id: created.roomId,
        round: joined.roundId,
        host: prefix + '-host',
        guest: prefix + '-guest'
    };
}

async function finish(room) {
    const stored = fixture.docs.battle_rooms[room.id];
    stored.status = 'playing';
    stored.startTime = Date.now() - logic.CONFIG.BATTLE_DURATION_MS - 1;
    stored.players[0].score = 100;
    stored.players[1].score = 50;
    const response = await call(room.host, { action: 'query', roomId: room.id, protocolVersion: 2 });
    assert.strictEqual(response.status, 'finished');
}

function evidenceFor(roomId) {
    return Object.values(fixture.docs.retention_battle_evidence)
        .filter(value => value.roomId === roomId);
}

(async function run() {
    const opted = await createRoom(true, false, 'opted');
    assert.strictEqual(fixture.docs.battle_rooms[opted.id].retentionEnabled, true);
    await finish(opted);
    let proofs = evidenceFor(opted.id);
    assert.strictEqual(proofs.length, 2);
    assert(proofs.every(proof => !proof.quit));
    const stable = JSON.stringify(proofs.sort((left, right) => left.owner.localeCompare(right.owner)));
    await call(opted.host, v2('rematch', opted.id, opted.round, { accept: true }));
    const next = await call(opted.guest, v2('rematch', opted.id, opted.round, { accept: true }));
    assert.strictEqual(next.roundId, opted.round + 1);
    assert.strictEqual(JSON.stringify(evidenceFor(opted.id)
        .sort((left, right) => left.owner.localeCompare(right.owner))), stable,
    'rematch must preserve prior-round proof');

    const roommate = await createRoom(false, true, 'roommate');
    assert.strictEqual(fixture.docs.battle_rooms[roommate.id].retentionEnabled, true,
        'joining enabled client opts room in');
    await finish(roommate);
    assert.strictEqual(evidenceFor(roommate.id).length, 2);

    const unopted = await createRoom(false, false, 'unopted');
    await finish(unopted);
    assert.strictEqual(evidenceFor(unopted.id).length, 0,
        'unopted v2 room must not write proof');

    const quitter = await createRoom(true, false, 'quitter');
    const stored = fixture.docs.battle_rooms[quitter.id];
    stored.status = 'playing';
    stored.startTime = Date.now();
    stored.players[0].score = 20;
    stored.players[1].score = 10;
    assert.strictEqual((await call(quitter.guest,
        v2('leave', quitter.id, quitter.round))).ok, true);
    proofs = evidenceFor(quitter.id);
    assert.strictEqual(proofs.length, 2);
    assert.strictEqual(proofs.find(proof => proof.score === 10).quit, true);
    assert.strictEqual(proofs.find(proof => proof.score === 20).quit, false);

    const event = {
        id: 'pvp:' + quitter.id + ':' + quitter.round,
        mode: 'pvp', roomId: quitter.id, roundId: quitter.round,
        date: 'ignored', cleared: 20, validMove: true
    };
    const quitRecord = await call(quitter.guest, { action: 'retentionRecord', event: event });
    assert.strictEqual(quitRecord.code, 'PVP_NOT_ELIGIBLE');
    const stayedRecord = await call(quitter.host, { action: 'retentionRecord', event: event });
    assert.strictEqual(stayedRecord.ok, true);

    console.log('retention QA routes: opt-in evidence, rematch stability and quitter exclusion passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
