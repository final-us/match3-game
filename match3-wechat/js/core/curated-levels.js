/** Short introductions; the cat board remains independently random. */
const config = require('./config');
const GENERATOR_VERSION = 'curated-v8';
const CONTENT_REVISION = 'curated-v8-century';
const LEVELS = [
    { name: '月光初遇', moves: 18, goals: [{ type: 'score', target: 1000 }] },
    { name: '火箭初遇', moves: 20, goals: [{ type: 'collect', pieceType: 1, target: 12 }],
        specials: [{ row: 4, column: 3, type: config.SPECIAL_TYPES.H_ROCKET }] },
    { name: '猫爪初遇', moves: 22, goals: [{ type: 'collect', pieceType: 2, target: 6 }, { type: 'collect', pieceType: 3, target: 6 }],
        specials: [{ row: 4, column: 3, type: config.SPECIAL_TYPES.TRACKING_PAW }, { row: 3, column: 4, type: config.SPECIAL_TYPES.BOMB }] },
    { name: '铃铛染色', moves: 22, goals: [{ type: 'collect', pieceType: 4, target: 8 }, { type: 'score', target: 1500 }],
        specials: [{ row: 4, column: 3, type: config.SPECIAL_TYPES.COLOR_BELL }] },
    { name: '第五色相遇', moves: 22, goals: [{ type: 'collect', pieceType: 5, target: 12 }] },
    { name: '果冻花园', moves: 24, goals: [{ type: 'jelly', target: 4 }], underlays: { '2:2': 1, '2:5': 1, '5:2': 1, '5:5': 1 } },
    { name: '冰晶花园', moves: 24, goals: [{ type: 'ice', target: 2 }], obstacles: { '2:3': 1, '5:4': 1 } },
    { name: '毛线源头', moves: 24, goals: [{ type: 'yarn', target: 3 }], yarn: { source: '3:3', health: 3, spreadEvery: 2, maxVines: 3 } },
    { name: '月相花园', moves: 24, goals: [{ type: 'moonbud', target: 2 }], moonbuds: ['3:3', '4:4'] },
    { name: '小鱼干配送', moves: 24, goals: [{ type: 'parcel', target: 1 }], parcels: [{ id: 'parcel-1', row: 4, column: 2 }], parcelExits: [2] }
];
function getCuratedLevel(id, options) {
    const def = LEVELS[id - 1];
    if (!def) return null;
    const level = JSON.parse(JSON.stringify(def));
    level.id = id;
    level.rows = level.columns = 8;
    level.colorCount = id <= 4 ? 4 : 5;
    level.timeLimitSec = id <= 4 ? 0 : 180;
    level.moveCount = level.moves;
    delete level.moves;
    level.underlays = level.underlays || {};
    level.obstacles = level.obstacles || {};
    level.yarn = level.yarn || null;
    if (level.specials) { level.initialSpecials = level.specials; delete level.specials; }
    level.targetWinRate = options.targetFor(id);
    level.generatorVersion = GENERATOR_VERSION;
    level.contentRevision = CONTENT_REVISION;
    return level;
}
module.exports = { GENERATOR_VERSION, CONTENT_REVISION, getCuratedLevel };
