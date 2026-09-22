/** 单设备每日纪录及待提交日志。奖励仅消费服务端收据，不根据本地分数发奖。 */
const KEY = 'match3_daily_progress_v1';
const coin = require('./coin');
const engine = require('./daily-challenge');
const reward = engine.DAILY_RULES.reward;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const count = value => Number.isSafeInteger(value) && value >= 0;
const dateKey = value => typeof value === 'string' && datePattern.test(value);
function storage() { return typeof wx !== 'undefined' ? wx : typeof global !== 'undefined' ? global.wx : null; }
function position(value) { return value && Number.isInteger(value.row) && Number.isInteger(value.column) && value.row >= 0 && value.row < 8 && value.column >= 0 && value.column < 8; }
function validActive(run) {
    return run && typeof run.runId === 'string' && run.runId.length > 0 && engine.isRecordedChallenge(run.challenge) &&
        Array.isArray(run.moves) && run.moves.length <= 25 && run.moves.every(move => move && position(move.from) && position(move.to));
}
function validRun(run) {
    return run && typeof run.runId === 'string' && run.runId.length > 0 && engine.isRecordedChallenge(run.challenge) &&
        Array.isArray(run.moves) && run.moves.length === 25 && run.moves.every(move => move && position(move.from) && position(move.to)) &&
        count(run.score) && count(run.maxCascade) && count(run.specialComboCount);
}
function read() {
    const store = storage();
    if (!store || !store.getStorageSync || !store.setStorageSync) return { ok: false, reason: 'storage_unavailable' };
    try {
        const saved = store.getStorageSync(KEY);
        if (saved == null || saved === '') return { ok: true, best: {}, claimed: {}, pending: null, active: null };
        if (!saved || typeof saved !== 'object' || Array.isArray(saved) ||
            !saved.best || typeof saved.best !== 'object' || Array.isArray(saved.best) ||
            !saved.claimed || typeof saved.claimed !== 'object' || Array.isArray(saved.claimed) ||
            !Object.keys(saved.best).every(date => dateKey(date) && count(saved.best[date])) ||
            !Object.keys(saved.claimed).every(date => dateKey(date) && saved.claimed[date] === true) ||
            !(saved.pending === null || validRun(saved.pending)) ||
            !(saved.active == null || validActive(saved.active))) return { ok: false, reason: 'storage_invalid' };
        return Object.assign({ ok: true, active: null }, JSON.parse(JSON.stringify(saved)));
    } catch (e) { return { ok: false, reason: 'storage_read_failed' }; }
}
function write(state) {
    try {
        storage().setStorageSync(KEY, { best: state.best, claimed: state.claimed, pending: state.pending, active: state.active || null });
        return { ok: true };
    } catch (e) { return { ok: false, reason: 'storage_write_failed' }; }
}
function saveActive(run) {
    const state = read();
    if (!state.ok) return state;
    if (!validActive(run)) return {ok:false,reason:'invalid_active'};
    if (state.pending || (state.active && state.active.runId !== run.runId)) return {ok:false,reason:'active_exists'};
    state.active = JSON.parse(JSON.stringify(run));
    return write(state);
}
function discardActive(runId) {
    const state = read();
    if (!state.ok) return state;
    if (!state.active || state.active.runId !== runId) return {ok:false,reason:'active_changed'};
    state.active = null;
    return write(state);
}
function savePending(run) {
    const state = read();
    if (!state.ok) return state;
    if (!validRun(run)) return { ok: false, reason: 'invalid_run' };
    if (state.pending) {
        return state.pending.runId === run.runId ? { ok: true } : { ok: false, reason: 'pending_exists' };
    }
    state.pending = JSON.parse(JSON.stringify(run));
    if (state.active && state.active.runId === run.runId) state.active = null;
    return write(state);
}
function finishPending(result) {
    const state = read();
    if (!state.ok) return state;
    const pending = state.pending;
    if (!pending) return { ok: false, reason: 'no_pending' };
    if (!result || result.ok !== true || result.date !== pending.challenge.date ||
        (result.runId && result.runId !== pending.runId) || !count(result.score) || typeof result.qualified !== 'boolean') {
        return { ok: false, reason: 'invalid_result' };
    }
    if (result.qualified) {
        if (result.coinReward !== pending.challenge.reward) return { ok: false, reason: 'invalid_reward' };
        const credit = coin.creditOnce(result.settlementId, result.coinReward);
        if (!credit.ok) return credit;
        state.claimed[result.date] = true;
    } else if (result.coinReward !== 0 || result.settlementId) {
        return { ok: false, reason: 'invalid_reward' };
    }
    state.best[result.date] = Math.max(state.best[result.date] || 0, result.score);
    state.pending = null;
    return write(state);
}
function rememberReceipt(date, receiptId, amount) {
    const state = read();
    if (!state.ok) return state;
    if (!dateKey(date) || (amount !== reward && amount !== 300)) return { ok: false, reason: 'invalid_reward' };
    const credit = coin.creditOnce(receiptId, amount);
    if (!credit.ok) return credit;
    state.claimed[date] = true;
    return write(state);
}
// 仅在用户明确放弃服务器已拒绝的过期/缺失记录后调用。
function discardPending(runId) {
    const state = read();
    if (!state.ok) return state;
    if (!state.pending || state.pending.runId !== runId) return {ok:false,reason:'pending_changed'};
    state.pending = null;
    return write(state);
}
module.exports = { KEY, read, saveActive, discardActive, savePending, finishPending, rememberReceipt, discardPending };
