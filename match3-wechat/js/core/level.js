/**
 * 单人无限关卡源。前 20 关使用精修内容，21 关起使用 infinite-v5 难度版；
 * 每次挑战的棋盘仍由 GameCore 随机生成。
 */

const curatedLevels = require('./curated-levels');

const generatorVersion = 'curated-v6/v7 + infinite-v5/v6';
const INFINITE_GENERATOR_VERSION = 'infinite-v5';
const LAYOUT_SEED_VERSION = 'infinite-v3';
const INFINITE_CONTENT_REVISION = 'infinite-v5-progressive-colors';
const YARN_GENERATOR_VERSION = 'infinite-v6';
const YARN_CONTENT_REVISION = 'infinite-v6-yarn-cycle';
const ROWS = 8;
const COLUMNS = 8;
const TARGET_CURVE_EARLY = [95, 80, 77, 74, 69, 85, 78, 72, 65, 58];
const TARGET_CURVE_MID = [78, 73, 70, 65, 60, 75, 65, 60, 55, 45];
const TARGET_CURVE_CYCLE = [60, 58, 55, 54, 51, 48, 45, 42, 36, 28];
// 每十关保留起伏，同时逐段提高底线；增幅逐渐放缓，避免无限压缩到不可玩。
function progressionFor(levelId) {
    const chapter = Math.floor((levelId - 21) / 10);
    return chapter / (chapter + 10);
}
const INFINITE_PROFILES = [
    { moves: 24, score: 3650 },
    { moves: 24, score: 3750 },
    { moves: 24, score: 3850 },
    { moves: 24, score: 3500, jelly: 'center6', ice: 'icePair' },
    { moves: 24, score: 3950 },
    { moves: 24, score: 3500, jelly: 'center8' },
    { moves: 24, score: 3500, jelly: 'center8' },
    { moves: 23, score: 3500, jelly: 'center8' },
    { moves: 23, score: 3600, jelly: 'center8' },
    { moves: 24, score: 4100, jelly: 'center8', ice: 'iceCorners' }
];
const LEVEL_NAMES = [
    '新手入门', '小试牛刀', '渐入佳境', '甜蜜开场', '草莓奶昔',
    '果冻花园', '缤纷世界', '冰镇果冻', '果冻风暴', '双倍挑战',
    '果冻列车', '冰火考验', '深陷重围', '雪山之巅', '极限冲刺',
    '果冻深渊', '冰晶迷宫', '绝地求生', '王者之路', '终极挑战'
];
const PATTERNS = {
    center6: [[3, 3], [3, 4], [4, 3], [4, 4], [5, 3], [5, 4]],
    center8: [[2, 3], [2, 4], [3, 3], [3, 4], [4, 3], [4, 4], [5, 3], [5, 4]],
    columns10: [[2, 3], [2, 4], [3, 3], [3, 4], [4, 3], [4, 4], [5, 3], [5, 4], [6, 3], [6, 4]],
    icePair: [[2, 2], [5, 5]],
    iceCorners: [[2, 2], [2, 5], [5, 2], [5, 5]]
};
const YARN_SOURCE_CANDIDATES = [
    [3, 3], [3, 4], [4, 3], [4, 4], [3, 5], [4, 5],
    [2, 4], [5, 4], [2, 5], [5, 5], [3, 2], [4, 2]
];
const CACHE = Object.create(null);

function normalizeLevelId(levelId) {
    const value = Number(levelId);
    if (!Number.isFinite(value) || value <= 0 || Math.floor(value) !== value || value > Number.MAX_SAFE_INTEGER) return 0;
    return value;
}

