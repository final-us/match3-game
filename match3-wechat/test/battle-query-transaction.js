'use strict';

const assert = require('assert');
const Module = require('module');
const path = require('path');
const battleDir = path.join(__dirname, '..', 'cloudfunctions', 'battle');
const { Db } = require(path.join(battleDir, 'node_modules', '@cloudbase', 'database'));
const { EJSON } = require(path.join(battleDir, 'node_modules', 'bson'));
const logic = require(path.join(battleDir, 'logic'));

const originalRequest = Db.reqClass;
const originalLoad = Module._load;
const originalNow = Date.now;
let at = 1000000;
let openid = 'host';
let transactionNumber = 0;
let updates = 0;
let version = 0;
let injectConflict = 0;
const transactions = new Map();
const roomId = 'R12345678abcdef0123';
const store = {
    [roomId]: {
        _id: roomId, protocolVersion: 2, roundId: 1, roundNumber: 1,
        status: 'waiting', createdAt: at, waitingAt: at, startTime: 0,
        settledRoundId: 0, result: {}, effects: [], casts: [],
        players: ['host', 'guest'].map(function (id) {
            return {
                openid: id, nickname: id, score: 0, ready: false,
                items: { ...logic.CONFIG.INITIAL_ITEMS }, itemCooldownUntil: 0,
                activeEffectUntil: 0, online: true, lastSeen: at,
                wins: 0, rematchAccepted: false, left: false
            };
        })
    }
};

function copy(value) { return EJSON.parse(EJSON.stringify(value)); }
function setPath(document, path, value) {
    const parts = path.split('.');
    let target = document;
    for (let index = 0; index < parts.length - 1; index++) {
        target[parts[index]] = target[parts[index]] || {};
        target = target[parts[index]];
    }
    target[parts[parts.length - 1]] = value;
}

class Request {
    async send(action, params) {
        if (action === 'database.startTransaction') {
            const id = 'tx' + (++transactionNumber);
            transactions.set(id, { docs: copy(store), version: version, dirty: new Set() });
            return { transactionId: id };
        }
        const tx = transactions.get(params.transactionId);
        assert(tx, 'SDK request must use a live transaction');
        if (action === 'database.getDocument') {
            const id = EJSON.parse(params.query)._id;
            return { data: { list: tx.docs[id] ? [EJSON.stringify(tx.docs[id])] : [] } };
        }
        if (action === 'database.modifyDocument') {
            const id = EJSON.parse(params.query)._id;
            assert(tx.docs[id]);
            const change = EJSON.parse(params.data);
            assert(change.$set, 'SDK must serialize update to $set');
            for (const field of Object.keys(change.$set)) setPath(tx.docs[id], field, change.$set[field]);
            tx.dirty.add(id);
            updates++;
            return { data: { updated: 1 } };
        }
        if (action === 'database.commitTransaction') {
            transactions.delete(params.transactionId);
            const conflict = tx.dirty.size && (injectConflict > 0 || tx.version !== version);
            if (injectConflict > 0) injectConflict--;
            if (conflict) {
                return { code: 'DATABASE_TRANSACTION_CONFLICT' };
            }
            for (const id of tx.dirty) store[id] = tx.docs[id];
            if (tx.dirty.size) version++;
            return {};
        }
        if (action === 'database.abortTransaction') {
            transactions.delete(params.transactionId);
            return {};
        }
        throw new Error('unexpected SDK request: ' + action);
    }
}

Db.reqClass = Request;
Date.now = function () { return at; };
const sdkDb = new Db({ throwOnCode: true });
const database = {
    collection: function (name) {
        assert(['battle_rooms', 'daily_runs', 'daily_progress', 'retention_profiles',
            'retention_events', 'retention_receipts'].includes(name));
        return {};
    },
    runTransaction: function (callback) {
        return sdkDb.runTransaction(function (tx) {
            return callback({
                collection: function (name) {
                    return {
                        doc: function (id) {
                            const ref = tx.collection(name).doc(id);
                            return {
                                get: function () { return ref.get(); },
                                update: function (options) { return ref.update(options.data); }
                            };
                        }
                    };
                }
            });
        });
    }
};
const cloud = {
    DYNAMIC_CURRENT_ENV: 'test', init: function () {},
    database: function () { return database; },
    getWXContext: function () { return { OPENID: openid }; }
};
Module._load = function (request, parent, isMain) {
    if (request === 'wx-server-sdk') return cloud;
    return originalLoad.call(this, request, parent, isMain);
};
const battle = require(path.join(battleDir, 'index'));
Module._load = originalLoad;

