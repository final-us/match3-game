'use strict';
// Isolated local UI fixture. No WeChat accounts, cloud writes or persistent saves.
const fs = require('fs');
const path = require('path');
const http = require('http');
const root = path.resolve(__dirname, '../match3-wechat');
const { createBattleLocal } = require('../match3-wechat/test/helpers/battle-local');
const local = createBattleLocal();
const sources = {};
function collect(file) {
    const id = path.relative(root, file).replaceAll('\\', '/');
    if (sources[id]) return;
    sources[id] = fs.readFileSync(file, 'utf8');
    for (const match of sources[id].matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
        if (match[1].startsWith('.')) collect(path.resolve(path.dirname(file), match[1] + '.js'));
    }
}
collect(path.join(root, 'js/main.js'));
const html = `<!doctype html><meta charset="utf-8"><title>四道具对战 · 本地验证</title>
<style>body{margin:12px;background:#e7eafa;color:#182654;font:14px system-ui}canvas{display:block;touch-action:none}nav{margin-bottom:8px}button,select{font:inherit;padding:8px}output{display:block;margin:6px 0}#toast{min-height:22px}</style>
<nav><a href="/?width=320&height=568">320</a> · <a href="/?width=390&height=844">390</a> · <a href="/?width=430&height=932">430</a>
<label>网络 <select id="network"><option value="ok">正常</option><option value="stall">不回调</option><option value="fail">立即失败</option></select></label>
<button id="late">释放迟到回包</button><label><input id="joined" type="checkbox">模拟好友加入</label>
<button id="play">本地对局</button><button id="freeze">受冰冻</button><button id="disturb">受干扰</button><button id="cast">释放提示</button><button id="reflect">反弹护盾</button><button id="cheer">鼓舞效果</button><button id="wait">等待房间</button></nav><output id="status"></output><output id="toast"></output><canvas></canvas><script src="/fixture.js"></script>`;
const script = `
const sources=${JSON.stringify(sources)},cache={},params=new URLSearchParams(location.search);
const width=+(params.get('width')||390),height=+(params.get('height')||844);
const canvas=document.querySelector('canvas'),status=document.querySelector('#status'),toast=document.querySelector('#toast');
const memory={match3_music_enabled_v1:false,match3_sfx_enabled_v1:false},events={},pending=[];
let avatarCalls=0,frameCount=0,shareCalls=0,room={items:{freeze:1,disturb:2},ready:false};
const originalRAF=requestAnimationFrame.bind(window);window.requestAnimationFrame=fn=>originalRAF(t=>{frameCount++;fn(t);});
window.wx={createCanvas:()=>canvas,createImage:()=>new Image(),
 getStorageSync:key=>memory[key],setStorageSync:(key,value)=>memory[key]=value,removeStorageSync:key=>delete memory[key],
 getSystemInfoSync:()=>({windowWidth:width,windowHeight:height,pixelRatio:2,safeArea:{top:47,bottom:height-34,left:0,right:width}}),
 getMenuButtonBoundingClientRect:()=>({bottom:87,left:width-90}),
 getAccountInfoSync:()=>({miniProgram:{envVersion:'develop'}}),
 onTouchStart:fn=>events.start=fn,onTouchMove:fn=>events.move=fn,onTouchEnd:fn=>events.end=fn,
 onShow:fn=>events.show=fn,onHide:fn=>events.hide=fn,onError:()=>{},onUnhandledRejection:()=>{},
 showToast:o=>toast.textContent=o.title,showModal:o=>toast.textContent=o.content,
 createUserInfoButton:()=>{avatarCalls++;throw Error('synthetic avatar API unavailable');},
 shareAppMessage:()=>{shareCalls++;toast.textContent='本地分享模拟：已调起后取消，未发送邀请';},onShareAppMessage:()=>{},
 cloud:{init:()=>{},callFunction:o=>{
  const action=o.data.action,mode=document.querySelector('#network').value;
  async function respond(){
   try {
    const response=await fetch('/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:o.data,joined:document.querySelector('#joined').checked})});
    o.success({result:await response.json()});
   } catch(error) {o.fail({errMsg:'local transport failure'});}
  }
  if(action!=='create'&&action!=='leave'&&mode==='stall'){pending.push(respond);return;}
  setTimeout(()=>mode==='fail'?o.fail({errMsg:'network offline'}):respond(),350);
 }}};
function load(id){if(cache[id])return cache[id].exports;const m=cache[id]={exports:{}};
 const req=relative=>{const p=id.split('/');p.pop();relative.split('/').forEach(x=>x==='..'?p.pop():x!=='.'&&p.push(x));return load(p.join('/')+'.js');};
 new Function('require','module','exports',sources[id])(req,m,m.exports);return m.exports;}
function point(e){const r=canvas.getBoundingClientRect();return {clientX:(e.clientX-r.left)*width/r.width,clientY:(e.clientY-r.top)*height/r.height};}
canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);events.start({touches:[point(e)]});};
canvas.onpointermove=e=>{if(e.buttons)events.move({touches:[point(e)]});};
canvas.onpointerup=e=>events.end({changedTouches:[point(e)]});
const app=new (load('js/main.js'))();canvas.style.width=width+'px';canvas.style.height=height+'px';
// Only this offline fixture exposes synthetic effects; production has no debug route.
window.battleFixture={app,async play(){
 app.stopPolling();app.guide=null;app.guideQueue=[];
 const response=await fetch('/play',{method:'POST'}),res=await response.json();
 const b=app.battle=app.newBattleState(true);b.roomId=res.roomId;b.protocolVersion=2;b.roundId=res.roundId;
 app.state='battle_wait';app.applyPoll(res);app.startPolling();
 document.querySelector('#joined').checked=true;
},hit(item){if(app.state!=='battle_playing')return;app.stopPolling();
 const now=app.battleNow(),b=app.battle;b.pollRevision++;
 if(item==='reflect')b.reflectUntil=now+5000;
 else if(item==='cheer'){b.cheerUntil=now+5000;load('js/net/battle-items.js').window(b,b.cheerUntil);}
 else app.applyEffect({item,until:now+(item==='freeze'?3000:5000)});
}};
for(const key of ['freeze','disturb','reflect','cheer'])document.querySelector('#'+key).onclick=()=>battleFixture.hit(key);
document.querySelector('#play').onclick=()=>battleFixture.play();
document.querySelector('#wait').onclick=()=>{app.stopPolling();app.battle=null;app.state='menu';app.guide=null;app.startBattle();};
document.querySelector('#cast').onclick=()=>{if(app.battle)app.battle.castNotice={item:'freeze',until:app.battleNow()+1500};};
document.querySelector('#late').onclick=()=>pending.splice(0).forEach(fn=>fn());
setInterval(()=>{const b=app.battle;status.textContent='仅本地模拟 | 分享 '+shareCalls+' | 头像尝试 '+avatarCalls+' | '+app.state+(b?' | 道具 '+Object.values(b.items).join('/')+' | 同步 '+!!b.actionPending+' | 离线 '+!!b.offline:'');},200);
`;
let previewRound = 0;
const identities = {};
const server = http.createServer(async (req, res) => {
    if (req.method === 'POST') {
        const body = []; for await (const chunk of req) body.push(chunk);
        const input = JSON.parse(Buffer.concat(body).toString() || '{}');
        let response;
        if (req.url === '/play') {
            // Per-preview identities prevent rate limiting when switching screen sizes.
            const host = 'preview-host-' + (++previewRound), guest = host + '-guest';
            const created = await local.call(host, { action: 'create', protocolVersion: 2, itemRulesVersion: 3 });
            identities[created.roomId] = { host, guest };
            const joined = await local.call(guest, { action: 'join', roomId: created.roomId, protocolVersion: 2, itemRulesVersion: 3 });
            const base = { roomId: created.roomId, protocolVersion: 2, itemRulesVersion: 3, roundId: joined.roundId };
            await local.call(guest, { ...base, action: 'ready', ready: true });
            await local.call(host, { ...base, action: 'ready', ready: true });
            response = { ...await local.call(host, { ...base, action: 'query' }), roomId: created.roomId };
        } else {
            const event = input.event;
            if (event.action === 'create') {
                const host = 'preview-host-' + (++previewRound);
                response = await local.call(host, event);
                identities[response.roomId] = { host, guest: host + '-guest' };
            } else {
                const ids = identities[event.roomId];
                if (ids && input.joined) {
                    const room = local.storage.docs.battle_rooms[event.roomId];
                    if (room.players.length === 1) await local.call(ids.guest, { ...event, action: 'join' });
                    await local.call(ids.guest, { ...event, action: 'query' });
                }
                response = ids ? await local.call(ids.host, event) : { ok: false, err: '本地房间不存在' };
            }
        }
        res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(response)); return;
    }
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
    if (url.pathname === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript; charset=utf-8'); res.end(script); return; }
    const file = path.resolve(root, '.' + url.pathname);
    if (!file.startsWith(root + path.sep)) { res.statusCode = 404; res.end(); return; }
    fs.readFile(file, (error, data) => { res.statusCode = error ? 404 : 200; res.end(error ? '' : data); });
});
server.listen(0, '127.0.0.1', () => console.log('http://127.0.0.1:' + server.address().port));
