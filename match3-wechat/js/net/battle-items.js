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
function sample(b, score) {
    if (b.itemRulesVersion !== 3 || score <= b.lastSampleScore) return;
    const at = Math.max(b.lastSampleAt || 0, serverNow(b));
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
module.exports = { KEYS, INITIAL, keys, configure, serverNow, sample, acknowledge, status, window, displayScore };
