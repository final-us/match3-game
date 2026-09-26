'use strict';

const dailyEngine = require('./daily-engine/daily-challenge');

const DAY_MS = 24 * 60 * 60 * 1000;
const RECEIPT_RETENTION_MS = 35 * DAY_MS;
const EVIDENCE_RETENTION_MS = 35 * DAY_MS;
const TASK_TARGETS = [1, 2, 80];
const TASK_COINS = [40, 60, 60];
const TASK_ACTIVITY = [20, 30, 30];
const WEEK_TARGETS = [200, 350, 500];
const WEEK_COINS = [300, 500, 1000];
const SIGN_COINS = [100, 100, 150, 100, 100, 150, 200];
const MAX_PENDING_RECEIPTS = 100;
const MAX_EVENTS_PER_DAY = 82;

function beijingDate(at) {
    return new Date(at + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function dateValue(date) {
    return Date.parse(date + 'T00:00:00.000Z');
}

function weekFor(at) {
    const local = new Date(at + 8 * 60 * 60 * 1000);
    const day = local.getUTCDay();
    const monday = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
    monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1));
    const week = monday.toISOString().slice(0, 10);
    const startsAt = monday.getTime() - 8 * 60 * 60 * 1000;
    return { week: week, startsAt: startsAt, endsAt: startsAt + 7 * DAY_MS };
}

function weekForDate(date) {
    return weekFor(dateValue(date) - 8 * 60 * 60 * 1000).week;
}

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

function terminal(code, err) { return { ok: false, code: code, err: err, terminal: true }; }
function retryable(code, err) { return { ok: false, code: code, err: err }; }
function bools(value, length) {
    return Array.from({ length: length }, function (_, index) { return !!(Array.isArray(value) && value[index]); });
}
function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const at = dateValue(value);
    return Number.isFinite(at) && new Date(at).toISOString().slice(0, 10) === value;
}
function validBooleans(value, length) {
    return Array.isArray(value) && value.length === length && value.every(function (item) { return typeof item === 'boolean'; });
}
function corrupt(message) {
    const error = new Error(message); error.code = 'CORRUPT_RETENTION_STATE'; return error;
}

