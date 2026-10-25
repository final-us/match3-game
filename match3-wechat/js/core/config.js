/**
 * 游戏配置（数据驱动层）
 * 改这里的配置即可调整玩法，无需改逻辑代码
 */

// 棋子类型定义（颜色 + emoji 作为无图片时的后备显示）
// type 编号从 1 开始，0 保留表示空位
// 颜色为糖果风马卡龙色系，与 theme.js 风格统一
const PIECE_TYPES = [
    { id: 1, color: '#FF8FAB', label: '🍎' },  // 草莓粉
    { id: 2, color: '#8ED1C4', label: '💎' },  // 薄荷青
    { id: 3, color: '#A8E6A3', label: '🍀' },  // 抹茶绿
    { id: 4, color: '#C9B6F0', label: '🍇' },  // 香芋紫
    { id: 5, color: '#FFE29A', label: '⭐' },  // 奶油黄
    { id: 6, color: '#FFC49B', label: '🍊' }   // 蜜桃橙
];

// 每种棋子类型对应的棋子数量（控制难度）
// easy: 4 种 / normal: 5 种 / hard: 6 种
const MODE_TYPES = {
    easy: 4,
    normal: 5,
    hard: 6
};

// 默认游戏配置
const GAME_CONFIG = {
    title: '猫猫开心消',
    mode: 'easy',          // 棋子种类数量
    freeMoves: false       // 是否允许任意移动（调试用）
};

// 用户已批准本地测试候选广告启用；模拟广告保持关闭。
const AD_CONFIG = {
    enabled: true,
    debugMockAds: false,
    rewardedAdUnitId: 'adunit-035fb16fac04d21b',
    interstitialAdUnitId: 'adunit-d4c3fac373ac66c1',
    reviveSteps: 5,
    interstitialEveryGames: 3,
    interstitialCooldownMs: 120000
};

// 通用事件/监控上报保持关闭；微信关卡/首页分析使用下方独立配置。
const REPORTING_CONFIG = {
    enabled: false,
    eventIds: {},
    monitorNames: {}
};

// 2026-10-23用户要求正式上线准备；此为本地正式候选，上传/发布另行确认。
// 事件10000003已由账号模板确认；不依赖广告归因或首页branchId。
const LEVEL_ANALYTICS_CONFIG = {
    enabled: true,
    testOnly: false,
    debug: false,
    debugInTest: true, // 仅确认开发版/体验版时启用原生调试和安全本地诊断。
    gameVersion: null // 未指定时由实际微信发布版本推导，取不到就省略。
};

// 用户提供的实际branchId已完成iPhone曝光/点击提交核对；正式候选关闭调试日志。
const HOME_ANALYTICS_CONFIG = {
    enabled: true,
    testOnly: false,
    debug: false,
    branches: { solo: 'BCBgAAoXHx5d0hJfR8jiP3', pvp: 'BCBgAAoXHx5d0hJfR8jiP0' }
};

// 系统场景7由微信关联启动耗时；不填业务侧Date差作为costTime。
const STARTUP_ANALYTICS_CONFIG = { enabled: true, testOnly: false };

// 首次消除/引导指标需账号后台先定义。当前仅保留本地事件，不猜事件名上报。
const MILESTONE_ANALYTICS_CONFIG = {
    enabled: false,
    testOnly: true,
    eventIds: { board_ready: '', first_match: '', guide_confirm: '', guide_skip: '' }
};

// 特殊棋子类型（type 编号 100+，与普通棋子区分）
const OBJECT_TYPES = { PARCEL: 201 };

const SPECIAL_TYPES = {
    H_ROCKET: 101, // 横消火箭：消除时炸整行
    V_ROCKET: 102, // 竖消火箭：消除时炸整列
    BOMB: 103,     // 炸弹：消除时炸 3x3
    COLOR_BALL: 104, // 猫爪彩球：消除一种颜色或参与特殊组合
    TRACKING_PAW: 105,
    COLOR_BELL: 106
};

/** 特殊棋子显示定义 */
const SPECIAL_DEFS = {
    101: { label: '↔', color: '#E17055', name: '横火箭' },
    102: { label: '↕', color: '#00B894', name: '竖火箭' },
    103: { label: '💣', color: '#6C5CE7', name: '炸弹' },
    104: { label: '🐾', color: '#F7B731', name: '猫爪彩球' },
    105: { label: '🐾', color: '#F3A5C5', name: '追踪猫爪' },
    106: { label: '♧', color: '#FFE29A', name: '染色铃铛' }
};

/** 判断是否为特殊棋子 */
function isSpecialType(t) {
    return t === SPECIAL_TYPES.H_ROCKET || t === SPECIAL_TYPES.V_ROCKET ||
        t === SPECIAL_TYPES.BOMB || t === SPECIAL_TYPES.COLOR_BALL || t === SPECIAL_TYPES.TRACKING_PAW ||
        t === SPECIAL_TYPES.COLOR_BELL;
}

/** 获取特殊棋子显示定义 */
function getSpecialDef(type) {
    return SPECIAL_DEFS[type] || null;
}

/** 获取当前模式下可用的棋子类型编号列表 */
function getCommonTypes(colorCount) {
    const count = colorCount === undefined ? (MODE_TYPES[GAME_CONFIG.mode] || 4) : colorCount;
    if (!Number.isInteger(count) || count < 4 || count > PIECE_TYPES.length) throw new RangeError('Invalid color count');
    const types = [];
    for (let i = 0; i < count; i++) {
        types.push(PIECE_TYPES[i].id);
    }
    return types;
}

/** 按 id 获取棋子类型定义 */
function getPieceTypeDef(id) {
    for (let i = 0; i < PIECE_TYPES.length; i++) {
        if (PIECE_TYPES[i].id === id) return PIECE_TYPES[i];
    }
    return null;
}

module.exports = {
    PIECE_TYPES: PIECE_TYPES,
    GAME_CONFIG: GAME_CONFIG,
    AD_CONFIG: AD_CONFIG,
    REPORTING_CONFIG: REPORTING_CONFIG,
    LEVEL_ANALYTICS_CONFIG: LEVEL_ANALYTICS_CONFIG,
    HOME_ANALYTICS_CONFIG: HOME_ANALYTICS_CONFIG,
    STARTUP_ANALYTICS_CONFIG: STARTUP_ANALYTICS_CONFIG,
    MILESTONE_ANALYTICS_CONFIG: MILESTONE_ANALYTICS_CONFIG,
    SPECIAL_TYPES: SPECIAL_TYPES,
    OBJECT_TYPES: OBJECT_TYPES,
    getCommonTypes: getCommonTypes,
    getPieceTypeDef: getPieceTypeDef,
    isSpecialType: isSpecialType,
    getSpecialDef: getSpecialDef
};
