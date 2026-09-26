/**
 * Combined retention-reward WAL tests. Run with: node test/retention-wallet.js
 */

const assert = require('assert');
const coinPath = require.resolve('../js/core/coin');

function loadCoin() {
    delete require.cache[coinPath];
    return require('../js/core/coin');
}

function installStore(values, failure) {
    const store = values || {};
    let failed = false;
    let matchingWrites = 0;
    global.wx = {
        getStorageSync: function (key) {
            if (failure && failure.readKey === key) throw new Error('injected read failure');
            return store[key];
        },
        setStorageSync: function (key, value) {
            if (failure && failure.key === key) matchingWrites++;
            if (!failed && failure && failure.key === key &&
                matchingWrites === (failure.occurrence || 1)) {
                failed = true;
                if (failure.timing === 'after') store[key] = value;
                throw new Error('injected write failure for ' + key);
            }
            store[key] = value;
        }
    };
    return store;
}

function assertRewardApplied(coin, store, id, coins, hammer) {
    assert.strictEqual(coin.getCoins(), coins);
    assert.deepStrictEqual(coin.getItems(), { hammer: hammer, bomb: 2, color: 3 });
    assert(store.match3_coin_receipts_v1.indexOf(id) !== -1);
    assert.strictEqual(store.match3_reward_pending_credit_v1, null);
}

// Day-seven reward applies both assets, persists the existing keys, and replays once.
let store = installStore({
    match3_coin_v1: 100,
    match3_items_v1: { hammer: 4, bomb: 2, color: 3 }
});
let coin = loadCoin();
let result = coin.creditRewardOnce('retention:signin:day7', {
    coins: 200,
    items: { hammer: 1 }
});
assert.deepStrictEqual(result, { ok: true, credited: true, balance: 300 });
assertRewardApplied(coin, store, 'retention:signin:day7', 300, 5);

installStore(store);
coin = loadCoin();
assert.deepStrictEqual(coin.creditRewardOnce('retention:signin:day7', {
    coins: 200,
    items: { hammer: 1 }
}), { ok: true, credited: false, balance: 300 });
assertRewardApplied(coin, store, 'retention:signin:day7', 300, 5);

// Coin-only and hammer-only receipts are supported; IDs share old receipt history.
assert.deepStrictEqual(coin.creditRewardOnce('retention:task:coins', {
    coins: 40,
    items: { hammer: 0 }
}), { ok: true, credited: true, balance: 340 });
assert.deepStrictEqual(coin.creditRewardOnce('retention:item-only', {
    coins: 0,
    items: { hammer: 2 }
}), { ok: true, credited: true, balance: 340 });
assert.deepStrictEqual(coin.creditOnce('retention:item-only', 99), {
    ok: true, credited: false, balance: 340
});
assert.strictEqual(coin.getItems().hammer, 7);

store = installStore({ match3_coin_v1: 10 });
coin = loadCoin();
assert.strictEqual(coin.creditRewardOnce('retention:coins-without-item-write', {
    coins: 5,
    items: { hammer: 0 }
}).ok, true);
assert.strictEqual(store.match3_items_v1, undefined);

store = installStore({ match3_items_v1: { hammer: 1, bomb: 0, color: 0 } });
coin = loadCoin();
assert.strictEqual(coin.creditRewardOnce('retention:item-without-coin-write', {
    coins: 0,
    items: { hammer: 1 }
}).ok, true);
assert.strictEqual(store.match3_coin_v1, undefined);

// Reject malformed rewards without writing an intent.
[
    null,
    { coins: -1, items: { hammer: 1 } },
    { coins: 1, items: { hammer: -1 } },
    { coins: 0, items: { hammer: 0 } },
    { coins: 1, items: {} },
    { coins: 1, items: { hammer: 1.5 } }
].forEach(function (reward, index) {
    assert.strictEqual(coin.creditRewardOnce('invalid-' + index, reward).ok, false);
});

