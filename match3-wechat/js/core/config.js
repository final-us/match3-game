/**
 * 游戏配置（数据驱动层）
 * 改这里的配置即可调整玩法，无需改逻辑代码
 */

// 棋子类型定义（占位素材：颜色 + emoji，正式素材后续替换为图片）
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
    mode: 'easy',          // 棋子种类数量
    freeMoves: false,      // 是否允许任意移动（调试用）
    maxLevel: 3            // 当前内置关卡数
};

// 广告配置（上线前在微信小游戏后台创建广告位，填入 adUnitId）
const AD_CONFIG = {
    rewardedAdUnitId: '',  // 激励视频广告位 ID（留空则跳过广告，用于开发调试）
    reviveSteps: 5,        // 看广告复活获得的步数
    reviveLimitPerGame: 1  // 每局复活次数上限
};

// 特殊棋子类型（type 编号 100+，与普通棋子区分）
const SPECIAL_TYPES = {
    H_ROCKET: 101, // 横消火箭：消除时炸整行
    V_ROCKET: 102, // 竖消火箭：消除时炸整列
    BOMB: 103      // 炸弹：消除时炸 3x3
};

/** 特殊棋子显示定义 */
const SPECIAL_DEFS = {
    101: { label: '↔', color: '#E17055', name: '横火箭' },
    102: { label: '↕', color: '#00B894', name: '竖火箭' },
    103: { label: '💣', color: '#6C5CE7', name: '炸弹' }
};

/** 判断是否为特殊棋子 */
function isSpecialType(t) {
    return t === SPECIAL_TYPES.H_ROCKET || t === SPECIAL_TYPES.V_ROCKET || t === SPECIAL_TYPES.BOMB;
}

/** 获取特殊棋子显示定义 */
function getSpecialDef(type) {
    return SPECIAL_DEFS[type] || null;
}

/** 获取当前模式下可用的棋子类型编号列表 */
function getCommonTypes() {
    const count = MODE_TYPES[GAME_CONFIG.mode] || 4;
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
    SPECIAL_TYPES: SPECIAL_TYPES,
    getCommonTypes: getCommonTypes,
    getPieceTypeDef: getPieceTypeDef,
    isSpecialType: isSpecialType,
    getSpecialDef: getSpecialDef
};
