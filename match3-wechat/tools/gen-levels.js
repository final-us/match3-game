/**
 * 关卡生成脚本（开发工具，一次性运行）
 * 用法: node tools/gen-levels.js
 * 生成 levels/level4.js ~ level20.js，并重写 js/core/level.js（含全部关卡注册）
 * 关卡设计按难度曲线：简单纯分 → 果冻 → 果冻+冰块 → 挑战
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// ===== 障碍位置模板（8x8 棋盘常用 pattern）=====
const PATTERNS = {
    // 中心 4 格
    center4: ['3:3', '3:4', '4:3', '4:4'],
    // 中心 8 格（2x4）
    center8: ['2:3', '2:4', '3:3', '3:4', '4:3', '4:4', '5:3', '5:4'],
    // 中心 12 格（十字+四角内）
    center12: ['2:3', '2:4', '3:2', '3:3', '3:4', '3:5', '4:2', '4:3', '4:4', '4:5', '5:3', '5:4'],
    // 中心 16 格
    center16: ['2:2', '2:3', '2:4', '2:5', '3:2', '3:3', '3:4', '3:5', '4:2', '4:3', '4:4', '4:5', '5:2', '5:3', '5:4', '5:5'],
    // 双列果冻（3、4 列）
    col34: ['2:3', '2:4', '3:3', '3:4', '4:3', '4:4', '5:3', '5:4', '6:3', '6:4'],
    // 四角内圈冰块
    iceCorner: ['2:2', '2:5', '5:2', '5:5'],
    // 四角内圈 + 中上中下
    iceSpread: ['2:2', '2:5', '5:2', '5:5', '2:3', '2:4', '5:3', '5:4'],
    // 密集冰块（上下两排）
    iceDense: ['2:2', '2:3', '2:4', '2:5', '5:2', '5:3', '5:4', '5:5']
};

/** 过滤与果冻重叠的位置（同一格不叠放） */
function filterOverlap(jelly, ice) {
    return (ice || []).filter(function (key) { return (jelly || []).indexOf(key) === -1; });
}

/**
 * 关卡配置表（4-20 关）
 * type: 'score' 纯分 | 'jelly' 果冻 | 'mix' 果冻+分数 | 'hard' 果冻+冰块+分数
 */
const LEVEL_CONFIGS = [
    // ---- 第 4-7 关：简单（纯分递进 / 果冻入门）----
    { name: '甜蜜开场', moveCount: 22, type: 'jelly', jelly: PATTERNS.center4, goals: [{ type: 'jelly', target: 4 }] },
    { name: '草莓奶昔', moveCount: 20, type: 'score', goals: [{ type: 'score', target: 4500 }] },
    { name: '果冻花园', moveCount: 22, type: 'jelly', jelly: PATTERNS.center8, goals: [{ type: 'jelly', target: 8 }] },
    { name: '缤纷世界', moveCount: 20, type: 'score', goals: [{ type: 'score', target: 4500 }] },
    // ---- 第 8-11 关：中等（果冻增多 / 冰块初现）----
    { name: '冰镇果冻', moveCount: 20, type: 'mix', jelly: PATTERNS.center8, ice: PATTERNS.iceCorner, goals: [{ type: 'jelly', target: 8 }, { type: 'score', target: 4000 }] },
    { name: '果冻风暴', moveCount: 20, type: 'jelly', jelly: PATTERNS.center12, goals: [{ type: 'jelly', target: 12 }] },
    { name: '双倍挑战', moveCount: 18, type: 'mix', jelly: PATTERNS.center8, goals: [{ type: 'jelly', target: 8 }, { type: 'score', target: 3500 }] },
    { name: '果冻列车', moveCount: 20, type: 'jelly', jelly: PATTERNS.col34, goals: [{ type: 'jelly', target: 10 }] },
    // ---- 第 12-15 关：较难（果冻+冰块）----
    { name: '冰火考验', moveCount: 18, type: 'hard', jelly: PATTERNS.center8, ice: PATTERNS.iceCorner, goals: [{ type: 'jelly', target: 8 }, { type: 'score', target: 3500 }] },
    { name: '深陷重围', moveCount: 18, type: 'hard', jelly: PATTERNS.center12, ice: PATTERNS.iceCorner, goals: [{ type: 'jelly', target: 12 }] },
    { name: '雪山之巅', moveCount: 16, type: 'hard', jelly: PATTERNS.center8, ice: PATTERNS.iceSpread, goals: [{ type: 'jelly', target: 8 }, { type: 'score', target: 3000 }] },
    { name: '极限冲刺', moveCount: 16, type: 'score', goals: [{ type: 'score', target: 4000 }] },
    // ---- 第 16-20 关：挑战（障碍密集 / 高分目标）----
    { name: '果冻深渊', moveCount: 16, type: 'hard', jelly: PATTERNS.center12, ice: PATTERNS.iceCorner, goals: [{ type: 'jelly', target: 12 }] },
    { name: '冰晶迷宫', moveCount: 16, type: 'hard', jelly: PATTERNS.center8, ice: PATTERNS.iceSpread, goals: [{ type: 'jelly', target: 8 }, { type: 'score', target: 3500 }] },
    { name: '绝地求生', moveCount: 15, type: 'hard', jelly: PATTERNS.center12, ice: PATTERNS.iceSpread, goals: [{ type: 'jelly', target: 12 }, { type: 'score', target: 2500 }] },
    { name: '王者之路', moveCount: 15, type: 'hard', jelly: PATTERNS.center8, ice: PATTERNS.iceDense, goals: [{ type: 'jelly', target: 8 }, { type: 'score', target: 2500 }] },
    { name: '终极挑战', moveCount: 15, type: 'hard', jelly: PATTERNS.center12, ice: PATTERNS.iceSpread, goals: [{ type: 'jelly', target: 12 }, { type: 'score', target: 2500 }] }
];

