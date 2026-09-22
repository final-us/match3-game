/**
 * Receipt-credit recovery tests. Run with: node test/coin-receipts.js
 */

const assert = require('assert');
const coinPath = require.resolve('../js/core/coin');

function loadCoin() {
    delete require.cache[coinPath];
    return require('../js/core/coin');
}

function installStore(values, failKey, failTiming, failOccurrence) {
    const store = values || {};
    let failed = false;
    let matchingWrites = 0;
    global.wx = {
        getStorageSync: function (key) { return store[key]; },
        setStorageSync: function (key, value) {
            if (key === failKey) matchingWrites++;
            if (!failed && key === failKey && matchingWrites === (failOccurrence || 1)) {
                failed = true;
                if (failTiming === 'after') store[key] = value;
                throw new Error('injected storage failure for ' + key + ' (' + failTiming + ')');
            }
            store[key] = value;
        }
    };
    return store;
}

function assertReceiptHistory(coin, store, receiptId) {
    assert(Array.isArray(store[coin.COIN_RECEIPT_HISTORY_KEY]), 'receipt history should be an array');
    assert(store[coin.COIN_RECEIPT_HISTORY_KEY].indexOf(receiptId) !== -1, 'receipt should be recorded');
    assert.strictEqual(store[coin.COIN_PENDING_CREDIT_KEY], null, 'pending intent should be cleared');
}

// Existing users retain their integer v1 balance, with no balance-key migration.
let store = installStore({ match3_coin_v1: 730 });
let coin = loadCoin();
assert.strictEqual(coin.getCoins(), 730);
assert.strictEqual(typeof store.match3_coin_v1, 'number');

let result = coin.creditOnce('settlement-round-1', 150);
assert.deepStrictEqual(result, { ok: true, credited: true, balance: 880 });
assert.strictEqual(store.match3_coin_v1, 880);
assertReceiptHistory(coin, store, 'settlement-round-1');

result = coin.creditOnce('settlement-round-1', 150);
assert.deepStrictEqual(result, { ok: true, credited: false, balance: 880 });
result = coin.creditOnce('settlement-round-2', 30);
assert.deepStrictEqual(result, { ok: true, credited: true, balance: 910 });
assert.strictEqual(coin.getCoins(), 910);
assert.strictEqual(coin.creditOnce('', 10).ok, false);
assert.strictEqual(coin.creditOnce('settlement-invalid', 0).ok, false);
assert.strictEqual(coin.getCoins(), 910);

// wx returns '' for a missing key. Receipt history retains accepted IDs so an
// old settlement cannot become creditable again after later rounds.
store = installStore({
    match3_coin_v1: 0,
    match3_coin_receipts_v1: '',
    match3_coin_pending_credit_v1: ''
});
coin = loadCoin();
for (let i = 0; i <= 100; i++) {
    assert.strictEqual(coin.creditOnce('settlement-bounded-' + i, 1).credited, true);
}
assert.strictEqual(store[coin.COIN_RECEIPT_HISTORY_KEY].length, 101);
assert.deepStrictEqual(coin.creditOnce('settlement-bounded-0', 1), {
    ok: true, credited: false, balance: 101
});
assert.strictEqual(coin.getCoins(), 101);

// A write may fail before or after it reaches storage. Every marker is safe to
// restart from: pending intent, balance, receipt history, and cleanup.
[
    { key: 'match3_coin_pending_credit_v1', occurrence: 1, pendingWrite: true },
    { key: 'match3_coin_v1', occurrence: 1 },
    { key: 'match3_coin_receipts_v1', occurrence: 1 },
    { key: 'match3_coin_pending_credit_v1', occurrence: 2 }
].forEach(function (stage, index) {
    ['before', 'after'].forEach(function (timing) {
        const receiptId = 'settlement-failure-' + index + '-' + timing;
        const fresh = installStore({ match3_coin_v1: 100 }, stage.key, timing, stage.occurrence);
        const current = loadCoin();
        const failed = current.creditOnce(receiptId, 50);
        assert.strictEqual(failed.ok, false, stage.key + ' should fail ' + timing + ' its write');

        // Restart and any wallet read must settle the interrupted transaction.
        installStore(fresh);
        const restarted = loadCoin();
        const afterRestart = restarted.getCoins();
        const pendingWriteWasRejected = stage.pendingWrite && timing === 'before';
        assert.strictEqual(afterRestart, pendingWriteWasRejected ? 100 : 150,
            stage.key + ' should recover the correct balance after ' + timing + ' failure');

        const retried = restarted.creditOnce(receiptId, 50);
        if (pendingWriteWasRejected) {
            assert.deepStrictEqual(retried, { ok: true, credited: true, balance: 150 });
        } else {
            assert.deepStrictEqual(retried, { ok: true, credited: false, balance: 150 });
            assertReceiptHistory(restarted, fresh, receiptId);
        }
    });
});

// Ordinary wallet writes are allowed only after the pending credit has settled.
store = installStore({ match3_coin_v1: 100 }, 'match3_coin_v1', 'after');
coin = loadCoin();
assert.strictEqual(coin.creditOnce('settlement-recover-before-spend', 50).ok, false);
installStore(store);
coin = loadCoin();
assert.strictEqual(coin.spendCoins(20), true);
assert.strictEqual(coin.addCoins(10), 140);
assert.strictEqual(coin.getCoins(), 140);

// If an interrupted receipt cannot be recovered, a spend must not inspect and
// deduct the old balance.
store = {
    match3_coin_v1: 100,
    match3_coin_pending_credit_v1: {
        receiptId: 'settlement-unresolved', amount: 50, balanceBefore: 100, balanceAfter: 150
    }
};
global.wx = {
    getStorageSync: function (key) {
        if (key === 'match3_coin_receipts_v1') throw new Error('injected receipt read failure');
        return store[key];
    },
    setStorageSync: function (key, value) { store[key] = value; }
};
coin = loadCoin();
assert.strictEqual(coin.getCoins(), null);
assert.strictEqual(coin.addCoins(1), null);
assert.strictEqual(coin.spendCoins(100), false);
assert.strictEqual(store.match3_coin_v1, 100);

console.log('coin receipt recovery: all tests passed');
