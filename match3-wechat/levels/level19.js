// 关卡数据：第 19 关（数据驱动，加关卡 = 复制本文件改数据 + 在 level.js 注册）
module.exports = {
    "id": 19,
    "name": "王者之路",
    "rows": 8,
    "columns": 8,
    "moveCount": 15,
    "goals": [
        {
            "type": "jelly",
            "target": 8
        },
        {
            "type": "score",
            "target": 2500
        }
    ],
    "underlays": {
        "2:3": 1,
        "2:4": 1,
        "3:3": 1,
        "3:4": 1,
        "4:3": 1,
        "4:4": 1,
        "5:3": 1,
        "5:4": 1
    },
    "obstacles": {
        "2:2": 1,
        "2:5": 1,
        "5:2": 1,
        "5:5": 1
    }
};
