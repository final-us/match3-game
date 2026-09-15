'use strict';

const assert = require('assert');
const Module = require('module');

let currentOpenid = '';
let removeCalls = 0;
let transactionCalls = 0;
let cutoff = 0;
let setError = null;
const documents = Object.create(null);
let transactionTail = Promise.resolve();

function documentRef(id) {
    return {
        get: function () {
            return Promise.resolve({ data: documents[id] || null });
        },
        set: function (options) {
            if (setError) return Promise.reject(setError);
            assert(options && options.data && typeof options.data === 'object');
            assert.strictEqual(Object.prototype.hasOwnProperty.call(options.data, '_id'), false,
                '事务 set 数据不得包含 _id');
            documents[id] = Object.assign({ _id: id }, options.data);
            return Promise.resolve({});
        },
        update: function (options) {
            assert(documents[id], '更新必须针对现有房间');
            Object.assign(documents[id], options.data);
            return Promise.resolve({});
        }
    };
}

const transaction = {
    collection: function (name) {
        assert.strictEqual(name, 'battle_rooms');
        return { doc: documentRef };
    }
};

const rooms = {
    where: function (condition) {
        assert(condition && condition.createdAt && Number.isFinite(condition.createdAt.lt));
        cutoff = condition.createdAt.lt;
        return {
            remove: function () {
                removeCalls++;
                return Promise.resolve({ stats: { removed: 3 } });
            }
        };
    }
};

const database = {
    command: {
        lt: function (value) { return { lt: value }; }
    },
    collection: function (name) {
        assert.strictEqual(name, 'battle_rooms');
        return rooms;
    },
    runTransaction: function (handler) {
        transactionCalls++;
        const result = transactionTail.then(function () { return handler(transaction); });
        transactionTail = result.catch(function () {});
        return result;
    }
};

const cloudMock = {
    DYNAMIC_CURRENT_ENV: 'dynamic-env',
    init: function () {},
    database: function () { return database; },
    getWXContext: function () { return { OPENID: currentOpenid }; }
};

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'wx-server-sdk') return cloudMock;
    return originalLoad.call(this, request, parent, isMain);
};

const battleFunction = require('../cloudfunctions/battle/index');
const logic = require('../cloudfunctions/battle/logic');
Module._load = originalLoad;

