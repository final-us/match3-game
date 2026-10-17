/** Local completed-view journal. No ad/network calls and no unfinished-view recovery. */
const coin = require('./coin');
const heart = require('./heart');
const STORAGE_KEY = 'match3_ad_rewards_v1';
const DONE_LIMIT = 64;
let volatilePending = null;
const issued = new Map();

function validClaim(claim) {
    return claim && typeof claim.id === 'string' && /^ad-local-[1-9][0-9]*$/.test(claim.id) &&
        (claim.kind === 'heart_refill' && claim.item == null ||
        (claim.kind === 'shop_item' || claim.kind === 'solo_item') && Object.prototype.hasOwnProperty.call(coin.ITEM_DEFS, claim.item));
}
function sameClaim(a, b) {
    return a && b && a.id === b.id && a.kind === b.kind && a.item === b.item;
}
function readJournal() {
    const store = typeof wx !== 'undefined' ? wx : global.wx;
    if (!store || !store.getStorageSync || !store.setStorageSync) throw new Error('storage_unavailable');
    const saved = store.getStorageSync(STORAGE_KEY);
    if (saved == null || saved === '') return { sequence: 0, pending: null, done: [] };
    if (!Number.isSafeInteger(saved.sequence) || saved.sequence < 0 || !Array.isArray(saved.done) ||
        saved.done.some(claim => !validClaim(claim)) ||
        (saved.pending != null && (!validClaim(saved.pending) || !Number.isFinite(saved.pending.completedAt)))) {
        throw new Error('journal_invalid');
    }
    return { sequence: saved.sequence, pending: saved.pending && Object.assign({}, saved.pending),
        done: saved.done.map(claim => Object.assign({}, claim)) };
}
function writeJournal(journal) {
    const store = typeof wx !== 'undefined' ? wx : global.wx;
    store.setStorageSync(STORAGE_KEY, journal);
}
function result(ok, granted, pending, claim, reason) {
    const value = { ok: ok, granted: granted, pending: pending };
    if (claim) {
        value.kind = claim.kind;
        if (claim.item != null) value.item = claim.item;
    }
    if (reason) value.reason = reason;
    return value;
}
function hasPending() {
    if (volatilePending) return true;
    try { return !!readJournal().pending; } catch (error) { return true; }
}
function recover() {
    let pending = volatilePending;
    try {
        const journal = readJournal();
        if (pending && journal.done.some(claim => sameClaim(claim, pending))) {
            volatilePending = null;
            issued.delete(pending.id);
            return result(true, false, false, pending);
        }
        if (journal.pending) {
            if (pending && !sameClaim(pending, journal.pending)) {
                return result(false, false, true, pending, 'pending_conflict');
            }
            pending = journal.pending;
        }
        if (!pending) return result(true, false, false);
        volatilePending = pending;
        // Persist completion BEFORE any wallet/heart write. A failed first write
        // remains retryable only in this process unless the write actually committed.
        if (!journal.pending) {
            journal.pending = pending;
            writeJournal(journal);
        }
        const paid = pending.kind === 'shop_item'
            ? coin.claimRewardedItem(pending.item, pending.completedAt, pending.id)
            : pending.kind === 'solo_item'
                ? coin.claimSoloRewardedItem(pending.item, pending.id)
                : heart.claimRewardedHeart(pending.id);
        if (!paid.ok) return result(false, false, true, pending, paid.reason);
        journal.done.push({ id: pending.id, kind: pending.kind, item: pending.item });
        journal.done = journal.done.slice(-DONE_LIMIT);
        journal.pending = null;
        writeJournal(journal);
        volatilePending = null;
        issued.delete(pending.id);
        return result(true, paid.granted === true, false, pending);
    } catch (error) {
        return result(false, false, true, pending, 'storage_failed');
    }
}
function createClaim(kind, item) {
    if (kind !== 'heart_refill' && kind !== 'shop_item' && kind !== 'solo_item' ||
        (kind === 'shop_item' || kind === 'solo_item') && !Object.prototype.hasOwnProperty.call(coin.ITEM_DEFS, item)) {
        return { ok: false, reason: 'invalid_claim' };
    }
    const restored = recover();
    if (!restored.ok) return { ok: false, pending: true, reason: restored.reason };
    try {
        const journal = readJournal();
        if (journal.sequence === Number.MAX_SAFE_INTEGER) return { ok: false, reason: 'sequence_exhausted' };
        if (kind === 'shop_item') {
            const state = coin.getRewardedItemState();
            if (!state) return { ok: false, reason: 'storage_failed' };
            if (!state.remaining) return { ok: false, reason: 'limit' };
        } else if (kind === 'heart_refill' && heart.getHeartState().count >= heart.HEART_CONFIG.maxHeart) {
            return { ok: false, reason: 'full' };
        }
        journal.sequence++;
        writeJournal(journal);
        const claim = { id: 'ad-local-' + journal.sequence, kind: kind };
        if (kind === 'shop_item' || kind === 'solo_item') claim.item = item;
        issued.set(claim.id, Object.assign({}, claim));
        return { ok: true, claim: claim };
    } catch (error) { return { ok: false, reason: 'storage_failed' }; }
}
function complete(claim) {
    if (!validClaim(claim)) return result(false, false, hasPending(), null, 'invalid_claim');
    try {
        const journal = readJournal();
        if (journal.done.some(done => sameClaim(done, claim))) {
            if (sameClaim(volatilePending, claim)) volatilePending = null;
            issued.delete(claim.id);
            return result(true, false, hasPending(), claim);
        }
        const pending = volatilePending || journal.pending;
        if (pending) {
            if (!sameClaim(pending, claim)) return result(false, false, true, claim, 'pending_conflict');
            return recover();
        }
        if (!sameClaim(issued.get(claim.id), claim)) return result(false, false, false, claim, 'unknown_claim');
        // The local natural day is frozen here, never at request or retry time.
        volatilePending = Object.assign({}, claim, { completedAt: Date.now() });
        return recover();
    } catch (error) {
        // Even a journal read failure after completed viewing must retain intent.
        if (!volatilePending && sameClaim(issued.get(claim.id), claim)) {
            volatilePending = Object.assign({}, claim, { completedAt: Date.now() });
        }
        return result(false, false, true, claim, 'storage_failed');
    }
}
/** Forget a cancelled/failed view, never a completed reward intent. */
function cancel(claim) {
    if (!validClaim(claim) || !sameClaim(issued.get(claim.id), claim)) return false;
    try {
        if (sameClaim(volatilePending, claim) || sameClaim(readJournal().pending, claim)) return false;
        return issued.delete(claim.id);
    } catch (error) { return false; }
}
module.exports = { cancel: cancel, createClaim: createClaim, complete: complete, recover: recover, hasPending: hasPending };
