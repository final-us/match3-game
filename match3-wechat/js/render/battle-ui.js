/**
 * 双人对战 UI 绘制模块
 * 所有按钮返回 {x, y, w, h} 区域，由 Main 统一做点击命中检测
 * 包含：房间等待页 / 对战顶部栏 / 道具栏 / 结算页 / 受击特效
 */

const THEME = require('./theme');
const assets = require('./assets');

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
    const img = assets.get('gameBackground');
    if (img && img.width && img.height) {
        const scale = Math.max(screen.width / img.width, screen.height / img.height);
        const sw = screen.width / scale;
        const sh = screen.height / scale;
        ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, 0, 0, screen.width, screen.height);
    } else {
        const g = ctx.createLinearGradient(0, 0, 0, screen.height);
        g.addColorStop(0, THEME.bgTop);
        g.addColorStop(0.55, THEME.bgMid);
        g.addColorStop(1, THEME.bgBottom);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, screen.width, screen.height);
    }
    ctx.fillStyle = 'rgba(8, 12, 48, 0.24)';
    ctx.fillRect(0, 0, screen.width, screen.height);
}

function drawButton(ctx, screen, x, y, w, h, text, top, bottom, size) {
    ctx.save();
    if (!screen.reduceEffects) {
        ctx.shadowColor = THEME.cardShadow;
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 3;
    }
    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    roundRect(ctx, x, y, w, h, Math.min(16, h / 2));
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 226, 244, 0.64)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = THEME.textLight;
    ctx.font = 'bold ' + (size || 18) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2 + 1);
}

/** 画一个玩家头像（圆形 + emoji） */
function drawAvatar(ctx, cx, cy, r, emoji) {
    ctx.fillStyle = THEME.glassBgSoft;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = THEME.gold;
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
    ctx.fillStyle = THEME.textScene;
    ctx.fillText('双人对战', cx, 60);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = THEME.textSceneMuted;
    ctx.fillText('房间号 ' + data.roomId, cx, 86);

    // 双方头像
    const avatarY = screen.height * 0.3;
    const r = 40;
    // 我（左）
    drawAvatar(ctx, cx - 70, avatarY, r, '🐱');
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = THEME.textScene;
    ctx.fillText(data.myName || '我', cx - 70, avatarY + r + 22);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = data.myReady ? THEME.gold : THEME.textSceneMuted;
    ctx.fillText(data.myReady ? '已准备' : '等待中', cx - 70, avatarY + r + 42);

    // VS
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = THEME.primaryLight;
    ctx.fillText('VS', cx, avatarY);

    // 对手（右）
    drawAvatar(ctx, cx + 70, avatarY, r, data.oppJoined ? '🐶' : '❓');
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = THEME.textScene;
    ctx.fillText(data.oppJoined ? (data.oppName || '对手') : '等待加入', cx + 70, avatarY + r + 22);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = data.oppReady ? THEME.gold : THEME.textSceneMuted;
    ctx.fillText(data.oppJoined ? (data.oppReady ? '已准备' : '等待中') : '', cx + 70, avatarY + r + 42);

    // 提示
    ctx.font = '13px sans-serif';
    ctx.fillStyle = THEME.textSceneMuted;
    ctx.fillText('双方都准备好后 3 秒自动开局', cx, screen.height * 0.55);

    const buttons = {};
    // 准备按钮
    const btnW = 200;
    const btnH = 54;
    const btnX = cx - btnW / 2;
    const btnY = screen.height * 0.62;
    if (data.myReady) {
        drawButton(ctx, screen, btnX, btnY, btnW, btnH, '已准备（取消准备）', '#B9A7F4', THEME.successDark, 16);
    } else {
        drawButton(ctx, screen, btnX, btnY, btnW, btnH, '准 备', THEME.primaryLight, THEME.primary, 20);
    }
    buttons.ready = { x: btnX, y: btnY, w: btnW, h: btnH };

    // 取消/退出按钮
    const cancelY = btnY + btnH + 16;
    drawButton(ctx, screen, btnX, cancelY, btnW, 46, data.isHost ? '取消房间' : '退出房间', THEME.btnGrayTop, THEME.btnGrayBottom, 15);
    buttons.cancel = { x: btnX, y: cancelY, w: btnW, h: 46 };

    return buttons;
};

/**
 * 对战顶部栏（倒计时 + 双方分数）
 * @param data { timeLeft, myScore, oppScore, myName, oppName }
 */
