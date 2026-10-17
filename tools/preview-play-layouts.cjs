'use strict';
// Direction comparison only. Real assets/pieces, illustrative state, no gameplay input or cloud.
const fs = require('fs');
const path = require('path');
const http = require('http');
const root = path.resolve(__dirname, '../match3-wechat');
const out = path.resolve(__dirname, '../assets/_incoming/play-layout-directions-20261016');
const sources = {};
function collect(file) {
    const id = path.relative(root, file).replaceAll('\\', '/');
    if (sources[id]) return;
    sources[id] = fs.readFileSync(file, 'utf8');
    for (const match of sources[id].matchAll(/require\(['"]([^'"]+)['"]\)/g))
        if (match[1].startsWith('.')) collect(path.resolve(path.dirname(file), match[1] + '.js'));
}
['render/battle-ui', 'render/board-render', 'core/game-core'].forEach(id => collect(path.join(root, 'js', id + '.js')));
function client() {
    const cache = {}, params = new URLSearchParams(location.search);
    const width = +(params.get('width') || 390), height = width === 320 ? 568 : width === 430 ? 932 : 844;
    window.wx = { createImage: () => new Image() };
    function load(id) {
        if (cache[id]) return cache[id].exports;
        const m = cache[id] = { exports: {} };
        const req = relative => {
            const p = id.split('/'); p.pop();
            relative.split('/').forEach(x => x === '..' ? p.pop() : x !== '.' && p.push(x));
            return load(p.join('/') + '.js');
        };
        new Function('require', 'module', 'exports', previewSources[id])(req, m, m.exports);
        return m.exports;
    }
    const Board = load('js/render/board-render.js'), Game = load('js/core/game-core.js');
    const ui = load('js/render/battle-ui.js'), geometry = load('js/render/game-layout.js');
    const moon = load('js/render/moon-controls.js'), type = load('js/render/typography.js');
    const assets = load('js/render/assets.js'), theme = load('js/render/theme.js');
    const screen = { width, height, safeTop: 47, contentTop: 91, safeBottom: 34, reduceEffects: false };
    const cards = [];
    function text(ctx, str, x, y, size, color, align, maxWidth) {
        ctx.fillStyle = color || '#353D69';
        type.drawFit(ctx, str, x, y, maxWidth || width - 32,
            { size, minSize: size - 1, weight: '600', align: align || 'left', numbers: true });
    }
    function image(ctx, key, x, y, size) {
        const img = assets.get(key);
        if (img && img.width) ctx.drawImage(img, x, y, size, size);
    }
    function backdrop(ctx) {
        const img = assets.get('gameBackground');
        if (img && img.width) {
            const s = Math.max(width / img.width, height / img.height);
            ctx.drawImage(img, (width - img.width * s) / 2, (height - img.height * s) / 2, img.width * s, img.height * s);
        } else { ctx.fillStyle = theme.bgTop; ctx.fillRect(0, 0, width, height); }
        ctx.fillStyle = 'rgba(8,12,48,.12)'; ctx.fillRect(0, 0, width, height);
    }
    function header(ctx, mode, top, tall) {
        text(ctx, mode === 'pvp' ? '好友对战' : '单人闯关', 14, screen.safeTop + 14, 16, '#F5F3FF', 'left', 200);
        if (mode === 'pvp') {
            const y = top;
            ctx.save(); ctx.translate(0, y - geometry.pvp(screen).hudY);
            ctx.scale(1, 80 / geometry.pvp(screen).hudH);
            ui.drawTop(ctx, screen, { protocolVersion: 2, roundNumber: 3, myWins: 2, oppWins: 1,
                myScore: 2480, oppScore: 1960, timeLeft: 42 });
            ctx.restore();
        } else {
            const h = tall ? 112 : 96;
            moon.panel(ctx, screen, 10, top, width - 20, h);
            text(ctx, '第 16 关', 24, top + 17, 14);
            text(ctx, '得分 1840', 24, top + 41, 20, '#914E73');
            text(ctx, '剩余步数', width - 52, top + 16, 10, '#656482', 'center', 80);
            text(ctx, '18', width - 52, top + 42, 30, '#353D69', 'center', 80);
            ctx.strokeStyle = '#DCD7E8'; ctx.beginPath();
            ctx.moveTo(24, top + 57); ctx.lineTo(width - 24, top + 57); ctx.stroke();
            image(ctx, 'piece2', 24, top + (tall ? 70 : 63), tall ? 28 : 24);
            text(ctx, '还需 12 只', 58, top + (tall ? 85 : 79), 13, '#914E73', 'left', width / 2 - 60);
            text(ctx, '目标分 3000', width - 26, top + (tall ? 85 : 79), 13, '#426494', 'right', width / 2 - 24);
        }
    }
    const pvpItems = [
        ['freeze', '冰霜冻结', '冻结对手3秒', 2],
        ['disturb', '四连魔咒', '四连起消5秒', 1],
        ['reflect', '镜面反弹', '5秒内反弹一次', 1],
        ['cheer', '猫咪鼓舞', '5秒得分翻倍', 1]
    ];
    const soloItems = [
        ['uiToolHammer', '锤子', '消除一个棋子', 3],
        ['uiToolBomb', '炸弹', '消除3×3区域', 2],
        ['uiToolYarn', '换色', '制造即时消除', 1]
    ];
    function dock(ctx, mode, y, h, expanded) {
        const compact = h < 130;
        moon.panel(ctx, screen, 10, y, width - 20, h);
        text(ctx, mode === 'pvp' ? '对战道具' : '局内道具', 24, y + 18, 13);
        text(ctx, mode === 'pvp' ? '每10秒可用一次' : '点击道具后使用', width - 24, y + 18, 10, '#656482', 'right', width / 2);
        const items = mode === 'pvp' ? pvpItems : soloItems;
        if (mode === 'solo' && expanded && !compact) {
            const rowH = (h - 50) / 3;
            items.forEach((item, index) => {
                const py = y + 34 + index * (rowH + 4);
                moon.button(ctx, 20, py, width - 40, rowH, '', index % 2 ? 'pink' : 'blue');
                image(ctx, item[0], 27, py + (rowH - 34) / 2, 34);
                text(ctx, item[1], 71, py + rowH / 2 - 7, 13);
                text(ctx, item[2], 71, py + rowH / 2 + 11, 11, '#656482');
                text(ctx, '×' + item[3], width - 34, py + rowH / 2, 15, '#353D69', 'right', 50);
            });
            return;
        }
        const columns = mode === 'pvp' && expanded && !compact ? 2 : items.length;
        const rows = Math.ceil(items.length / columns), gap = 8, pad = 10;
        const cellW = (width - 40 - (columns - 1) * gap) / columns;
        const footer = expanded && !compact ? 25 : 8;
        const cellH = (h - 36 - footer - (rows - 1) * gap) / rows;
        items.forEach((item, index) => {
            const x = 20 + (index % columns) * (cellW + gap);
            const py = y + 34 + Math.floor(index / columns) * (cellH + gap);
            const pvp = mode === 'pvp', rowCard = columns === 2;
            moon.button(ctx, x, py, cellW, cellH, '', index % 2 ? 'pink' : 'blue');
            const size = rowCard ? 32 : Math.min(42, Math.max(23, cellH - (compact ? 23 : 44)));
            const ix = rowCard ? x + 6 : x + (cellW - size) / 2;
            const iy = rowCard ? py + (cellH - size) / 2 : py + 5;
            if (pvp) moon.battleIcon(ctx, item[0], ix, iy, size); else image(ctx, item[0], ix, iy, size);
            const labelX = rowCard ? x + 43 : x + cellW / 2;
            text(ctx, item[1], labelX, rowCard ? py + cellH / 2 - 8 : py + size + 16, compact ? 10 : 12,
                '#353D69', rowCard ? 'left' : 'center', rowCard ? cellW - 66 : cellW - 6);
            if (!compact) text(ctx, item[2], labelX, rowCard ? py + cellH / 2 + 12 : py + size + 34, 10,
                '#656482', rowCard ? 'left' : 'center', rowCard ? cellW - 48 : cellW - 6);
            text(ctx, '×' + item[3], x + cellW - 8, py + 14, 11, '#353D69', 'right', 28);
        });
        if (expanded && !compact) text(ctx, mode === 'pvp' ? '选择道具，把握出手时机' : '道具不会消耗步数',
            width / 2, y + h - 12, 11, '#656482', 'center');
    }
    function draw(card) {
        const { ctx, board, mode, variant } = card;
        backdrop(ctx);
        const top = screen.contentTop, bottom = height - screen.safeBottom - 12, space = bottom - top;
        const expanded = variant === 'a';
        const headerH = mode === 'pvp' ? 80 : (expanded ? 112 : 96);
        const tile = Math.min(Math.floor((width - 12) / 8), Math.floor((space - headerH - 112 - 24) / 8));
        const boardW = tile * 8, boardX = (width - boardW) / 2;
        const dockH = expanded ? Math.min(208, space - headerH - boardW - 24) : (width === 320 ? 104 : 112);
        const gap = expanded ? (space - headerH - boardW - dockH) / 2 : 12;
        const boardY = top + headerH + gap;
        const boardH = expanded ? boardW : space - headerH - dockH - 24;
        const dockY = expanded ? boardY + boardH + gap : bottom - dockH;
        board.tileSize = tile; board.boardW = boardW; board.boardH = boardH;
        board.boardX = boardX; board.boardY = boardY; board.syncPiecesFromGrid();
        header(ctx, mode, top, expanded);
        if (expanded) board.drawBoard();
        else {
            // Direction B separates vertical cell pitch from square cat artwork.
            ctx.fillStyle = theme.boardBg;
            board.roundRect(boardX, boardY, boardW, boardH, 12); ctx.fill();
            ctx.strokeStyle = theme.boardBorder; ctx.lineWidth = 2; ctx.stroke();
            const pitchY = boardH / 8;
            for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
                ctx.fillStyle = theme.tileEmpty;
                board.roundRect(boardX + c * tile + 2, boardY + r * pitchY + 2, tile - 4, pitchY - 4, 5);
                ctx.fill();
            }
            for (const piece of board.pieces) {
                piece.y = boardY + (piece.row + .5) * pitchY;
                board.drawPiece(piece);
            }
        }
        dock(ctx, mode, dockY, bottom - dockY, expanded);
    }
    ['a', 'b'].forEach(variant => ['pvp', 'solo'].forEach(mode => {
        const section = document.createElement('section'), title = document.createElement('h2');
        title.textContent = (variant === 'a' ? 'A · 上下功能分区' : 'B · 纵向舒展棋盘') + (mode === 'pvp' ? ' / 双人' : ' / 单人');
        const canvas = document.createElement('canvas');
        canvas.width = width * 2; canvas.height = height * 2;
        canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
        const ctx = canvas.getContext('2d'); ctx.scale(2, 2);
        const board = new Board(ctx, screen); board.battleMode = true;
        board.setGame(new Game({ id: 16, rows: 8, columns: 8, moveCount: 24,
            goals: [{ type: 'collect', pieceType: 2, target: 18 }, { type: 'score', target: 3000 }] }, {}));
        const card = { canvas, ctx, board, mode, variant };
        cards.push(card); section.append(title, canvas); document.querySelector('main').append(section);
    }));
    document.querySelector('#save').onclick = async () => {
        const files = [];
        for (const card of cards) {
            const name = card.variant + '-' + card.mode + '-' + width;
            const res = await fetch('/capture?name=' + name, { method: 'POST', body: card.canvas.toDataURL('image/png') });
            files.push(await res.text());
        }
        for (const mode of ['pvp', 'solo']) {
            const pair = document.createElement('canvas');
            pair.width = (width * 2 + 24) * 2; pair.height = (height + 36) * 2;
            const p = pair.getContext('2d'); p.scale(2, 2);
            p.fillStyle = '#E9EBF5'; p.fillRect(0, 0, pair.width, pair.height);
            p.fillStyle = '#353D69'; p.font = '600 14px system-ui';
            p.fillText('A · 上下功能分区', 8, 23);
            p.fillText('B · 纵向舒展棋盘', width + 32, 23);
            cards.filter(card => card.mode === mode).forEach((card, i) =>
                p.drawImage(card.canvas, i * (width + 24), 36, width, height));
            const res = await fetch('/capture?name=' + mode + '-compare-' + width,
                { method: 'POST', body: pair.toDataURL('image/png') });
            files.push(await res.text());
        }
        document.querySelector('output').textContent = files.join(' · ');
    };
    assets.preload(() => cards.forEach(draw)); cards.forEach(draw);
}
const html = '<!doctype html><meta charset="utf-8"><title>单人和双人 · 布局方向对照</title>' +
    '<style>body{margin:20px;background:#e9ebf5;color:#353d69;font:14px system-ui}a,button{margin-right:14px}' +
    'main{display:grid;grid-template-columns:max-content max-content;gap:24px}h2{font-size:16px}canvas{display:block}' +
    'p{max-width:850px}output{display:block;margin-top:12px}</style>' +
    '<nav><a href="?width=320">320</a><a href="?width=390">390</a><a href="?width=430">430</a><button id="save">保存四张方案</button></nav>' +
    '<p>布局方向草图 · 示例比分、步数与目标 · A扩大功能区；B扩大棋盘纵向空间，猫咪保持方形。尚未接入正式交互。</p><main></main><output></output>' +
    '<script>const previewSources=' + JSON.stringify(sources) + ';(' + client.toString() + ')();</script>';
http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'POST' && url.pathname === '/capture') {
        const name = url.searchParams.get('name');
        if (!/^([ab]-(pvp|solo)|(pvp|solo)-compare)-(320|390|430)$/.test(name || '')) { res.writeHead(400); res.end(); return; }
        const chunks = []; let size = 0;
        for await (const chunk of req) { size += chunk.length; if (size > 8 * 1024 * 1024) { res.writeHead(413); res.end(); return; } chunks.push(chunk); }
        const data = Buffer.concat(chunks).toString();
        if (!data.startsWith('data:image/png;base64,')) { res.writeHead(400); res.end(); return; }
        fs.mkdirSync(out, { recursive: true });
        fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(data.slice(22), 'base64'));
        res.end(name + '.png'); return;
    }
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
    fs.readFile(file, (error, data) => { res.statusCode = error ? 404 : 200; res.end(error ? '' : data); });
}).listen(0, '127.0.0.1', function () { console.log('http://127.0.0.1:' + this.address().port); });