(async function () {
    try {
        for (let second = 0; second < 3; second++) {
            at = 1000000 + second * 1000;
            for (const id of ['host', 'guest']) {
                openid = id;
                const response = await battle.main({ action: 'query', roomId: roomId });
                assert.strictEqual(response.ok, true);
            }
        }
        assert.strictEqual(updates, 0, 'routine one-second polls must not write the shared room');
        assert.strictEqual(store[roomId].players[0].lastSeen, 1000000,
            'SDK snapshots must not persist in-memory mutations without update');

        openid = 'host';
        const configured = await battle.main({
            action: 'configureItems', roomId: roomId, protocolVersion: 2, roundId: 1,
            items: { freeze: 2, disturb: 1 }
        });
        assert.strictEqual(configured.ok, true);
        assert.strictEqual(updates, 1);
        assert.deepStrictEqual(store[roomId].players[0].items, { freeze: 2, disturb: 1 });
        injectConflict = 1;
        const attemptsBeforeReady = transactionNumber;
        assert.strictEqual((await battle.main({
            action: 'ready', roomId: roomId, protocolVersion: 2, roundId: 1, ready: true
        })).ok, true);
        assert.strictEqual(transactionNumber, attemptsBeforeReady + 2,
            'installed SDK must retry a transaction conflict with a fresh snapshot');
        openid = 'guest';
        assert.strictEqual((await battle.main({
            action: 'configureItems', roomId: roomId, protocolVersion: 2, roundId: 1,
            items: { freeze: 0, disturb: 3 }
        })).ok, true);
        assert.strictEqual(store[roomId].players[0].ready, true,
            'opponent item configuration must preserve host ready state');
        assert.strictEqual(store[roomId].players[1].ready, false,
            'configuring own items must not implicitly ready the guest');
        openid = 'host';
        const hostAfterGuestConfig = await battle.main({ action: 'query', roomId: roomId });
        assert.strictEqual(hostAfterGuestConfig.myReady, true);
        assert.deepStrictEqual(hostAfterGuestConfig.myItems, { freeze: 2, disturb: 1 });
        assert.strictEqual(hostAfterGuestConfig.opp.ready, false);
        openid = 'guest';
        assert.strictEqual((await battle.main({
            action: 'ready', roomId: roomId, protocolVersion: 2, roundId: 1, ready: true
        })).ok, true);
        assert.strictEqual(store[roomId].status, 'playing');
        assert(store[roomId].players.every(function (player) { return player.ready; }));

        const writesBeforePoll = updates;
        at = 1005001;
        openid = 'host';
        const response = await battle.main({ action: 'query', roomId: roomId });
        assert.strictEqual(response.ok, true);
        assert.strictEqual(updates, writesBeforePoll + 1, 'heartbeat must persist before the 10-second offline grace');
        assert.strictEqual(store[roomId].players[0].lastSeen, at);
        assert.strictEqual(store[roomId].players[1].lastSeen, 1002000);
        assert.strictEqual(response.myReady, true);
        assert.strictEqual(response.opp.ready, true);

        assert.strictEqual((await battle.main({
            action: 'syncScore', roomId: roomId, protocolVersion: 2, roundId: 1, score: 10
        })).ok, true);
        openid = 'guest';
        assert.strictEqual((await battle.main({
            action: 'syncScore', roomId: roomId, protocolVersion: 2, roundId: 1, score: 5
        })).ok, true);

        at = store[roomId].startTime + logic.CONFIG.BATTLE_DURATION_MS;
        openid = 'host';
        assert.strictEqual((await battle.main({ action: 'query', roomId: roomId })).status, 'finished');
        assert.strictEqual(store[roomId].settledRoundId, 1);
        assert.strictEqual(store[roomId].players[0].wins, 1);
        const settledResult = copy(store[roomId].result);
        const finishedWrites = updates;
        at++;
        assert.strictEqual((await battle.main({ action: 'query', roomId: roomId })).status, 'finished');
        assert.strictEqual(updates, finishedWrites,
            'settled finished-room polling must not write the shared room every second');
        assert.deepStrictEqual(store[roomId].result, settledResult);
        assert.strictEqual(store[roomId].players[0].wins, 1);

        store[roomId].result = { host: store[roomId].result.host };
        store[roomId].settledRoundId = 0;
        store[roomId].players[0].wins = 0;
        version++;
        at++;
        assert.strictEqual((await battle.main({ action: 'query', roomId: roomId })).status, 'finished');
        assert.strictEqual(updates, finishedWrites + 1, 'legacy partial settlement must be repaired once');
        assert.strictEqual(store[roomId].settledRoundId, 1);
        assert.strictEqual(store[roomId].players[0].wins, 1);
        assert(store[roomId].result.host.settlementId && store[roomId].result.guest.settlementId);
        const repairedWrites = updates;
        at++;
        await battle.main({ action: 'query', roomId: roomId });
        assert.strictEqual(updates, repairedWrites, 'settlement retry must remain idempotent');
        assert.strictEqual(store[roomId].players[0].wins, 1);

        at += 3000;
        await battle.main({ action: 'query', roomId: roomId });
        assert.strictEqual(updates, repairedWrites + 1,
            'finished room must still persist a due rematch heartbeat');
        assert.strictEqual(store[roomId].players[0].wins, 1);

        assert.strictEqual((await battle.main({
            action: 'rematch', roomId: roomId, protocolVersion: 2, roundId: 1, accept: true
        })).ok, true);
        const rematchWrites = updates;
        at++;
        await battle.main({ action: 'query', roomId: roomId });
        assert.strictEqual(updates, rematchWrites, 'finished query must not overwrite a pending rematch');
        assert.strictEqual(store[roomId].players[0].rematchAccepted, true);
        openid = 'guest';
        assert.strictEqual((await battle.main({
            action: 'rematch', roomId: roomId, protocolVersion: 2, roundId: 1, accept: true
        })).ok, true);
        assert.strictEqual(store[roomId].status, 'waiting');
        assert.strictEqual(store[roomId].roundId, 2);
        assert(store[roomId].players.every(function (player) { return !player.ready; }));
        assert.strictEqual(store[roomId].players[0].wins, 1);
        console.log('battle query transaction tests passed');
    } finally {
        Db.reqClass = originalRequest;
        Date.now = originalNow;
    }
})().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
