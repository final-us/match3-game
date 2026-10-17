const assert = require('assert');
const paths = ['coin', 'heart', 'ad-rewards'].map(name => require.resolve('../js/core/' + name));
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const realNow = Date.now;
let now = new Date(2026, 9, 14, 23, 59).getTime();
Date.now = () => now;
let data, writes, reads, failWrite, failRead, afterWrite;
let coin, heart, rewards;
function reload() {
    paths.forEach(path => delete require.cache[path]);
    coin = require(paths[0]); heart = require(paths[1]); rewards = require(paths[2]);
}
function setup() {
    data = { match3_items_v1: { hammer: 2, bomb: 3, color: 4 }, match3_coin_v1: 2000,
        match3_heart_v1: { count: 2, lastLossTime: now, refundPending: true } };
    writes = reads = 0; failWrite = failRead = 0; afterWrite = false;
    global.wx = {
        getStorageSync(key) {
            reads++;
            if (reads === failRead) throw new Error('read_failure');
            return clone(data[key]);
        },
        setStorageSync(key, value) {
            writes++;
            if (writes === failWrite && !afterWrite) throw new Error('write_failure');
            data[key] = clone(value);
            if (writes === failWrite && afterWrite) throw new Error('write_after_failure');
        }
    };
    reload();
}
function claim(kind) {
    const created = rewards.createClaim(kind, kind !== 'heart_refill' ? 'bomb' : undefined);
    assert.strictEqual(created.ok, true);
    return created.claim;
}
function checkAward(kind) {
    if (kind !== 'heart_refill') {
        assert.strictEqual(coin.getItems().bomb, 4);
        assert.strictEqual(coin.getRewardedItemState(now).count, kind === 'shop_item' ? 1 : 0);
    } else assert.strictEqual(heart.getHeartState().count, 3);
}
let cases = 0;
try {
    for (const kind of ['shop_item', 'solo_item', 'heart_refill']) {
        setup(); const baseline = claim(kind); writes = reads = 0;
        const done = rewards.complete(baseline);
        assert.deepStrictEqual(done, Object.assign({ ok: true, granted: true, pending: false, kind },
            kind !== 'heart_refill' ? { item: 'bomb' } : {}));
        const writeCount = writes, readCount = reads;
        checkAward(kind);
        assert.strictEqual(rewards.complete(baseline).granted, false);
        reload(); assert.strictEqual(rewards.complete(baseline).granted, false);
        assert.strictEqual(rewards.recover().granted, false);
        for (let point = 1; point <= writeCount; point++) {
            for (const after of [false, true]) {
                for (const restart of [false, true]) {
                    setup(); const c = claim(kind); writes = 0;
                    failWrite = point; afterWrite = after;
                    const failed = rewards.complete(c);
                    assert.strictEqual(failed.ok, false);
                    assert.strictEqual(failed.pending, true);
                    assert.strictEqual(rewards.hasPending(), true);
                    failWrite = 0;
                    if (restart) reload();
                    const recovered = rewards.recover();
                    assert.strictEqual(recovered.ok, true);
                    // First intent write before-commit + restart cannot prove viewing.
                    if (restart && point === 1 && !after) {
                        assert.strictEqual(recovered.granted, false);
                        assert.strictEqual(kind !== 'heart_refill' ? coin.getItems().bomb : heart.getHeartState().count,
                            kind !== 'heart_refill' ? 3 : 2);
                        assert.strictEqual(rewards.complete(c).ok, false);
                    } else {
                        checkAward(kind);
                        assert.strictEqual(rewards.complete(c).granted, false);
                    }
                    assert.strictEqual(rewards.recover().granted, false);
                    cases++;
                }
            }
        }
        for (let point = 1; point <= readCount; point++) {
            setup(); const c = claim(kind); reads = 0; failRead = point;
            const failed = rewards.complete(c);
            assert.strictEqual(failed.ok, false);
            assert.strictEqual(failed.pending, true);
            failRead = 0;
            assert.strictEqual(rewards.recover().ok, true);
            checkAward(kind); cases++;
        }
        setup(); const unviewed = claim(kind); reload();
        assert.strictEqual(rewards.recover().granted, false);
        assert.strictEqual(rewards.complete(unviewed).ok, false);
        const next = claim(kind); assert.notStrictEqual(next.id, unviewed.id);
        // Claim allocation itself must fail closed at every read/write point.
        setup(); writes = reads = 0; claim(kind);
        const createWrites = writes, createReads = reads;
        for (let point = 1; point <= createWrites; point++) {
            for (const after of [false, true]) {
                setup(); failWrite = point; afterWrite = after;
                assert.strictEqual(rewards.createClaim(kind, 'bomb').ok, false);
                failWrite = 0; reload(); assert.strictEqual(rewards.recover().granted, false);
                cases++;
            }
        }
        for (let point = 1; point <= createReads; point++) {
            setup(); failRead = point;
            assert.strictEqual(rewards.createClaim(kind, 'bomb').ok, false);
            failRead = 0; assert.strictEqual(rewards.recover().granted, false); cases++;
        }
    }
    // Cancelled solo views and allocation alone never pay, including after reload.
    setup(); const soloCancelled = claim('solo_item');
    assert.strictEqual(rewards.cancel(soloCancelled), true);
    assert.strictEqual(rewards.complete(soloCancelled).ok, false);
    reload(); assert.strictEqual(rewards.recover().granted, false);
    assert.deepStrictEqual(coin.getItems(), { hammer: 2, bomb: 3, color: 4 });
    // Solo does not inspect heart fullness or shop quota, and grants every item >10 times.
    setup(); data.match3_heart_v1.count = 5;
    for (let i = 0; i < 10; i++) coin.claimRewardedItem('hammer', now, 'shop-full-' + i);
    const shopBefore = clone(data.match3_rewarded_items_v1);
    for (const type of ['hammer', 'bomb', 'color']) {
        for (let i = 0; i < 12; i++) {
            const c = rewards.createClaim('solo_item', type).claim;
            assert(c);
            assert.strictEqual(rewards.complete(c).granted, true);
            assert.strictEqual(rewards.complete(c).granted, false);
        }
    }
    assert.deepStrictEqual(coin.getItems(), { hammer: 24, bomb: 15, color: 16 });
    assert.deepStrictEqual(data.match3_rewarded_items_v1, shopBefore);
    assert.strictEqual(rewards.createClaim('shop_item', 'bomb').reason, 'limit');
    assert.strictEqual(coin.getCoins(), 2000);
    // Ordinary wallet mutations settle a solo WAL first; journal replay cannot re-grant.
    setup(); const soloInterleaved = claim('solo_item'); writes = 0; failWrite = 3;
    assert.strictEqual(rewards.complete(soloInterleaved).ok, false); failWrite = 0;
    assert.strictEqual(coin.useItem('bomb'), true);
    assert.strictEqual(coin.addItem('color', 2), true);
    assert.strictEqual(coin.spendCoins(1000), true);
    reload(); assert.strictEqual(rewards.recover().ok, true);
    assert.strictEqual(rewards.complete(soloInterleaved).granted, false);
    assert.deepStrictEqual(coin.getItems(), { hammer: 2, bomb: 3, color: 6 });
    assert.strictEqual(data.match3_rewarded_items_v1, undefined);
    // Malformed external inputs fail before writes; receipts share wallet deduplication.
    setup();
    for (const type of ['invalid', '__proto__', 'constructor', null]) {
        assert.strictEqual(rewards.createClaim('solo_item', type).ok, false);
        assert.strictEqual(coin.claimSoloRewardedItem(type, 'solo-invalid').ok, false);
    }
    for (const id of [undefined, '', 123, 'x'.repeat(161)]) {
        assert.strictEqual(coin.claimSoloRewardedItem('bomb', id).ok, false);
    }
    assert.strictEqual(writes, 0);
    assert.strictEqual(coin.claimSoloRewardedItem('color', 'solo-shared').granted, true);
    assert.strictEqual(coin.claimSoloRewardedItem('bomb', 'solo-shared').granted, false);
    assert.strictEqual(coin.creditOnce('solo-shared', 100).credited, false);
    assert.strictEqual(coin.creditOnce('server-shared', 100).credited, true);
    assert.strictEqual(coin.claimSoloRewardedItem('bomb', 'server-shared').granted, false);
    assert.deepStrictEqual(coin.getItems(), { hammer: 2, bomb: 3, color: 5 });
    setup(); data.match3_items_v1.bomb = Number.MAX_SAFE_INTEGER;
    assert.strictEqual(coin.claimSoloRewardedItem('bomb', 'overflow').reason, 'item_balance_invalid');
    assert.strictEqual(writes, 0);
    // A stuck solo WAL closes ordinary wallet operations until storage recovers.
    setup(); const stuck = claim('solo_item'); writes = 0; failWrite = 3;
    assert.strictEqual(rewards.complete(stuck).ok, false); failWrite = 0;
    data.match3_items_v1.bomb = 9;
    assert.strictEqual(coin.getItems(), null);
    assert.strictEqual(coin.addItem('color', 1), false);
    assert.strictEqual(coin.spendCoins(1), false);
    assert.strictEqual(rewards.recover().reason, 'pending_item_conflict');
    data.match3_items_v1.bomb = 3;
    reload(); assert.strictEqual(rewards.recover().ok, true);
    checkAward('solo_item');
    // Legacy WAL (no kind) and quota shape remain recoverable alongside the journal.
    setup();
    const legacyDay = '2026-10-14';
    const legacyQuota = { date: legacyDay, count: 2, receipts: ['ad-local-1'] };
    data.match3_rewarded_items_v1 = { date: legacyDay, count: 1 };
    data.match3_rewarded_item_pending_v1 = {
        type: 'bomb', receiptId: 'ad-local-1', before: 3, after: 4, quota: legacyQuota
    };
    data.match3_ad_rewards_v1 = { sequence: 1, done: [], pending: {
        id: 'ad-local-1', kind: 'shop_item', item: 'bomb', completedAt: now
    } };
    reload(); assert.strictEqual(rewards.recover().ok, true);
    assert.strictEqual(coin.getItems().bomb, 4);
    assert.strictEqual(coin.getRewardedItemState(new Date(2026, 9, 14)).count, 2);
    const afterLegacy = claim('solo_item');
    assert.strictEqual(rewards.complete(afterLegacy).granted, true);
    assert.strictEqual(coin.getItems().bomb, 5);
    assert.deepStrictEqual(data.match3_rewarded_items_v1, legacyQuota);
    // Shared receipt history outlives the journal's bounded done list.
    setup(); let oldSolo;
    for (let i = 0; i < 70; i++) {
        const c = claim('solo_item'); if (i === 0) oldSolo = c;
        assert.strictEqual(rewards.complete(c).ok, true);
    }
    reload(); assert.strictEqual(rewards.complete(oldSolo).ok, false);
    assert.strictEqual(coin.claimSoloRewardedItem('bomb', oldSolo.id).granted, false);
    assert.strictEqual(coin.getItems().bomb, 73);
    // Cross-day retry charges the completion day even after today's quota read.
    for (const firstWriteFailure of [true, false]) {
        setup(); const day = now; const c = claim('shop_item'); writes = 0;
        failWrite = firstWriteFailure ? 1 : 3;
        assert.strictEqual(rewards.complete(c).ok, false); failWrite = 0;
        now += 24 * 60 * 60 * 1000;
        if (!firstWriteFailure) reload();
        coin.getRewardedItemState(now);
        assert.strictEqual(rewards.recover().ok, true);
        assert.strictEqual(coin.getRewardedItemState(day).count, 1);
        assert.strictEqual(coin.getRewardedItemState(now).count, 0);
        assert.strictEqual(rewards.complete(c).granted, false);
        const tomorrow = claim('shop_item'); rewards.complete(tomorrow);
        assert.strictEqual(coin.getRewardedItemState(now).count, 1); now = day;
    }
    // Request before midnight, completion after midnight belongs to the latter day.
    setup(); const requestedAt = now; const overnight = claim('shop_item');
    now += 24 * 60 * 60 * 1000; rewards.complete(overnight);
    assert.strictEqual(coin.getRewardedItemState(requestedAt).count, 0);
    assert.strictEqual(coin.getRewardedItemState(now).count, 1); now = requestedAt;
    setup();
    for (let i = 0; i < 10; i++) assert.strictEqual(coin.claimRewardedItem('hammer', now, 'test-' + i).ok, true);
    assert.strictEqual(rewards.createClaim('shop_item', 'bomb').reason, 'limit');
    assert.strictEqual(coin.claimRewardedItem('hammer', now, 'test-0').ok, true);
    setup(); const capped = claim('shop_item');
    for (let i = 0; i < 10; i++) coin.claimRewardedItem('hammer', now, 'cap-' + i);
    assert.strictEqual(rewards.complete(capped).reason, 'limit');
    assert.strictEqual(rewards.hasPending(), true);
    now += 24 * 60 * 60 * 1000;
    assert.strictEqual(rewards.recover().reason, 'limit'); now -= 24 * 60 * 60 * 1000;
    // Wallet operations recover the item WAL before altering balances or inventory.
    setup(); const interleaved = claim('shop_item'); writes = 0; failWrite = 3;
    rewards.complete(interleaved); failWrite = 0;
    assert.strictEqual(coin.useItem('bomb'), true);
    assert.strictEqual(coin.addItem('color', 2), true);
    assert.strictEqual(coin.spendCoins(1000), true);
    assert.strictEqual(coin.creditRewardOnce('server-1', { coins: 50, items: { hammer: 1 } }).ok, true);
    reload(); const alreadyPaid = rewards.recover();
    assert.strictEqual(alreadyPaid.ok, true); assert.strictEqual(alreadyPaid.granted, false);
    assert.strictEqual(alreadyPaid.kind, 'shop_item');
    assert.deepStrictEqual(coin.getItems(), { hammer: 3, bomb: 3, color: 6 });
    assert.strictEqual(coin.getCoins(), 1050);
    assert.strictEqual(coin.getRewardedItemState(now).count, 1);
    // Atomic heart receipt survives post-write errors and ordinary consumption/refund.
    setup(); const hc = claim('heart_refill'); writes = 0; failWrite = 2; afterWrite = true;
    rewards.complete(hc); failWrite = 0;
    heart.consumeHeart(true); heart.refundConsumedHeart(); heart.addHeart(1);
    reload(); rewards.recover(); assert.strictEqual(heart.getHeartState().count, 4);
    // Retry complete itself; an already-written core receipt reports no new award.
    for (const kind of ['shop_item', 'solo_item', 'heart_refill']) {
        setup(); const c = claim(kind); writes = 0;
        failWrite = kind !== 'heart_refill' ? 6 : 3;
        assert.strictEqual(rewards.complete(c).ok, false); failWrite = 0; reload();
        const retried = rewards.complete(c);
        assert.strictEqual(retried.ok, true); assert.strictEqual(retried.granted, false);
        assert.strictEqual(retried.kind, kind); checkAward(kind);
    }
    setup(); const retry = claim('shop_item'); writes = 0; failWrite = 3;
    assert.strictEqual(rewards.complete(retry).ok, false); failWrite = 0; reload();
    assert.strictEqual(rewards.recover().granted, true);
    setup(); const fills = claim('heart_refill'); now += 30 * 60 * 1000;
    assert.strictEqual(rewards.complete(fills).ok, true);
    assert.strictEqual(heart.getHeartState().count, 5);
    assert.strictEqual(heart.getHeartState().lastLossTime, 0);
    heart.consumeHeart(); rewards.complete(fills); assert.strictEqual(heart.getHeartState().count, 4);
    setup(); const cancelled = claim('shop_item');
    assert.strictEqual(rewards.cancel(cancelled), true);
    assert.strictEqual(rewards.cancel(cancelled), false);
    assert.strictEqual(rewards.complete(cancelled).ok, false);
    assert.strictEqual(coin.getItems().bomb, 3);
    const completed = claim('shop_item'); writes = 0; failWrite = 1;
    assert.strictEqual(rewards.complete(completed).reason, 'storage_failed'); failWrite = 0;
    assert.strictEqual(rewards.cancel(completed), false);
    assert.strictEqual(rewards.recover().granted, true);
    setup(); data.match3_heart_v1.count = 4;
    let oldest;
    for (let i = 0; i < 70; i++) {
        const c = claim('heart_refill'); if (i === 0) oldest = c;
        assert.strictEqual(rewards.complete(c).ok, true);
        heart.consumeHeart();
    }
    assert.strictEqual(data.match3_ad_rewards_v1.done.length, 64);
    assert.strictEqual(rewards.complete(oldest).ok, false);
    reload(); assert.strictEqual(rewards.complete(oldest).ok, false);
    assert.strictEqual(heart.getHeartState().count, 4);
    assert.strictEqual(rewards.createClaim('invalid').ok, false);
    console.log('ad-rewards: passed (' + cases + ' fault/reload cases plus day/limit/interleaving checks)');
} finally { Date.now = realNow; }
