'use strict';
const assert = require('assert');
const file = require.resolve('../js/core/daily-progress');
let data = {}, failRead = false, failKey = '', postWrite = false;
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
global.wx = {
    getStorageSync(key) { if (failRead) throw new Error('read failed'); return key in data ? copy(data[key]) : ''; },
    setStorageSync(key, value) {
        if (key === failKey && !postWrite) throw new Error('write failed');
        data[key] = copy(value);
        if (key === failKey) throw new Error('ack lost');
    }
};
let daily = require(file);
const coin = require('../js/core/coin');
const challenge = date => require('../js/core/daily-challenge').challengeForDate(date);
const run = { runId: 'r1', challenge: challenge('2026-09-21'),
    moves: Array.from({ length: 25 }, () => ({ from: { row: 0, column: 0 }, to: { row: 0, column: 1 } })),
    score: 5000, maxCascade: 3, specialComboCount: 1 };
const result = { ok: true, runId: 'r1', date: '2026-09-21', score: 5000, qualified: true, settlementId: 'daily-1', coinReward: 500 };
assert(daily.read().ok);
failKey = daily.KEY;
assert(!daily.savePending(run).ok);
assert.strictEqual(daily.read().pending, null, 'failed write is not a saved result');
failKey = '';
assert(daily.savePending(run).ok);
assert(!daily.savePending({ ...run, runId: 'new' }).ok, 'must preserve previous pending');
assert(!daily.finishPending({ ...result, date: '2026-09-22' }).ok);
assert.strictEqual(coin.getCoins(), 0, 'wrong date never credited');
assert(!daily.finishPending({ ...result, coinReward: 100 }).ok, 'reject stale reward amount');
assert(!daily.finishPending({ ...result, coinReward: 999 }).ok, 'reject unexpected reward amount');
failKey = 'match3_coin_pending_credit_v1';
assert(!daily.finishPending(result).ok);
assert(daily.read().pending, 'failed receipt keeps replay');
failKey = daily.KEY;
assert(!daily.finishPending(result).ok);
assert.strictEqual(coin.getCoins(), 500, 'credit persisted before daily save failure');
assert(daily.read().pending);
delete require.cache[file]; daily = require(file); failKey = '';
assert(daily.finishPending(result).ok);
assert.strictEqual(coin.getCoins(), 500, 'restart cannot grant receipt twice');
assert.strictEqual(daily.read().pending, null);
assert(!daily.finishPending(result).ok);
assert(daily.rememberReceipt(result.date, result.settlementId, 500).ok);
assert.strictEqual(coin.getCoins(), 500);
assert(daily.savePending({ ...run, runId: 'r2', challenge: challenge('2026-09-22') }).ok);
assert(daily.finishPending({ ok: true, runId: 'r2', date: '2026-09-22', score: 100, qualified: false, coinReward: 0 }).ok);
assert.strictEqual(daily.read().pending, null, 'nonqualifying completion clears pending without reward');
assert.strictEqual(daily.read().best['2026-09-21'], 5000);
assert.strictEqual(daily.read().best['2026-09-22'], 100);
assert(!daily.read().claimed['2026-09-22']);
assert.strictEqual(coin.getCoins(), 500);
// A platform write that completed but threw may be retried safely.
failKey = daily.KEY; postWrite = true;
assert(!daily.savePending({ ...run, runId: 'r3' }).ok);
failKey = ''; postWrite = false;
assert(daily.savePending({ ...run, runId: 'r3' }).ok);
assert.strictEqual(daily.read().pending.runId, 'r3');
failRead = true;
assert(!daily.read().ok); assert(!daily.savePending(run).ok);
failRead = false; data[daily.KEY] = { best: {}, claimed: {}, pending: { runId: 'bad' } };
assert(!daily.read().ok); assert(!daily.savePending(run).ok, 'corrupt log must not be overwritten');
data = {};
const active = {...run,moves:run.moves.slice(0,3)};
assert(daily.saveActive(active).ok);
delete require.cache[file]; daily=require(file);
assert.strictEqual(daily.read().active.moves.length,3,'partial progress survives reload');
failKey=daily.KEY;
assert(!daily.saveActive({...active,moves:run.moves.slice(0,4)}).ok);
assert.strictEqual(daily.read().active.moves.length,3,'failed write preserves confirmed local prefix');
failKey='';
assert(daily.savePending(run).ok);
assert.strictEqual(daily.read().active,null,'completed journal moves to pending atomically');
assert(!daily.saveActive(active).ok,'pending result blocks new active progress');
console.log('daily progress storage/restart/receipt/date tests passed');
