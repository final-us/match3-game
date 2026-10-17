'use strict';

const assert = require('assert');
const Module = require('module');
const path = require('path');
const battleDir = path.join(__dirname, '..', 'cloudfunctions', 'battle');
const { Db } = require(path.join(battleDir, 'node_modules', '@cloudbase', 'database'));
const { EJSON } = require(path.join(battleDir, 'node_modules', 'bson'));
const logic = require(path.join(battleDir, 'logic'));
const { UpdateSerializer } = require(path.join(battleDir, 'node_modules', '@cloudbase', 'database', 'dist', 'commonjs', 'serializer', 'update'));

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
        status: 'waiting', itemRulesVersion: 3, createdAt: at, waitingAt: at, startTime: 0,
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
    command: sdkDb.command,
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
        assert.deepStrictEqual(UpdateSerializer.encode({ result: {} }), {}, 'plain empty map is omitted by installed SDK');
        assert.deepStrictEqual(UpdateSerializer.encode({ result: sdkDb.command.set({}) }), { $set: { result: {} } });
        const room = store[roomId];
        room.status = 'finished'; room.roundId = 2; room.roundNumber = 1;
        room.finishedAt = at; room.finishReason = 'time'; room.settledRoundId = 2;
        room.result = {
            host: { result: 'win', myScore: 5180, oppScore: 0, roundId: 2, settlementId: 'old-host' },
            guest: { result: 'lose', myScore: 0, oppScore: 5180, roundId: 2, settlementId: 'old-guest' }
        };
        room.players[0].wins = 1;
        function event(action, roundId, extra) {
            return Object.assign({ action, roomId, roundId, protocolVersion: 2, itemRulesVersion: 3 }, extra);
        }
        async function call(who, action, roundId, extra) {
            openid = who; return battle.main(event(action, roundId, extra));
        }
        assert((await call('host', 'rematch', 2, { accept: true })).ok);
        const next = await call('guest', 'rematch', 2, { accept: true });
        assert.strictEqual(next.roundId, 3);
        assert.deepStrictEqual(store[roomId].result, {}, 'real SDK serialization must persist an empty result map');
        assert.strictEqual(store[roomId].settledRoundId, 0);
        assert.strictEqual(store[roomId].players[0].wins, 1);
        for (const who of ['host', 'guest']) assert((await call(who, 'ready', 3, { ready: true })).ok);
        const start = store[roomId].startTime;
        store[roomId].result = { staleOpponent: { result: 'win' } };
        at = start + 60000;
        assert((await call('host', 'syncScore', 3, { samples: [], final: true })).ok);
        assert((await call('guest', 'syncScore', 3, { samples: [{ seq: 1, score: 5090, at: start + 59999 }], final: true })).ok);
        const current = store[roomId];
        assert.strictEqual(current.status, 'finished');
        assert.deepStrictEqual(Object.keys(current.result).sort(), ['guest', 'host'], 'settlement replaces the entire map');
        assert.strictEqual(current.result.host.result, 'lose');
        assert.strictEqual(current.result.host.myScore, 0);
        assert.strictEqual(current.result.host.oppScore, 5090);
        assert.strictEqual(current.result.guest.result, 'win');
        assert.strictEqual(current.result.guest.myScore, 5090);
        assert.strictEqual(current.result.guest.oppScore, 0);
        assert.strictEqual(current.result.guest.roundId, 3);
        assert.notStrictEqual(current.result.host.settlementId, 'old-host');
        assert.notStrictEqual(current.result.guest.settlementId, 'old-guest');
        assert.deepStrictEqual(current.players.map(p => p.wins), [1, 1]);
        const results = copy(current.result);
        await call('guest', 'syncScore', 3, { samples: [], final: true });
        await call('host', 'query', 3); at += 3000; await call('guest', 'query', 3);
        assert.deepStrictEqual(store[roomId].result, results);
        assert.deepStrictEqual(store[roomId].players.map(p => p.wins), [1, 1]);
        // Waiting leave and replacement opponent use the same explicit map replacement.
        await call('host', 'rematch', 3, { accept: true });
        await call('guest', 'rematch', 3, { accept: true });
        store[roomId].result = { stale: { result: 'win' } };
        await call('guest', 'leave', 4);
        assert.deepStrictEqual(store[roomId].result, {});
        store[roomId].result = { stale: { result: 'win' } };
        openid = 'replacement';
        const replacement = await battle.main(event('join', 5));
        assert.strictEqual(replacement.roundId, 6);
        assert.deepStrictEqual(store[roomId].result, {});
        console.log('battle SDK round reset tests passed');
    } finally {
        Db.reqClass = originalRequest; Date.now = originalNow;
    }
})().catch(function (error) { console.error(error); process.exitCode = 1; });
