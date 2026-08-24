/**
 * 零素材 Canvas 情境式引导；覆盖当前页面但不改变页面/棋盘状态。
 */

const THEME = require('./theme');
const typography = require('./typography');

const CONTENT = {
    solo_intro: {
        title: '滑动相邻猫咪',
        lines: ['从相邻格向左、右、上或下滑动', '凑够 3 只同色猫咪即可消除。']
    },
    special_piece: {
        title: '发现特殊棋子',
        lines: ['4 连会生成横/竖火箭，5 连会生成更强的猫爪彩球。', '把它滑到合适的触发点，威力会更大。']
    },
    obstacle: {
        title: '果冻与冰块',
        lines: ['果冻被命中会破一层，多次命中才能清掉。', '冰块被命中或被相邻消除波及时会融化。']
    },
    solo_item: {
        title: '单人道具',
        lines: ['棋盘下方可以使用已有道具。', '道具不消耗步数，适合在关键位置使用。']
    },
    pvp_wait: {
        title: '准备开局',
        lines: ['把共 3 个冰冻/干扰道具分配好，再点准备。', 'PvP 道具共享 10 秒冷却。']
    }
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function roundRect(ctx, x, y, w, h, radius) {
    const r = Math.min(radius, w / 2, h / 2);
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

function drawButton(ctx, x, y, w, h, text, top, bottom) {
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, top);
    gradient.addColorStop(1, bottom);
    ctx.fillStyle = gradient;
    roundRect(ctx, x, y, w, h, Math.min(14, h / 2));
    ctx.fill();
    ctx.fillStyle = THEME.textLight;
    typography.drawCentered(ctx, text, x, y, w, h, {
        size: 15, minSize: 10, weight: 'bold'
    });
}

function draw(ctx, screen, key) {
    const content = CONTENT[key] || CONTENT.solo_intro;
    const width = Number(screen.width) || 320;
    const height = Number(screen.height) || 568;
    const safeTop = Math.max(0, Number(screen.safeTop) || 0);
    const safeBottom = Math.max(0, Number(screen.safeBottom) || 0);
    const cardW = Math.min(348, width - 24);
    const cardH = 274;
    const cardX = (width - cardW) / 2;
    const cardY = clamp((height - cardH) / 2, safeTop + 12, height - safeBottom - cardH - 12);
    const buttonH = 46;
    const buttonGap = 10;
    const buttonW = (cardW - 40 - buttonGap) / 2;
    const buttonY = cardY + cardH - 62;

    ctx.save();
    ctx.fillStyle = 'rgba(7, 10, 42, 0.72)';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = THEME.glassBg;
    roundRect(ctx, cardX, cardY, cardW, cardH, 24);
    ctx.fill();
    ctx.strokeStyle = THEME.glassBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = THEME.gold;
    typography.drawFit(ctx, content.title, width / 2, cardY + 52, cardW - 32, {
        size: 25, minSize: 18, weight: 'bold', align: 'center'
    });
    ctx.fillStyle = THEME.textSceneMuted;
    for (let i = 0; i < content.lines.length; i++) {
        typography.drawFit(ctx, content.lines[i], width / 2, cardY + 94 + i * 30, cardW - 34, {
            size: 15, minSize: 10, align: 'center'
        });
    }

    const leftX = cardX + 20;
    const rightX = leftX + buttonW + buttonGap;
    drawButton(ctx, leftX, buttonY, buttonW, buttonH, '跳过', THEME.btnGrayTop, THEME.btnGrayBottom);
    drawButton(ctx, rightX, buttonY, buttonW, buttonH, '知道了', THEME.primaryLight, THEME.primary);
    ctx.restore();

    return {
        skip: { x: leftX, y: buttonY, w: buttonW, h: buttonH },
        confirm: { x: rightX, y: buttonY, w: buttonW, h: buttonH }
    };
}

function hitTest(x, y, button) {
    return !!button && x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h;
}

module.exports = {
    CONTENT: CONTENT,
    draw: draw,
    hitTest: hitTest
};
