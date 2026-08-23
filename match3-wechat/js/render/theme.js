/**
 * 主题配置（数据驱动：改这里就能换整套 UI 配色，无需动逻辑代码）
 * 风格：月夜猫咪花园（深蓝夜空 + 薰衣草紫 + 樱花粉）
 */

const THEME = {
    // 背景（自上而下渐变）
    bgTop: '#142052',
    bgMid: '#34336F',
    bgBottom: '#8B5E92',

    // 主色调（粉，用于主按钮/强调）
    primary: '#F16FAD',
    primaryLight: '#FF9CC8',
    primaryDark: '#D44F91',

    // 成功色（薄荷绿，用于胜利/确认按钮）
    success: '#9D83E8',
    successDark: '#7659C7',

    // 危险色（草莓红，失败/扣分）
    danger: '#FF5E78',

    // 文本（深色用于浅底卡片，浅色用于月夜场景）
    textDark: '#403452',
    textMid: '#81738F',
    textScene: '#FFF5FC',
    textSceneMuted: '#E4D5F2',
    textLight: '#FFFFFF',  // 按钮文字

    // 卡片/面板
    cardBg: 'rgba(248, 239, 255, 0.95)',
    glassBg: 'rgba(24, 25, 76, 0.82)',
    glassBgSoft: 'rgba(45, 42, 101, 0.72)',
    glassBorder: 'rgba(255, 220, 241, 0.72)',
    gold: '#FFD58A',
    cardShadow: 'rgba(17, 22, 67, 0.34)',

    // 棋盘
    boardBg: 'rgba(27, 28, 86, 0.88)',
    boardBorder: 'rgba(255, 213, 138, 0.86)',
    tileEmpty: 'rgba(255, 242, 252, 0.14)',

    // 体力
    heartRed: '#FF4D6D',

    // 次要按钮（返回/置灰）
    btnGrayTop: '#8C82B0',
    btnGrayBottom: '#625A8A',
    btnGrayText: '#EDE7F5',

    // 商店按钮（金色点缀）
    shopTop: '#FFE3A3',
    shopBottom: '#FFC94D',

    // 分享按钮（天蓝点缀）
    shareTop: '#C4E3FF',
    shareBottom: '#7FB8F5'
};

module.exports = THEME;
