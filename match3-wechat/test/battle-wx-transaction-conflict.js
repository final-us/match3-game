'use strict';

const assert = require('assert');
const Module = require('module');
const path = require('path');
const battleDir = path.join(__dirname, '..', 'cloudfunctions', 'battle');
const { Db } = require(path.join(battleDir, 'node_modules', '@cloudbase', 'database'));
const { EJSON } = require(path.join(battleDir, 'node_modules', 'bson'));
const cloudSdk = require(path.join(battleDir, 'node_modules', 'wx-server-sdk'));
const logic = require(path.join(battleDir, 'logic'));
const retention = require(path.join(battleDir, 'retention'));
const originalRequest = Db.reqClass;
const originalLoad = Module._load;
const originalNow = Date.now;
const originalError = console.error;
const roomId = 'R12345678abcdef0123';
const marker = '[ResourceUnavailable.TransactionConflict]';
const logged = [];
const transactions = new Map();
let at = 1000000;
let attempts = 0;
let updateRequests = 0;
let fault = null;
let stored;
let serviceDocs = {};
let caller = 'host';
function copy(value) { return EJSON.parse(EJSON.stringify(value)); }
function reset() {
    at = 1000000;
    fault = null;
    stored = {
        _id: roomId, protocolVersion: 2, itemRulesVersion: 3, roundId: 1, roundNumber: 1,
        status: 'playing', createdAt: at, startTime: at - 1000, result: {}, effects: [], casts: [],
        players: ['host', 'guest'].map(function (openid) {
            return { openid: openid, nickname: openid, score: 0, rawScore: 0, scoreSeq: 0,
                scoreFinalized: false, items: { ...logic.CONFIG.V3_ITEMS },
                itemCooldowns: { freeze: 0, disturb: 0, reflect: 0, cheer: 0 },
                itemCooldownUntil: 0, activeEffectUntil: 0, lastSeen: at, online: true,
                frozenUntil: 0, reflectUntil: 0, cheerUntil: 0, cheerWindows: [] };
        })
    };
}
class Request {
    async send(action, params) {
        if (action === 'database.startTransaction') {
            const id = 'tx' + (++attempts);
            transactions.set(id, { doc: copy(stored), docs: copy(serviceDocs), dirty: false });
            return { transactionId: id };
        }
        if (!params.transactionId) {
            assert.strictEqual(action, 'database.getDocument', 'outside transactions only pending receipt queries are allowed');
            assert.strictEqual(params.collectionName, 'retention_receipts');
            const query = EJSON.parse(params.query);
            const list = Object.values(serviceDocs.retention_receipts || {}).filter(function (doc) {
                return Object.keys(query).every(function (key) { return doc[key] === query[key]; });
            });
            return { data: { list: list.map(function (doc) { return EJSON.stringify(doc); }) } };
        }
        const tx = transactions.get(params.transactionId);
        assert(tx, 'only local transaction requests are allowed');
        if (action === 'database.modifyDocument') updateRequests++;
        if (fault && fault.action === action && fault.remaining > 0 &&
            (!fault.collection || fault.collection === params.collectionName)) {
            fault.remaining--;
            if (fault.change) fault.change(tx, params);
            return { code: 'DATABASE_TRANSACTION_CONFLICT', message: fault.message || marker };
        }
        if (action === 'database.getDocument') {
            const id = EJSON.parse(params.query)._id;
            const doc = params.collectionName === 'battle_rooms' ? tx.doc : (tx.docs[params.collectionName] || {})[id];
            return { data: { list: doc ? [EJSON.stringify(doc)] : [] } };
        }
        if (action === 'database.modifyDocument') {
            const change = EJSON.parse(params.data);
            if (params.collectionName === 'battle_rooms') {
                assert(change.$set);
                Object.assign(tx.doc, change.$set);
            } else {
                const id = EJSON.parse(params.query)._id;
                const collection = tx.docs[params.collectionName] || (tx.docs[params.collectionName] = {});
                if (params.merge === false) collection[id] = Object.assign({ _id: id }, change);
                else Object.assign(collection[id], change.$set);
            }
            tx.dirty = true;
            return { data: { updated: 1 } };
        }
        if (action === 'database.commitTransaction') {
            if (tx.dirty) { stored = tx.doc; serviceDocs = tx.docs; }
            transactions.delete(params.transactionId);
            return {};
        }
        if (action === 'database.abortTransaction') {
            transactions.delete(params.transactionId);
            return {};
        }
        throw new Error('unexpected SDK request: ' + action);
    }
}
cloudSdk.init({ env: 'test' });
const database = cloudSdk.database({ throwOnNotFound: false });
assert(database._db instanceof Db, 'fixture uses installed wx wrapper and database SDK');
// wx database construction installs its own request transport; replace it only after construction.
Db.reqClass = Request;
Date.now = function () { return at; };
console.error = function () { logged.push(Array.from(arguments)); };
Module._load = function (request, parent, isMain) {
    if (request === 'wx-server-sdk') return {
        DYNAMIC_CURRENT_ENV: 'test', init: function () {}, database: function () { return database; },
        getWXContext: function () { return { OPENID: caller }; }
    };
    return originalLoad.call(this, request, parent, isMain);
};
const battle = require(path.join(battleDir, 'index'));
Module._load = originalLoad;
function event(action, extra) {
    return Object.assign({ action: action, roomId: roomId, protocolVersion: 2,
        itemRulesVersion: 3, roundId: 1 }, extra || {});
}
function inject(action, remaining, change, message) {
    fault = { action: action, remaining: remaining, change: change, message: message };
}

