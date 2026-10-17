'use strict';
// Only ordinary solo runs that requested ad revival enter this local journal.
const snapshot = require('./solo-snapshot');
const coin = require('./coin');
const KEY = 'match3_solo_resume_v1';
const clone = value => JSON.parse(JSON.stringify(value));
function store() { return typeof wx !== 'undefined' ? wx : global.wx; }
function read() {
    try {
        const stored = store().getStorageSync(KEY);
        if (stored == null || stored === '') return { ok: true, record: null };
        // Decode the SDK bridge value before applying strict snapshot validation.
        const r = clone(stored);
        if (r.version !== 1 || typeof r.id !== 'string' || r.id.length > 120 ||
            !['prepared','ready','action','result'].includes(r.stage) || !snapshot.validate(r.snapshot) ||
            !Number.isSafeInteger(r.sequence) || r.sequence < 0 || !r.meta ||
            !Number.isSafeInteger(r.meta.reviveCount) || r.meta.reviveCount < 0 ||
            !Number.isFinite(r.clockAt) || typeof r.clockRunning !== 'boolean' ||
            (r.revision != null && (!Number.isSafeInteger(r.revision) || r.revision < 0)) ||
            (r.elapsedMs != null && (!Number.isFinite(r.elapsedMs) || r.elapsedMs < 0))) return { ok: false, reason: 'invalid_resume' };
        if (r.stage === 'action' && (!r.op || !['swap','tool'].includes(r.op.kind) ||
            !Number.isInteger(r.op.seed) || !Array.isArray(r.op.args) || !Number.isFinite(r.op.startedAt))) return { ok: false, reason: 'invalid_operation' };
        return { ok: true, record: Object.assign({ revision: 0 }, clone(r)) };
    } catch (e) { return { ok: false, reason: 'storage_failed' }; }
}
function matches(a, b) { return !a && !b || !!a && !!b && a.id === b.id && a.revision === b.revision; }
function current(record) {
    const saved = read();
    return saved.ok && matches(saved.record, record);
}
function write(record, expected) {
    try {
        if (!current(expected)) return { ok: false, reason: 'stale_run' };
        if (record) record.revision = expected ? expected.revision + 1 : 1;
        store().setStorageSync(KEY, record && clone(record));
        return { ok: true, record: record };
    } catch (e) { return { ok: false, reason: 'storage_failed' }; }
}
function eligible(r) { return !!r && (r.stage !== 'prepared' || r.meta.reviveCount > 0); }
function prepare(core, meta, previous) {
    try {
        const saved = read();
        if (!saved.ok || (eligible(saved.record) && !matches(saved.record, previous))) return { ok: false, reason: 'stale_run' };
        const r = { version: 1, id: previous ? previous.id : 'resume:' + Date.now().toString(36) + Math.random().toString(36).slice(2,12),
            sequence: previous ? previous.sequence + 1 : 0, stage: 'prepared', snapshot: snapshot.capture(core),
            meta: clone(meta), clockAt: Date.now(), clockRunning: false };
        return write(r, saved.record);
    } catch (e) { return { ok: false, reason: 'unstable_board' }; }
}
function complete(prepared) {
    const saved = read();
    if (!saved.ok) return saved;
    const r = saved.record;
    if (!r || r.id !== prepared.id || r.sequence !== prepared.sequence) return { ok: false, reason: 'stale_run' };
    if (!snapshot.compatible(r.snapshot)) return { ok: false, reason: 'incompatible_rules' };
    if (r.stage !== 'prepared') return { ok: true, record: r };
    try {
        const core = snapshot.restore(r.snapshot, {});
        if (!core.revive(5, 30000)) return { ok: false, reason: 'not_failed' };
        core.pauseTimer();
        r.snapshot = snapshot.capture(core); r.stage = 'ready'; r.meta.reviveCount++;
        r.meta.completionTracked = false; r.meta.result = null;
        if (r.meta.retentionSolo) r.meta.retentionSolo.completed = false;
        return write(r, saved.record);
    } catch (e) { return { ok: false, reason: 'invalid_resume' }; }
}
function checkpoint(r, core, meta) {
    try {
        const next = clone(r);
        next.snapshot = snapshot.capture(core); next.meta = clone(meta);
        next.stage = core.ended ? 'result' : 'ready'; delete next.op; delete next.elapsedMs;
        next.clockAt = Date.now(); next.clockRunning = !core.timerPaused && core.timerStarted && !core.ended;
        return write(next, r);
    } catch (e) { return { ok: false, reason: 'unstable_board' }; }
}
function begin(r, core, kind, args, meta) {
    const next = checkpoint(r, core, meta);
    if (!next.ok) return next;
    next.record.stage = 'action'; next.record.sequence++;
    next.record.op = { kind: kind, args: clone(args), seed: Math.floor(Math.random() * 4294967296), startedAt: Date.now() };
    return write(next.record, next.record);
}
function clock(r, running) {
    const next = clone(r), now = Date.now();
    // For a pending action keep board input intact; only persist its elapsed active time.
    if (next.clockRunning) next.elapsedMs = (next.elapsedMs || 0) + Math.max(0, now - next.clockAt);
    next.clockAt = now; next.clockRunning = !!running;
    return write(next, r);
}
function timeoutBeforeResolve(r) {
    if (r.stage !== 'action') return { ok: false, reason: 'not_in_action' };
    const next = clone(r); next.op.timeoutBeforeResolve = true;
    return write(next, r);
}
function elapsed(r) { return (r.elapsedMs || 0) + (r.clockRunning ? Math.max(0, Date.now() - r.clockAt) : 0); }
async function recover(r) {
    try {
        if (!current(r)) return { ok: false, reason: 'stale_run' };
        if (!snapshot.compatible(r.snapshot)) return { ok: false, reason: 'incompatible_rules' };
        const meta = clone(r.meta); let result = null, core;
        const earlyTimeout = () => { if (r.op && r.op.timeoutBeforeResolve) { core.timeLeftMs = 0; core.checkLevelEnd('timeout'); } };
        core = snapshot.restore(r.snapshot, {
            onColorChange: earlyTimeout, onInvalidSwap: earlyTimeout,
            onSwap() { if (meta.retentionSolo) meta.retentionSolo.validMove = true; },
            onMatch(data) { if (meta.retentionSolo) { meta.retentionSolo.cleared += data.removed.length; if (data.removed.length) meta.retentionSolo.validMove = true; } },
            onLevelEnd(value) { result = value; }
        });
        if (core.timeLimitMs > 0 && core.timerStarted && !core.ended) core.timeLeftMs = Math.max(0, core.timeLeftMs - elapsed(r));
        if (r.stage === 'action') {
            core.random = snapshot.random(r.op.seed);
            const success = r.op.kind === 'swap' ? await core.trySwap(...r.op.args) : await core.useTool(...r.op.args);
            if (!current(r)) return { ok: false, reason: 'stale_run' };
            if (success && r.op.kind === 'tool') {
                if (!coin.useItemOnce(r.op.args[0], r.id + ':' + r.sequence).ok) return { ok: false, reason: 'inventory_pending' };
                if (meta.retentionSolo) meta.retentionSolo.validMove = true;
            }
        }
        if (!core.ended && core.timerStarted && core.timeLeftMs <= 0) core.checkLevelEnd('timeout');
        core.pauseTimer();
        if (result) { meta.result = result; meta.completionTracked = false; }
        const next = checkpoint(r, core, meta);
        return next;
    } catch (e) { return { ok: false, reason: 'resume_failed' }; }
}
function close(r) {
    const saved = read();
    if (!saved.ok) return saved;
    if (!saved.record) return { ok: true }; // A previous clear may have committed before reporting an error.
    if (!matches(saved.record, r)) return { ok: false, reason: 'stale_run' };
    return write(null, saved.record);
}
module.exports = { KEY: KEY, read: read, current: current, eligible: eligible, prepare: prepare, complete: complete,
    checkpoint: checkpoint, begin: begin, clock: clock, timeoutBeforeResolve: timeoutBeforeResolve, recover: recover, close: close };
