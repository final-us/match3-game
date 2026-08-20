/**
 * 双人对战 UI 绘制模块
 * 所有按钮返回 {x, y, w, h} 区域，由 Main 统一做点击命中检测
 * 包含：房间等待页 / 对战顶部栏 / 道具栏 / 结算页 / 受击特效
 */

const THEME = require('./theme');

const BattleUI = {};

/** 圆角矩形路径 */
function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function drawBg(ctx, screen) {
    const g = ctx.createLinearGradient(0, 0, 0, screen.height);
    g.addColorStop(0, THEME.bgTop);
    g.addColorStop(0.55, THEME.bgMid);
    g.addColorStop(1, THEME.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, screen.width, screen.height);
}

function drawButton(ctx, x, y, w, h, text, top, bottom, size) {
    ctx.save();
    ctx.shadowColor = THEME.cardShadow;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, Math.min(16, h / 2));
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = THEME.textLight;
    ctx.font = 'bold ' + (size || 18) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
}

/** 画一个玩家头像（圆形 + emoji） */
function drawAvatar(ctx, cx, cy, r, emoji) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = THEME.boardBorder;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = Math.floor(r * 1.2) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, cx, cy + 1);
}

/**
 * 房间等待页
 * @param data { roomId, myName, myReady, oppName, oppReady, oppJoined, isHost }
 * @returns { ready, cancel }
 */
BattleUI.drawWait = function (ctx, screen, data) {
    const cx = screen.width / 2;
    drawBg(ctx, screen);

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = THEME.textDark;
    ctx.fillText('双人对战', cx, 60);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = THEME.textMid;
    ctx.fillText('房间号 ' + data.roomId, cx, 86);

    // 双方头像
    const avatarY = screen.height * 0.3;
    const r = 40;
    // 我（左）
    drawAvatar(ctx, cx - 70, avatarY, r, '🐱');
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = THEME.textDark;
    ctx.fillText(data.myName || '我', cx - 70, avatarY + r + 22);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = data.myReady ? '#3FB98C' : THEME.textMid;
    ctx.fillText(data.myReady ? '已准备' : '等待中', cx - 70, avatarY + r + 42);

    // VS
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = THEME.primary;
    ctx.fillText('VS', cx, avatarY);

    // 对手（右）
    drawAvatar(ctx, cx + 70, avatarY, r, data.oppJoined ? '🐶' : '❓');
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = THEME.textDark;
    ctx.fillText(data.oppJoined ? (data.oppName || '对手') : '等待加入', cx + 70, avatarY + r + 22);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = data.oppReady ? '#3FB98C' : THEME.textMid;
    ctx.fillText(data.oppJoined ? (data.oppReady ? '已准备' : '等待中') : '', cx + 70, avatarY + r + 42);

    // 提示
    ctx.font = '13px sans-serif';
    ctx.fillStyle = THEME.textMid;
    ctx.fillText('双方都准备好后 3 秒自动开局', cx, screen.height * 0.55);

    const buttons = {};
    // 准备按钮
    const btnW = 200;
    const btnH = 54;
    const btnX = cx - btnW / 2;
    const btnY = screen.height * 0.62;
    if (data.myReady) {
        drawButton(ctx, btnX, btnY, btnW, btnH, '已准备（取消准备）', THEME.success, '#3FB98C', 16);
    } else {
        drawButton(ctx, btnX, btnY, btnW, btnH, '准 备', THEME.primaryLight, THEME.primary, 20);
    }
    buttons.ready = { x: btnX, y: btnY, w: btnW, h: btnH };

    // 取消/退出按钮
    const cancelY = btnY + btnH + 16;
    drawButton(ctx, btnX, cancelY, btnW, 46, data.isHost ? '取消房间' : '退出房间', THEME.btnGrayTop, THEME.btnGrayBottom, 15);
    buttons.cancel = { x: btnX, y: cancelY, w: btnW, h: 46 };

    return buttons;
};

/**
 * 对战顶部栏（倒计时 + 双方分数）
 * @param data { timeLeft, myScore, oppScore, myName, oppName }
 */
BattleUI.drawTop = function (ctx, screen, data) {
    const cx = screen.width / 2;

    // 倒计时（居中醒目）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillStyle = THEME.danger;
    ctx.fillText(String(data.timeLeft), cx, 30);

    // 我的分数（左）
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#3FB98C';
    ctx.fillText('🐱 ' + data.myScore, 14, 30);
    ctx.textAlign = 'left';

    // 对手分数（右）
    ctx.textAlign = 'right';
    ctx.fillStyle = THEME.primary;
    ctx.fillText('🐶 ' + data.oppScore, screen.width - 14, 30);

    ctx.textAlign = 'left';
};

