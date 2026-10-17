/** Stable local solo state. No callbacks, RNG state or asynchronous work is persisted. */
const GameCore = require('./game-core');
const config = require('./config');
const LEVEL_FIELDS = ['id', 'name', 'rows', 'columns', 'colorCount', 'moveCount', 'timeLimitSec',
    'goals', 'underlays', 'obstacles', 'yarn', 'moonbuds', 'parcels', 'parcelExits',
    'initialSpecials', 'trackingPaw', 'colorBell', 'targetWinRate', 'generatorVersion',
    'contentRevision', 'recipeKind', 'layoutFamily'];
const NUMBERS = ['jellyTotal', 'iceTotal', 'yarnTurns', 'score', 'movesLeft', 'timeLimitMs',
    'timeLeftMs', 'minMatchCount', 'maxCascade', 'specialComboCount', 'parcelDelivered',
    'parcelTotal', 'moonbudTotal'];
const BOOLEANS = ['timerStarted', 'timerPaused', 'ended', 'won', 'moonbudOpen'];
const DATA_FIELDS = ['grid', 'commonTypes', 'specialBases', 'jellyGrid', 'iceGrid',
    'yarnSource', 'yarnVines', 'moonbudCells', 'parcels', 'parcelExits', 'collectedCounts']
    .concat(NUMBERS, BOOLEANS);
const QUEUES = ['pendingTriggers', 'pendingRemovals', 'preferredGenerationPositions',
    'pendingPawSquares', 'pendingBellShapes'];
const uint = (n) => Number.isSafeInteger(n) && n >= 0;
const record = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const fields = (v, allowed) => record(v) && Object.keys(v).every(k => allowed.indexOf(k) !== -1);
const exact = (v, allowed) => fields(v, allowed) && Object.keys(v).length === allowed.length;

// Inspect descriptors before reading values: reject getters, prototypes, cycles and oversized trees.
function safeJSON(value, seen = new Set(), depth = 0, budget = { left: 50000 }) {
    if (--budget.left < 0 || depth > 12) return false;
    if (value === null || typeof value === 'boolean') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (typeof value === 'string') return value.length <= 4096;
    if (typeof value !== 'object' || seen.has(value)) return false;
    const array = Array.isArray(value);
    if (array ? Object.getPrototypeOf(value) !== Array.prototype : !record(value)) return false;
    const keys = Reflect.ownKeys(value);
    if (array && (value.length > 4096 || keys.length !== value.length + 1)) return false;
    seen.add(value);
    for (const key of keys) {
        if (array && key === 'length') continue;
        if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].indexOf(key) !== -1 ||
            (array && !/^(0|[1-9]\d*)$/.test(key))) return false;
        const desc = Object.getOwnPropertyDescriptor(value, key);
        if (!desc.enumerable || !Object.prototype.hasOwnProperty.call(desc, 'value') ||
            !safeJSON(desc.value, seen, depth + 1, budget)) return false;
    }
    seen.delete(value);
    return true;
}

