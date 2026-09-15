/**
 * 主题配置（数据驱动：改这里就能换整套 UI 配色，无需动逻辑代码）
 * B 风格：月光水晶（浅雾蓝 + 珍珠玻璃 + 樱花粉）
 */

const THEME = {
    // 背景（自上而下渐变）
    bgTop: '#A9BBDF',
    bgMid: '#CBD6EF',
    bgBottom: '#E8E7F4',

    // 主色调（粉，用于主按钮/强调）
    primary: '#C788B6',
    primaryLight: '#DCA4CE',
    primaryDark: '#AF719E',

    // 成功色（薄荷绿，用于胜利/确认按钮）
    success: '#D9E8FF',
    successDark: '#A7BDE5',

    // 危险色（草莓红，失败/扣分）
    danger: '#FF5E78',

    // 文本（深色用于浅底卡片，浅色用于月夜场景）
    textDark: '#303C70',
    textMid: '#5D6A90',
    textScene: '#303C70',
    textSceneMuted: '#5D6A90',
    textLight: '#303C70',  // 浅色按钮文字
    textWhite: '#FFFFFF',

    // 卡片/面板
    cardBg: 'rgba(240, 243, 255, 0.94)',
    glassBg: 'rgba(240, 243, 255, 0.94)',
    glassBgSoft: 'rgba(222, 231, 250, 0.88)',
    glassBorder: 'rgba(255, 255, 255, 0.90)',
    gold: '#E4D0AE',
    cardShadow: 'rgba(62, 78, 128, 0.22)',

    // 棋盘
    boardBg: 'rgba(151, 170, 214, 0.82)',
    boardBorder: 'rgba(255, 255, 255, 0.86)',
    tileEmpty: 'rgba(240, 243, 255, 0.34)',

    // 体力
    heartRed: '#FF4D6D',

    // 次要按钮（返回/置灰）
    btnGrayTop: '#E3EAF9',
    btnGrayBottom: '#B6C5E4',
    btnGrayText: '#303C70',

    // 商店按钮（金色点缀）
    shopTop: '#F4E7CC',
    shopBottom: '#E4D0AE',

    // 分享按钮（天蓝点缀）
    shareTop: '#D9E8FF',
    shareBottom: '#A7BDE5'
};

module.exports = THEME;