function profile() { return Object.values(serviceDocs.retention_profiles || {}).find(function (p) { return p.owner; }); }
function profileConflict(action, change, message, remaining) {
    inject(action, remaining === undefined ? 1 : remaining, change, message);
    fault.collection = 'retention_profiles';
}
function commitCompetingProfile(tx, params) {
    const id = EJSON.parse(params.query)._id;
    tx.docs.retention_profiles[id] = Object.assign({ _id: id }, EJSON.parse(params.data));
    serviceDocs = copy(tx.docs);
}

(async function () {
    try {
        // Verify the real wx-server-sdk 4.0.2 transformation, rather than mocking its final error.
        for (const operation of ['get', 'update']) {
            reset();
            inject(operation === 'get' ? 'database.getDocument' : 'database.modifyDocument', 1);
            const before = attempts;
            let wrapped;
            try {
                await database.runTransaction(async function (tx) {
                    const ref = tx.collection('battle_rooms').doc(roomId);
                    if (operation === 'get') return ref.get();
                    return ref.update({ data: { status: 'playing' } });
                });
            } catch (error) { wrapped = error; }
            assert(wrapped, operation + ' error must reach the real wx wrapper');
            assert.strictEqual(wrapped.errCode, -501001);
            assert(wrapped.errMsg.includes(marker));
            assert.strictEqual(wrapped.code, undefined, 'wx wrapper drops the database conflict code');
            assert.strictEqual(attempts - before, 1, 'un-normalized wrapper conflict does not retry');
        }

        for (const action of ['database.modifyDocument', 'database.getDocument']) {
            reset();
            inject(action, 1, function () { stored.players[1].score = 7; stored.players[1].rawScore = 7; });
            const before = attempts;
            const result = await battle.main(event('syncScore', {
                samples: [{ seq: 1, score: 100, at: at }]
            }));
            assert.strictEqual(result.ok, true, action + ' wrapped conflict should retry');
            assert.strictEqual(attempts - before, 2);
            assert.strictEqual(stored.players[0].score, 100);
            assert.strictEqual(stored.players[1].score, 7, 'retry must read a new snapshot and preserve opponent writes');
        }

        reset();
        inject('database.modifyDocument', 1, function () { stored.players[1].score = 9; });
        const beforeCast = attempts;
        const cast = await battle.main(event('useItem', { item: 'freeze', requestId: 'conflict-freeze-1' }));
        assert.strictEqual(cast.ok, true);
        assert.strictEqual(attempts - beforeCast, 2);
        assert.strictEqual(stored.players[0].items.freeze, 1, 'aborted attempt must not double consume');
        assert.strictEqual(stored.casts.length, 1);
        assert.strictEqual(stored.players[1].score, 9);
        const deadline = cast.itemCooldowns.freeze;
        at += 500;
        const retry = await battle.main(event('useItem', { item: 'freeze', requestId: 'conflict-freeze-1' }));
        assert.strictEqual(retry.cast.id, cast.cast.id);
        assert.strictEqual(retry.items.freeze, 1);
        assert.strictEqual(retry.itemCooldowns.freeze, deadline, 'duplicate must not renew cooldown');

        reset();
        // A competing identical request commits while this attempt conflicts at its update.
        inject('database.modifyDocument', 1, function (tx, params) {
            stored = copy(tx.doc);
            Object.assign(stored, EJSON.parse(params.data).$set);
        });
        const beforeConcurrent = attempts;
        const writesBeforeConcurrent = updateRequests;
        const concurrent = await battle.main(event('useItem', { item: 'freeze', requestId: 'concurrent-freeze-1' }));
        assert.strictEqual(concurrent.ok, true);
        assert.strictEqual(attempts - beforeConcurrent, 2);
        assert.strictEqual(updateRequests - writesBeforeConcurrent, 1,
            'retry sees the committed duplicate and returns without another update');
        assert.strictEqual(concurrent.items.freeze, 1);
        assert.strictEqual(stored.casts.length, 1);
        assert.strictEqual(concurrent.cast.id, stored.casts[0].id);

        reset();
        inject('database.modifyDocument', 1, null, '[ResourceUnavailable.OtherFailure]');
        const beforeOther = attempts;
        assert.deepStrictEqual(await battle.main(event('syncScore', {
            samples: [{ seq: 1, score: 100, at: at }]
        })), { ok: false, err: '服务异常' });
        assert.strictEqual(attempts - beforeOther, 1, 'other -501001 errors must not retry');
        assert.strictEqual(logged[logged.length - 1][2].errCode, -501001);
        assert.strictEqual(logged[logged.length - 1][2].code, undefined);

        reset();
        inject('database.modifyDocument', Infinity);
        const beforePersistent = attempts;
        assert.deepStrictEqual(await battle.main(event('useItem', {
            item: 'freeze', requestId: 'persistent-freeze-1'
        })), { ok: false, err: '服务异常' });
        assert.strictEqual(attempts - beforePersistent, 4, 'SDK default allows three retries, then fails');
        assert.strictEqual(stored.players[0].items.freeze, 2);
        assert.strictEqual(stored.players[0].itemCooldowns.freeze, 0);
        const finalError = logged[logged.length - 1][2];
        assert.strictEqual(finalError.errCode, -501001);
        assert(finalError.errMsg.includes(marker), 'final log preserves the original wrapped message');
        assert.strictEqual(finalError.code, 'DATABASE_TRANSACTION_CONFLICT');

        // The same real wx wrapper is used for retention profile reads and set writes.
        fault = null;
        at = Date.UTC(2026, 9, 17, 4);
        const infoInput = { action: 'retentionInfo', taskClaimMode: 'manual-v1' };
        assert.strictEqual((await battle.main(infoInput)).ok, true);
        const failedProfileRetries = [];
        for (const route of ['retentionInfo', 'catalogInfo']) {
            for (const operation of ['database.getDocument', 'database.modifyDocument']) {
                profileConflict(operation, function () {
                    profile().catalog.fish++;
                    profile().catalog.days++;
                    profile().catalog.revision++;
                    profile().day.games = 1;
                    profile().day.tasks[0] = true;
                });
                const before = attempts;
                const expectedFish = profile().catalog.fish + 1;
                const result = await battle.main({ action: route, taskClaimMode: 'manual-v1' });
                if (!result.ok) { failedProfileRetries.push(route + ':' + operation); continue; }
                assert.strictEqual(attempts - before, 2);
                assert.strictEqual(profile().catalog.fish, expectedFish, 'new snapshot preserves concurrent catalog progress');
                assert.strictEqual(profile().day.games, 1, 'new snapshot preserves concurrent daily task progress');
                assert.strictEqual(profile().day.tasks[0], true);
            }
        }
        assert.deepStrictEqual(failedProfileRetries, [], 'wrapped profile read/set conflicts should retry');

        const today = retention.beijingDate(at);
        const claim = { action: 'retentionClaimTask', date: today, index: 0 };
        profileConflict('database.modifyDocument');
        assert.strictEqual((await battle.main(claim)).ok, true);
        assert.strictEqual(profile().currentWeek.activity, 20);
        assert.strictEqual(Object.keys(serviceDocs.retention_receipts).length, 1);
        assert.strictEqual(Object.values(serviceDocs.retention_receipts)[0].coins, 40);
        // Reproduce another identical claim committing both receipt and profile at the conflict.
        profile().day.claimed[0] = false;
        profile().currentWeek.activity = 0;
        serviceDocs.retention_receipts = {};
        profileConflict('database.modifyDocument', commitCompetingProfile);
        assert.strictEqual((await battle.main(claim)).ok, true);
        assert.strictEqual(profile().currentWeek.activity, 20, 'competing same claim awards activity once');
        assert.strictEqual(Object.keys(serviceDocs.retention_receipts).length, 1, 'deterministic receipt is unique');
        assert.strictEqual((await battle.main(claim)).receipts.length, 1);

        Object.assign(profile().catalog, { days: 7, fish: 5, owned: ['cream'], affection: { cream: 0 } });
        const feedInput = function (id) { return { action: 'catalogFeed', catId: 'cream', requestId: id,
            expectedRevision: profile().catalog.revision, expectedOwner: profile().owner }; };
        const feed = feedInput('conflict-feed-0001');
        profileConflict('database.modifyDocument');
        assert.strictEqual((await battle.main(feed)).ok, true);
        assert.strictEqual(profile().catalog.fish, 4);
        assert.strictEqual(profile().catalog.affection.cream, 1);
        const competingFeed = feedInput('competing-feed-0001');
        profileConflict('database.modifyDocument', commitCompetingProfile);
        assert.strictEqual((await battle.main(competingFeed)).ok, true);
        assert.strictEqual(profile().catalog.fish, 3, 'same feed competing commit spends one fish');
        assert.strictEqual(profile().catalog.affection.cream, 2);
        assert.strictEqual((await battle.main(competingFeed)).ok, true);
        assert.strictEqual(profile().catalog.fish, 3, 'replayed feed cannot spend again');
        assert.strictEqual((await battle.main(feed)).code, 'STATE_CHANGED', 'older revision stays rejected after newer feed');
        const wrongOwner = Object.assign(feedInput('foreign-feed-0001'), { expectedOwner: 'other-owner' });
        assert.strictEqual((await battle.main(wrongOwner)).code, 'CATALOG_OWNER_CHANGED');
        assert.strictEqual(profile().catalog.fish, 3);
        assert.strictEqual((await battle.main({ action: 'retentionClaimTask', date: '2026-10-16', index: 2 })).eventStatus, 'expired');
        const receipt = Object.values(serviceDocs.retention_receipts)[0];
        caller = 'other-owner';
        assert.strictEqual((await battle.main(claim)).code, 'NOT_ELIGIBLE', 'caller identity cannot claim host reward');
        assert.strictEqual((await battle.main({ action: 'retentionAck', receiptIds: [receipt._id] })).code, 'RECEIPT_OWNER_MISMATCH');
        caller = 'host';

        // Exercise the other shared-profile transaction paths under the same SDK wrapper.
        for (const request of [
            { action: 'retentionSign', date: today },
            { action: 'retentionRecord', event: { id: 'solo:transaction-test', mode: 'solo', date: today,
                levelId: 1, validMove: true, completed: true, cleared: 80 } },
            { action: 'retentionAck', receiptIds: [receipt._id] }
        ]) {
            profileConflict('database.modifyDocument');
            const before = attempts;
            assert.strictEqual((await battle.main(request)).ok, true);
            assert.strictEqual(attempts - before, 2);
        }
        profile().currentWeek.activity = 200;
        profileConflict('database.modifyDocument');
        assert.strictEqual((await battle.main({ action: 'retentionClaim', week: profile().currentWeek.week, index: 0 })).ok, true);
        assert.strictEqual(profile().currentWeek.claimed[0], true);

        for (const route of ['retentionInfo', 'catalogInfo']) {
            profileConflict('database.modifyDocument', null, '[ResourceUnavailable.OtherFailure]');
            const before = attempts;
            assert.deepStrictEqual(await battle.main({ action: route }), { ok: false, err: '服务异常' });
            assert.strictEqual(attempts - before, 1);
            assert.strictEqual(logged[logged.length - 1][2].errCode, -501001);
            assert.strictEqual(logged[logged.length - 1][2].code, undefined);
            const unchanged = copy(profile());
            profileConflict('database.modifyDocument', null, undefined, Infinity);
            const beforePersistent = attempts;
            assert.deepStrictEqual(await battle.main({ action: route }), { ok: false, err: '服务异常' });
            assert.strictEqual(attempts - beforePersistent, 4);
            assert.deepStrictEqual(profile(), unchanged, 'all exhausted profile attempts roll back');
            const error = logged[logged.length - 1][2];
            assert.strictEqual(error.errCode, -501001);
            assert(error.errMsg.includes(marker));
            assert.strictEqual(error.code, 'DATABASE_TRANSACTION_CONFLICT');
        }
        console.log('battle real wx SDK transaction conflict tests passed (local transport only)');
    } finally {
        Db.reqClass = originalRequest;
        Date.now = originalNow;
        console.error = originalError;
        Module._load = originalLoad;
    }
})().catch(function (error) { console.error(error); process.exitCode = 1; });