function createService(db, crypto, clock) {
    const now = clock || Date.now;
    function ownerId(openid) { return hashId(crypto, 'U', openid); }
    function profileId(owner) { return hashId(crypto, 'R', owner); }
    function eventId(owner, canonical) { return hashId(crypto, 'E', owner + ':' + canonical); }
    function receiptId(owner, kind, key) { return hashId(crypto, 'r', owner + ':' + kind + ':' + key); }
    function battleEvidenceId(owner, roomId, roundId) {
        return hashId(crypto, 'B', owner + ':' + roomId + ':' + roundId);
    }

    function freshProfile(owner, at) {
        const date = beijingDate(at); const currentWeek = weekFor(at);
        return {
            kind: 'retention_profile', owner: owner, signCount: 0, lastSignDate: '',
            day: { date: date, games: 0, cleared: 0, eventCount: 0, tasks: [false, false, false] },
            currentWeek: { week: currentWeek.week, activity: 0, claimed: [false, false, false] },
            previousWeek: null, createdAt: at, updatedAt: at
        };
    }

    function normalizeProfile(stored, owner, at) {
        if (!stored) return freshProfile(owner, at);
        const date = beijingDate(at); const current = weekFor(at);
        const day = stored.day; const storedCurrent = stored.currentWeek; const previous = stored.previousWeek;
        const validSign = Number.isSafeInteger(stored.signCount) && stored.signCount >= 0 && stored.signCount <= 7 &&
            (stored.lastSignDate === '' || validDate(stored.lastSignDate)) &&
            ((stored.signCount === 0 && stored.lastSignDate === '') || (stored.signCount > 0 && validDate(stored.lastSignDate)));
        const validDay = day && validDate(day.date) && Number.isSafeInteger(day.games) && day.games >= 0 && day.games <= 2 &&
            Number.isSafeInteger(day.cleared) && day.cleared >= 0 && day.cleared <= 80 &&
            Number.isSafeInteger(day.eventCount) && day.eventCount >= 0 && day.eventCount <= MAX_EVENTS_PER_DAY &&
            validBooleans(day.tasks, 3) && day.tasks[0] === (day.games >= 1) && day.tasks[1] === (day.games >= 2) &&
            day.tasks[2] === (day.cleared >= 80);
        const validCurrent = storedCurrent && validDate(storedCurrent.week) && Number.isSafeInteger(storedCurrent.activity) &&
            storedCurrent.activity >= 0 && storedCurrent.activity <= 700 && validBooleans(storedCurrent.claimed, 3) &&
            storedCurrent.claimed.every(function (claimed, index) { return !claimed || storedCurrent.activity >= WEEK_TARGETS[index]; });
        const validPrevious = previous === null || (previous && validDate(previous.week) && Number.isFinite(previous.expiresAt) &&
            Number.isSafeInteger(previous.activity) && previous.activity >= 0 && previous.activity <= 700 &&
            validBooleans(previous.available, 3) && validBooleans(previous.claimed, 3) &&
            previous.available.every(function (available, index) { return available === (previous.activity >= WEEK_TARGETS[index]); }) &&
            previous.claimed.every(function (claimed, index) { return !claimed || previous.available[index]; }));
        const validChronology = validDay && validCurrent && day.date <= date && storedCurrent.week <= current.week &&
            storedCurrent.week === weekForDate(day.date) &&
            (stored.lastSignDate === '' || (stored.lastSignDate <= day.date && stored.lastSignDate <= date)) &&
            (!previous || (dateValue(storedCurrent.week) - dateValue(previous.week) === 7 * DAY_MS &&
                previous.expiresAt === dateValue(storedCurrent.week) - 8 * 60 * 60 * 1000 + 7 * DAY_MS));
        if (stored.kind !== 'retention_profile' || stored.owner !== owner || !validSign || !validDay || !validCurrent ||
            !validPrevious || !validChronology) {
            throw corrupt('retention profile is corrupt');
        }
        const profile = Object.assign({}, stored);
        // Cloud database reads include SDK-managed fields. They identify the ref,
        // but must never be echoed inside set({ data }) for an existing profile.
        delete profile._id;
        delete profile._openid;
        profile.day = day.date === date ? {
            date: date, games: day.games, cleared: day.cleared, eventCount: day.eventCount, tasks: day.tasks.slice()
        } : { date: date, games: 0, cleared: 0, eventCount: 0, tasks: [false, false, false] };

        const storedWeek = profile.currentWeek && profile.currentWeek.week;
        if (storedWeek !== current.week) {
            const immediatelyPrevious = typeof storedWeek === 'string' &&
                dateValue(current.week) - dateValue(storedWeek) === 7 * DAY_MS;
            if (immediatelyPrevious) {
                const priorActivity = profile.currentWeek.activity;
                profile.previousWeek = {
                    week: storedWeek, expiresAt: current.endsAt, activity: priorActivity,
                    available: WEEK_TARGETS.map(function (target) { return priorActivity >= target; }),
                    claimed: profile.currentWeek.claimed.slice()
                };
            } else {
                profile.previousWeek = null;
            }
            profile.currentWeek = { week: current.week, activity: 0, claimed: [false, false, false] };
        } else {
            profile.currentWeek = {
                week: current.week,
                activity: profile.currentWeek.activity,
                claimed: profile.currentWeek.claimed.slice()
            };
        }
        if (profile.previousWeek && (!Number.isFinite(profile.previousWeek.expiresAt) || at >= profile.previousWeek.expiresAt)) {
            profile.previousWeek = null;
        }
        profile.updatedAt = at;
        return profile;
    }

    async function loadProfile(tx, owner, at) {
        const ref = tx.collection('retention_profiles').doc(profileId(owner));
        const stored = await getData(ref);
        const profile = normalizeProfile(stored, owner, at);
        return { ref: ref, profile: profile };
    }

    function publicState(profile, at) {
        const current = weekFor(at); const signed = profile.lastSignDate === profile.day.date;
        const signDay = signed ? profile.signCount : (profile.signCount >= 7 ? 1 : profile.signCount + 1);
        const state = {
            serverNow: at,
            date: profile.day.date,
            week: profile.currentWeek.week,
            weekEndsAt: current.endsAt,
            signDay: Math.max(1, Math.min(7, signDay || 1)),
            signed: signed,
            taskProgress: [Math.min(1, profile.day.games), Math.min(2, profile.day.games), Math.min(80, profile.day.cleared)],
            activity: profile.currentWeek.activity,
            claimed: bools(profile.currentWeek.claimed, 3)
        };
        if (profile.previousWeek) {
            state.previousWeek = {
                week: profile.previousWeek.week,
                expiresAt: profile.previousWeek.expiresAt,
                available: bools(profile.previousWeek.available, 3),
                claimed: bools(profile.previousWeek.claimed, 3)
            };
        }
        return state;
    }

    function validReceipt(value, owner) {
        const base = value && value.kind === 'retention_receipt' && value.owner === owner && /^r[0-9a-f]{30}$/.test(value._id || '') &&
            Number.isSafeInteger(value.coins) && value.coins > 0 && value.items &&
            Number.isSafeInteger(value.items.hammer) && value.items.hammer >= 0 &&
            ['signin', 'task', 'weekly'].indexOf(value.rewardKind) >= 0 && validDate(value.date) &&
            typeof value.acknowledged === 'boolean' && Number.isFinite(value.createdAt) &&
            (!value.acknowledged || Number.isFinite(value.acknowledgedAt));
        if (!base) return false;
        if (value.rewardKind === 'signin') return SIGN_COINS.indexOf(value.coins) >= 0 && value.items.hammer === (value.coins === 200 ? 1 : 0);
        if (value.rewardKind === 'task') return TASK_COINS.indexOf(value.coins) >= 0 && value.items.hammer === 0;
        return WEEK_COINS.indexOf(value.coins) >= 0 && value.items.hammer === 0;
    }

    function publicReceipt(value) {
        return { id: value._id || value.id, coins: value.coins, items: { hammer: Number(value.items && value.items.hammer) || 0 }, kind: value.rewardKind, date: value.date };
    }

    async function pendingReceipts(owner) {
        const result = await db.collection('retention_receipts').where({ owner: owner, acknowledged: false })
            .orderBy('createdAt', 'asc').limit(MAX_PENDING_RECEIPTS).get();
        const list = result && Array.isArray(result.data) ? result.data : [];
        if (list.some(function (value) { return !validReceipt(value, owner); })) throw corrupt('retention receipt is corrupt');
        return list.map(publicReceipt);
    }

    async function response(owner, profile, at, eventStatus) {
        const result = { ok: true, state: publicState(profile, at), receipts: await pendingReceipts(owner) };
        if (eventStatus) result.eventStatus = eventStatus;
        return result;
    }

    async function writeReceipt(tx, owner, id, coins, hammer, kind, date, at) {
        const ref = tx.collection('retention_receipts').doc(id);
        const existing = await getData(ref);
        if (existing) {
            if (!validReceipt(existing, owner) || existing._id !== id || existing.coins !== coins ||
                existing.items.hammer !== (hammer || 0) || existing.rewardKind !== kind || existing.date !== date) {
                throw corrupt('retention receipt conflicts with deterministic reward');
            }
            return;
        }
        await ref.set({ data: {
            kind: 'retention_receipt', owner: owner, coins: coins, items: { hammer: hammer || 0 },
            rewardKind: kind, date: date, acknowledged: false, createdAt: at
        } });
    }

    async function info(openid) {
        const at = now(); const owner = ownerId(openid);
        const profile = await db.runTransaction(async function (tx) {
            const loaded = await loadProfile(tx, owner, at);
            await loaded.ref.set({ data: loaded.profile });
            return loaded.profile;
        });
        return response(owner, profile, at);
    }

    async function sign(openid, input) {
        const at = now(); const owner = ownerId(openid); const today = beijingDate(at);
        if (!input || !validDate(input.date)) {
            return terminal('INVALID_DATE', '签到日期格式非法');
        }
        if (input.date > today) return terminal('INVALID_DATE', '签到日期非法');
        const outcome = await db.runTransaction(async function (tx) {
            const loaded = await loadProfile(tx, owner, at); const profile = loaded.profile;
            if (input.date < today) {
                const oldReceipt = await getData(tx.collection('retention_receipts').doc(receiptId(owner, 'signin', input.date)));
                if (oldReceipt && !validReceipt(oldReceipt, owner)) throw corrupt('retention signin receipt is corrupt');
                await loaded.ref.set({ data: profile });
                return { profile: profile, eventStatus: oldReceipt && validReceipt(oldReceipt, owner)
                    ? 'recorded' : 'expired' };
            }
            if (profile.lastSignDate !== today) {
                if (profile.signCount >= 7) profile.signCount = 0;
                profile.signCount++;
                profile.lastSignDate = today;
                profile.currentWeek.activity += 20;
                const index = profile.signCount - 1;
                await writeReceipt(tx, owner, receiptId(owner, 'signin', today), SIGN_COINS[index], index === 6 ? 1 : 0, 'signin', today, at);
            }
            await loaded.ref.set({ data: profile });
            return { profile: profile };
        });
        return response(owner, outcome.profile, at, outcome.eventStatus);
    }

    function validateRecordShape(event) {
        if (!event || typeof event !== 'object') return terminal('INVALID_EVENT', '事件格式非法');
        if (['solo', 'daily', 'pvp'].indexOf(event.mode) < 0) return terminal('INVALID_MODE', '事件模式非法');
        if (typeof event.id !== 'string' || event.id.length < 5 || event.id.length > 128) return terminal('INVALID_EVENT_ID', '事件编号非法');
        if (!Number.isSafeInteger(event.cleared) || event.cleared < 0 || event.cleared > 100000) return terminal('INVALID_CLEARED', '消除数量非法');
        return null;
    }

    async function dailyProof(tx, owner, event) {
        if (typeof event.runId !== 'string' || event.id !== 'daily:' + event.runId) return terminal('INVALID_DAILY_ID', '每日挑战事件编号非法');
        const run = await getData(tx.collection('daily_runs').doc(event.runId));
        if (!run || run.kind !== 'daily_run') return terminal('DAILY_NOT_FOUND', '每日挑战记录不存在');
        if (run.owner !== owner) return terminal('DAILY_OWNER_MISMATCH', '每日挑战身份不符');
        if (!run.completed || !run.result || !Number.isFinite(run.result.score) || !validDate(run.date) || !Array.isArray(run.moves)) {
            return terminal('DAILY_INCOMPLETE', '每日挑战尚未完成');
        }
        let cleared = 0; let core;
        try {
            core = dailyEngine.createCore(run.challenge, { onMatch: function (payload) {
                cleared += Array.isArray(payload && payload.removed) ? payload.removed.length : 0;
            } });
            for (let index = 0; index < run.moves.length; index++) {
                if (!await core.trySwap(run.moves[index].from, run.moves[index].to)) return terminal('DAILY_REPLAY_INVALID', '每日挑战回放无效');
            }
        } catch (error) {
            return terminal('DAILY_REPLAY_INVALID', '每日挑战回放无效');
        }
        if (!core.ended || core.movesLeft !== 0 || core.score !== run.result.score) return terminal('DAILY_REPLAY_INVALID', '每日挑战回放无效');
        return { ok: true, canonical: 'daily:' + event.runId, date: run.date, cleared: cleared };
    }

    async function pvpProof(tx, owner, event) {
        if (typeof event.roomId !== 'string' || !Number.isSafeInteger(event.roundId) || event.roundId < 1 ||
            event.id !== 'pvp:' + event.roomId + ':' + event.roundId) {
            return terminal('INVALID_PVP_ID', '对战事件编号非法');
        }
        const proof = await getData(tx.collection('retention_battle_evidence').doc(battleEvidenceId(owner, event.roomId, event.roundId)));
        if (!proof || proof.kind !== 'retention_battle_evidence' || proof.owner !== owner) return terminal('PVP_NOT_SETTLED', '对战结算凭据不存在');
        if (proof.roomId !== event.roomId || proof.roundId !== event.roundId || typeof proof.quit !== 'boolean' ||
            !Number.isFinite(proof.finishedAt)) return terminal('PVP_EVIDENCE_INVALID', '对战结算凭据异常');
        if (proof.quit || !Number.isSafeInteger(proof.score) || proof.score <= 0) return terminal('PVP_NOT_ELIGIBLE', '主动退出或无有效得分的对局不计入任务');
        return { ok: true, canonical: 'pvp:' + event.roomId + ':' + event.roundId,
            date: beijingDate(proof.finishedAt), cleared: event.cleared };
    }

    function soloProof(event, today) {
        if (!/^solo:[A-Za-z0-9:_-]{1,120}$/.test(event.id) || event.validMove !== true || event.completed !== true ||
            !validDate(event.date) || event.date > today ||
            !Number.isSafeInteger(event.levelId) || event.levelId < 1 || event.levelId > 1000000) {
            return terminal('INVALID_SOLO_EVENT', '单人结算事件非法');
        }
        if (event.date !== today) return { ok: true, canonical: event.id, date: event.date, cleared: event.cleared, expired: true };
        return { ok: true, canonical: event.id, date: today, cleared: event.cleared };
    }

    function canonicalForEvent(event) {
        if (event.mode === 'solo') {
            return /^solo:[A-Za-z0-9:_-]{1,120}$/.test(event.id) ? event.id : terminal('INVALID_SOLO_EVENT', '单人结算事件非法');
        }
        if (event.mode === 'daily') {
            return typeof event.runId === 'string' && event.id === 'daily:' + event.runId
                ? event.id : terminal('INVALID_DAILY_ID', '每日挑战事件编号非法');
        }
        return typeof event.roomId === 'string' && Number.isSafeInteger(event.roundId) && event.roundId >= 1 &&
            event.id === 'pvp:' + event.roomId + ':' + event.roundId
            ? event.id : terminal('INVALID_PVP_ID', '对战事件编号非法');
    }

    async function record(openid, input) {
        const at = now(); const today = beijingDate(at); const owner = ownerId(openid);
        const event = input && input.event; const invalid = validateRecordShape(event);
        if (invalid) return invalid;
        const canonical = canonicalForEvent(event);
        if (typeof canonical !== 'string') return canonical;
        const outcome = await db.runTransaction(async function (tx) {
            const canonicalRef = tx.collection('retention_events').doc(eventId(owner, canonical));
            const existing = await getData(canonicalRef);
            const loaded = await loadProfile(tx, owner, at); const profile = loaded.profile;
            if (existing) {
                if (existing.kind !== 'retention_event' || existing.owner !== owner || existing.canonical !== canonical ||
                    existing.mode !== event.mode || existing.status !== 'recorded') throw corrupt('retention event is corrupt');
                await loaded.ref.set({ data: profile });
                return { profile: profile, eventStatus: existing.status || 'recorded' };
            }
            let proof;
            if (event.mode === 'daily') proof = await dailyProof(tx, owner, event);
            else if (event.mode === 'pvp') proof = await pvpProof(tx, owner, event);
            else proof = soloProof(event, today);
            if (!proof.ok) return { error: proof };
            if (proof.expired || proof.date !== today) {
                await loaded.ref.set({ data: profile });
                return { profile: profile, eventStatus: 'expired' };
            }
            if (profile.day.eventCount >= MAX_EVENTS_PER_DAY || profile.day.tasks.every(Boolean)) {
                await loaded.ref.set({ data: profile });
                return { profile: profile, eventStatus: 'capped' };
            }
            const priorGames = profile.day.games; const priorCleared = profile.day.cleared;
            profile.day.eventCount++;
            profile.day.games = Math.min(2, priorGames + 1);
            profile.day.cleared = Math.min(80, priorCleared + proof.cleared);
            const values = [profile.day.games, profile.day.games, profile.day.cleared];
            for (let index = 0; index < TASK_TARGETS.length; index++) {
                if (!profile.day.tasks[index] && values[index] >= TASK_TARGETS[index]) {
                    profile.day.tasks[index] = true;
                    profile.currentWeek.activity += TASK_ACTIVITY[index];
                    await writeReceipt(tx, owner, receiptId(owner, 'task', today + ':' + index), TASK_COINS[index], 0, 'task', today, at);
                }
            }
            await canonicalRef.set({ data: { kind: 'retention_event', owner: owner, mode: event.mode,
                canonical: proof.canonical, date: proof.date, status: 'recorded', createdAt: at } });
            await loaded.ref.set({ data: profile });
            return { profile: profile, eventStatus: 'recorded' };
        });
        if (outcome.error) return outcome.error;
        return response(owner, outcome.profile, at, outcome.eventStatus);
    }

    async function claim(openid, input) {
        const at = now(); const owner = ownerId(openid);
        if (!input || !validDate(input.week) ||
            !Number.isSafeInteger(input.index) || input.index < 0 || input.index >= WEEK_TARGETS.length) {
            return terminal('INVALID_CLAIM', '宝箱领取参数非法');
        }
        const current = weekFor(at);
        if (input.week > current.week) return terminal('INVALID_WEEK', '宝箱周标识非法');
        const outcome = await db.runTransaction(async function (tx) {
            const loaded = await loadProfile(tx, owner, at); const profile = loaded.profile; let target;
            const priorReceipt = await getData(tx.collection('retention_receipts').doc(receiptId(owner, 'weekly', input.week + ':' + input.index)));
            if (priorReceipt && validReceipt(priorReceipt, owner)) {
                if (priorReceipt.rewardKind !== 'weekly' || priorReceipt.date !== input.week ||
                    priorReceipt.coins !== WEEK_COINS[input.index] || priorReceipt.items.hammer !== 0) {
                    throw corrupt('retention weekly receipt is corrupt');
                }
                await loaded.ref.set({ data: profile });
                return { profile: profile, eventStatus: 'recorded' };
            }
            if (input.week === profile.currentWeek.week) {
                target = profile.currentWeek;
                if (target.activity < WEEK_TARGETS[input.index]) return { error: retryable('NOT_ELIGIBLE', '活跃度尚未达到宝箱门槛') };
            } else if (profile.previousWeek && input.week === profile.previousWeek.week && at < profile.previousWeek.expiresAt) {
                target = profile.previousWeek;
                if (!target.available[input.index]) return { error: terminal('NOT_ELIGIBLE', '上周未达到宝箱门槛') };
            } else {
                await loaded.ref.set({ data: profile });
                return { profile: profile, eventStatus: 'expired' };
            }
            if (!target.claimed[input.index]) {
                target.claimed[input.index] = true;
                await writeReceipt(tx, owner, receiptId(owner, 'weekly', input.week + ':' + input.index), WEEK_COINS[input.index], 0, 'weekly', input.week, at);
            }
            await loaded.ref.set({ data: profile });
            return { profile: profile };
        });
        if (outcome.error) return outcome.error;
        return response(owner, outcome.profile, at, outcome.eventStatus);
    }

    async function ack(openid, input) {
        const at = now(); const owner = ownerId(openid);
        if (!input || !Array.isArray(input.receiptIds) || input.receiptIds.length > 50 || input.receiptIds.some(function (id) {
            return typeof id !== 'string' || !/^r[0-9a-f]{30}$/.test(id);
        })) return terminal('INVALID_RECEIPT_IDS', '收据编号格式非法');
        const profile = await db.runTransaction(async function (tx) {
            for (let index = 0; index < input.receiptIds.length; index++) {
                const ref = tx.collection('retention_receipts').doc(input.receiptIds[index]);
                const value = await getData(ref);
                // A committed ACK may outlive the acknowledged receipt's retention window.
                // Missing deterministic IDs are therefore idempotent no-ops; an existing foreign receipt is not.
                if (!value) continue;
                if (value.owner !== owner) return { error: terminal('RECEIPT_OWNER_MISMATCH', '收据身份不符') };
                if (!validReceipt(value, owner)) throw corrupt('retention receipt is corrupt');
                if (!value.acknowledged) await ref.update({ data: { acknowledged: true, acknowledgedAt: at } });
            }
            const loaded = await loadProfile(tx, owner, at);
            await loaded.ref.set({ data: loaded.profile });
            return loaded.profile;
        });
        if (profile.error) return profile.error;
        return response(owner, profile, at);
    }

    async function captureBattleEvidence(tx, room, roomId, quitterOpenid) {
        if (!tx || !room || room.retentionEnabled !== true || room.protocolVersion !== 2 || room.status !== 'finished' ||
            !Number.isSafeInteger(room.roundId) || !Number.isFinite(room.finishedAt) || !Array.isArray(room.players)) return;
        for (let index = 0; index < room.players.length; index++) {
            const player = room.players[index]; const owner = ownerId(player.openid);
            const ref = tx.collection('retention_battle_evidence').doc(battleEvidenceId(owner, roomId, room.roundId));
            if (await getData(ref)) continue;
            await ref.set({ data: { kind: 'retention_battle_evidence', owner: owner, roomId: roomId,
                roundId: room.roundId, score: Number(player.score) || 0,
                quit: room.finishReason === 'leave' && player.openid === quitterOpenid,
                finishedAt: room.finishedAt, createdAt: room.finishedAt } });
        }
    }

    async function cleanup(at) {
        const evidenceCutoff = at - EVIDENCE_RETENTION_MS; const receiptCutoff = at - RECEIPT_RETENTION_MS;
        function missingCollection(error) {
            const value = String(error && (error.errCode || error.code || error.message) || '');
            return /DATABASE_COLLECTION_NOT_EXIST|COLLECTION_NOT_FOUND|collection[^\n]*(?:not.?exist|not.?found)/i.test(value);
        }
        async function remove(name, condition) {
            try { return await db.collection(name).where(condition).remove(); }
            catch (error) {
                if (!missingCollection(error)) throw error;
                console.error('retention cleanup skipped: collection missing', name);
                return { stats: { removed: 0 } };
            }
        }
        const removedEvents = await remove('retention_events', { createdAt: db.command.lt(evidenceCutoff) });
        const removedEvidence = await remove('retention_battle_evidence', { createdAt: db.command.lt(evidenceCutoff) });
        const removedReceipts = await remove('retention_receipts', { acknowledged: true, acknowledgedAt: db.command.lt(receiptCutoff) });
        return [removedEvents, removedEvidence, removedReceipts].reduce(function (sum, result) {
            return sum + Number(result && result.stats && result.stats.removed || 0);
        }, 0);
    }

    return { info: info, sign: sign, record: record, claim: claim, ack: ack, cleanup: cleanup,
        captureBattleEvidence: captureBattleEvidence, ownerId: ownerId, battleEvidenceId: battleEvidenceId };
}

module.exports = { createService: createService, beijingDate: beijingDate, weekFor: weekFor };
