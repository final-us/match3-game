'use strict';

const KEYS = ['freeze', 'disturb', 'reflect', 'cheer'];
const LEGACY_KEYS = KEYS.slice(0, 2);
const INITIAL = { freeze: 2, disturb: 1, reflect: 1, cheer: 1 };
function keys(b) { return b.itemRulesVersion === 3 ? KEYS : LEGACY_KEYS; }
function configure(b, response) {
    const version = response.itemRulesVersion === 3 ? 3 : 1;
    if (b.itemRulesVersion === version) return;
    b.itemRulesVersion = version;
    b.items = version === 3 ? { ...INITIAL } : { freeze: 1, disturb: 2 };
}
function serverNow(b) { return Date.now() + (b.serverOffset || 0); }
function cooldowns(b, response, query) {
    const prefix = query ? 'my' : '';
    const field = name => prefix ? prefix + name[0].toUpperCase() + name.slice(1) : name;
    b.itemCooldownUntil = Number(response[field('itemCooldownUntil')]) || 0;
    b.activeEffectUntil = Number(response[field('activeEffectUntil')]) || 0;
    const deadlines = response[field('itemCooldowns')];
    // Absence means an older cloud function still enforces shared cooldowns.
    b.itemCooldowns = deadlines && typeof deadlines === 'object' ? {} : null;
    if (b.itemCooldowns) for (const key of keys(b)) b.itemCooldowns[key] = Number(deadlines[key]) || 0;
}
function cooldownUntil(b, item) {
    return b.itemCooldowns ? b.itemCooldowns[item] || 0 : Math.max(b.itemCooldownUntil || 0, b.activeEffectUntil || 0);
}
function cooldownRemaining(b, now) {
    const remaining = {};
    for (const key of keys(b)) remaining[key] = Math.max(0, cooldownUntil(b, key) - now);
    return remaining;
}
function sample(b, score) {
    if (b.itemRulesVersion !== 3 || score <= b.lastSampleScore) return;
    // Midpoint clock correction can be half a millisecond; the wire timestamp is an integer.
    const at = Math.max(b.lastSampleAt || 0, Math.floor(serverNow(b)));
    if (at < b.startTime || at >= b.endTime) return;
    b.scoreSamples.push({ seq: ++b.nextScoreSeq, score: score, at: at });
    b.lastSampleScore = score;
    b.lastSampleAt = at;
}
function acknowledge(b, response) {
    if (b.itemRulesVersion !== 3) return;
    const seq = response.ackSeq === undefined ? response.myScoreSeq : response.ackSeq;
    const raw = response.rawScore === undefined ? response.myRawScore : response.rawScore;
    if (!Number.isSafeInteger(seq) || seq < b.scoreAckSeq || !Number.isSafeInteger(raw) || !Number.isSafeInteger(response.myScore)) return;
    b.scoreAckSeq = seq;
    b.syncedScore = raw;
    b.confirmedScore = response.myScore;
    b.scoreSamples = b.scoreSamples.filter(s => s.seq > seq);
    return true;
}
function status(b, response, sentAt) {
    const receivedAt = Date.now(), roundTrip = receivedAt - sentAt;
    // Keep the best round-trip sample: a slow later reply must not move effect clocks back.
    if (Number.isFinite(response.serverTime) && Number.isFinite(roundTrip) && roundTrip >= 0 &&
        (b.clockRoundTrip === undefined || roundTrip <= b.clockRoundTrip)) {
        b.clockRoundTrip = roundTrip;
        b.serverOffset = response.serverTime - (sentAt + receivedAt) / 2;
    }
    for (const key of ['frozen', 'reflect', 'cheer']) {
        const value = response['my' + key[0].toUpperCase() + key.slice(1) + 'Until'];
        if (Number.isFinite(value)) b[key + 'Until'] = value;
    }
    if (Number.isSafeInteger(response.scoreCloseAt) && response.scoreCloseAt > 0) b.scoreCloseAt = response.scoreCloseAt;
    if (response.myScoreFinalized === true) b.scoreFinalized = true;
    window(b, b.cheerUntil);
}
function window(b, until) {
    if (!(until > 0) || b.cheerWindows.some(w => w.until === until)) return;
    b.cheerWindows.push({ at: until - 5000, until: until });
}
function displayScore(b) {
    let score = b.confirmedScore, raw = b.syncedScore;
    for (const s of b.scoreSamples) {
        const boosted = b.cheerWindows.some(w => s.at >= w.at && s.at < w.until);
        score += (s.score - raw) * (boosted ? 2 : 1);
        raw = s.score;
    }
    return score;
}
module.exports = { KEYS, INITIAL, keys, configure, serverNow, cooldowns, cooldownUntil, cooldownRemaining,
    sample, acknowledge, status, window, displayScore };
