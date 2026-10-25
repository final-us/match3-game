'use strict';
// Local, editable Canvas concepts only. No production modules or services are loaded.
const fs = require('fs');
const path = require('path');
const http = require('http');
const root = path.resolve(__dirname, '../match3-wechat');
const out = path.resolve(__dirname, '../assets/_incoming/result-card-concepts-20261018');
const assetPaths = ['res/ui/result-happy-cat.png', 'res/ui/result-sad-cat.png', 'res/ui/coin.png', 'res/home/moonlit-garden-bg.jpg', ...[1, 2, 3, 4, 5].map(n => 'res/piece' + n + '-runtime.png')];
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>单人结算 · 离线概念比较</title>
<style>body{margin:20px;background:#e9edf5;color:#303b62;font:15px system-ui}nav{display:flex;gap:12px;flex-wrap:wrap}button{font:inherit;min-height:44px;padding:8px 18px;border:1px solid #a9b8d0;border-radius:12px;background:#fff;color:inherit;cursor:pointer}button[aria-pressed=true]{background:#dfebff;border-color:#677da7}canvas,#raster{display:block;width:min(800px,100%);height:auto;margin-top:18px}[hidden]{display:none!important}p{max-width:800px;line-height:1.6}output{display:block;margin-top:12px}</style>
<nav><button id="c" aria-pressed="true">C · 猫咪剧场</button><button id="d" aria-pressed="false">D · 月夜画卷</button><button id="a" aria-pressed="false">旧 A · 星光庆典</button><button id="b" aria-pressed="false">旧 B · 月光成绩单</button><button id="save" disabled hidden>保存当前方案 PNG</button></nav>
<p>左成功 / 右失败。C、D是新一轮AI美术方向参考，尚未制作成可运行UI；旧A/B保留比较。画中数据与按钮均为示例，不领奖、不触发广告。正式字体、响应布局与剩余目标合同尚待选型后实现。</p>
<img id="raster" src="/concept/pair-c.png" alt="C 猫咪剧场：左成功，右失败"><canvas id="pair" width="1600" height="1520" aria-label="旧方案：左侧成功、右侧失败的结算概念比较" hidden></canvas><output>C · 猫咪剧场 · 美术方向参考，未接入正式游戏</output><script src="/fixture.js"></script></html>`;
function fixture() {
  const c = document.querySelector('#pair'), ctx = c.getContext('2d');
  ctx.scale(2, 2);
  const C = { ink: '#303758', muted: '#68718d', line: '#d7dfec', rose: '#b9939f', pink: '#f4b7cf', blue: '#e0edfa', pearl: '#fffdf8', gold: '#e9bd60' };
  const images = {};
  let selected = 'c';
  const font = '"PingFang SC","Microsoft YaHei",system-ui,sans-serif';
  function text(s, x, y, size = 16, color = C.ink, weight = 400, align = 'center') {
    ctx.font = weight + ' ' + size + 'px ' + font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
  }
  function box(x, y, w, h, radius, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function line(x, y, w) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke(); }
  function img(id, x, y, w, h = w) {
    const image = images[id], scale = Math.min(w / image.width, h / image.height);
    ctx.drawImage(image, x + (w - image.width * scale) / 2, y + (h - image.height * scale) / 2, image.width * scale, image.height * scale);
  }
  function star(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? r * .46 : r; const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath(); ctx.fillStyle = C.gold; ctx.fill(); ctx.strokeStyle = '#cb9842'; ctx.lineWidth = 1; ctx.stroke();
  }
  function stars(y, r) { [-1, 0, 1].forEach(i => star(180 + i * (r * 2 + 12), y, r)); }
  function button(label, y, secondary = false, x = 36, w = 288, subtitle) {
    box(x, y, w, subtitle ? 64 : 52, 16, secondary ? C.blue : C.pink, secondary ? '#bdd0e7' : '#d98aaa');
    text(label, x + w / 2, y + (subtitle ? 22 : 26), 18, C.ink, 650);
    if (subtitle) text(subtitle, x + w / 2, y + 46, 14, '#545777', 500);
  }
  function foot(success) {
    if (success) { button('下一关', 470); text('返回首页', 180, 551, 16, C.ink, 550); }
    else { button('看广告继续', 454, false, 36, 288, '+5 步 · +30 秒'); button('重新挑战', 530, true, 36, 138); button('返回首页', 530, true, 186, 138); }
    text('视觉示例 · 按钮不可操作', 180, 605, 12, C.muted);
  }
  function phone(x, success, variant) {
    ctx.save(); ctx.translate(x, 82);
    ctx.save(); ctx.beginPath(); ctx.roundRect(0, 0, 360, 660, 28); ctx.clip();
    const bg = images['res/home/moonlit-garden-bg.jpg'], scale = Math.max(360 / bg.width, 660 / bg.height);
    ctx.drawImage(bg, (360 - bg.width * scale) / 2, (660 - bg.height * scale) / 2, bg.width * scale, bg.height * scale);
    box(18, 120, 324, 324, 16, 'rgba(235,242,255,.1)', 'rgba(229,235,255,.16)');
    ctx.globalAlpha = .24;
    for (let r = 0; r < 6; r++) for (let col = 0; col < 6; col++) img('res/piece' + ((r * 2 + col) % 5 + 1) + '-runtime.png', 24 + col * 52, 128 + r * 52, 44);
    ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(20,28,57,.61)'; ctx.fillRect(0, 0, 360, 660);
    text('第 16 关', 180, 28, 14, '#e1e8fb', 550);
    ctx.shadowColor = 'rgba(9,16,44,.25)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 7;
    box(18, 56, 324, 580, 24, C.pearl, variant === 'a' ? '#c7a4ae' : '#d6dfec');
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    if (variant === 'a') celebration(success); else report(success);
    foot(success); ctx.restore(); ctx.restore();
  }
  function celebration(success) {
    if (success) {
      box(79, 74, 202, 46, [22, 22, 12, 12], '#f8e7ed', '#d6b3bf');
      text('通关成功', 180, 97, 26, C.ink, 700);
      img('res/ui/result-happy-cat.png', 105, 128, 150, 120);
      stars(266, 20); text('本关得分', 180, 305, 14, C.muted);
      text('12,480', 180, 340, 34, C.ink, 750);
      img('res/ui/coin.png', 124, 370, 26); text('+180 金币', 200, 384, 18, C.ink, 600);
      line(46, 412, 268); text('最高连消 6 连', 108, 437, 14, C.muted, 500); text('特殊组合 2 次', 254, 437, 14, C.muted, 500);
    } else {
      text('挑战未完成', 180, 99, 26, C.ink, 700);
      img('res/ui/result-sad-cat.png', 140, 126, 80, 74);
      text('步数用完了', 180, 220, 17, C.muted, 500);
      line(46, 246, 268); text('还差目标', 180, 272, 17, C.ink, 650);
      goalIcon('jelly', 71, 316); text('果冻层', 110, 310, 16, C.muted, 500, 'left'); text('2 层', 286, 310, 23, C.ink, 700, 'right');
      goalIcon('yarn', 71, 366); text('剩余耐久', 110, 360, 16, C.muted, 500, 'left'); text('1/3', 286, 360, 23, C.ink, 700, 'right');
      line(46, 395, 268); text('得分 8,640  ·  最高连消 6 连', 180, 423, 14, C.muted);
    }
  }
  function goalIcon(type, x, y) {
    if (type === 'jelly') {
      box(x - 17, y - 18, 34, 32, 9, '#d9d2f2', '#afa1d3');
      ctx.beginPath(); ctx.moveTo(x - 9, y - 7); ctx.quadraticCurveTo(x, y - 12, x + 9, y - 7); ctx.strokeStyle = '#fffdfc'; ctx.lineWidth = 3; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(x, y - 2, 17, 0, Math.PI * 2); ctx.fillStyle = '#ebc1d2'; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(x, y - 2, 16, 0, Math.PI * 2); ctx.clip(); ctx.strokeStyle = '#b77e9d'; ctx.lineWidth = 1.5;
      for (let i = -20; i <= 20; i += 7) { ctx.beginPath(); ctx.moveTo(x - 20, y + i); ctx.lineTo(x + 20, y + i - 22); ctx.stroke(); }
      ctx.restore();
    }
  }
  function report(success) {
    text(success ? '通关成功' : '挑战未完成', 44, 100, 26, C.ink, 700, 'left');
    img(success ? 'res/ui/result-happy-cat.png' : 'res/ui/result-sad-cat.png', 263, 76, 57, 65);
    text(success ? '第 16 关' : '步数用完了', 44, 136, 16, C.muted, 500, 'left');
    line(44, 164, 272);
    if (success) {
      stars(195, 12); text('本关得分', 180, 240, 16, C.muted); text('12,480', 180, 281, 34, C.ink, 750);
      box(42, 322, 276, 57, 13, '#f0f5fb'); img('res/ui/coin.png', 109, 337, 28); text('+180 金币', 202, 351, 18, C.ink, 600);
      text('最高连消', 110, 409, 14, C.muted); text('特殊组合', 250, 409, 14, C.muted); text('6 连', 110, 438, 22, C.ink, 650); text('2 次', 250, 438, 22, C.ink, 650);
    } else {
      text('尚未完成的目标', 44, 193, 16, C.muted, 500, 'left');
      progress('jelly', '果冻层', '还差 2 层', '已清除 4 / 6 层', 241);
      progress('yarn', '毛线', '耐久 1/3', '已消除 2 / 3 耐久', 328);
      line(44, 402, 272); text('得分 8,640  ·  最高连消 6 连', 180, 426, 14, C.muted);
    }
  }
  function progress(type, label, remaining, done, y) {
    goalIcon(type, 64, y + 2); text(label, 94, y - 6, 16, C.muted, 500, 'left'); text(remaining, 316, y - 5, 21, C.ink, 700, 'right');
    box(94, y + 19, 222, 7, 4, '#e5eaf3'); box(94, y + 19, 148, 7, 4, '#a7bddb'); text(done, 94, y + 43, 12, C.muted, 400, 'left');
  }
  function draw() {
    ctx.clearRect(0, 0, 800, 760); ctx.fillStyle = '#eaf0f8'; ctx.fillRect(0, 0, 800, 760);
    text(selected === 'a' ? 'A · 星光庆典' : 'B · 月光成绩单', 24, 25, 24, C.ink, 700, 'left');
    text(selected === 'a' ? '猫咪与星星聚焦庆祝，奖励与下一步一眼可见' : '文字与目标先行，轻分隔呈现清爽成绩单', 24, 57, 16, C.muted, 400, 'left');
    phone(24, true, selected); phone(416, false, selected);
    for (const key of ['a', 'b']) document.querySelector('#' + key).setAttribute('aria-pressed', String(key === selected));
  }
  function show() {
    const raster = selected === 'c' || selected === 'd';
    c.hidden = raster;
    const image = document.querySelector('#raster'); image.hidden = !raster;
    document.querySelector('#save').hidden = raster;
    for (const key of ['a', 'b', 'c', 'd']) document.querySelector('#' + key).setAttribute('aria-pressed', String(key === selected));
    if (raster) {
      image.src = '/concept/pair-' + selected + '.png';
      image.alt = selected === 'c' ? 'C 猫咪剧场：左成功，右失败' : 'D 月夜画卷：左成功，右失败';
      document.querySelector('output').textContent = (selected === 'c' ? 'C · 猫咪剧场' : 'D · 月夜画卷') + ' · 美术方向参考，未接入正式游戏';
    } else {
      draw();
      document.querySelector('output').textContent = '旧原生Canvas方案 · 左成功 / 右失败';
    }
  }
  for (const key of ['a', 'b', 'c', 'd']) document.querySelector('#' + key).onclick = () => { selected = key; show(); };
  document.querySelector('#save').onclick = async () => {
    const output = document.querySelector('output');
    try { const response = await fetch('/capture?name=pair-' + selected, { method: 'POST', body: c.toDataURL('image/png') }); if (!response.ok) throw new Error('保存失败：' + response.status); output.textContent = '已保存 ' + await response.text() + '（1600×1520，2×清晰度）'; }
    catch (error) { output.textContent = error.message; }
  };
  Promise.all(ASSET_PATHS.map(src => new Promise((resolve, reject) => { const image = new Image(); images[src] = image; image.onload = resolve; image.onerror = () => reject(new Error('素材加载失败：' + src)); image.src = '/' + src; }))).then(() => { show(); document.querySelector('#save').disabled = false; }).catch(error => { document.querySelector('output').textContent = error.message; });
}
const script = 'const ASSET_PATHS=' + JSON.stringify(assetPaths) + ';(' + fixture.toString() + ')();';
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'POST' && url.pathname === '/capture') {
    const name = url.searchParams.get('name');
    if (!/^pair-[ab]$/.test(name || '')) { res.writeHead(400); res.end('Invalid concept'); return; }
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 8 * 1024 * 1024) { res.writeHead(413); res.end(); return; } chunks.push(chunk); }
    const data = Buffer.concat(chunks).toString();
    if (!data.startsWith('data:image/png;base64,')) { res.writeHead(400); res.end(); return; }
    fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(data.slice(22), 'base64'));
    res.end(name + '.png'); return;
  }
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
  if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
  if (url.pathname === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); res.end(script); return; }
  if (/^\/concept\/pair-[cd]\.png$/.test(url.pathname)) {
    res.setHeader('Content-Type', 'image/png');
    fs.readFile(path.join(out, path.basename(url.pathname)), (error, data) => { res.statusCode = error ? 404 : 200; res.end(error ? '' : data); });
    return;
  }
  const relative = url.pathname.slice(1);
  if (!assetPaths.includes(relative)) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', relative.endsWith('.png') ? 'image/png' : 'image/jpeg');
  fs.readFile(path.join(root, relative), (error, data) => { res.statusCode = error ? 404 : 200; res.end(error ? '' : data); });
});
server.listen(Number(process.argv[2]) || 0, '127.0.0.1', () => console.log('http://127.0.0.1:' + server.address().port));
