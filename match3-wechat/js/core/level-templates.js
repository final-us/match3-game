/** A finite recipe book with a checked seam; absolute IDs only vary coordinates inside a family. */
const { getMoveBudget } = require('./level-budgets');
const FAMILY_NAMES = ['双岛', '错位分区', '分段通道', '边缘开口', '长短路径', '中心与两侧'];
// Ordered, asymmetric shapes, rather than six rotations of a single shape.
const SHAPES = [
    [[2,1],[2,2],[3,1],[3,2],[5,5],[5,6],[6,5],[6,6],[2,3],[4,2],[4,5],[5,4],[1,1],[1,6],[3,5],[6,3]],
    [[1,2],[2,4],[3,1],[4,3],[5,5],[6,2],[1,5],[2,1],[3,4],[4,6],[5,2],[6,5],[2,6],[4,1],[6,4],[3,6]],
    [[1,2],[2,2],[4,2],[5,2],[2,5],[3,5],[5,5],[6,5],[1,3],[4,3],[3,6],[6,6],[2,1],[5,1],[1,5],[4,5]],
    [[1,1],[2,1],[1,6],[6,1],[4,1],[3,6],[5,6],[6,6],[1,3],[6,4],[2,5],[5,2],[3,1],[4,6],[2,3],[5,4]],
    [[1,3],[2,3],[3,3],[5,3],[6,3],[3,6],[4,6],[6,6],[1,1],[2,1],[5,1],[6,1],[4,4],[2,5],[5,5],[3,1]],
    [[3,3],[3,4],[5,1],[4,4],[2,1],[5,6],[2,6],[5,1],[1,3],[6,4],[3,1],[4,6],[1,6],[6,1],[2,4],[5,3]]
];
// RECIPE_BOOK is generated offline once, never searched at lookup time.
const RECIPE_BOOK = [
    ["BI",5],["YC",3],["BC",4],["BP",4],["C",3],["JY",1],["BC",2],["BP",3],["PJ",3],["JIY",3],
    ["PI",4],["YC",5],["JC",5],["BJ",3],["C",1],["BI",0],["JC",1],["JY",2],["BP",0],["BPI",2],
    ["JI",1],["YC",1],["PC",2],["PJ",4],["S",2],["BJ",4],["JC",3],["BP",5],["PJ",1],["JIY",1],
    ["PI",3],["BP",2],["IC",3],["JY",3],["S",0],["JY",0],["IC",5],["BP",4],["BI",4],["JIY",4],
    ["BJ",1],["YC",3],["PC",0],["JY",1],["C",3],["PI",0],["YC",4],["PJ",0],["JY",2],["BPI",1],
    ["JI",2],["PJ",3],["IC",4],["BP",0],["S",4],["BI",3],["PC",3],["JI",3],["PJ",4],["BPI",2],
    ["BJ",2],["JI",4],["YC",2],["JI",1],["C",2],["BP",3],["YC",0],["JY",0],["BP",5],["JIY",3],
    ["PJ",1],["BP",1],["BC",1],["JY",4],["CC",1],["PI",3],["YC",5],["BJ",5],["PJ",2],["BPI",5],
    ["BI",2],["YC",1],["IC",1],["BP",2],["S",0],["BI",0],["JC",1],["JI",5],["BP",0],["JIY",2],
    ["JI",0],["BP",4],["YC",3],["PJ",3],["CC",4],["BI",1],["JC",2],["JY",5],["BP",3],["BPI",2],
    ["JI",4],["YC",0],["PC",2],["JI",1],["CC",3],["PI",1],["IC",0],["BP",1],["PJ",0],["JIY",5],
    ["BI",5],["YC",2],["JC",0],["BP",5],["CC",2],["BJ",2],["BC",3],["JY",4],["BJ",5],["BPI",5],
    ["PI",2],["YC",1],["IC",4],["JY",0],["C",5],["BP",2],["BC",5],["JI",2],["BP",0],["BPJ",3],
    ["JI",0],["YC",3],["BC",0],["JY",2],["C",4],["JY",1],["BC",1],["BP",3],["PJ",3],["JIY",2],
    ["BI",0],["PJ",2],["JC",5],["BP",4],["CC",3],["BP",1],["BC",4],["JY",3],["BJ",4],["BPI",4],
    ["PJ",5],["JI",5],["BC",3],["BJ",2],["CC",1],["JY",4],["YC",1],["JI",3],["PJ",0],["BPI",5],
    ["BJ",3],["JI",2],["PC",3],["JY",5],["C",1],["BJ",0],["BC",5],["JI",4],["BP",5],["BPJ",2],
    ["JI",1],["BP",3],["YC",5],["BP",0],["CC",0],["BJ",1],["YC",2],["JI",0],["BP",2],["JIY",5],
    ["PJ",1],["BI",2],["IC",4],["PJ",3],["S",5],["BI",0],["IC",1],["BJ",4],["JY",1],["BPI",0],
    ["PI",0],["YC",3],["IC",5],["JI",3],["S",3],["PI",2],["PC",3],["JY",0],["BI",4],["BPJ",1],
    ["PJ",0],["BI",1],["YC",0],["PJ",2],["S",0],["BJ",0],["PC",1],["JI",5],["JY",2],["BPI",1],
    ["PI",5],["YC",5],["PC",5],["PJ",5],["CC",5],["BP",0],["JC",5],["BJ",3],["BI",3],["JIY",0],
    ["PJ",1],["BI",2],["PC",4],["BP",1],["C",4],["BJ",4],["YC",1],["JY",5],["PJ",4],["BPI",5],
    ["BI",4],["PJ",0],["IC",1],["BJ",1],["S",4],["BI",1],["BC",1],["JY",3],["PJ",2],["BPI",4]
];
function seedFor(id) {
    const text = 'century-v8:' + id;
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return hash >>> 0;
}
function makeLevel(id) {
    const index = (id - 11) % RECIPE_BOOK.length;
    let [kind, family] = RECIPE_BOOK[index];
    // The first chapter teaches two-way combinations; subsequent chapter ends use three.
    if (id === 20) { kind = 'JY'; family = 4; }
    const slot = (id - 11) % 10, c = Math.floor((id - 11) / 10);
    if (slot === 4) kind = ['S','C','CC'][c % 3];
    const tier = id <= 20 ? 0 : id <= 40 ? 1 : id <= 60 ? 2 : id <= 90 ? 3 : 4;
    const hard = slot === 3 || slot >= 7;
    const single = /^[JIBPY]C$/.test(kind);
    const offset = (family + c % 2) % 2;
    let jelly = kind.includes('J') ? (single ? [6,6,8,10,10][tier] + offset * 2 : [4,4,6,6,6][tier] + (hard ? 2 : 0) + offset * 2) : 0;
    let ice = kind.includes('I') ? (single ? [3,3,4,4,4][tier] + offset : [2,2,3,3,4][tier] + (hard ? offset : 0)) : 0;
    ice = Math.min(6, ice + (ice && tier >= 3 && hard ? 1 : 0));
    let buds = kind.includes('B') ? Math.min(8, (single ? [3,3,4,5,6][tier] : [2,3,4,4,5][tier] + (hard ? 1 : 0)) + offset + (tier === 4 && hard ? 1 : 0)) : 0;
    // One long edge route avoids stacking several bottom-corner setup requirements.
    const edgeDelivery = tier === 4 && kind === 'PJ' && family === 3;
    const parcels = edgeDelivery ? 1 : kind.includes('P') ? (single ? [2,2,2,2,3][tier] + (tier >= 2 && tier <= 3 ? offset : 0) : [1,1,2,2,2][tier] + (hard && tier >= 3 ? offset : 0)) : 0;
    const yarn = kind.includes('Y') ? 1 : 0;
    const cap = id <= 40 ? 10 : id <= 60 ? 12 : 14;
    // Flower cells now lock cats too. Keep the existing total and per-row lock budgets.
    jelly = Math.min(12, jelly, cap - ice - yarn);
    const excess = Math.max(0, jelly + ice + yarn + buds - cap);
    const jellyTrim = Math.min(excess, Math.max(0, jelly - 4));
    jelly -= jellyTrim;
    buds -= excess - jellyTrim;
    // Delivery already needs a cleared route; leave room around the three-goal jelly recipes.
    if (kind === 'BPJ') buds = Math.min(6, buds);
    const double = tier >= 3 && (kind === 'JC' || kind === 'JI') && family % 2 === 0 ? 2 : 0;
    const seed = seedFor(id);
    const level = {
        id, name: '月夜花园 · ' + id, rows: 8, columns: 8, colorCount: 5,
        moveCount: getMoveBudget(id),
        timeLimitSec: slot === 9 || parcels || buds ? 180 : 165,
        goals: [], underlays: {}, obstacles: {}, yarn: null,
        generatorVersion: 'infinite-v8', contentRevision: 'infinite-v8-century-moves-v1' + (edgeDelivery ? '-edge-delivery-v1' : ''),
        recipeKind: kind, layoutFamily: slot === 4 ? '开放棋盘' : FAMILY_NAMES[family]
    };
    const used = new Set(), deliveryCols = [];
    const columns = [[1,5,3],[2,6,4],[1,4,6],[0,7,3],[2,5,0],[1,6,4]][family];
    if (parcels) {
        const baseRow = [3,3,2,1,1][tier] - family % 2;
        level.parcels = columns.slice(0, parcels).map((col, i) => {
            const column = seed % 2 ? 7 - col : col;
            // Family 4 gives unequal path lengths; all remain within the stage band.
            const row = family === 4 && i === 1 ? Math.max(0, baseRow - 1) : baseRow;
            used.add(row + ':' + column); deliveryCols.push(column);
            return { id: 'parcel-' + (i + 1), row, column };
        });
        level.parcelExits = deliveryCols.slice();
    }
    if (kind === 'YC') {
        const source = [[1,1],[1,2],[1,3],[2,2],[2,3],[3,3]][family];
        const key = source[0] + ':' + (seed % 2 ? 7 - source[1] : source[1]);
        level.yarn = { source: key, health: 3, spreadEvery: 2, maxVines: 3 };
        level.goals.push({ type: 'yarn', target: 3 });
        used.add(key);
        level.layoutFamily = ['偏边角','偏边近侧','边缘中段','内侧角','内侧中段','中心'][family];
    }
    const shift = (seed >>> 1) % 2;
    const ordered = SHAPES[family].map(([r,col]) => [1 + (r - 1 + shift) % 6, seed % 2 ? 7 - col : col]);
    // Combined delivery tasks put a removable lock on each vertical route.
    if (parcels && (jelly || ice)) {
        const pathCells = level.parcels.map(p => [Math.min(6, p.row + 1 + family % 2), p.column]);
        ordered.unshift(...pathCells);
    }
    // Complete the pool for combined budgets, preserving a free top/bottom row.
    for (let r = 1; r <= 6; r++) for (let col = 0; col < 8; col++) {
        if (!ordered.some(cell => cell[0] === r && cell[1] === col)) ordered.push([r,col]);
    }
    const lockCounts = Array(8).fill(0);
    if (level.yarn) lockCounts[Number(level.yarn.source.split(':')[0])]++;
    function take(count, avoidDelivery, lock) {
        const result = [];
        for (const [r,col] of ordered) {
            const key = r + ':' + col;
            if (used.has(key) || avoidDelivery && deliveryCols.includes(col) || lock && lockCounts[r] >= 5) continue;
            used.add(key); result.push(key);
            if (lock) lockCounts[r]++;
            if (result.length === count) break;
        }
        if (result.length !== count) throw new Error('Invalid recipe space ' + id);
        return result;
    }
    if (jelly) {
        take(jelly, false, true).forEach((key,i) => { level.underlays[key] = i < double ? 2 : 1; });
        level.goals.push({ type: 'jelly', target: jelly + double });
    }
    if (ice) {
        take(ice, false, true).forEach(key => { level.obstacles[key] = 1; });
        level.goals.push({ type: 'ice', target: ice });
    }
    if (yarn && kind !== 'YC') {
        level.yarn = { source: take(1, false, true)[0], health: 3, spreadEvery: 2, maxVines: 3 };
        level.goals.push({ type: 'yarn', target: 3 });
    }
    if (buds) {
        level.moonbuds = take(buds, true, true);
        level.goals.push({ type: 'moonbud', target: buds });
    }
    if (parcels) level.goals.push({ type: 'parcel', target: parcels });
    if (single || kind === 'C' || kind === 'CC') {
        const pieceType = seed % 5 + 1;
        level.goals.push({ type: 'collect', pieceType, target: kind === 'CC' ? 8 + 2 * (c % 6 >= 3 ? 1 : 0) : kind === 'C' ? 20 + 2 * (c % 6 >= 3 ? 1 : 0) : 18 + tier * 2 });
        if (kind === 'CC') level.goals.push({ type: 'collect', pieceType: pieceType % 5 + 1, target: 8 + 2 * (c % 6 >= 3 ? 1 : 0) });
    }
    if (kind === 'S') level.goals.push({ type: 'score', target: 2500 + tier * 150 + (c % 6 >= 3 ? 200 : 0) });
    return level;
}
module.exports = { makeLevel };