function validate(snapshot) {
    try {
        if (!safeJSON(snapshot) || !exact(snapshot, ['schema', 'level', 'state']) || ![1, 2].includes(snapshot.schema)) return false;
        const l = snapshot.level, d = snapshot.state;
        if (!fields(l, LEVEL_FIELDS) || !exact(d, DATA_FIELDS) ||
            !Number.isInteger(l.rows) || l.rows < 3 || l.rows > 64 ||
            !Number.isInteger(l.columns) || l.columns < 3 || l.columns > 64) return false;
        const pos = p => fields(p, ['id', 'row', 'column', 'type', 'health', 'maxHealth']) &&
            uint(p.row) && p.row < l.rows && uint(p.column) && p.column < l.columns;
        const keyPos = key => /^(0|[1-9]\d*):(0|[1-9]\d*)$/.test(key) &&
            pos({ row: Number(key.split(':')[0]), column: Number(key.split(':')[1]) });
        const map = (v, predicate) => record(v) && Object.keys(v).every(k => keyPos(k) && predicate(v[k], k));
        const matrix = (v, predicate) => Array.isArray(v) && v.length === l.rows &&
            v.every(row => Array.isArray(row) && row.length === l.columns && row.every(predicate));
        const common = config.getCommonTypes(l.colorCount);
        const color = n => common.indexOf(n) !== -1;
        const piece = n => color(n) || config.isSpecialType(n) || n === config.OBJECT_TYPES.PARCEL;
        if (!Array.isArray(d.commonTypes) || JSON.stringify(d.commonTypes) !== JSON.stringify(common) ||
            !matrix(d.grid, piece) || !matrix(d.jellyGrid, uint) || !matrix(d.iceGrid, n => n === 0 || n === 1)) return false;
        if (!NUMBERS.every(k => ['timeLimitMs', 'timeLeftMs'].indexOf(k) !== -1 ?
            Number.isFinite(d[k]) && d[k] >= 0 : uint(d[k])) || !BOOLEANS.every(k => typeof d[k] === 'boolean') ||
            (d.minMatchCount !== 3 && d.minMatchCount !== 4) || (d.won && !d.ended)) return false;
        // Timer deltas can be fractional milliseconds; all other counters are integers.
        if (l.moveCount !== undefined && (!uint(l.moveCount) || l.moveCount === 0)) return false;
        if (l.timeLimitSec !== undefined && (!Number.isFinite(l.timeLimitSec) || l.timeLimitSec < 0)) return false;
        if (l.id !== undefined && (!uint(l.id) || !l.id)) return false;
        for (const k of ['name', 'generatorVersion', 'contentRevision', 'recipeKind', 'layoutFamily']) {
            if (l[k] !== undefined && typeof l[k] !== 'string') return false;
        }
        for (const k of ['trackingPaw', 'colorBell']) if (l[k] !== undefined && typeof l[k] !== 'boolean') return false;
        if (l.targetWinRate !== undefined && (!Number.isFinite(l.targetWinRate) || l.targetWinRate < 0 || l.targetWinRate > 100)) return false;
        if (d.timeLimitMs !== (l.timeLimitSec > 0 ? l.timeLimitSec * 1000 : 0)) return false;
        if (!map(d.specialBases, (n, k) => color(n) && config.isSpecialType(d.grid[Number(k.split(':')[0])][Number(k.split(':')[1])])) ||
            !map(d.yarnVines, n => n === true) || !map(d.moonbudCells, n => n === true) ||
            !record(d.collectedCounts) || !Object.keys(d.collectedCounts).every(k => String(Number(k)) === k && color(Number(k)) && uint(d.collectedCounts[k]))) return false;
        for (const k of ['underlays', 'obstacles']) {
            if (l[k] !== undefined && !map(l[k], n => uint(n) && n > 0 && (k !== 'obstacles' || n === 1))) return false;
        }
        if (l.yarn !== undefined && l.yarn !== null && (!exact(l.yarn, ['source', 'health', 'spreadEvery', 'maxVines']) ||
            !keyPos(l.yarn.source) || !uint(l.yarn.health) || !l.yarn.health ||
            !uint(l.yarn.spreadEvery) || !l.yarn.spreadEvery || !uint(l.yarn.maxVines))) return false;
        if (d.yarnSource !== null && (!exact(d.yarnSource, ['row', 'column', 'health', 'maxHealth']) ||
            !pos(d.yarnSource) || !uint(d.yarnSource.health) || !uint(d.yarnSource.maxHealth) ||
            !l.yarn || d.yarnSource.maxHealth !== l.yarn.health || d.yarnSource.health > d.yarnSource.maxHealth ||
            d.yarnSource.row + ':' + d.yarnSource.column !== l.yarn.source)) return false;
        if (!!l.yarn !== !!d.yarnSource || (!d.yarnSource || !d.yarnSource.health) && Object.keys(d.yarnVines).length) return false;
        const exits = v => Array.isArray(v) && v.every((n, i) => uint(n) && n < l.columns && v.indexOf(n) === i);
        const parcels = v => Array.isArray(v) && v.every((p, i) => exact(p, ['id', 'row', 'column']) && pos(p) &&
            typeof p.id === 'string' && p.id.length > 0 && v.findIndex(q => q.id === p.id) === i &&
            v.findIndex(q => q.row === p.row && q.column === p.column) === i);
        if (!exits(d.parcelExits) || !parcels(d.parcels) ||
            (l.parcelExits !== undefined && !exits(l.parcelExits)) || (l.parcels !== undefined && !parcels(l.parcels)) ||
            JSON.stringify(d.parcelExits) !== JSON.stringify(l.parcelExits || []) ||
            d.parcelTotal !== (l.parcels || []).length || d.parcelDelivered + d.parcels.length !== d.parcelTotal) return false;
        if (!d.parcels.every(p => d.parcelExits.indexOf(p.column) !== -1 &&
            d.grid[p.row][p.column] === config.OBJECT_TYPES.PARCEL && (l.parcels || []).some(q => q.id === p.id))) return false;
        if (d.grid.flat().filter(n => n === config.OBJECT_TYPES.PARCEL).length !== d.parcels.length) return false;
        if (l.moonbuds !== undefined && (!Array.isArray(l.moonbuds) || !l.moonbuds.every((k, i) => keyPos(k) && l.moonbuds.indexOf(k) === i))) return false;
        if (d.moonbudTotal !== (l.moonbuds || []).length || !Object.keys(d.moonbudCells).every(k => (l.moonbuds || []).indexOf(k) !== -1)) return false;
        const total = v => Object.values(v || {}).reduce((a, b) => a + b, 0);
        const at = (matrix, k) => matrix[Number(k.split(':')[0])][Number(k.split(':')[1])];
        if (!Object.keys(d.yarnVines).every(k => !at(d.iceGrid, k) && !at(d.jellyGrid, k) &&
            !d.moonbudCells[k] && !config.isSpecialType(at(d.grid, k)) && at(d.grid, k) !== config.OBJECT_TYPES.PARCEL)) return false;
        if (!d.jellyGrid.every((row, r) => row.every((n, c) => n <= ((l.underlays || {})[r + ':' + c] || 0))) ||
            !d.iceGrid.every((row, r) => row.every((n, c) => n <= ((l.obstacles || {})[r + ':' + c] || 0)))) return false;
        if (d.jellyTotal !== total(l.underlays) || total(d.jellyGrid.flat()) > d.jellyTotal ||
            d.iceTotal !== Object.keys(l.obstacles || {}).length || total(d.iceGrid.flat()) > d.iceTotal) return false;
        if (l.initialSpecials !== undefined && (!Array.isArray(l.initialSpecials) || !l.initialSpecials.every(p =>
            exact(p, ['row', 'column', 'type']) && pos(p) && config.isSpecialType(p.type)))) return false;
        // Initial obstacle ownership must also be legal; Main compares the full level revision.
        const occupied = new Set(Object.keys(l.underlays || {}).concat(Object.keys(l.obstacles || {})));
        if (l.yarn) {
            if (occupied.has(l.yarn.source)) return false;
            occupied.add(l.yarn.source);
            if (Object.keys(d.yarnVines).length > l.yarn.maxVines) return false;
        }
        for (const key of (l.moonbuds || []).concat((l.parcels || []).map(p => p.row + ':' + p.column))) {
            if (occupied.has(key)) return false;
            occupied.add(key);
        }
        if (!(l.initialSpecials || []).every(p => !occupied.has(p.row + ':' + p.column))) return false;
        if (!(l.parcels || []).every(p => (l.parcelExits || []).indexOf(p.column) !== -1)) return false;
        if (l.goals !== undefined && (!Array.isArray(l.goals) || !l.goals.every(g => fields(g, ['type', 'target', 'pieceType']) &&
            ['score', 'collect', 'jelly', 'ice', 'yarn', 'moonbud', 'parcel'].indexOf(g.type) !== -1 &&
            uint(g.target) && (g.type !== 'collect' || color(g.pieceType))))) return false;
        for (const goal of l.goals || []) {
            const targets = { ice: d.iceTotal, yarn: l.yarn && l.yarn.health,
                moonbud: d.moonbudTotal, parcel: d.parcelTotal };
            if (Object.prototype.hasOwnProperty.call(targets, goal.type) &&
                (!goal.target || goal.target !== targets[goal.type])) return false;
        }
        return true;
    } catch (_) { return false; }
}

