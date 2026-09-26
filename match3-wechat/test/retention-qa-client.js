'use strict';

const assert = require('assert');
const client = require('../js/platform/retention-client');

const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
const now = Date.UTC(2026, 8, 23, 5);
const state = {
    date: '2026-09-23', week: '2026-09-21', serverNow: now,
    weekEndsAt: Date.UTC(2026, 8, 27, 16), signDay: 1, signed: false,
    taskProgress: [1, 1, 15], activity: 20, claimed: [false, false, false]
};

function fixture(options) {
    const values = {};
    const notices = [];
    const calls = [];
    let failRetentionWrite = !!options.failRetentionWrite;
    const api = {
        getStorageSync(key) { return copy(values[key]); },
        setStorageSync(key, value) {
            if (key === client.KEY && failRetentionWrite) {
                failRetentionWrite = false;
                throw new Error('disk');
            }
            values[key] = copy(value);
        }
    };
    const wallet = {
        creditRewardOnce() {
            if (options.walletFailure) return { ok: false, credited: false };
            return { ok: true, credited: true, balance: 40 };
        }
    };
    let releaseInfo;
    const call = (action, input) => {
        calls.push({ action: action, input: copy(input) });
        if (options.holdInfo && action === 'retentionInfo') {
            return new Promise(resolve => { releaseInfo = resolve; });
        }
        const receipts = action === 'retentionRecord' && options.recordReceipt
            ? [{ id: 'task:1', coins: 40, items: { hammer: 0 }, kind: 'task', date: state.date }]
            : [];
        return Promise.resolve({ ok: true, state: copy(state), receipts: receipts });
    };
    return {
        notices: notices,
        calls: calls,
        releaseInfo: value => releaseInfo(value),
        controller: client.create(api, call, wallet, message => notices.push(message), () => now)
    };
}

(async function run() {
    let test = fixture({ holdInfo: true });
    const initial = test.controller.sync();
    assert.strictEqual(test.controller.model.status, 'loading',
        'plain info refresh must not be reward-pending');
    test.releaseInfo({ ok: true, state: copy(state), receipts: [] });
    await initial;

    test = fixture({});
    await test.controller.sync();
    assert.strictEqual(test.controller.record({
        id: 'solo:i:1', mode: 'solo', levelId: 1, date: state.date,
        cleared: 15, validMove: true, completed: true
    }).ok, true);
    await test.controller.sync();
    assert(test.notices.includes('每日任务已同步 · 09.23'));

    test = fixture({ recordReceipt: true, walletFailure: true });
    await test.controller.sync();
    test.controller.record({
        id: 'solo:i:1', mode: 'solo', levelId: 1, date: state.date,
        cleared: 15, validMove: true, completed: true
    });
    await test.controller.sync();
    assert.strictEqual(test.controller.model.status, 'error');
    assert(!test.notices.some(message => message.includes('已同步') || message.includes('每日金币 +')),
        'wallet failure must not announce task sync success');
    assert(test.notices.some(message => message.includes('待同步')),
        'wallet failure must expose a truthful pending notice');

    test = fixture({ failRetentionWrite: true });
    const recoveredSolo = test.controller.startSolo(1);
    assert(recoveredSolo && recoveredSolo.id,
        'transient allocation failure must retain an in-memory run');
    recoveredSolo.validMove = true;
    recoveredSolo.cleared = 12;
    assert.strictEqual(test.controller.finishSolo(recoveredSolo).ok, true);
    await test.controller.sync();
    assert(test.calls.some(call => call.action === 'retentionRecord' &&
        call.input.event.id === recoveredSolo.id));

    console.log('retention QA client: pending truth and transient storage recovery passed');
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