// Every write boundary may fail before or after persistence. A restart and any
// wallet read recovers a recorded intent exactly once; a rejected intent retries.
[
    { key: 'match3_reward_pending_credit_v1', occurrence: 1, intent: true },
    { key: 'match3_coin_v1', occurrence: 1 },
    { key: 'match3_items_v1', occurrence: 1 },
    { key: 'match3_coin_receipts_v1', occurrence: 1 },
    { key: 'match3_reward_pending_credit_v1', occurrence: 2 }
].forEach(function (stage, stageIndex) {
    ['before', 'after'].forEach(function (timing) {
        const id = 'retention:failure:' + stageIndex + ':' + timing;
        const fresh = installStore({
            match3_coin_v1: 100,
            match3_items_v1: { hammer: 4, bomb: 2, color: 3 }
        }, { key: stage.key, occurrence: stage.occurrence, timing: timing });
        const current = loadCoin();
        assert.strictEqual(current.creditRewardOnce(id, {
            coins: 200,
            items: { hammer: 1 }
        }).ok, false, stage.key + ' should report the ' + timing + ' failure');

        installStore(fresh);
        const restarted = loadCoin();
        const rejectedIntent = stage.intent && timing === 'before';
        assert.deepStrictEqual(restarted.getItems(), rejectedIntent
            ? { hammer: 4, bomb: 2, color: 3 }
            : { hammer: 5, bomb: 2, color: 3 });
        assert.strictEqual(restarted.getCoins(), rejectedIntent ? 100 : 300);

        const retried = restarted.creditRewardOnce(id, {
            coins: 200,
            items: { hammer: 1 }
        });
        assert.deepStrictEqual(retried, rejectedIntent
            ? { ok: true, credited: true, balance: 300 }
            : { ok: true, credited: false, balance: 300 });
        assertRewardApplied(restarted, fresh, id, 300, 5);
    });
});

// An ordinary item mutation must finish the combined receipt first.
store = installStore({
    match3_coin_v1: 100,
    match3_items_v1: { hammer: 4, bomb: 2, color: 3 }
}, { key: 'match3_items_v1', timing: 'after' });
coin = loadCoin();
assert.strictEqual(coin.creditRewardOnce('retention:recover-before-item', {
    coins: 200,
    items: { hammer: 1 }
}).ok, false);
installStore(store);
coin = loadCoin();
assert.strictEqual(coin.addItem('bomb', 1), true);
assert.strictEqual(coin.useItem('hammer'), true);
assert.strictEqual(coin.getCoins(), 300);
assert.deepStrictEqual(coin.getItems(), { hammer: 4, bomb: 3, color: 3 });

// Failed or corrupt pending reads block every wallet path without using defaults.
store = {
    match3_coin_v1: 100,
    match3_items_v1: { hammer: 4, bomb: 2, color: 3 },
    match3_reward_pending_credit_v1: {
        receiptId: 'retention:unresolved', coins: 200, hammer: 1,
        balanceBefore: 100, balanceAfter: 300, hammerBefore: 4, hammerAfter: 5
    }
};
installStore(store, { readKey: 'match3_coin_receipts_v1' });
coin = loadCoin();
assert.strictEqual(coin.getCoins(), null);
assert.strictEqual(coin.getItems(), null);
assert.strictEqual(coin.addCoins(1), null);
assert.strictEqual(coin.spendCoins(1), false);
assert.strictEqual(coin.addItem('hammer', 1), false);
assert.strictEqual(coin.useItem('hammer'), false);
assert.strictEqual(store.match3_coin_v1, 100);
assert.deepStrictEqual(store.match3_items_v1, { hammer: 4, bomb: 2, color: 3 });

store = installStore({ match3_coin_v1: '100', match3_items_v1: { hammer: '4' } });
coin = loadCoin();
assert.strictEqual(coin.getCoins(), null);
assert.strictEqual(coin.getItems(), null);

console.log('retention wallet WAL: all tests passed');