/** v3 布局 seed 保持冻结，避免难度版无意改动 21 关及后的模板方位。 */
function layoutSeedFor(levelId) {
    const text = LAYOUT_SEED_VERSION + ':' + String(levelId);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function targetFor(levelId) {
    if (levelId <= 10) return TARGET_CURVE_EARLY[levelId - 1];
    if (levelId <= 20) return TARGET_CURVE_MID[levelId - 11];
    return Math.max(10, TARGET_CURVE_CYCLE[(levelId - 21) % TARGET_CURVE_CYCLE.length] - Math.round(26 * progressionFor(levelId)));
}

function timeFor(target, levelId) {
    if (levelId === 1) return 0;
    // 五色精修关单独给出思考预算，避免改目标通过率时隐式改变限时。
    if (levelId >= 6 && levelId <= 20) return [165,165,150,135,135,165,165,150,150,150,165,150,135,120,120][levelId-6];
    if (target >= 80) return 180;
    if (target >= 68) return 165;
    if (target >= 58) return 150;
    return 120;
}

/** 8 种旋转/镜像变体不改变模板密度和难度，只改变视觉布局。 */
function transformCell(cell, variant) {
    let row = cell[0];
    let column = cell[1];
    if (variant >= 4) column = COLUMNS - 1 - column;
    const turns = variant % 4;
    for (let i = 0; i < turns; i++) {
        const oldRow = row;
        row = column;
        column = COLUMNS - 1 - oldRow;
    }
    return row + ':' + column;
}

function makeLayout(patternName, variant) {
    const layout = {};
    const pattern = PATTERNS[patternName] || [];
    for (let i = 0; i < pattern.length; i++) layout[transformCell(pattern[i], variant)] = 1;
    return layout;
}

function makeYarn(underlays, obstacles, variant) {
    for (let i = 0; i < YARN_SOURCE_CANDIDATES.length; i++) {
        const source = transformCell(YARN_SOURCE_CANDIDATES[i], variant);
        if (!underlays[source] && !obstacles[source]) {
            return { source: source, health: 3, spreadEvery: 2, maxVines: 3 };
        }
    }
    throw new Error('No free yarn source cell');
}

function hasInfiniteYarn(position) {
    return position === 2 || position === 5 || position === 9;
}

function makeGoals(profile, underlays) {
    const goals = [];
    const jellyCount = Object.keys(underlays).length;
    if (jellyCount) goals.push({ type: 'jelly', target: jellyCount });
    if (profile.score) goals.push({ type: 'score', target: profile.score });
    return goals;
}

function generateInfiniteLevel(levelId) {
    const target = targetFor(levelId);
    const position = (levelId - 21) % 10;
    const pressure = progressionFor(levelId);
    const profile = Object.assign({}, INFINITE_PROFILES[position]);
    profile.moves -= Math.floor(2 * pressure);
    profile.score = Math.round(profile.score * (1 + 0.2 * pressure) / 10) * 10;
    const variant = (levelId - 1 + layoutSeedFor(1)) % 8;
    const underlays = makeLayout(profile.jelly, variant);
    const obstacles = makeLayout(profile.ice, variant);
    const yarn = hasInfiniteYarn(position) ? makeYarn(underlays, obstacles, variant) : null;
    const name = LEVEL_NAMES[(levelId - 1) % LEVEL_NAMES.length] + (levelId > LEVEL_NAMES.length ? ' · ' + levelId : '');
    return {
        id: levelId,
        name: name,
        rows: ROWS,
        columns: COLUMNS,
        colorCount: 5,
        timeLimitSec: position < 3 ? 165 : position < 6 ? 150 : 135,
        moveCount: profile.moves,
        goals: yarn ? makeGoals(profile, underlays).concat({ type: 'yarn', target: yarn.health }) : makeGoals(profile, underlays),
        underlays: underlays,
        obstacles: obstacles,
        yarn: yarn,
        targetWinRate: target,
        generatorVersion: yarn ? YARN_GENERATOR_VERSION : INFINITE_GENERATOR_VERSION,
        contentRevision: yarn ? YARN_CONTENT_REVISION : INFINITE_CONTENT_REVISION
    };
}

function generateLevel(levelId) {
    if (levelId <= 20) {
        return curatedLevels.getCuratedLevel(levelId, {
            rows: ROWS,
            columns: COLUMNS,
            targetFor: targetFor,
            timeFor: timeFor,
            makeLayout: makeLayout,
            makeYarn: makeYarn,
            variantFor: function (id) { return (id - 1 + layoutSeedFor(1)) % 8; }
        });
    }
    return generateInfiniteLevel(levelId);
}

function getLevel(levelId) {
    const id = normalizeLevelId(levelId);
    if (!id) return null;
    if (!CACHE[id]) CACHE[id] = generateLevel(id);
    return CACHE[id];
}

function getTargetWinRate(levelId) {
    const id = normalizeLevelId(levelId);
    return id ? targetFor(id) : null;
}

module.exports = {
    generatorVersion: generatorVersion,
    legacyGeneratorVersion: INFINITE_GENERATOR_VERSION,
    infiniteGeneratorVersion: INFINITE_GENERATOR_VERSION,
    curatedGeneratorVersion: curatedLevels.GENERATOR_VERSION,
    getLevel: getLevel,
    getTargetWinRate: getTargetWinRate
};
