'use strict';

const assert = require('assert');
const Module = require('module');

let currentOpenid = '';
const documents = Object.create(null);
let transactionTail = Promise.resolve();

function documentRef(id) {
    return {
        get: function () { return Promise.resolve({ data: documents[id] || null }); },
        set: function (options) {
            documents[id] = Object.assign({ _id: id }, options.data);
            return Promise.resolve({});
        },
        update: function (options) {
            assert(documents[id], 'update requires an existing document');
            Object.assign(documents[id], options.data);
            return Promise.resolve({});
        }
    };
}

const transaction = { collection: function () { return { doc: documentRef }; } };
const database = {
    command: { lt: function (value) { return { lt: value }; } },
    collection: function () { return { where: function () { return { remove: function () { return Promise.resolve({ stats: { removed: 0 } }); } }; } }; },
    runTransaction: function (handler) {
        const result = transactionTail.then(function () { return handler(transaction); });
        transactionTail = result.catch(function () {});
        return result;
    }
};
const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'test', init: function () {}, database: function () { return database; },
    getWXContext: function () { return { OPENID: currentOpenid }; }
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'wx-server-sdk') return cloudMock;
    return originalLoad.call(this, request, parent, isMain);
};
const battle = require('../cloudfunctions/battle/index');
const logic = require('../cloudfunctions/battle/logic');
Module._load = originalLoad;

async function call(openid, event) {
    currentOpenid = openid;
    return battle.main(event);
}

function v2(roomId, roundId, action, extra) {
    return Object.assign({ action: action, roomId: roomId, protocolVersion: 2, roundId: roundId }, extra || {});
}

async function finish(roomId, winner) {
    const room = documents[roomId];
    room.status = 'playing';
    room.startTime = Date.now() - logic.CONFIG.BATTLE_DURATION_MS - 1;
    room.players.forEach(function (player) { player.score = player.openid === winner ? 700 : 400; });
    return call(winner, { action: 'query', roomId: roomId, protocolVersion: 2 });
}