function capture(core) {
    if (core.processing || core.swapFeedbackPending || core.moonbudPhasePending || core.yarnAdvancePending ||
        core.pendingCombo || QUEUES.some(k => core[k].length) || Object.keys(core.pendingBellColors).length) {
        throw new Error('Cannot capture unstable solo state');
    }
    const data = {};
    DATA_FIELDS.forEach(k => { data[k] = core[k]; });
    const snapshot = { schema: 2, level: core.level, state: data };
    if (!validate(snapshot)) throw new Error('Invalid solo state');
    return JSON.parse(JSON.stringify(snapshot));
}

function compatible(snapshot) {
    return validate(snapshot) && (snapshot.schema === 2 ||
        (!(snapshot.level.moonbuds || []).length && !snapshot.level.yarn));
}

function restore(snapshot, callbacks) {
    if (!validate(snapshot)) throw new Error('Invalid solo snapshot');
    if (!compatible(snapshot)) {
        const error = new Error('Incompatible solo obstacle rules');
        error.code = 'incompatible_rules';
        throw error;
    }
    const copy = JSON.parse(JSON.stringify(snapshot));
    // Do not run the constructor: it generates a fresh board and initializes a new round.
    const core = Object.create(GameCore.prototype);
    core.level = copy.level;
    Object.assign(core, copy.state);
    core.callbacks = callbacks || {};
    core.random = undefined;
    core.timerPaused = true;
    core.processing = false;
    core.swapFeedbackPending = false;
    core.moonbudPhasePending = false;
    core.yarnAdvancePending = false;
    core.pendingCombo = null;
    QUEUES.forEach(k => { core[k] = []; });
    core.pendingBellColors = {};
    return core;
}

/** Mulberry32: uint32 seed, deterministic [0, 1), not for security. */
function random(seed) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Invalid uint32 seed');
    let state = seed;
    return function () {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), state | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

module.exports = { capture, restore, validate, compatible, random };
