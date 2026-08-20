/**
 * 主题配置（数据驱动：改这里就能换整套 UI 配色，无需动逻辑代码）
 * 风格：糖果甜心（粉嫩马卡龙色系，圆润Q弹）
 */

const THEME = {
    // 背景（自上而下渐变）
    bgTop: '#FFE3EE',      // 浅粉
    bgMid: '#FFF3E0',      // 奶油黄
    bgBottom: '#F3E8FF',   // 淡紫粉

    // 主色调（粉，用于主按钮/强调）
    primary: '#FF7BA9',
    primaryLight: '#FFA6C5',
    primaryDark: '#E75A8C',

    // 成功色（薄荷绿，用于胜利/确认按钮）
    success: '#5ED6A5',
    successDark: '#3FB98C',

    // 危险色（草莓红，失败/扣分）
    danger: '#FF5E78',

    // 文本
    textDark: '#5A4252',   // 主文字（深棕紫）
    textMid: '#9A8292',    // 次要文字（灰紫）
    textLight: '#FFFFFF',  // 按钮文字

    // 卡片/面板
    cardBg: '#FFFFFF',
    cardShadow: 'rgba(231, 90, 140, 0.22)',

    // 棋盘
    boardBg: '#FFF0F5',    // 奶粉
    boardBorder: '#F0C8D8',
    tileEmpty: 'rgba(255,255,255,0.6)',

    // 体力
    heartRed: '#FF4D6D',

    // 次要按钮（返回/置灰）
    btnGrayTop: '#EDE0E8',
    btnGrayBottom: '#D8C8D4',
    btnGrayText: '#9A8292',

    // 商店按钮（金色点缀）
    shopTop: '#FFE3A3',
    shopBottom: '#FFC94D',

    // 分享按钮（天蓝点缀）
    shareTop: '#C4E3FF',
    shareBottom: '#7FB8F5'
};

module.exports = THEME;
