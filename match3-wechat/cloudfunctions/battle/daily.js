'use strict';

const daily = require('./daily-engine/daily-challenge');

const RUN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const STARTS_PER_MINUTE = 10;

function beijingDate(at) { return new Date(at + 8 * 60 * 60 * 1000).toISOString().slice(0, 10); }

function hashId(crypto, prefix, value) {
    return prefix + crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 30);
}

function getData(ref) {
    return ref.get().then(function (result) { return result && result.data ? result.data : null; }).catch(function (error) {
        const code = error && String(error.errCode || error.code || '');
        if (code === 'DATABASE_DOCUMENT_NOT_EXIST' || /not.?found/i.test(code)) return null;
        throw error;
    });
}

function publicResult(result) {
    return {
        ok: true, date: result.date, score: result.score, maxCascade: result.maxCascade,
        specialComboCount: result.specialComboCount, qualified: result.qualified,
        settlementId: result.settlementId || undefined, coinReward: Number(result.coinReward) || 0
    };
}

function sameMove(left, right) {
    return !!left && !!right && !!left.from && !!left.to && !!right.from && !!right.to &&
        left.from.row === right.from.row && left.from.column === right.from.column &&
        left.to.row === right.to.row && left.to.column === right.to.column;
}

function beginsWith(moves, prefix) {
    return moves.length >= prefix.length && prefix.every(function (move, index) { return sameMove(move, moves[index]); });
}

function validRunId(value) { return typeof value === 'string' && /^D[0-9a-z]{8,10}[0-9a-f]{16}$/.test(value); }
function storedMoves(run) { return Array.isArray(run && run.moves) ? run.moves : []; }
function runResponse(run, id) { return { ok: true, runId: id || run._id, challenge: run.challenge, moves: storedMoves(run), expiresAt: run.expiresAt }; }