function buildLevelData(id, cfg) {
    const data = {
        id: id,
        name: cfg.name,
        rows: 8,
        columns: 8,
        moveCount: cfg.moveCount,
        goals: cfg.goals
    };
    if (cfg.jelly) {
        const underlays = {};
        for (let i = 0; i < cfg.jelly.length; i++) {
            underlays[cfg.jelly[i]] = 1;
        }
        data.underlays = underlays;
        // 果冻目标自动等于果冻格子数
        for (let i = 0; i < data.goals.length; i++) {
            if (data.goals[i].type === 'jelly') data.goals[i].target = cfg.jelly.length;
        }
    }
    if (cfg.ice) {
        const ice = filterOverlap(cfg.jelly, cfg.ice);
        if (ice.length) {
            const obstacles = {};
            for (let i = 0; i < ice.length; i++) {
                obstacles[ice[i]] = 1;
            }
            data.obstacles = obstacles;
        }
    }
    return data;
}

function jsify(data) {
    return '// 关卡数据：第 ' + data.id + ' 关（数据驱动，加关卡 = 复制本文件改数据 + 在 level.js 注册）\n' +
        'module.exports = ' + JSON.stringify(data, null, 4) + ';\n';
}

// 生成 level4-20.js
for (let i = 0; i < LEVEL_CONFIGS.length; i++) {
    const id = i + 4;
    const data = buildLevelData(id, LEVEL_CONFIGS[i]);
    const file = path.join(ROOT, 'levels', 'level' + id + '.js');
    fs.writeFileSync(file, jsify(data), 'utf8');
    console.log('生成 levels/level' + id + '.js [' + data.name + ']');
}

// 重写 level.js（静态 require 20 关，微信小游戏不支持动态 require）
const requireLines = [];
const arrayLines = [];
for (let i = 1; i <= 20; i++) {
    requireLines.push("const level" + i + " = require('../../levels/level" + i + "');");
    arrayLines.push('level' + i);
}

const levelJs = `/**
 * 关卡数据加载器（数据驱动）
 * 关卡数据来自 levels/*.js 文件（唯一数据源）
 * 注意：微信小游戏不支持 require JSON 与动态 require，必须静态列明
 * 加关卡 = 新建 levels/levelN.js + 在此注册
 */

${requireLines.join('\n')}

const LEVELS = [${arrayLines.join(', ')}];

/** 按关卡号取关卡数据 */
function getLevel(levelId) {
    for (let i = 0; i < LEVELS.length; i++) {
        if (LEVELS[i].id === levelId) return LEVELS[i];
    }
    return null;
}

/** 关卡总数 */
function getLevelCount() {
    return LEVELS.length;
}

module.exports = {
    LEVELS: LEVELS,
    getLevel: getLevel,
    getLevelCount: getLevelCount
};
`;

fs.writeFileSync(path.join(ROOT, 'js', 'core', 'level.js'), levelJs, 'utf8');
console.log('已更新 js/core/level.js（共 20 关）');
console.log('完成 ✅');