BattleUI.drawTop = function (ctx, screen, data) {
    const cx = screen.width / 2;
    const scoreY = (Number(screen.safeTop) || 0) + 30;
    const urgent = data.urgent || data.timeLeft <= 10;

    ctx.fillStyle = THEME.glassBg;
    roundRect(ctx, 8, scoreY - 24, 112, 48, 18);
    ctx.fill();
    roundRect(ctx, screen.width - 120, scoreY - 24, 112, 48, 18);
    ctx.fill();
    ctx.strokeStyle = THEME.glassBorder;
    ctx.lineWidth = 1.5;
    roundRect(ctx, 8, scoreY - 24, 112, 48, 18);
    ctx.stroke();
    roundRect(ctx, screen.width - 120, scoreY - 24, 112, 48, 18);
    ctx.stroke();

    // 倒计时（居中醒目）
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (urgent) {
        ctx.fillStyle = 'rgba(255, 94, 120, 0.18)';
        ctx.beginPath();
        ctx.arc(cx, scoreY, 27, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.font = 'bold ' + (urgent ? 38 : 30) + 'px sans-serif';
    ctx.fillStyle = urgent ? '#FF6C8A' : THEME.gold;
    ctx.fillText(String(data.timeLeft), cx, scoreY);

    // 我的分数（左）
    ctx.textAlign = 'left';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#B9A7F4';
    ctx.fillText('🐱 ' + data.myScore, 14, scoreY);

    // 对手分数（右）
    ctx.textAlign = 'right';
    ctx.fillStyle = THEME.primaryLight;
    ctx.fillText('🐶 ' + data.oppScore, screen.width - 14, scoreY);

    ctx.textAlign = 'left';
};

BattleUI.drawCountdown = function (ctx, screen, data) {
    ctx.fillStyle = 'rgba(13, 18, 58, 0.50)';
    ctx.fillRect(0, 0, screen.width, screen.height);
    const cx = screen.width / 2;
    const cy = screen.height * 0.46;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFF4FC';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('准备好了吗', cx, cy - 54);
    ctx.font = 'bold 84px sans-serif';
    ctx.fillStyle = '#FF9CC8';
    ctx.fillText(data.label || String(data.seconds), cx, cy + 18);
};

BattleUI.drawWarning = function (ctx, screen) {
    const w = Math.min(screen.width - 20, 350);
    const h = 54;
    const x = (screen.width - w) / 2;
    const y = Math.max((Number(screen.safeTop) || 0) + 72, screen.height * 0.34);
    ctx.save();
    ctx.fillStyle = 'rgba(255, 72, 106, 0.94)';
    roundRect(ctx, x, y, w, h, 16);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('还剩 30 秒！', screen.width / 2, y + h / 2 + 1);
    ctx.restore();
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
    const y = screen.height - (Number(screen.safeBottom) || 0) - 40;
    const buttons = {};

    ctx.fillStyle = THEME.glassBgSoft;
    roundRect(ctx, startX - r - 10, y - r - 8, (items.length - 1) * gap + (r + 10) * 2, r * 2 + 16, 28);
    ctx.fill();
    ctx.strokeStyle = THEME.glassBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const x = startX + i * gap;
        ctx.fillStyle = it.count > 0 ? 'rgba(255,245,252,0.22)' : 'rgba(255,245,252,0.08)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = it.count > 0 ? THEME.gold : THEME.glassBorder;
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
    drawBg(ctx, screen);
    ctx.fillStyle = 'rgba(10, 10, 44, 0.42)';
    ctx.fillRect(0, 0, screen.width, screen.height);

    const cardW = 300;
    const cardH = 320;
    const cardX = cx - cardW / 2;
    const cardY = screen.height * 0.22;
    ctx.save();
    if (!screen.reduceEffects) {
        ctx.shadowColor = THEME.cardShadow;
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 5;
    }
    ctx.fillStyle = THEME.glassBg;
    roundRect(ctx, cardX, cardY, cardW, cardH, 18);
    ctx.fill();
    ctx.strokeStyle = THEME.glassBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // 结果
    const icon = data.result === 'win' ? '🏆' : (data.result === 'draw' ? '🤝' : '😵');
    const title = data.result === 'win' ? '胜利！' : (data.result === 'draw' ? '平局' : '失败');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '48px sans-serif';
    ctx.fillText(icon, cx, cardY + 56);
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = data.result === 'win' ? THEME.gold : (data.result === 'draw' ? THEME.textScene : '#FF9DB6');
    ctx.fillText(title, cx, cardY + 108);

    // 比分
    ctx.font = '20px sans-serif';
    ctx.fillStyle = THEME.textScene;
    ctx.fillText('你 ' + data.myScore + ' : ' + data.oppScore + ' 对手', cx, cardY + 150);

    // 金币奖励
    if (data.coinReward > 0) {
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = THEME.gold;
        ctx.fillText('🪙 +' + data.coinReward + ' 金币', cx, cardY + 182);
    }

    const buttons = {};
    const btnW = 220;
    const btnH = 48;
    const btnX = cx - btnW / 2;
    const y1 = cardY + 210;
    drawButton(ctx, screen, btnX, y1, btnW, btnH, '再来一局', THEME.primaryLight, THEME.primary, 17);
    buttons.again = { x: btnX, y: y1, w: btnW, h: btnH };

    const y2 = y1 + btnH + 12;
    drawButton(ctx, screen, btnX, y2, btnW, btnH, '返回主页', THEME.btnGrayTop, THEME.btnGrayBottom, 16);
    buttons.menu = { x: btnX, y: y2, w: btnW, h: btnH };

    return buttons;
};

function drawEffectBanner(ctx, screen, text, y, fill) {
    const w = Math.min(screen.width - 20, 355);
    const h = 52;
    const x = (screen.width - w) / 2;
    ctx.save();
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, w, h, 15);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, screen.width / 2, y + h / 2 + 1);
    ctx.restore();
}

/**
 * 受击特效（冰冻 / 干扰横幅）
 * @param data { frozen, disturb, boardY } 布尔
 */
BattleUI.drawEffects = function (ctx, screen, data) {
    const boardY = Number(data.boardY);
    const baseY = Math.max(
        (Number(screen.safeTop) || 0) + 72,
        Number.isFinite(boardY) ? boardY - 56 : screen.height * 0.34
    );
    let y = baseY;
    if (data.frozen) {
        drawEffectBanner(ctx, screen, '对手使用冰冻 · 3秒内无法操作', y, 'rgba(59, 151, 217, 0.96)');
        y += 58;
    }
    if (data.disturb) {
        drawEffectBanner(ctx, screen, '对手使用干扰 · 需4连消除', y, 'rgba(225, 91, 151, 0.96)');
    }
};

BattleUI.hitTest = function (x, y, btn) {
    if (!btn) return false;
    return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
};

module.exports = BattleUI;