(async function run() {
    const before = Date.now() - logic.CONFIG.ROOM_RETENTION_MS;
    const cleanup = await battleFunction.main({
        Type: 'Timer',
        TriggerName: 'cleanup-battle-rooms'
    });
    const after = Date.now() - logic.CONFIG.ROOM_RETENTION_MS;
    assert.deepStrictEqual(cleanup, { ok: true, deleted: 3 });
    assert.strictEqual(removeCalls, 1);
    assert(cutoff >= before && cutoff <= after, '清理截止时间不正确');

    currentOpenid = 'client-openid';
    const forged = await battleFunction.main({
        Type: 'Timer',
        TriggerName: 'cleanup-battle-rooms'
    });
    assert.strictEqual(forged.ok, false);
    assert.strictEqual(removeCalls, 1, '客户端伪造定时事件不得触发清理');

    currentOpenid = '';
    const missingIdentity = await battleFunction.main({ action: 'create' });
    assert.deepStrictEqual(missingIdentity, { ok: false, err: '身份校验失败' });

    currentOpenid = 'client-openid';
    const invalidRoom = await battleFunction.main({ action: 'join', roomId: 'R123' });
    assert.deepStrictEqual(invalidRoom, { ok: false, err: '房间号格式非法' });
    assert.strictEqual(transactionCalls, 0, '非法房间号不得进入事务');

    for (let i = 0; i < 5; i++) {
        const created = await battleFunction.main({ action: 'create', nickname: '玩家' });
        assert.strictEqual(created.ok, true);
        assert(logic.isValidRoomId(created.roomId));
    }
    const limited = await battleFunction.main({ action: 'create', nickname: '玩家' });
    assert.deepStrictEqual(limited, { ok: false, err: logic.CREATE_RATE_LIMIT_MESSAGE });
    const counterIds = Object.keys(documents).filter(function (id) {
        return id.indexOf(logic.CREATE_LIMIT_DOCUMENT_PREFIX) === 0;
    });
    assert.strictEqual(counterIds.length, 1, '每个 OpenID 应只有一个哈希计数文档');
    assert(counterIds[0].length <= 32, '限流文档 ID 过长');
    assert.strictEqual(counterIds[0].includes(currentOpenid), false, '限流文档 ID 泄露 OpenID');
    assert.strictEqual(JSON.stringify(documents[counterIds[0]]).includes(currentOpenid), false,
        '限流文档内容泄露 OpenID');

    currentOpenid = 'concurrent-openid';
    const concurrent = await Promise.all(Array.from({ length: 6 }, function () {
        return battleFunction.main({ action: 'create', nickname: '并发玩家' });
    }));
    assert.strictEqual(concurrent.filter(function (result) { return result.ok; }).length, 5,
        '并发建房穿透每分钟上限');
    assert.deepStrictEqual(concurrent.filter(function (result) { return !result.ok; })[0],
        { ok: false, err: logic.CREATE_RATE_LIMIT_MESSAGE });

    const oldConsoleError = console.error;
    console.error = function () {};
    currentOpenid = 'failing-openid';
    setError = new Error('secret database detail');
    try {
        const failure = await battleFunction.main({ action: 'create', nickname: '玩家' });
        assert.deepStrictEqual(failure, { ok: false, err: '服务异常' });
        assert.strictEqual(JSON.stringify(failure).includes('secret'), false);
    } finally {
        setError = null;
        console.error = oldConsoleError;
    }

    currentOpenid = 'waiting-host';
    const waitingRoom = await battleFunction.main({ action: 'create' });
    assert(waitingRoom.ok);
    const waitingId = waitingRoom.roomId;
    currentOpenid = 'waiting-guest';
    assert((await battleFunction.main({ action: 'join', roomId: waitingId })).ok);
    assert((await battleFunction.main({ action: 'ready', roomId: waitingId })).ok);
    assert((await battleFunction.main({ action: 'leave', roomId: waitingId })).ok);
    assert.strictEqual(documents[waitingId].players.length, 1, '等待中退出必须释放席位');
    currentOpenid = 'waiting-host';
    assert((await battleFunction.main({ action: 'ready', roomId: waitingId })).ok);
    assert.strictEqual(documents[waitingId].status, 'waiting', '退出玩家不可继续参与allReady');
    currentOpenid = 'replacement-guest';
    assert((await battleFunction.main({ action: 'join', roomId: waitingId })).ok, '空席位应允许新好友加入');
    assert.strictEqual(documents[waitingId].players.every(function (p) { return !p.ready; }), true,
        '换人后双方重新确认准备，不沿用上个对手的准备状态');
    assert((await battleFunction.main({ action: 'ready', roomId: waitingId })).ok);
    currentOpenid = 'waiting-host';
    assert((await battleFunction.main({ action: 'ready', roomId: waitingId })).ok);
    assert.strictEqual(documents[waitingId].status, 'playing', '双方重新准备后应可开局');
    currentOpenid = 'replacement-guest';
    assert((await battleFunction.main({ action: 'leave', roomId: waitingId })).ok);
    assert.strictEqual(documents[waitingId].status, 'finished', '对局中退出仍应结算而非删除席位');
    assert.strictEqual(documents[waitingId].players.length, 2);
    assert.strictEqual(documents[waitingId].result['waiting-host'].result, 'win');
    assert.strictEqual(documents[waitingId].result['replacement-guest'].result, 'lose');

    currentOpenid = 'last-waiting-player';
    const emptyRoom = await battleFunction.main({ action: 'create' });
    assert((await battleFunction.main({ action: 'leave', roomId: emptyRoom.roomId })).ok);
    assert.strictEqual(documents[emptyRoom.roomId].players.length, 0);
    currentOpenid = 'late-invite-player';
    assert.strictEqual((await battleFunction.main({ action: 'join', roomId: emptyRoom.roomId })).ok, false,
        '所有人离开的旧邀请不得复活空房间');
    console.log('battle cloud function tests passed');
})().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
