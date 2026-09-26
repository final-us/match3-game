/**
 * 精修的前二十关。这里仅描述任务和布局模板；初始棋盘仍由 GameCore 独立生成，
 * 因而不会把教学关锁定为唯一解。
 */

const CONTENT_REVISION = 'curated-v6-five-colors';
const GENERATOR_VERSION = 'curated-v6';
const TUTORIAL_GENERATOR_VERSION = 'curated-v4';
const TUTORIAL_CONTENT_REVISION = 'curated-v4';

const CUSTOM_LAYOUTS = {
    splitIslands: [[2, 2], [2, 5], [5, 2], [5, 5]],
    moonLanes: [[2, 2], [3, 2], [4, 2], [5, 2], [2, 5], [3, 5], [4, 5], [5, 5]],
    cometCross: [[2, 3], [3, 3], [4, 3], [5, 3], [3, 2], [3, 4], [3, 5]],
    petalRing: [[2, 3], [3, 2], [3, 4], [4, 2], [4, 5], [5, 3], [5, 4]],
    staggeredPetals: [[2, 3], [2, 4], [3, 2], [3, 5], [4, 2], [4, 5], [5, 3], [5, 4]]
};

const LEVELS = [
    { name: '月光初遇', moves: 28, score: 3500 },
    { name: '轻轻交换', moves: 26, score: 3850 },
    { name: '四连星光', moves: 26, score: 4000 },
    { name: '彩球花园', moves: 25, score: 4160 },
    { name: '猫爪练习', moves: 25, score: 4300 },
    { name: '草莓收集', moves: 27, collect: [1, 42] },
    { name: '薄荷收集', moves: 25, collect: [2, 32], jelly: 'center6' },
    { name: '抹茶果冻', moves: 25, collect: [3, 32], jelly: 'center8' },
    { name: '葡萄冰晶', moves: 24, collect: [4, 28], jelly: 'center8', ice: 'icePair' },
    { name: '月夜收集', moves: 25, collect: [1, 28], jelly: 'columns10' },
    { name: '火箭相遇', moves: 26, score: 3100, yarn: true },
    { name: '炸弹花圃', moves: 26, score: 3450, jelly: 'moonLanes' },
    { name: '彩球微光', moves: 25, score: 3450, jelly: 'cometCross', ice: 'icePair' },
    { name: '十字星轨', moves: 25, score: 3500, jelly: 'petalRing', ice: 'icePair' },
    { name: '月光连携', moves: 25, score: 3250, jelly: 'staggeredPetals', ice: 'iceCorners' },
    { name: '回暖花园', moves: 25, collect: [2, 22], score: 3350, yarn: true },
    { name: '薄荷果冻', moves: 25, collect: [3, 35], jelly: 'center8' },
    { name: '葡萄迷宫', moves: 24, collect: [4, 28], jelly: 'center8', ice: 'icePair' },
    { name: '猫爪风暴', moves: 24, collect: [1, 26], jelly: 'columns10', yarn: true },
    { name: '月夜挑战', moves: 24, collect: [2, 28], jelly: 'center8', ice: 'iceCorners' }
];

function goalList(def, underlays) {
    const goals = [];
    if (def.collect) goals.push({ type: 'collect', pieceType: def.collect[0], target: def.collect[1] });
    if (def.jelly) goals.push({ type: 'jelly', target: Object.keys(underlays).length });
    if (def.yarn) goals.push({ type: 'yarn', target: 3 });
    if (def.score) goals.push({ type: 'score', target: def.score });
    return goals;
}

function transformCell(cell, variant) {
    let row = cell[0];
    let column = cell[1];
    if (variant >= 4) column = 7 - column;
    for (let i = 0; i < variant % 4; i++) {
        const previousRow = row;
        row = column;
        column = 7 - previousRow;
    }
    return row + ':' + column;
}

function layoutFor(patternName, variant, options) {
    const cells = CUSTOM_LAYOUTS[patternName];
    if (!cells) return options.makeLayout(patternName, variant);
    const layout = {};
    for (let i = 0; i < cells.length; i++) layout[transformCell(cells[i], variant)] = 1;
    return layout;
}

function getCuratedLevel(levelId, options) {
    const def = LEVELS[levelId - 1];
    if (!def) return null;
    const target = options.targetFor(levelId);
    const variant = options.variantFor(levelId);
    const underlays = layoutFor(def.jelly, variant, options);
    const obstacles = layoutFor(def.ice, variant, options);
    return {
        id: levelId,
        name: def.name,
        rows: options.rows,
        columns: options.columns,
        colorCount: levelId <= 5 ? 4 : 5,
        timeLimitSec: options.timeFor(target, levelId),
        moveCount: def.moves,
        goals: goalList(def, underlays),
        underlays: underlays,
        obstacles: obstacles,
        yarn: def.yarn ? options.makeYarn(underlays, obstacles, variant) : null,
        targetWinRate: target,
        generatorVersion: levelId === 1 ? TUTORIAL_GENERATOR_VERSION : levelId <= 5 ? 'curated-v5' : def.yarn && levelId !== 11 ? 'curated-v7' : GENERATOR_VERSION,
        contentRevision: levelId === 1 ? TUTORIAL_CONTENT_REVISION : levelId <= 5 ? 'curated-v5-difficulty' : levelId === 11 ? 'curated-v7-yarn-intro' : def.yarn ? 'curated-v7-yarn-rollout' : CONTENT_REVISION
    };
}

module.exports = {
    CONTENT_REVISION: CONTENT_REVISION,
    GENERATOR_VERSION: GENERATOR_VERSION,
    getCuratedLevel: getCuratedLevel
};
