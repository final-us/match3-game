'use strict';

const GameCore = require('./daily-v1/game-core');
const dailyConfig = require('./daily-v1/config');

const DAILY_VERSION = 'daily-v1';
const RNG_VERSION = 'mulberry32-v1';
const DAILY_RULES = Object.freeze({ rows: 8, columns: 8, moveCount: 25, target: 2000, reward: 500 });
const LEGACY_REWARDS = Object.freeze([300]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function seedForDate(date) {
    let hash = 2166136261;
    const text = DAILY_VERSION + ':' + date;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function createRandom(seed) {
    let state = Number(seed) >>> 0;
    return function () {
        state = (state + 0x6D2B79F5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function challengeForDate(date) {
    if (typeof date !== 'string' || !DATE_PATTERN.test(date)) return null;
    const seed = seedForDate(date);
    return {
        version: DAILY_VERSION,
        rngVersion: RNG_VERSION,
        date: date,
        seed: seed,
        target: DAILY_RULES.target,
        reward: DAILY_RULES.reward,
        level: {
            id: DAILY_VERSION + ':' + date,
            rows: DAILY_RULES.rows,
            columns: DAILY_RULES.columns,
            moveCount: DAILY_RULES.moveCount,
            timeLimitSec: 0,
            completeOnMoveLimit: true,
            goals: [{ type: 'score', target: DAILY_RULES.target }],
            underlays: {},
            obstacles: {}
        }
    };
}

function isKnownReward(reward) {
    return reward === DAILY_RULES.reward || LEGACY_REWARDS.includes(reward);
}

function hasChallengeStructure(value, allowLegacyReward) {
    if (!value || value.version !== DAILY_VERSION || value.rngVersion !== RNG_VERSION) return false;
    const expected = challengeForDate(value.date);
    const level = value.level || {};
    const expectedLevel = expected && expected.level;
    const rewardMatches = allowLegacyReward ? isKnownReward(value.reward) : value.reward === DAILY_RULES.reward;
    return !!expected && value.seed === expected.seed && value.target === expected.target && rewardMatches &&
        level.id === expectedLevel.id && level.rows === expectedLevel.rows && level.columns === expectedLevel.columns &&
        level.moveCount === expectedLevel.moveCount && level.timeLimitSec === expectedLevel.timeLimitSec &&
        level.completeOnMoveLimit === true && Array.isArray(level.goals) && level.goals.length === 1 &&
        level.goals[0] && level.goals[0].type === 'score' && level.goals[0].target === expected.target &&
        level.underlays && Object.keys(level.underlays).length === 0 && level.obstacles && Object.keys(level.obstacles).length === 0;
}

function isChallenge(value) { return hasChallengeStructure(value, false); }
function isRecordedChallenge(value) { return hasChallengeStructure(value, true); }

function createCore(challenge, callbacks) {
    if (!isRecordedChallenge(challenge)) throw new Error('invalid daily challenge');
    const canonical = challengeForDate(challenge.date);
    return new GameCore(canonical.level, callbacks || {}, { random: createRandom(canonical.seed) });
}

function validMove(move) {
    const from = move && move.from;
    const to = move && move.to;
    return !!from && !!to && Number.isInteger(from.row) && Number.isInteger(from.column) &&
        Number.isInteger(to.row) && Number.isInteger(to.column) &&
        from.row >= 0 && from.row < DAILY_RULES.rows && from.column >= 0 && from.column < DAILY_RULES.columns &&
        to.row >= 0 && to.row < DAILY_RULES.rows && to.column >= 0 && to.column < DAILY_RULES.columns;
}

async function replay(challenge, moves) {
    if (!isRecordedChallenge(challenge)) return { ok: false, code: 'UNKNOWN_DAILY_VERSION' };
    if (!Array.isArray(moves) || moves.length !== DAILY_RULES.moveCount) return { ok: false, code: 'INVALID_MOVE_COUNT' };
    return replayPrefix(challenge, moves, true);
}

async function replayPrefix(challenge, moves, requireComplete) {
    if (!isRecordedChallenge(challenge)) return { ok: false, code: 'UNKNOWN_DAILY_VERSION' };
    if (!Array.isArray(moves) || moves.length > DAILY_RULES.moveCount) return { ok: false, code: 'INVALID_MOVE_COUNT' };
    const core = createCore(challenge);
    for (let i = 0; i < moves.length; i++) {
        if (!validMove(moves[i])) return { ok: false, code: 'INVALID_MOVE_COORDINATES' };
        const accepted = await core.trySwap(moves[i].from, moves[i].to);
        if (!accepted) return { ok: false, code: 'ILLEGAL_MOVE', index: i };
    }
    if (requireComplete && (!core.ended || core.movesLeft !== 0)) return { ok: false, code: 'INCOMPLETE_RUN' };
    return {
        ok: true,
        moves: moves.length,
        score: core.score,
        maxCascade: core.maxCascade,
        specialComboCount: core.specialComboCount,
        qualified: core.score >= challenge.target
    };
}

module.exports = {
    DAILY_VERSION: DAILY_VERSION,
    RNG_VERSION: RNG_VERSION,
    DAILY_RULES: DAILY_RULES,
    challengeForDate: challengeForDate,
    createCore: createCore,
    replay: replay,
    replayPrefix: replayPrefix,
    isChallenge: isChallenge,
    isRecordedChallenge: isRecordedChallenge,
    seedForDate: seedForDate,
    createRandom: createRandom
};
