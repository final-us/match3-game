'use strict';
// Local image viewer only; no production code, remote assets or image generation.
const fs = require('fs');
const path = require('path');
const http = require('http');
const directory = path.resolve(__dirname, '../assets/_incoming/ui-illustration-concepts-20261020');
const concepts = [
  ['battle-prep.png', '对战准备', '对战准备页面插画效果稿'],
  ['battle-result.png', '对战结算', '对战结算：胜利与失败双卡效果稿'],
  ['stamina-shop.png', '体力商店', '体力商店页面插画效果稿'],
  ['retention.png', '签到 / 任务', '签到与任务双页插画效果稿'],
];
const routes = new Map(concepts.map(([file]) => ['/' + file, path.join(directory, file)]));
const html = `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>猫猫开心消 · 页面插画效果稿</title>
<style>
body{box-sizing:border-box;height:100vh;height:100dvh;margin:0;padding:20px;display:flex;flex-direction:column;gap:12px;background:#e9edf5;color:#303b62;font:15px system-ui,sans-serif}
h1,nav,p,output{flex:none;margin:0}h1{font-size:24px}nav{display:flex;gap:12px;flex-wrap:wrap}
button{font:inherit;min-height:44px;padding:8px 18px;border:1px solid #a9b8d0;border-radius:12px;background:#fff;color:inherit;cursor:pointer}
button[aria-pressed=true]{background:#dfebff;border-color:#677da7}
button:focus-visible,a:focus-visible{outline:3px solid #677da7;outline-offset:3px}
p{line-height:1.6}a{color:#344f83}output{display:block}
.viewport{flex:1 1 0;min-width:0;min-height:0;display:flex;align-items:center;justify-content:center;overflow:auto;width:100%}img{display:block;flex:none;width:auto;height:auto;max-width:100%;max-height:100%;object-fit:contain}
[hidden]{display:none!important}
</style>
<h1>猫猫开心消 · 页面插画效果稿</h1>
<p><strong>效果稿·示例数据，非已实现界面</strong>。图片内按钮不可操作；默认整体适配当前视口，可打开原图查看细节。</p>
<nav aria-label="效果稿页面">${concepts.map(([, label], i) => '<button type="button" data-index="' + i + '" aria-pressed="' + (i === 0) + '">' + label + '</button>').join('')}</nav>
<output id="status" aria-live="polite"></output>
<p><a id="original" target="_blank" rel="noopener">打开当前原图</a></p>
<div class="viewport" tabindex="0" role="region" aria-label="效果稿图片，整体适配，可滚动"><img id="concept" hidden></div>
<script>
const concepts = ${JSON.stringify(concepts)};
const image = document.querySelector('#concept');
const status = document.querySelector('#status');
const original = document.querySelector('#original');
let selected = 0;
image.onload = () => { image.hidden = false; status.textContent = concepts[selected][1] + ' · 效果稿·示例数据，非已实现界面'; };
image.onerror = () => { image.hidden = true; status.textContent = concepts[selected][0] + ' 尚未生成或暂时无法读取；请在图片生成后重新点击本页按钮。'; };
function select(index) {
  selected = index;
  const [file, label, description] = concepts[index];
  document.querySelectorAll('nav button').forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  image.hidden = true;
  image.alt = description;
  status.textContent = label + ' · 正在读取效果稿…';
  original.href = '/' + file;
  image.src = '/' + file;
}
document.querySelectorAll('nav button').forEach((button, index) => button.addEventListener('click', () => select(index)));
select(0);
</script></html>`;
const port = process.argv[2] === undefined ? 0 : Number(process.argv[2]);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('Usage: node tools/preview-ui-illustration-concepts.cjs [port: 0–65535]');
  process.exit(1);
}
const server = http.createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }); res.end('Method not allowed'); return; }
  if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
  const file = routes.get(req.url);
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('效果稿尚未生成或暂时无法读取，请在生成完成后重试。');
      return;
    }
    res.setHeader('Content-Type', 'image/png');
    res.end(data);
  });
});
server.on('error', error => { console.error('本地效果稿浏览服务启动失败：' + error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log('http://127.0.0.1:' + server.address().port));
