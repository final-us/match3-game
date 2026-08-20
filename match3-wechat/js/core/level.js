/**
 * 关卡数据加载器（数据驱动）
 * 关卡数据来自 levels/*.js 文件（唯一数据源）
 * 注意：微信小游戏不支持 require JSON 与动态 require，必须静态列明
 * 加关卡 = 新建 levels/levelN.js + 在此注册
 */

const level1 = require('../../levels/level1');
const level2 = require('../../levels/level2');
const level3 = require('../../levels/level3');
const level4 = require('../../levels/level4');
const level5 = require('../../levels/level5');
const level6 = require('../../levels/level6');
const level7 = require('../../levels/level7');
const level8 = require('../../levels/level8');
const level9 = require('../../levels/level9');
const level10 = require('../../levels/level10');
const level11 = require('../../levels/level11');
const level12 = require('../../levels/level12');
const level13 = require('../../levels/level13');
const level14 = require('../../levels/level14');
const level15 = require('../../levels/level15');
const level16 = require('../../levels/level16');
const level17 = require('../../levels/level17');
const level18 = require('../../levels/level18');
const level19 = require('../../levels/level19');
const level20 = require('../../levels/level20');

const LEVELS = [level1, level2, level3, level4, level5, level6, level7, level8, level9, level10, level11, level12, level13, level14, level15, level16, level17, level18, level19, level20];

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
