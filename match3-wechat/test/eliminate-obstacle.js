/**
 * 精确验证：果冻/冰块标准规则
 * 用法: node test/eliminate-obstacle.js
 * 规则：
 *   果冻：消除命中果冻格 → 果冻破层，棋子保留（需再消一次）
 *   冰块：消除命中冰块格或其上下左右相邻格 → 冰块融化，露出原棋子
 */

const GameCore = require('../js/core/game-core');
const levelData = require('../js/core/level');

(async function () {
    console.log('========== 果冻/冰块标准规则验证 ==========');

    const level = levelData.getLevel(3);
    const core = new GameCore(level, {});

    // 关卡3 布局：冰块(2,2)(2,5)(5,2)(5,5)，果冻(3,3)(3,4)(4,3)(4,4)(2,3)(2,4)(5,3)(5,4)
    console.log('初始: 冰块(2,2)=' + core.iceGrid[2][2] + ' 冰块(2,5)=' + core.iceGrid[2][5] +
        ' 果冻(2,3)=' + core.jellyGrid[2][3] + ' 果冻(2,4)=' + core.jellyGrid[2][4]);

    // 场景：强制 (2,2)(2,3)(2,4) 形成三连消除
    core.grid[2][2] = 7;
    core.grid[2][3] = 7;
    core.grid[2][4] = 7;
    const beforePieces = [core.grid[2][2], core.grid[2][3], core.grid[2][4]];

    await core.processGrid();

    // 断言1：冰块(2,2)融化（自身被消）
    // 断言2：冰块(2,5)融化（邻居(2,4)被消波及）
    // 断言3：果冻(2,3)(2,4)破层
    // 断言4：三个格子棋子全部保留
    const iceOwn = core.iceGrid[2][2] === 0;
    const iceNeighbor = core.iceGrid[2][5] === 0;
    const jelly1 = core.jellyGrid[2][3] === 0;
    const jelly2 = core.jellyGrid[2][4] === 0;
    const pieceKept = core.grid[2][2] !== 0 && core.grid[2][3] !== 0 && core.grid[2][4] !== 0;

    console.log('冰块(2,2)自身被消→融化:', iceOwn ? '✅' : '❌ 还在!');
    console.log('冰块(2,5)相邻波及→融化:', iceNeighbor ? '✅' : '❌ 还在!');
    console.log('果冻(2,3)(2,4)破层:', (jelly1 && jelly2) ? '✅' : '❌');
    console.log('棋子全部保留(果冻/冰块不消棋):', pieceKept ? '✅' : '❌ 棋子被消了!');
    console.log('  棋子现状:', core.grid[2][2] + ',' + core.grid[2][3] + ',' + core.grid[2][4], '(应为非0,非0,非0)');

    // 场景2：果冻已破，再消一次果冻格棋子 → 这次棋子真正消失（有得分）
    const scoreBefore2 = core.score;
    core.grid[2][3] = 8;
    core.grid[2][4] = 8;
    core.grid[2][5] = 8; // (2,5) 冰块已融，棋子可正常消
    await core.processGrid();

    const scoreGained = core.score > scoreBefore2;
    console.log('第二次消除得分增加(棋子被消):', scoreGained ? '✅' : '❌', '(消除+下落填充后格子由新棋子填满属正常)');

    console.log('========================================');
    console.log('结论: ' + (iceOwn && iceNeighbor && jelly1 && jelly2 && pieceKept && scoreGained ? '全部规则正确' : '存在异常'));
})();