/**
 * 对战道具栏（5 个：锤/炸弹/换色 + 冰冻/干扰）
 * @param data { hammer, bomb, color, freeze, disturb } 各道具数量
 * @returns { hammer, bomb, color, freeze, disturb } 按钮区域
 */
BattleUI.drawItems = function (ctx, screen, data) {
    const items = [
        { key: 'hammer', icon: '🔨', count: data.hammer },
        { key: 'bomb', icon: '💣', count: data.bomb },
        { key: 'color', icon: '🎨', count: data.color },
        { key: 'freeze', icon: '❄️', count: data.freeze },
        { key: 'disturb', icon: '🌀', count: data.disturb }
    ];

    const r = 28;
    const gap = 62;
    const startX = (screen.width - (items.length - 1) * gap) / 2;
    const y = screen.height - 40;
    const buttons = {};

    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const x = startX + i * gap;
        ctx.fillStyle = it.count > 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = THEME.boardBorder;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(it.icon, x, y - 2);

        // 数量角标
        if (it.count > 0) {
            ctx.fillStyle = THEME.primary;
            ctx.beginPath();
            ctx.arc(x + r * 0.62, y - r * 0.62, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText(String(it.count), x + r * 0.62, y - r * 0.62 + 1);
        }
        buttons[it.key] = { x: x - r, y: y - r, w: r * 2, h: r * 2 };
    }
    return buttons;
};

/**
 * 结算页
 * @param data { result:'win'|'lose'|'draw', myScore, oppScore, coinReward }
 * @returns { again, menu }
 */
BattleUI.drawResult = function (ctx, screen, data) {
    const cx = screen.width / 2;
    ctx.fillStyle = 'rgba(40,30,20,0.55)';
    ctx.fillRect(0, 0, screen.width, screen.height);

    const cardW = 300;
    const cardH = 320;
    const cardX = cx - cardW / 2;
    const cardY = screen.height * 0.22;
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fill();

    // 结果
    const icon = data.result === 'win' ? '🏆' : (data.result === 'draw' ? '🤝' : '😵');
    const title = data.result === 'win' ? '胜利！' : (data.result === 'draw' ? '平局' : '失败');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '48px sans-serif';
    ctx.fillText(icon, cx, cardY + 56);
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = data.result === 'win' ? '#3FB98C' : (data.result === 'draw' ? THEME.textDark : THEME.danger);
    ctx.fillText(title, cx, cardY + 108);

    // 比分
    ctx.font = '20px sans-serif';
    ctx.fillStyle = THEME.textDark;
    ctx.fillText('你 ' + data.myScore + ' : ' + data.oppScore + ' 对手', cx, cardY + 150);

    // 金币奖励
    if (data.coinReward > 0) {
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = THEME.primaryDark;
        ctx.fillText('🪙 +' + data.coinReward + ' 金币', cx, cardY + 182);
    }

    const buttons = {};
    const btnW = 220;
    const btnH = 48;
    const btnX = cx - btnW / 2;
    const y1 = cardY + 210;
    drawButton(ctx, btnX, y1, btnW, btnH, '再来一局', THEME.primaryLight, THEME.primary, 17);
    buttons.again = { x: btnX, y: y1, w: btnW, h: btnH };

    const y2 = y1 + btnH + 12;
    drawButton(ctx, btnX, y2, btnW, btnH, '返回主页', THEME.btnGrayTop, THEME.btnGrayBottom, 16);
    buttons.menu = { x: btnX, y: y2, w: btnW, h: btnH };

    return buttons;
};

/**
 * 受击特效（冰冻遮罩 / 干扰提示）
 * @param data { frozen, disturb } 布尔
 */
BattleUI.drawEffects = function (ctx, screen, data) {
    if (data.frozen) {
        // 冰冻：全屏冰蓝遮罩
        ctx.fillStyle = 'rgba(120, 190, 240, 0.35)';
        ctx.fillRect(0, 0, screen.width, screen.height);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('❄️ 冰冻中', screen.width / 2, screen.height / 2);
    }
    if (data.disturb) {
        // 干扰：顶部横幅提示
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#FF8FAB';
        ctx.fillText('🌀 干扰中 · 需 4 连消除', screen.width / 2, 56);
    }
};

BattleUI.hitTest = function (x, y, btn) {
    if (!btn) return false;
    return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
};

module.exports = BattleUI;
