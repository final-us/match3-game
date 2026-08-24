// 关卡数据：第 3 关（数据驱动，加关卡 = 复制本文件改数据 + 在 level.js 注册）
module.exports = {
    id: 3,
    name: '渐入佳境',
    rows: 8,
    columns: 8,
    timeLimitSec: 180,
    moveCount: 28,
    // 目标：清完所有果冻
    goals: [
        { type: 'jelly', target: 8 }
    ],
    // 果冻层（统一 1 层，消除即消失）
    underlays: {
        '3:3': 1, '3:4': 1, '4:3': 1, '4:4': 1,
        '2:3': 1, '2:4': 1, '5:3': 1, '5:4': 1
    }
};
