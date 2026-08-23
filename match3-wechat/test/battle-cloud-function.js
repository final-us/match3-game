'use strict';

const assert = require('assert');
const Module = require('module');

let currentOpenid = '';
let removeCalls = 0;
let transactionCalls = 0;
let cutoff = 0;
let addError = null;

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
    },
    add: function () {
        if (addError) return Promise.reject(addError);
        return Promise.resolve({});
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
    runTransaction: function () {
        transactionCalls++;
        return Promise.resolve({ ok: false });
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

    const oldConsoleError = console.error;
    console.error = function () {};
    addError = new Error('secret database detail');
    try {
        const failure = await battleFunction.main({ action: 'create', nickname: '玩家' });
        assert.deepStrictEqual(failure, { ok: false, err: '服务异常' });
        assert.strictEqual(JSON.stringify(failure).includes('secret'), false);
    } finally {
        console.error = oldConsoleError;
    }

    console.log('battle cloud function tests passed');
})().catch(function (error) {
    console.error(error);
    process.exitCode = 1;
});
