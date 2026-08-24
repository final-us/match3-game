// 关卡数据：第 4 关（数据驱动，加关卡 = 复制本文件改数据 + 在 level.js 注册）
module.exports = {
    "id": 4,
    "name": "甜蜜开场",
    "rows": 8,
    "columns": 8,
    "timeLimitSec": 180,
    "moveCount": 28,
    "goals": [
        {
            "type": "jelly",
            "target": 6
        }
    ],
    "underlays": {
        "3:3": 1,
        "3:4": 1,
        "4:3": 1,
        "4:4": 1,
        "5:3": 1,
        "5:4": 1
    },
    "obstacles": {
        "2:2": 1,
        "5:5": 1
    }
};
