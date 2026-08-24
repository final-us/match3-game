/**
 * 双人对战 UI 绘制模块
 * 所有按钮返回 {x, y, w, h} 区域，由 Main 统一做点击命中检测
 * 包含：房间等待页 / 对战顶部栏 / 道具栏 / 结算页 / 受击特效
 */

const THEME = require('./theme');
const assets = require('./assets');
const typography = require('./typography');

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
    typography.drawCentered(ctx, text, x, y + 1, w, h, {
        size: size || 18, minSize: 10, weight: 'bold'
    });
}

function roomDisplayName(roomId) {
    const prefixes = ['紫藤', '星灯', '月桂', '晚樱', '云朵', '蜜桃', '铃兰', '萤火'];
    const places = ['猫眠亭', '爪爪巷', '月牙桥', '绒球庭', '星愿台', '软软坡', '花影阁', '猫语泉'];
    let hash = 2166136261;
    const text = String(roomId || '');
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    hash >>>= 0;
    return prefixes[hash % prefixes.length] + places[Math.floor(hash / prefixes.length) % places.length];
}

function drawImageCoverCircle(ctx, image, cx, cy, r) {
    if (!image || !image.width || !image.height) return false;
    const scale = Math.max(r * 2 / image.width, r * 2 / image.height);
    const sw = r * 2 / scale;
    const sh = r * 2 / scale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(image, (image.width - sw) / 2, (image.height - sh) / 2, sw, sh, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
    return true;
}

/** 画一个玩家头像；无授权时使用项目内猫咪头像。 */
function drawAvatar(ctx, cx, cy, r, image, fallbackKey) {
    ctx.fillStyle = THEME.glassBgSoft;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = THEME.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (!drawImageCoverCircle(ctx, image || assets.get(fallbackKey), cx, cy, r)) {
        ctx.fillStyle = '#F8D9EC';
        typography.drawFit(ctx, '猫咪', cx, cy + 1, r * 1.6, {
            size: 15, minSize: 10, weight: 'bold', align: 'center'
        });
    }
}

/**
 * 房间等待页
 * @param data { roomId, myName, myReady, oppName, oppReady, oppJoined, items, isHost, myAvatar }
 * @returns { ready, cancel, avatar }
 */
BattleUI.drawWait = function (ctx, screen, data) {
    const cx = screen.width / 2;
    const top = Number(screen.contentTop) || Number(screen.safeTop) || 18;
    drawBg(ctx, screen);

    // 标题
    ctx.fillStyle = THEME.textScene;
    typography.drawFit(ctx, '双人对战', cx, top + 24, screen.width - 36, {
        size: 26, minSize: 18, weight: 'bold', align: 'center'
    });

    ctx.fillStyle = '#FFE1A7';
    typography.drawFit(ctx, '相遇地点 · ' + roomDisplayName(data.roomId), cx, top + 54, screen.width - 36, {
        size: 17, minSize: 10, weight: 'bold', align: 'center'
    });
    ctx.fillStyle = 'rgba(255,239,249,0.62)';
    typography.drawFit(ctx, '邀请识别码 ' + String(data.roomId || '').slice(-6).toUpperCase(), cx, top + 73, screen.width - 36, {
        size: 10, minSize: 8, align: 'center', numbers: true
    });

    // 双方头像
    const avatarY = Math.max(screen.height * 0.3, top + 138);
    const r = 40;
    // 我（左）
    drawAvatar(ctx, cx - 70, avatarY, r, data.myAvatar, 'piece1');
    ctx.fillStyle = THEME.textScene;
    typography.drawFit(ctx, data.myName || '我', cx - 70, avatarY + r + 22, 100, {
        size: 16, minSize: 10, weight: 'bold', align: 'center'
    });
    ctx.fillStyle = data.myReady ? THEME.gold : THEME.textSceneMuted;
    typography.drawFit(ctx, data.myReady ? '已准备' : '配置中', cx - 70, avatarY + r + 42, 100, {
        size: 13, minSize: 9, align: 'center'
    });

    // VS
    ctx.fillStyle = THEME.primaryLight;
    typography.drawFit(ctx, 'VS', cx, avatarY, 50, {
        size: 20, minSize: 12, weight: 'bold', numbers: true, align: 'center'
    });

    // 对手（右）
    drawAvatar(ctx, cx + 70, avatarY, r, null, data.oppJoined ? 'piece2' : 'piece5');
    ctx.fillStyle = THEME.textScene;
    typography.drawFit(ctx, data.oppJoined ? (data.oppName || '对手') : '等待加入', cx + 70, avatarY + r + 22, 100, {
        size: 16, minSize: 10, weight: 'bold', align: 'center'
    });
    ctx.fillStyle = data.oppReady ? THEME.gold : THEME.textSceneMuted;
    typography.drawFit(ctx, data.oppJoined ? (data.oppReady ? '已准备' : '配置中') : '', cx + 70, avatarY + r + 42, 100, {
        size: 13, minSize: 9, align: 'center'
    });

    const buttons = {};
    buttons.avatar = { x: cx - 70 - r, y: avatarY - r, w: r * 2, h: r * 2 };
    if (!data.myAvatar) {
        ctx.fillStyle = '#FFE7F5';
        typography.drawFit(ctx, '点头像可换成微信头像', cx - 70, avatarY + r + 59, 120, {
            size: 10, minSize: 8, align: 'center'
        });
    }

    // 自己可见的固定预算配置；准备后锁定，服务端仍做最终校验。
    const items = data.items || { freeze: 1, disturb: 2 };
    const configY = Math.max(avatarY + r + 88, screen.height * 0.49);
    const total = (Number(items.freeze) || 0) + (Number(items.disturb) || 0);
    ctx.fillStyle = THEME.textScene;
    typography.drawFit(ctx, '对战道具 ' + total + '/3' + (data.myReady ? ' · 已锁定' : ''), cx, configY, screen.width - 36, {
        size: 15, minSize: 10, weight: 'bold', numbers: true, align: 'center'
    });
    const groups = [
        { key: 'freeze', name: '冰冻', x: cx - 76, count: Number(items.freeze) || 0 },
        { key: 'disturb', name: '干扰', x: cx + 76, count: Number(items.disturb) || 0 }
    ];
    for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const rowY = configY + 34;
        ctx.fillStyle = THEME.textSceneMuted;
        typography.drawFit(ctx, group.name, group.x, rowY - 19, 80, {
            size: 12, minSize: 9, weight: 'bold', align: 'center'
        });
        ctx.fillStyle = THEME.textScene;
        typography.drawFit(ctx, String(group.count), group.x, rowY + 1, 30, {
            size: 20, minSize: 12, weight: 'bold', numbers: true, align: 'center'
        });
        if (!data.myReady) {
            drawButton(ctx, screen, group.x - 48, rowY - 14, 28, 28, '−', THEME.btnGrayTop, THEME.btnGrayBottom, 18);
            drawButton(ctx, screen, group.x + 20, rowY - 14, 28, 28, '+', THEME.primaryLight, THEME.primary, 18);
            buttons[group.key + 'Minus'] = { x: group.x - 48, y: rowY - 14, w: 28, h: 28 };
            buttons[group.key + 'Plus'] = { x: group.x + 20, y: rowY - 14, w: 28, h: 28 };
        }
    }

    // 提示
    ctx.fillStyle = THEME.textSceneMuted;
    const hintY = Math.max(configY + 68, screen.height * 0.58);
    typography.drawFit(ctx, '双方都准备好后 3 秒自动开局', cx, hintY, screen.width - 36, {
        size: 13, minSize: 9, align: 'center', numbers: true
    });
    // 准备按钮
    const btnW = 200;
    const btnH = 54;
    const btnX = cx - btnW / 2;
    const btnY = Math.max(screen.height * 0.66, hintY + 28);
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
    const scoreY = (Number(screen.contentTop) || Number(screen.safeTop) || 0) + 30;
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
    if (urgent) {
        ctx.fillStyle = 'rgba(255, 94, 120, 0.18)';
        ctx.beginPath();
        ctx.arc(cx, scoreY, 27, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.fillStyle = urgent ? '#FF6C8A' : THEME.gold;
    typography.drawFit(ctx, String(data.timeLeft), cx, scoreY, 64, {
        size: urgent ? 38 : 30, minSize: 16, weight: 'bold', numbers: true, align: 'center'
    });

    // 我的分数（左）
    ctx.fillStyle = '#B9A7F4';
    drawImageCoverCircle(ctx, assets.get('piece1'), 27, scoreY, 15);
    typography.drawFit(ctx, String(data.myScore), 80, scoreY, 64, {
        size: 18, minSize: 8, weight: 'bold', numbers: true, align: 'center'
    });

    // 对手分数（右）
    ctx.fillStyle = THEME.primaryLight;
    drawImageCoverCircle(ctx, assets.get('piece2'), screen.width - 27, scoreY, 15);
    typography.drawFit(ctx, String(data.oppScore), screen.width - 80, scoreY, 64, {
        size: 18, minSize: 8, weight: 'bold', numbers: true, align: 'center'
    });
};

BattleUI.drawCountdown = function (ctx, screen, data) {
    ctx.fillStyle = 'rgba(13, 18, 58, 0.50)';
    ctx.fillRect(0, 0, screen.width, screen.height);
    const cx = screen.width / 2;
    const cy = screen.height * 0.46;
    ctx.fillStyle = '#FFF4FC';
    typography.drawFit(ctx, '准备好了吗', cx, cy - 54, screen.width - 48, {
        size: 28, minSize: 18, weight: 'bold', align: 'center'
    });
    ctx.fillStyle = '#FF9CC8';
    typography.drawFit(ctx, data.label || String(data.seconds), cx, cy + 18, screen.width - 48, {
        size: 84, minSize: 30, weight: 'bold', numbers: !data.label, align: 'center'
    });
};

BattleUI.drawWarning = function (ctx, screen) {
    const w = Math.min(screen.width - 20, 350);
    const h = 54;
    const x = (screen.width - w) / 2;
    const y = Math.max((Number(screen.contentTop) || Number(screen.safeTop) || 0) + 72, screen.height * 0.34);
    ctx.save();
    ctx.fillStyle = 'rgba(255, 72, 106, 0.94)';
    roundRect(ctx, x, y, w, h, 16);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    typography.drawFit(ctx, '还剩 30 秒！', screen.width / 2, y + h / 2 + 1, w - 20, {
        size: 30, minSize: 16, weight: 'bold', numbers: true, align: 'center'
    });
    ctx.restore();
};

/**
 * 对战道具栏（仅房间配置的冰冻/干扰；单人商店道具不进入 PvP）
 * @param data { freeze, disturb, cooldownRemaining, active }
 * @returns { freeze, disturb } 按钮区域
 */
BattleUI.drawItems = function (ctx, screen, data) {
    const items = [
        { key: 'freeze', icon: '❄️', count: data.freeze },
        { key: 'disturb', icon: '🌀', count: data.disturb }
    ];

    const r = 31;
    const gap = 104;
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
        const enabled = it.count > 0 && !data.active && Number(data.cooldownRemaining) <= 0;
        ctx.fillStyle = enabled ? 'rgba(255,245,252,0.22)' : 'rgba(255,245,252,0.08)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = enabled ? THEME.gold : THEME.glassBorder;
        ctx.lineWidth = 2;
        ctx.stroke();

        if (it.asset) {
            const itemImage = assets.get(it.asset);
            if (itemImage && itemImage.width > 0) ctx.drawImage(itemImage, x - 22, y - 22, 44, 44);
        } else {
            typography.drawFit(ctx, it.icon, x, y - 2, r * 1.5, {
                size: 24, minSize: 12, align: 'center'
            });
        }

        // 数量角标
        if (it.count > 0) {
            ctx.fillStyle = THEME.primary;
            ctx.beginPath();
            ctx.arc(x + r * 0.62, y - r * 0.62, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFFFFF';
            typography.drawFit(ctx, String(it.count), x + r * 0.62, y - r * 0.62 + 1, 18, {
                size: 11, minSize: 8, weight: 'bold', numbers: true, align: 'center'
            });
        }
        buttons[it.key] = { x: x - r, y: y - r, w: r * 2, h: r * 2 };
    }
    if (Number(data.cooldownRemaining) > 0) {
        ctx.fillStyle = '#FFE1A7';
        typography.drawFit(ctx, '共享冷却 ' + Math.ceil(data.cooldownRemaining / 1000) + '秒', screen.width / 2, y - r - 15, 180, {
            size: 13, minSize: 9, weight: 'bold', numbers: true, align: 'center'
        });
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
    const title = data.result === 'win' ? '胜利！' : (data.result === 'draw' ? '平局' : '失败');
    if (data.result === 'draw') {
        drawAvatar(ctx, cx - 24, cardY + 55, 28, null, 'piece1');
        drawAvatar(ctx, cx + 24, cardY + 55, 28, null, 'piece2');
    } else {
        const resultImage = assets.get(data.result === 'win' ? 'uiResultHappyCat' : 'uiResultSadCat');
        if (resultImage && resultImage.width > 0) ctx.drawImage(resultImage, cx - 54, cardY + 5, 108, 108);
    }
    ctx.fillStyle = data.result === 'win' ? THEME.gold : (data.result === 'draw' ? THEME.textScene : '#FF9DB6');
    typography.drawFit(ctx, title, cx, cardY + 108, cardW - 36, {
        size: 26, minSize: 18, weight: 'bold', align: 'center'
    });

    // 比分
    ctx.fillStyle = THEME.textScene;
    typography.drawFit(ctx, '你 ' + data.myScore + ' : ' + data.oppScore + ' 对手', cx, cardY + 150, cardW - 36, {
        size: 20, minSize: 11, numbers: true, align: 'center'
    });

    // 金币奖励
    if (data.coinReward > 0) {
        const coinImage = assets.get('uiCoin');
        if (coinImage && coinImage.width > 0) ctx.drawImage(coinImage, cx - 66, cardY + 166, 30, 30);
        ctx.fillStyle = THEME.gold;
        typography.drawFit(ctx, '+' + data.coinReward + ' 金币', cx - 32, cardY + 182, cardW - 86, {
            size: 16, minSize: 10, weight: 'bold', numbers: true
        });
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
    typography.drawFit(ctx, text, screen.width / 2, y + h / 2 + 1, w - 20, {
        size: 22, minSize: 12, weight: 'bold', numbers: true, align: 'center'
    });
    ctx.restore();
}

/**
 * 受击特效（冰冻 / 干扰横幅）
 * @param data { frozen, frozenRemaining, disturb, disturbRemaining, castNotice, boardX, boardY, boardW, boardH }
 */
BattleUI.drawEffects = function (ctx, screen, data) {
    const boardY = Number(data.boardY);
    const baseY = Math.max(
        (Number(screen.contentTop) || Number(screen.safeTop) || 0) + 72,
        Number.isFinite(boardY) ? boardY - 56 : screen.height * 0.34
    );
    let y = baseY;
    if (data.castNotice) {
        const castName = data.castNotice === 'freeze' ? '冰冻' : '干扰';
        drawEffectBanner(ctx, screen, '已释放' + castName, y, 'rgba(114, 91, 196, 0.96)');
        y += 58;
    }
    const targetText = data.frozen
        ? '冰冻中 · ' + Math.max(1, Math.ceil(Number(data.frozenRemaining) / 1000)) + '秒'
        : (data.disturb ? '干扰中 · ' + Math.max(1, Math.ceil(Number(data.disturbRemaining) / 1000)) + '秒' : '');
    if (targetText && Number.isFinite(Number(data.boardX)) && Number.isFinite(Number(data.boardY)) &&
        Number.isFinite(Number(data.boardW)) && Number.isFinite(Number(data.boardH))) {
        ctx.save();
        ctx.fillStyle = data.frozen ? 'rgba(34, 126, 196, 0.38)' : 'rgba(190, 45, 120, 0.34)';
        roundRect(ctx, Number(data.boardX), Number(data.boardY), Number(data.boardW), Number(data.boardH), 12);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        typography.drawFit(ctx, targetText, screen.width / 2, Number(data.boardY) + Number(data.boardH) / 2, Number(data.boardW) - 24, {
            size: 30, minSize: 18, weight: 'bold', numbers: true, align: 'center'
        });
        ctx.restore();
    }
    if (data.frozen) {
        drawEffectBanner(ctx, screen, '对手使用冰冻 · ' + Math.max(1, Math.ceil(Number(data.frozenRemaining) / 1000)) + '秒', y, 'rgba(59, 151, 217, 0.96)');
        y += 58;
    }
    if (data.disturb) {
        drawEffectBanner(ctx, screen, '对手使用干扰 · 需4连 · ' + Math.max(1, Math.ceil(Number(data.disturbRemaining) / 1000)) + '秒', y, 'rgba(225, 91, 151, 0.96)');
    }
};

BattleUI.hitTest = function (x, y, btn) {
    if (!btn) return false;
    return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
};

BattleUI.roomDisplayName = roomDisplayName;

module.exports = BattleUI;
