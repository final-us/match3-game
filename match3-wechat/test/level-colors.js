'use strict';
// Per-board colors must survive refills/reshuffles/tools without changing PvP or daily.
const assert = require('assert');
const GameCore = require('../js/core/game-core');
const config = require('../js/core/config');
const grid = require('../js/core/grid');
const daily = require('../js/core/daily-v1/config');
const levels = require('../js/core/level');
function core(colorCount) {
    return new GameCore({rows:8,columns:8,colorCount,moveCount:30,
        goals:[{type:'score',target:999999}]}, {});
}
function check(board, count) {
    assert(board.grid.flat().every(type => type >= 1 && type <= count || config.isSpecialType(type)));
}
(async () => {
    for (let id = 1; id <= 10; id++) {
        const level = levels.getLevel(id);
        assert.strictEqual(level.colorCount, id <= 4 ? 4 : 5);
        const board = new GameCore(level, {});
        assert.strictEqual(board.commonTypes.length, id <= 4 ? 4 : 5);
        for (const special of level.initialSpecials || []) {
            assert.strictEqual(board.grid[special.row][special.column], special.type);
        }
    }
    assert.deepStrictEqual(levels.getLevel(1).goals, [{ type: 'score', target: 1000 }]);
    assert.deepStrictEqual(levels.getLevel(2).goals, [{ type: 'collect', pieceType: 1, target: 12 }]);
    assert.deepStrictEqual(levels.getLevel(3).goals, [{ type: 'collect', pieceType: 2, target: 6 }, { type: 'collect', pieceType: 3, target: 6 }]);
    assert.deepStrictEqual(levels.getLevel(4).goals, [{ type: 'collect', pieceType: 4, target: 8 }, { type: 'score', target: 1500 }]);
    assert.deepStrictEqual(levels.getLevel(5).goals, [{ type: 'collect', pieceType: 5, target: 12 }]);
    for (let id = 6; id <= 10; id++) assert.strictEqual(levels.getLevel(id).goals.length, 1);
    const five = core(5), four = core(4), battle = core(undefined);
    assert.deepStrictEqual(config.getCommonTypes(), [1,2,3,4]);
    assert.deepStrictEqual(daily.getCommonTypes(), [1,2,3,4,5]);
    assert.throws(() => core(0), RangeError);
    assert.throws(() => core(7), RangeError);
    for (let iteration=0; iteration<8; iteration++) {
        for (const [board,count] of [[five,5],[four,4],[battle,4]]) {
            await board.autoReshuffle();
            check(board,count);
            assert(board.hasValidMoves());
            assert.strictEqual(grid.getMatches(board.grid).length,0);
            board.grid[7].fill(0);
            await board.settleBoard();
            check(board,count);
        }
    }
    // Fifth color is considered by both color selection and color-ball targeting.
    five.grid = five.grid.map((row,r) => row.map((_,c) => (r+c)%5+1));
    five.grid[3][2]=5; five.grid[3][3]=1; five.grid[3][4]=5;
    assert.strictEqual(five.getSmartColorChoice({row:3,column:3}),5);
    five.grid.forEach(row=>row.fill(5));
    assert.strictEqual(five.getMostFrequentCommonType(),5);
    five.grid[3][3]=104;
    await five.trySwap({row:3,column:3},{row:3,column:4});
    assert(five.collectedCounts[5]>0,'彩球应能清除第五色');
    check(five,5);
    for (const count of [4,5]) {
        const board=core(count);
        board.level.goals=[{type:'collect',pieceType:5,target:3}];
        board.collectedCounts[5]=3;
        board.checkLevelEnd();
        assert.strictEqual(board.won,count===5,'收集目标只接受当前棋盘可用颜色');
    }
    console.log('level colors: isolated 4/5-color boards, refill, reshuffle, color tool, color ball, collect and daily/PvP defaults PASS');
})().catch(error => {console.error(error);process.exitCode=1;});