function createService(db, crypto, clock) {
    const now = clock || Date.now;
    const runs = db.collection('daily_runs');
    const progress = db.collection('daily_progress');
    function owner(openid) { return hashId(crypto, 'U', openid); }
    function runId() { return 'D' + now().toString(36) + crypto.randomBytes(8).toString('hex'); }
    function progressId(ownerId, date) { return hashId(crypto, 'P', ownerId + ':' + date); }
    function receipt(ownerId, date) { return hashId(crypto, 'd', ownerId + ':' + date); }

    async function info(openid) {
        const at = now(); const date = beijingDate(at); const oid = owner(openid);
        const record = await getData(progress.doc(progressId(oid, date)));
        let run = null;
        if (record && validRunId(record.activeRunId)) run = await getData(runs.doc(record.activeRunId));
        const result = run && run.result || record && record.result || null;
        const challenge = run && daily.isRecordedChallenge(run.challenge) ? run.challenge : daily.challengeForDate(date);
        const completed = !!(run && run.completed || record && (record.completed || record.settlementId || record.result));
        return {
            ok: true, challenge: challenge, claimed: !!(record && record.settlementId),
            settlementId: record && record.settlementId, coinReward: Number(record && record.coinReward) || 0,
            attempted: !!(record && (record.activeRunId || record.attempted || record.settlementId || record.result)), completed: completed,
            runId: run && record.activeRunId || undefined, score: result && Number.isFinite(result.score) ? result.score : undefined
        };
    }

    async function resumeRun(tx, oid, id, at) {
        const run = await getData(tx.collection('daily_runs').doc(id));
        if (!run || run.kind !== 'daily_run') return { ok: false, err: '挑战记录不存在' };
        if (run.owner !== oid) return { ok: false, err: '挑战身份不符' };
        if (run.completed) return { ok: false, err: '挑战已完成' };
        if (!Number.isFinite(run.expiresAt) || at >= run.expiresAt) return { ok: false, err: '挑战已过期' };
        if (!daily.isRecordedChallenge(run.challenge)) return { ok: false, err: '挑战版本不受支持' };
        if (storedMoves(run).length > daily.DAILY_RULES.moveCount) return { ok: false, err: '挑战记录异常' };
        return runResponse(run, id);
    }

    async function start(openid, input) {
        const at = now(); const oid = owner(openid); const date = beijingDate(at);
        const requestedRunId = input && input.runId;
        if (requestedRunId !== undefined && !validRunId(requestedRunId)) return { ok: false, err: '挑战记录格式非法' };
        return db.runTransaction(async function (tx) {
            if (requestedRunId) return resumeRun(tx, oid, requestedRunId, at);
            const progressRef = tx.collection('daily_progress').doc(progressId(oid, date));
            const previous = await getData(progressRef);
            // Legacy receipts predate the explicit completed flag; they still consume today's chance.
            if (previous && (previous.completed || previous.settlementId || previous.result)) return { ok: false, err: '今日挑战已完成' };
            if (previous && validRunId(previous.activeRunId)) return resumeRun(tx, oid, previous.activeRunId, at);

            const rateRef = tx.collection('daily_runs').doc(hashId(crypto, 'L', oid));
            const rate = await getData(rateRef);
            const minute = Math.floor(at / 60000);
            const count = rate && rate.minute === minute && Number.isSafeInteger(rate.count) ? rate.count : 0;
            if (count >= STARTS_PER_MINUTE) return { ok: false, err: '每日挑战开局过于频繁' };
            const id = runId(); const challenge = daily.challengeForDate(date); const expiresAt = at + RUN_TTL_MS;
            await rateRef.set({ data: { kind: 'daily_rate', createdAt: at, minute: minute, count: count + 1 } });
            await tx.collection('daily_runs').doc(id).set({ data: {
                kind: 'daily_run', owner: oid, date: date, challenge: challenge, createdAt: at,
                expiresAt: expiresAt, completed: false, moves: []
            } });
            await progressRef.set({ data: {
                kind: 'daily_progress', owner: oid, date: date, updatedAt: at,
                activeRunId: id, attempted: true, completed: false, bestScore: 0, settlementId: null, coinReward: 0
            } });
            return { ok: true, runId: id, challenge: challenge, moves: [], expiresAt: expiresAt };
        });
    }

    async function checkpoint(openid, input) {
        const at = now(); const oid = owner(openid);
        if (!input || !validRunId(input.runId)) return { ok: false, err: '挑战记录格式非法' };
        if (!Array.isArray(input.moves) || input.moves.length > daily.DAILY_RULES.moveCount) return { ok: false, err: '操作记录格式非法' };
        return db.runTransaction(async function (tx) {
            const runRef = tx.collection('daily_runs').doc(input.runId); const run = await getData(runRef);
            if (!run || run.kind !== 'daily_run') return { ok: false, err: '挑战记录不存在' };
            if (run.owner !== oid) return { ok: false, err: '挑战身份不符' };
            if (run.completed) return { ok: false, err: '挑战已完成' };
            if (!Number.isFinite(run.expiresAt) || at >= run.expiresAt) return { ok: false, err: '挑战已过期' };
            const prefix = storedMoves(run);
            if (prefix.length > daily.DAILY_RULES.moveCount || !beginsWith(input.moves, prefix)) return { ok: false, err: '操作记录不能改写' };
            if (input.moves.length === prefix.length) return { ok: true, runId: input.runId, moves: prefix, expiresAt: run.expiresAt };
            const replayed = await daily.replayPrefix(run.challenge, input.moves, false);
            if (!replayed.ok) return { ok: false, err: '挑战回放无效' };
            await runRef.update({ data: { moves: input.moves } });
            return { ok: true, runId: input.runId, moves: input.moves, expiresAt: run.expiresAt };
        });
    }

    async function submit(openid, input) {
        const at = now(); const oid = owner(openid);
        if (!input || !validRunId(input.runId)) return { ok: false, err: '挑战记录格式非法' };
        return db.runTransaction(async function (tx) {
            const runRef = tx.collection('daily_runs').doc(input.runId); const run = await getData(runRef);
            if (!run || run.kind !== 'daily_run') return { ok: false, err: '挑战记录不存在' };
            if (run.owner !== oid) return { ok: false, err: '挑战身份不符' };
            if (run.completed && run.result) return publicResult(run.result);
            if (!Number.isFinite(run.expiresAt) || at >= run.expiresAt) return { ok: false, err: '挑战已过期' };
            if (!Array.isArray(input.moves) || input.moves.length !== daily.DAILY_RULES.moveCount) return { ok: false, err: '操作记录格式非法' };
            const prefix = storedMoves(run);
            if (prefix.length > daily.DAILY_RULES.moveCount || !beginsWith(input.moves, prefix)) return { ok: false, err: '操作记录不能改写' };
            const replayed = await daily.replay(run.challenge, input.moves);
            if (!replayed.ok) return { ok: false, err: '挑战回放无效' };
            const progressRef = tx.collection('daily_progress').doc(progressId(oid, run.date));
            const previous = await getData(progressRef);
            const qualified = replayed.qualified;
            const priorSettlement = previous && previous.settlementId || null;
            const reward = Number(run.challenge && run.challenge.reward) || daily.DAILY_RULES.reward;
            const settlementId = qualified ? (priorSettlement || receipt(oid, run.date)) : null;
            const coinReward = qualified ? (priorSettlement ? Number(previous.coinReward) || reward : reward) : 0;
            const result = { date: run.date, score: replayed.score, maxCascade: replayed.maxCascade,
                specialComboCount: replayed.specialComboCount, qualified: qualified,
                settlementId: settlementId, coinReward: coinReward };
            const bestScore = Math.max(previous && Number(previous.bestScore) || 0, replayed.score);
            await progressRef.set({ data: { kind: 'daily_progress', owner: oid, date: run.date, updatedAt: at,
                activeRunId: input.runId, attempted: true, completed: true, bestScore: bestScore,
                settlementId: priorSettlement || settlementId, coinReward: priorSettlement || settlementId ? coinReward : 0,
                result: result } });
            await runRef.update({ data: { moves: input.moves, completed: true, completedAt: at, result: result } });
            return publicResult(result);
        });
    }

    async function cleanup(at) {
        const cutoff = at - RETENTION_MS;
        const removedRuns = await runs.where({ createdAt: db.command.lt(cutoff) }).remove();
        const removedProgress = await progress.where({ updatedAt: db.command.lt(cutoff) }).remove();
        return Number((removedRuns.stats && removedRuns.stats.removed) || 0) + Number((removedProgress.stats && removedProgress.stats.removed) || 0);
    }
    return { info: info, start: start, checkpoint: checkpoint, submit: submit, cleanup: cleanup, beijingDate: beijingDate, RUN_TTL_MS: RUN_TTL_MS, RETENTION_MS: RETENTION_MS };
}

module.exports = { createService: createService, beijingDate: beijingDate };
