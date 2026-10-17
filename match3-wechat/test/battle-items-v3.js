'use strict';

const assert = require('assert');
const Module = require('module');
const realNow = Date.now;
let clock = realNow();
Date.now = function () { return clock; };
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
    command: { lt: function (value) { return { lt: value }; },
        // Existing shallow update fixture already replaces values; this is not SDK evidence.
        set: function (value) { return value; } },
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
function v3(roomId, roundId, action, extra) {
    return Object.assign({ action: action, roomId: roomId, protocolVersion: 2,
        itemRulesVersion: 3, roundId: roundId }, extra || {});
}
function player(room, openid) { return room.players.find(function (entry) { return entry.openid === openid; }); }

(async function run() {
    const created = await call('host', { action: 'create', protocolVersion: 2, itemRulesVersion: 3 });
    assert.strictEqual(created.itemRulesVersion, 3);
    const roomId = created.roomId;
    const room = documents[roomId];
    assert.deepStrictEqual(room.players[0].items, logic.CONFIG.V3_ITEMS);
    assert.deepStrictEqual(await call('old', { action: 'join', roomId: roomId, protocolVersion: 2 }),
        { ok: false, err: 'UPDATE_REQUIRED' });
    const joined = await call('guest', v3(roomId, 1, 'join'));
    assert.strictEqual(joined.roundId, 2);
    const roundId = joined.roundId;
    assert.deepStrictEqual(await call('host', v3(roomId, 1, 'configureItems', { items: logic.CONFIG.V3_ITEMS })),
        { ok: false, err: 'STALE_ROUND' });
    const zero = { freeze: 0, disturb: 0, reflect: 0, cheer: 0 };
    assert.strictEqual((await call('host', v3(roomId, roundId, 'configureItems', { items: zero }))).ok, true);
    assert.strictEqual((await call('host', v3(roomId, roundId, 'ready', { ready: true }))).ok, false);
    const allCheer = { freeze: 0, disturb: 0, reflect: 0, cheer: 5 };
    assert.strictEqual((await call('host', v3(roomId, roundId, 'configureItems', { items: allCheer }))).ok, true);
    assert.strictEqual((await call('host', v3(roomId, roundId, 'ready', { ready: true }))).ready, true);
    assert.strictEqual((await call('host', v3(roomId, roundId, 'configureItems', { items: zero }))).ok, false);
    assert.strictEqual((await call('host', v3(roomId, roundId, 'ready', { ready: false }))).ready, false);
    assert.strictEqual((await call('host', v3(roomId, roundId, 'configureItems', { items: logic.CONFIG.V3_ITEMS }))).ok, true);
    assert.strictEqual((await call('host', v3(roomId, roundId, 'ready', { ready: true }))).ready, true);
    assert.strictEqual((await call('guest', v3(roomId, roundId, 'ready', { ready: true }))).ready, true);
    assert.strictEqual(room.status, 'playing');
    clock = room.startTime + 100;

    const first = { seq: 1, score: 100, at: clock };
    assert.strictEqual((await call('host', v3(roomId, roundId, 'syncScore', { samples: [first] }))).myScore, 100);
    assert.strictEqual((await call('host', v3(roomId, roundId, 'syncScore', { samples: [first] }))).myScore, 100);
    assert.strictEqual((await call('host', v3(roomId, roundId, 'syncScore', {
        samples: [{ seq: 1, score: 200, at: clock }]
    }))).err, 'STALE_SCORE_SAMPLE');
    assert.strictEqual((await call('host', v3(roomId, roundId, 'syncScore', {
        samples: [{ seq: 3, score: 300, at: clock }]
    }))).err, 'STALE_SCORE_SAMPLE');

    clock += 50;
    const cheerRequest = 'cheer-request-001';
    const cheer = await call('host', v3(roomId, roundId, 'useItem', { item: 'cheer', requestId: cheerRequest,
        samples: [{ seq: 2, score: 200, at: clock }] }));
    assert.strictEqual(cheer.ok, true);
    assert.strictEqual(cheer.myScore, 200, 'pre-cheer sample is not doubled');
    assert.strictEqual(cheer.ackSeq, 2);
    assert.strictEqual(cheer.items.cheer, 0);
    const retry = await call('host', v3(roomId, roundId, 'useItem', { item: 'cheer', requestId: cheerRequest,
        samples: [{ seq: 2, score: 200, at: clock }] }));
    assert.strictEqual(retry.cast.id, cheer.cast.id);
    assert.strictEqual(retry.items.cheer, 0);
    assert.deepStrictEqual(retry.itemCooldowns, cheer.itemCooldowns);
    assert.strictEqual((await call('host', v3(roomId, roundId, 'useItem', {
        item: 'freeze', requestId: cheerRequest
    }))).err, '道具请求冲突');
    clock = cheer.effect.until + 100;
    const doubled = await call('host', v3(roomId, roundId, 'syncScore', {
        samples: [{ seq: 3, score: 300, at: cheer.effect.at + 100 }]
    }));
    assert.strictEqual(doubled.myScore, 400, 'delayed sample in issued cheer window remains doubled');
    assert.strictEqual((await call('host', v3(roomId, roundId, 'useItem', {
        item: 'freeze', requestId: 'freeze-too-soon'
    }))).ok, true, 'a different item is usable during cheer cooldown');
    clock = cheer.effect.until + 100;
    const afterCheer = await call('host', v3(roomId, roundId, 'syncScore', {
        samples: [{ seq: 4, score: 400, at: clock }]
    }));
    assert.strictEqual(afterCheer.myScore, 500);
    assert.strictEqual((await call('host', v3(roomId, roundId, 'syncScore', {
        samples: [{ seq: 5, score: 500, at: clock + 2000 }]
    }))).err, '分数样本时间非法');

    clock = cheer.effect.until + 100 + logic.CONFIG.ITEM_COOLDOWN_MS;
    const shield = await call('guest', v3(roomId, roundId, 'useItem', {
        item: 'reflect', requestId: 'shield-request-1'
    }));
    assert.strictEqual(shield.ok, true);
    const freeze = await call('host', v3(roomId, roundId, 'useItem', {
        item: 'freeze', requestId: 'freeze-request-1'
    }));
    assert.strictEqual(freeze.ok, true);
    assert.strictEqual(freeze.cast.status, 'reflected');
    assert.strictEqual(player(room, 'guest').reflectUntil, clock);
    assert.strictEqual(player(room, 'host').frozenUntil, clock + logic.CONFIG.FREEZE_DURATION_MS);
    const guestView = await call('guest', v3(roomId, roundId, 'query'));
    assert(guestView.effects.some(function (effect) { return effect.id === freeze.effect.id && effect.status === 'blocked'; }));
    assert(guestView.effects.some(function (effect) { return effect.id === shield.effect.id && effect.status === 'triggered'; }));
    const hostView = await call('host', v3(roomId, roundId, 'query'));
    assert(hostView.effects.some(function (effect) {
        return effect.reflected === true && effect.sourceEffectId === freeze.effect.id && effect.status === 'active';
    }));
    assert.strictEqual((await call('host', v3(roomId, roundId, 'syncScore', {
        samples: [{ seq: 5, score: 500, at: clock }]
    }))).myScore, 600, 'an in-flight cascade may finish while frozen');
    assert.strictEqual((await call('host', v3(roomId, roundId - 1, 'query'))).roundId, roundId,
        'stale query reads current round for recovery');
    assert.deepStrictEqual(await call('old', { action: 'query', roomId: roomId }), { ok: false, err: '不在房间' });

    clock += 1000;
    room.startTime = clock - logic.CONFIG.BATTLE_DURATION_MS - logic.CONFIG.SCORE_FINALIZATION_MS - 1;
    const finished = await call('host', v3(roomId, roundId, 'query'));
    assert.strictEqual(finished.status, 'finished');
    assert.strictEqual((await call('host', v3(roomId, roundId, 'rematch', { accept: true }))).myRematch, true);
    const next = await call('guest', v3(roomId, roundId, 'rematch', { accept: true }));
    assert.strictEqual(next.roundId, roundId + 1);
    assert.deepStrictEqual(next.myItems, logic.CONFIG.V3_ITEMS);
    assert.deepStrictEqual(next.myItemCooldowns, zero);
    assert(room.players.every(function (owner) {
        return Object.values(owner.itemCooldowns).every(function (deadline) { return deadline === 0; });
    }));
    assert.strictEqual(next.myScoreSeq, 0);
    assert.strictEqual(next.myScore, 0);
    assert.strictEqual(next.effects.length, 0);
    assert.strictEqual(next.casts.length, 0);
    assert.deepStrictEqual(await call('host', v3(roomId, roundId, 'useItem', {
        item: 'cheer', requestId: 'stale-request-1'
    })), { ok: false, err: 'STALE_ROUND' });

    assert.strictEqual((await call('host', v3(roomId, next.roundId, 'ready', { ready: true }))).ready, true);
    assert.strictEqual((await call('guest', v3(roomId, next.roundId, 'ready', { ready: true }))).ready, true);
    clock = room.startTime + 100;
    const expiringShield = await call('guest', v3(roomId, next.roundId, 'useItem', {
        item: 'reflect', requestId: 'shield-expiry-1'
    }));
    assert.strictEqual(expiringShield.ok, true);
    clock = expiringShield.effect.until + 1;
    const unblocked = await call('host', v3(roomId, next.roundId, 'useItem', {
        item: 'freeze', requestId: 'freeze-expiry-1'
    }));
    assert.strictEqual(unblocked.cast.status, 'active', 'expired shield cannot block');
    const guest = player(room, 'guest');
    guest.itemCooldownUntil = 0;
    guest.activeEffectUntil = 0;
    assert.strictEqual(logic.validateItemUse(room, guest, 'freeze', clock, logic.CONFIG).err,
        '冻结中不能使用道具');

    clock += logic.CONFIG.ITEM_COOLDOWN_MS + 1;
    const host = player(room, 'host');
    for (const owner of [host, guest]) {
        owner.reflectUntil = clock + 5000;
        room.effects.push({ id: 'fixture-' + owner.openid, item: 'reflect', toOpenid: owner.openid,
            fromOpenid: owner.openid, at: clock, until: clock + 5000, duration: 5000, status: 'active' });
    }
    const beforeEffects = room.effects.length;
    const doubleShield = await call('host', v3(roomId, next.roundId, 'useItem', {
        item: 'disturb', requestId: 'double-shield-1'
    }));
    assert.strictEqual(doubleShield.cast.status, 'reflected');
    assert.strictEqual(room.effects.length, beforeEffects + 2, 'reflection cannot bounce a second time');
    const returned = room.effects.find(function (effect) { return effect.id === doubleShield.cast.reflectedEffectId; });
    assert.strictEqual(returned.status, 'blocked');
    assert.strictEqual(returned.reflected, true);

    const legacy = await call('legacy-host', { action: 'create', protocolVersion: 2 });
    const legacyJoin = await call('new', v3(legacy.roomId, 1, 'join'));
    assert.strictEqual(legacyJoin.ok, true);
    assert.strictEqual(legacyJoin.itemRulesVersion, undefined);
    assert.deepStrictEqual(documents[legacy.roomId].players[1].items, logic.CONFIG.INITIAL_ITEMS);

    // Dedicated independent-cooldown scenario: interleave all four items at the same instant.
    const independent = await call('cool-host', { action: 'create', protocolVersion: 2, itemRulesVersion: 3 });
    const independentJoin = await call('cool-guest', v3(independent.roomId, 1, 'join'));
    const independentRoom = documents[independent.roomId];
    const independentRound = independentJoin.roundId;
    const castItem = function (item, requestId, extra) {
        return call('cool-host', v3(independent.roomId, independentRound, 'useItem',
            Object.assign({ item: item, requestId: requestId }, extra || {})));
    };
    assert.deepStrictEqual(independentRoom.players[0].itemCooldowns, zero);
    await call('cool-host', v3(independent.roomId, independentRound, 'ready', { ready: true }));
    await call('cool-guest', v3(independent.roomId, independentRound, 'ready', { ready: true }));
    clock = independentRoom.startTime;
    const issuedAt = clock;
    const issued = await castItem('freeze', 'independent-freeze-1', {
        itemCooldowns: { freeze: 0 }, itemCooldownUntil: 0
    });
    assert.strictEqual(issued.ok, true);
    const expectedCooldowns = { freeze: issuedAt + 10000, disturb: 0, reflect: 0, cheer: 0 };
    assert.deepStrictEqual(issued.itemCooldowns, expectedCooldowns);
    for (const item of ['disturb', 'reflect', 'cheer']) {
        const cast = await castItem(item, 'independent-' + item + '-1');
        assert.strictEqual(cast.ok, true, item + ' is independent of active effects and other cooldowns');
        expectedCooldowns[item] = issuedAt + 10000;
        assert.deepStrictEqual(cast.itemCooldowns, expectedCooldowns);
    }
    const coolPlayer = player(independentRoom, 'cool-host');
    assert.strictEqual(coolPlayer.items.freeze, 1);
    assert.strictEqual((await call('cool-guest', v3(independent.roomId, independentRound, 'useItem', {
        item: 'reflect', requestId: 'frozen-reflect-1'
    }))).err, '冻结中不能使用道具');
    clock = issuedAt + 9999;
    assert.strictEqual((await castItem('freeze', 'independent-freeze-2')).err, '道具冷却中');
    const duplicate = await castItem('freeze', 'independent-freeze-1', {
        samples: [{ seq: 999, score: 999999999, at: clock }]
    });
    assert.strictEqual(duplicate.cast.id, issued.cast.id);
    assert.deepStrictEqual(duplicate.itemCooldowns, expectedCooldowns);
    assert.strictEqual(coolPlayer.items.freeze, 1);
    await call('cool-guest', v3(independent.roomId, independentRound, 'query'));
    const currentView = await call('cool-host', v3(independent.roomId, independentRound, 'query'));
    assert.deepStrictEqual(currentView.myItemCooldowns, expectedCooldowns);
    assert.strictEqual(currentView.myItemCooldownUntil, issuedAt + 10000);
    clock = issuedAt + 10000;
    const boundary = await castItem('freeze', 'independent-freeze-2');
    assert.strictEqual(boundary.ok, true, 'same item unlocks at exactly ten seconds');
    assert.strictEqual(boundary.itemCooldowns.freeze, issuedAt + 20000);
    assert.strictEqual(boundary.itemCooldowns.cheer, issuedAt + 10000);

    // Pre-map persisted players cannot bypass the former shared cooldown or effect lock.
    const migratedPlayer = player(independentRoom, 'cool-guest');
    delete migratedPlayer.itemCooldowns;
    migratedPlayer.frozenUntil = 0;
    migratedPlayer.itemCooldownUntil = clock + 4000;
    migratedPlayer.activeEffectUntil = clock + 5000;
    const migrationBaseline = clock + 5000;
    const oldView = await call('cool-guest', v3(independent.roomId, independentRound, 'query'));
    assert.deepStrictEqual(oldView.myItemCooldowns, {
        freeze: migrationBaseline, disturb: migrationBaseline, reflect: migrationBaseline, cheer: migrationBaseline
    });
    assert.strictEqual(migratedPlayer.itemCooldowns, undefined, 'query does not persist a migration');
    assert.strictEqual((await call('cool-guest', v3(independent.roomId, independentRound, 'useItem', {
        item: 'cheer', requestId: 'migration-cheer-1'
    }))).err, '道具冷却中');
    clock = migrationBaseline - 1;
    assert.strictEqual((await call('cool-guest', v3(independent.roomId, independentRound, 'useItem', {
        item: 'cheer', requestId: 'migration-cheer-1'
    }))).err, '已有道具生效中');
    clock = migrationBaseline;
    assert.strictEqual((await call('cool-guest', v3(independent.roomId, independentRound, 'useItem', {
        item: 'cheer', requestId: 'migration-invalid-1', samples: [{ seq: 5, score: 10, at: clock }]
    }))).err, 'STALE_SCORE_SAMPLE');
    assert.strictEqual(migratedPlayer.itemCooldowns, undefined, 'failed cast does not migrate');
    const migrated = await call('cool-guest', v3(independent.roomId, independentRound, 'useItem', {
        item: 'cheer', requestId: 'migration-cheer-1'
    }));
    assert.strictEqual(migrated.ok, true);
    assert.strictEqual(migrated.itemCooldowns.cheer, clock + 10000);
    assert.strictEqual(migrated.itemCooldowns.freeze, migrationBaseline);
    assert.strictEqual((await call('cool-guest', v3(independent.roomId, independentRound, 'useItem', {
        item: 'disturb', requestId: 'migration-disturb-1'
    }))).ok, true, 'migrated player now has independent cooldowns');

    // Legacy rules on the new server get the same independent behavior.
    const legacyRound = legacyJoin.roundId;
    const legacyEvent = function (action, extra) {
        return Object.assign({ action: action, roomId: legacy.roomId, protocolVersion: 2, roundId: legacyRound }, extra || {});
    };
    await call('legacy-host', legacyEvent('ready', { ready: true }));
    await call('new', legacyEvent('ready', { ready: true }));
    clock = documents[legacy.roomId].startTime;
    const legacyFreeze = await call('legacy-host', legacyEvent('useItem', { item: 'freeze' }));
    assert.deepStrictEqual(legacyFreeze.itemCooldowns, { freeze: clock + 10000, disturb: 0 });
    const legacyDisturb = await call('legacy-host', legacyEvent('useItem', { item: 'disturb' }));
    assert.strictEqual(legacyDisturb.ok, true);
    assert.strictEqual((await call('legacy-host', legacyEvent('useItem', { item: 'disturb' }))).err, '道具冷却中');
    clock += 10000;
    assert.strictEqual((await call('legacy-host', legacyEvent('useItem', { item: 'disturb' }))).ok, true);
    console.log('battle items v3 tests passed');
})().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
}).finally(function () { Date.now = realNow; });