(async function run() {
    const create = await call('host', { action: 'create', nickname: '甲', protocolVersion: 2 });
    assert.deepStrictEqual(Object.keys(create).sort(), ['ok', 'protocolVersion', 'roomId', 'roundId', 'roundNumber']);
    assert.strictEqual(create.protocolVersion, 2);
    assert.strictEqual(create.roundId, 1);
    assert.strictEqual(create.roundNumber, 1);
    const roomId = create.roomId;
    assert.deepStrictEqual(await call('old-client', { action: 'join', roomId: roomId }),
        { ok: false, err: 'UPDATE_REQUIRED' });

    const joined = await call('guest', { action: 'join', roomId: roomId, protocolVersion: 2 });
    assert.strictEqual(joined.roundId, 2, 'member change invalidates pre-join ready requests');
    assert.strictEqual(joined.roundNumber, 1, 'first opponent starts match number one');
    assert.deepStrictEqual(await call('host', { action: 'ready', roomId: roomId, ready: true }),
        { ok: false, err: 'STALE_ROUND' });
    assert.deepStrictEqual(await call('host', v2(roomId, 1, 'ready', { ready: true })),
        { ok: false, err: 'STALE_ROUND' });
    assert.strictEqual((await call('host', v2(roomId, 2, 'ready', { ready: true }))).ready, true);
    assert.strictEqual((await call('host', v2(roomId, 2, 'ready', { ready: true }))).ready, true,
        'explicit ready retry must not toggle');
    assert.strictEqual((await call('guest', v2(roomId, 2, 'ready', { ready: true }))).ready, true);
    assert.strictEqual(documents[roomId].status, 'playing');
    documents[roomId].startTime = Date.now() - 1;
    const itemResponse = await call('host', v2(roomId, 2, 'useItem', { item: 'freeze' }));
    assert.strictEqual(itemResponse.ok, true);
    assert.strictEqual(JSON.stringify(itemResponse).includes('host'), false,
        'item response does not expose an OpenID');

    const result = await finish(roomId, 'host');
    assert.strictEqual(result.status, 'finished');
    assert.deepStrictEqual(Object.keys(result).sort(), [
        'canRematch', 'casts', 'effects', 'myActiveEffectUntil', 'myItemCooldownUntil', 'myItems', 'myReady',
        'myRematch', 'myScore', 'myWins', 'ok', 'opp', 'oppLeft', 'oppRematch', 'oppWins', 'protocolVersion',
        'result', 'roundId', 'roundNumber', 'startTime', 'status'
    ]);
    assert.strictEqual(result.myWins, 1);
    assert.strictEqual(result.oppWins, 0);
    assert.strictEqual(result.result.roundId, 2);
    assert.strictEqual(typeof result.result.settlementId, 'string');
    assert.strictEqual(result.result.coinReward, 150);
    assert.strictEqual(JSON.stringify(result).includes('host'), false, 'new responses do not expose OpenID');
    const resultAgain = await call('host', { action: 'query', roomId: roomId, protocolVersion: 2 });
    assert.strictEqual(resultAgain.myWins, 1, 'repeated result poll cannot increment wins');
    assert.strictEqual(resultAgain.result.settlementId, result.result.settlementId, 'settlement identity is stable');

    const cancel = await call('host', v2(roomId, 2, 'rematch', { accept: true }));
    assert.strictEqual(cancel.myRematch, true);
    assert.strictEqual((await call('host', v2(roomId, 2, 'rematch', { accept: false }))).myRematch, false,
        'rematch cancellation is explicit and idempotent');
    assert.strictEqual((await call('guest', v2(roomId, 2, 'rematch', { accept: true }))).myRematch, true);
    const next = await call('host', v2(roomId, 2, 'rematch', { accept: true }));
    assert.strictEqual(next.status, 'waiting');
    assert.strictEqual(next.roundId, 3, 'two accepts advance exactly one round');
    assert.strictEqual(next.roundNumber, 2, 'accepted rematch advances displayed match number once');
    assert.strictEqual(next.myWins, 1);
    assert.strictEqual(next.myRematch, false);
    assert.strictEqual(next.myScore, 0);
    assert.deepStrictEqual(next.myItems, logic.CONFIG.INITIAL_ITEMS);
    const raced = await Promise.all([
        call('host', v2(roomId, 2, 'rematch', { accept: false })),
        call('guest', v2(roomId, 2, 'leave')),
        call('host', v2(roomId, 2, 'syncScore', { score: 900 })),
        call('guest', v2(roomId, 2, 'configureItems', { items: {} })),
        call('host', v2(roomId, 2, 'useItem', { item: 'invalid' }))
    ]);
    raced.forEach(function (response) { assert.deepStrictEqual(response, { ok: false, err: 'STALE_ROUND' }); });
    assert.strictEqual(documents[roomId].roundId, 3);
    assert.strictEqual(documents[roomId].status, 'waiting');

    assert.strictEqual((await call('guest', v2(roomId, 3, 'leave'))).ok, true);
    assert.strictEqual(documents[roomId].roundId, 4, 'waiting departure invalidates pending requests');
    assert.strictEqual(documents[roomId].roundNumber, 1, 'member departure resets displayed match number');
    assert.strictEqual(documents[roomId].players[0].wins, 0, 'replacement resets accumulated record');
    const replacement = await call('replacement', { action: 'join', roomId: roomId, protocolVersion: 2 });
    assert.strictEqual(replacement.roundId, 5, 'new member receives the current bumped round');
    assert.strictEqual(replacement.roundNumber, 1, 'replacement cannot inherit prior match count');
    const legacy = await call('legacy-host', { action: 'create' });
    const v2IntoLegacy = await call('new-client', { action: 'join', roomId: legacy.roomId, protocolVersion: 2 });
    assert.deepStrictEqual(v2IntoLegacy, { ok: true, roomId: legacy.roomId }, 'v2 clients retain legacy single-round rooms');

    const leaveRoom = await call('leave-host', { action: 'create', protocolVersion: 2 });
    const leaveId = leaveRoom.roomId;
    const leaveJoin = await call('leave-guest', { action: 'join', roomId: leaveId, protocolVersion: 2 });
    await finish(leaveId, 'leave-host');
    assert.strictEqual((await call('leave-host', v2(leaveId, leaveJoin.roundId, 'leave'))).ok, true);
    assert.deepStrictEqual(await call('leave-host', { action: 'query', roomId: leaveId, protocolVersion: 2 }),
        { ok: false, err: '不在房间' });
    assert.deepStrictEqual(await call('leave-host', v2(leaveId, leaveJoin.roundId, 'rematch', { accept: true })),
        { ok: false, err: '不在房间' });
    assert.strictEqual((await call('leave-host', v2(leaveId, leaveJoin.roundId, 'leave'))).ok, true,
        'finished leave is idempotent');
    const stayed = await call('leave-guest', { action: 'query', roomId: leaveId, protocolVersion: 2 });
    assert.strictEqual(stayed.oppLeft, true);
    assert.strictEqual(stayed.myWins, 0, 'remaining player keeps their own cumulative score');
    assert.strictEqual(stayed.oppWins, 1, 'finished winner departure must not erase opponent cumulative score');
    assert.strictEqual(stayed.result.result, 'lose', 'remaining player keeps their settled result');

    const playingLeave = await call('playing-host', { action: 'create', protocolVersion: 2 });
    const playingId = playingLeave.roomId;
    const playingJoin = await call('playing-guest', { action: 'join', roomId: playingId, protocolVersion: 2 });
    documents[playingId].status = 'playing';
    documents[playingId].startTime = Date.now();
    assert.strictEqual((await call('playing-host', v2(playingId, playingJoin.roundId, 'leave'))).ok, true);
    const playingStayed = await call('playing-guest', { action: 'query', roomId: playingId, protocolVersion: 2 });
    assert.strictEqual(playingStayed.oppLeft, true);
    assert.strictEqual(playingStayed.myWins, 1, 'playing departure retains the winner record');
    assert.strictEqual(playingStayed.oppWins, 0);
    assert.strictEqual(playingStayed.result.result, 'win');
    assert.deepStrictEqual(await call('playing-host', { action: 'query', roomId: playingId, protocolVersion: 2 }),
        { ok: false, err: '不在房间' });

    const expired = documents[leaveId];
    expired.finishedAt = Date.now() - logic.CONFIG.REMATCH_ROOM_TTL_MS;
    assert.deepStrictEqual(await call('leave-guest', v2(leaveId, expired.roundId, 'rematch', { accept: true })),
        { ok: false, err: '续局已失效' });
    console.log('battle rematch tests passed');
})().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
