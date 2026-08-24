/**
 * 确定性无限关卡生成器。
 * 同一 generatorVersion + 正整数关卡号始终得到相同任务配置；每次挑战的棋盘仍由 GameCore 随机生成。
 */

const generatorVersion = 'infinite-v3';
const ROWS = 8;
const COLUMNS = 8;
const TARGET_CURVE_EARLY = [95, 88, 85, 82, 76, 73, 70, 64, 60, 52];
const TARGET_CURVE_MID = [84, 82, 79, 76, 73, 70, 67, 63, 57, 50];
const TARGET_CURVE_LATE = [82, 80, 77, 74, 71, 68, 65, 61, 55, 49];
const TARGET_CURVE_CYCLE = [80, 78, 76, 73, 70, 68, 65, 62, 56, 48];
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
const CACHE = Object.create(null);

function normalizeLevelId(levelId) {
    const value = Number(levelId);
    if (!Number.isFinite(value) || value <= 0 || Math.floor(value) !== value || value > Number.MAX_SAFE_INTEGER) return 0;
    return value;
}

function seedFor(levelId) {
    const text = generatorVersion + ':' + String(levelId);
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
    if (levelId <= 30) return TARGET_CURVE_LATE[levelId - 21];
    return TARGET_CURVE_CYCLE[(levelId - 31) % TARGET_CURVE_CYCLE.length];
}

function timeFor(target, levelId) {
    if (levelId === 1) return 0;
    if (target >= 80) return 180;
    if (target >= 68) return 165;
    if (target >= 58) return 150;
    return 135;
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

/**
 * 使用上一版 20 关的实测配置作为锚点，避免未标定的随机障碍把难度放大数倍。
 */
function profileFor(target, levelId) {
    if (levelId === 1) return { moves: 28, score: 3600 };
    if (target >= 90) return { moves: 28, score: 3800 };
    if (target >= 86) return { moves: 28, score: 3950 };
    if (target >= 83) return { moves: 28, score: 4050 };
    if (target >= 80) return { moves: 26, score: 4200 };
    if (target >= 75) return { moves: 27, score: 4200 };
    if (target >= 72) return { moves: 28, jelly: 'center6', ice: 'icePair' };
    if (target >= 69) return { moves: 25, score: 4300 };
    if (target >= 68) return { moves: 26, jelly: 'center8' };
    if (target >= 62) return { moves: target >= 65 ? 26 : 25, jelly: 'center8', score: target >= 65 ? 2700 : 3200 };
    if (target >= 59) return { moves: 24, score: 4500 };
    if (target >= 58) return { moves: 23, jelly: 'center8', ice: 'iceCorners', score: 3200 };
    if (target >= 53) return { moves: 26, jelly: 'center8' };
    if (target >= 50) return { moves: 26, jelly: 'columns10' };
    return { moves: 24, jelly: 'center8', ice: 'iceCorners', score: 3800 };
}

function makeGoals(profile, underlays) {
    const goals = [];
    const jellyCount = Object.keys(underlays).length;
    if (jellyCount) goals.push({ type: 'jelly', target: jellyCount });
    if (profile.score) goals.push({ type: 'score', target: profile.score });
    return goals;
}

function generateLevel(levelId) {
    const target = targetFor(levelId);
    const profile = profileFor(target, levelId);
    if (profile.score && levelId > 1) profile.score += ((levelId + seedFor(2)) % 3 - 1) * 40;
    const variant = (levelId - 1 + seedFor(1)) % 8;
    const underlays = makeLayout(profile.jelly, variant);
    const obstacles = makeLayout(profile.ice, variant);
    const name = LEVEL_NAMES[(levelId - 1) % LEVEL_NAMES.length] + (levelId > LEVEL_NAMES.length ? ' · ' + levelId : '');
    return {
        id: levelId,
        name: name,
        rows: ROWS,
        columns: COLUMNS,
        timeLimitSec: timeFor(target, levelId),
        moveCount: profile.moves,
        goals: makeGoals(profile, underlays),
        underlays: underlays,
        obstacles: obstacles,
        targetWinRate: target,
        generatorVersion: generatorVersion
    };
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
    getLevel: getLevel,
    getTargetWinRate: getTargetWinRate
};
