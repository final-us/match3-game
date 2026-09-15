/**
 * 零素材 Canvas 情境式引导；覆盖当前页面但不改变页面/棋盘状态。
 */

const typography = require('./typography');
const moon = require('./moon-controls');

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

function wrapLines(ctx, lines, maxWidth) {
    const wrapped = [];
    lines.forEach(function (text) {
        // Balance short instructions across two lines, keeping punctuation off line starts.
        if (ctx.measureText(text).width > maxWidth) {
            let split = 0, best = Infinity;
            for (let i = 1; i < text.length; i++) {
                if (/^[，。、；：！？]/.test(text.slice(i))) continue;
                const left = ctx.measureText(text.slice(0, i)).width;
                const right = ctx.measureText(text.slice(i)).width;
                // Prefer an existing clause boundary over splitting a phrase or “5 连”.
                const difference = /[，。；！？]/.test(text[i - 1]) ? -1 : Math.abs(left - right);
                if (left <= maxWidth && right <= maxWidth && difference < best) {
                    split = i;
                    best = difference;
                }
            }
            if (split) {
                wrapped.push(text.slice(0, split), text.slice(split));
                return;
            }
        }
        let line = '';
        for (const char of text) {
            if (line && ctx.measureText(line + char).width > maxWidth) {
                wrapped.push(line);
                line = '';
            }
            line += char;
        }
        if (line) wrapped.push(line);
    });
    return wrapped;
}

function draw(ctx, screen, key) {
    const content = CONTENT[key] || CONTENT.solo_intro;
    const width = Number(screen.width) || 320;
    const height = Number(screen.height) || 568;
    const safeTop = Math.max(0, Number(screen.safeTop) || 0, Number(screen.contentTop) || 0);
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
    ctx.fillStyle = 'rgba(71, 86, 133, 0.34)';
    ctx.fillRect(0, 0, width, height);

    moon.panel(ctx, screen, cardX, cardY, cardW, cardH);

    ctx.fillStyle = '#303C70';
    typography.drawFit(ctx, content.title, width / 2, cardY + 44, cardW - 40, {
        size: 25, minSize: 18, weight: 'bold', align: 'center'
    });
    ctx.fillStyle = '#4E5B82';
    typography.set(ctx, 14, undefined, false, 'center', 'middle');
    const lines = wrapLines(ctx, content.lines, cardW - 44);
    const lineTop = cardY + 130 - (lines.length - 1) * 12;
    for (let i = 0; i < lines.length; i++) {
        typography.drawFit(ctx, lines[i], width / 2, lineTop + i * 24, cardW - 44, {
            size: 14, minSize: 14, align: 'center'
        });
    }

    const leftX = cardX + 20;
    const rightX = leftX + buttonW + buttonGap;
    moon.button(ctx, leftX, buttonY, buttonW, buttonH, '跳过', 'blue', 15);
    moon.button(ctx, rightX, buttonY, buttonW, buttonH, '知道了', 'pink', 15);
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
