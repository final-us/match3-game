'use strict';
// Isolated browser fixture: production Canvas renderers, sample models, no platform services.
const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const root = path.resolve(__dirname, '../match3-wechat');
const out = process.env.MATCH3_POLISH_PREVIEW_OUT || path.resolve(__dirname, '../assets/_incoming/ui-illustration-production-20261020/runtime/solo-blue-20261025');
const candidates = path.resolve(__dirname, '../assets/_incoming/prep-duo-variants-20261022');
const candidateFiles = new Map(['a', 'b'].map(key => ['/candidates/duo-' + key + '.png', path.join(candidates, 'duo-' + key + '-source.png')]));
candidateFiles.set('/candidates/header-smile.png',path.resolve(__dirname,'../assets/_incoming/header-smile-20261025/candidate.png'));
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
const states = ['wait', 'wait-share', 'wait-unjoined', 'wait-ready', 'wait-offline', 'battle', 'battle-cooldown',
    'win', 'lose', 'draw', 'stamina', 'stamina-ad', 'stamina-poor', 'stamina-storage',
    'signin', 'signed', 'day7', 'tasks', 'chests', 'previous', 'offline', 'pending', 'solo',
    'shop', 'shop-ad', 'shop-poor', 'shop-pending', 'shop-storage', 'shop-full',
    'daily', 'daily-loading', 'daily-error', 'daily-pending', 'daily-active', 'daily-completed',
    'home', 'home-empty', 'settings', 'solo-win', 'solo-revive','solo-settings','avatar-consent','retention-loading','retention-claiming'];
const stateNames = ['双人准备', '头像分享提示', '等待好友加入', '双方已准备', '准备页断网', '对战中', '对战道具冷却',
    '对战胜利', '对战失败', '对战平局', '体力耗尽', '体力含广告', '金币不足', '体力记录异常',
    '七日签到', '今日已签到', '第七天', '每日任务', '每周宝箱', '上周待领', '签到断网', '奖励确认中', '单人道具',
    '插画商店', '商店含广告', '商店金币不足', '商店领取中', '商店存储异常', '商店体力已满',
    '每日挑战', '挑战加载中', '挑战断网', '成绩待确认', '继续挑战', '今日挑战完成',
    '首页 · 体力充足', '首页 · 体力不足', '设置配色', '单人胜利配色', '广告复活配色','单人局内设置','首次入房头像提示','金币首开同步','金币原页领取中'];
const changedStates = ['home','home-empty'];
const captureNames = new Map();
for (const state of states) for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
    for (const fallback of ['', '-fallback']) for (const scroll of ['', '-scroll']) for (const duo of ['', '-duo-a', '-duo-b']) {
        captureNames.set(state + '-' + width + fallback + scroll + duo, { width, height });
    }
}
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>页面插画 · 真实Canvas运行预览</title>
<style>[hidden]{display:none!important}body{margin:16px;background:#e9edf5;color:#303b62;font:15px system-ui}nav{display:flex;gap:10px;flex-wrap:wrap;align-items:center}button,select{font:inherit;padding:8px;min-height:44px}canvas{display:block;margin-top:12px;max-width:100%;height:auto!important}output{display:block;padding:10px;white-space:pre-line}p{max-width:900px;line-height:1.5}</style>
<nav><label>宽度 <select id="width"><option>320</option><option>390</option><option>430</option></select></label>
<label>状态 <select id="state">${states.map((s,i) => '<option value="' + s + '">' + stateNames[i] + '</option>').join('')}</select></label>
<label>双猫 <select id="duo"><option value="current">正式B · 蓄势双猫</option><option value="a">A 月牙备战</option><option value="b">B 圆脸软萌</option></select></label>
<button id="save">保存当前实际画面</button><button id="batch">保存本尺寸全部状态</button>
<button id="retention">保存本尺寸签到/任务</button><button id="dailyBatch">保存本尺寸每日挑战</button><button id="changed">保存本轮修改页面</button>
<button id="duoBatch">保存双猫比较</button><a href="/compare">并排查看双猫</a>
<label>面板滚动 <input id="scroll" type="range" min="0" max="1000" value="0"></label>
<a href="?width=390&fallback=1">装饰未就绪回退</a><a href="?width=390">正式素材</a></nav>
<p>实际项目UI/Core/Board模块；状态、头像均为合成示例。A/B人像剪影仅标示两位玩家的独立头像槽，不是真人照片或微信个人资料。当前版本已接入用户选择的B；A/B原图切换仅用于历史比较。预览仅检查排版与真实触区，不发奖、不请求广告/云端/音频、不写设备存档，不代表微信或自然流程验收。短屏商店/签到/任务可滚动；周箱和上周待领状态直接定位底部。</p>
<canvas id="screen" aria-label="真实Canvas示例"></canvas><output>正在加载活动素材…</output><script src="/fixture.js"></script></html>`;
const script = `
'use strict';
const sources=${JSON.stringify(sources)},cache={},params=new URLSearchParams(location.search),states=${JSON.stringify(states)};
const disk={match3_music_enabled_v1:false,match3_sfx_enabled_v1:false};
const blocked=()=>{throw Error('此预览禁止真实平台服务');};
window.wx={createImage:()=>new Image(),createCanvas:()=>document.createElement('canvas'),
 loadSubpackage:o=>o.success(),getStorageSync:k=>disk[k]??'',setStorageSync:(k,v)=>{disk[k]=v;},removeStorageSync:k=>{delete disk[k];},
 request:blocked,connectSocket:blocked,cloud:{callFunction:blocked,init:blocked},
 createRewardedVideoAd:blocked,createInterstitialAd:blocked,createInnerAudioContext:blocked};
function load(id){if(cache[id])return cache[id].exports;if(!sources[id])throw Error('Missing bundled module '+id);
 const m=cache[id]={exports:{}};const req=relative=>{const p=id.split('/');p.pop();relative.split('/').forEach(x=>x==='..'?p.pop():x!=='.'&&p.push(x));return load(p.join('/')+'.js');};
 new Function('require','module','exports',sources[id])(req,m,m.exports);return m.exports;}
const Main=load('js/main.js'),UI=load('js/render/ui.js'),Battle=load('js/render/battle-ui.js'),Retention=load('js/render/retention-ui.js'),
 Daily=load('js/render/daily-ui.js'),DailyRules=load('js/core/daily-challenge.js'),RetentionModel=load('js/platform/retention-preview.js'),Core=load('js/core/game-core.js'),Board=load('js/render/board-render.js'),assets=load('js/render/assets.js'),coin=load('js/core/coin.js');
const canvas=document.querySelector('#screen'),ctx=canvas.getContext('2d'),output=document.querySelector('output');
let width=[320,390,430].includes(+params.get('width'))?+params.get('width'):390;
let selected=states.includes(params.get('state'))?params.get('state'):'wait',screen,buttons={},scroll=0,ready=false;
let duoVariant=['a','b'].includes(params.get('duo'))?params.get('duo'):'current';
const duoImages={},productionGet=assets.get;
assets.get=key=>key==='uiIllustrationHeaderCat'&&duoImages.header?duoImages.header:key==='uiIllustrationPrepDuo'&&duoVariant!=='current'&&duoImages[duoVariant]?duoImages[duoVariant]:productionGet(key);
if(params.has('embed')){document.querySelector('nav').hidden=true;document.querySelector('p').hidden=true;output.hidden=true;document.body.style.margin='0';canvas.style.margin='0';}
if(params.get('nativeChrome')==='1')document.querySelector('p').textContent+=' 右上胶囊为按平台矩形绘制的示意，手机实际位置以微信返回值为准。';
const errors=[];window.addEventListener('error',e=>{errors.push(e.message);output.textContent='ERROR: '+e.message;});
window.addEventListener('unhandledrejection',e=>{errors.push(String(e.reason));output.textContent='ERROR: '+e.reason;});
function avatar(label,color){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
 x.fillStyle=color;x.fillRect(0,0,128,128);x.fillStyle='#FFF9F0';x.beginPath();x.arc(64,46,25,0,Math.PI*2);x.fill();x.beginPath();x.ellipse(64,125,49,46,0,0,Math.PI*2);x.fill();
 x.fillStyle='#424C7B';x.font='bold 24px system-ui';x.textAlign='center';x.fillText(label,64,113);return c;}
let myAvatar,oppAvatar;
function resize(){const height=width===320?568:width===430?932:844;screen={width,height,contentTop:91,safeTop:47,safeBottom:34,reduceEffects:false,menuButtonRect:{x:width-97,y:55,w:87,h:32}};
 canvas.width=width*2;canvas.height=height*2;canvas.style.width=width+'px';ctx.setTransform(2,0,0,2,0,0);}
function menu(empty=true){return UI.drawMenu(ctx,screen,16,{count:empty?0:5,timeLeftText:empty?'04:32':'00:00',storageReady:true,canPlay:!empty,canAd:false},{coins:1280,retentionPreview:true});}
function board(battle){const level={id:battle?0:16,rows:8,columns:8,moveCount:battle?999:24,colorCount:4,goals:[{type:'score',target:10000}]};
 const core=new Core(level,{},()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;});
 core.score=2480;const board=new Board(ctx,screen);board.battleMode=battle;board.setGame(core);board.setTools({hammer:2,bomb:1,color:3});board.draw();
 if(!battle) return Object.fromEntries(board.tools.map(t=>[t.type,{x:t.x-t.r,y:t.y-t.r,w:t.r*2,h:t.r*2}]));return {};}
let seed=42;
function render(state){if(!ready)return;seed=42;ctx.clearRect(0,0,width,screen.height);buttons={};
 const shared={protocolVersion:2,roundNumber:2,myWins:1,oppWins:0,myName:'月光小猫',oppName:'星星猫咪',myAvatar,oppAvatar};
 if(state.startsWith('wait'))buttons=Battle.drawWait(ctx,screen,{...shared,roomId:'sample-room-20261020',itemRulesVersion:3,
  myReady:state==='wait-ready',oppReady:state==='wait-ready',oppJoined:state!=='wait-unjoined',isHost:true,offline:state==='wait-offline',
  items:{freeze:2,disturb:1,reflect:1,cheer:1},canChangeAvatar:state==='wait-share',avatarShared:false});
 else if(state==='battle'||state==='battle-cooldown'){
  board(true);Battle.drawTop(ctx,screen,{...shared,myScore:2480,oppScore:1960,timeLeft:38});
  buttons=Battle.drawItems(ctx,screen,{itemRulesVersion:3,freeze:2,disturb:1,reflect:1,cheer:1,sharedCooldown:false,
   cooldowns:state==='battle-cooldown'?{freeze:7000,disturb:0,reflect:0,cheer:0}:{}});
 }else if(['win','lose','draw'].includes(state))buttons=Battle.drawResult(ctx,screen,{...shared,result:state,
  myScore:state==='lose'?1960:2480,oppScore:state==='win'?1960:2480,coinReward:state==='win'?180:60,oppOnline:true});
 else if(state.startsWith('stamina')){menu();buttons=UI.drawStaminaEmpty(ctx,screen,{timeLeftText:'04:32',storageReady:state!=='stamina-storage',
  canBuy:!['stamina-poor','stamina-storage'].includes(state),canAd:state==='stamina-ad',staminaPrice:1000});}
 else if(state.startsWith('shop')){
  const storageReady=state!=='shop-storage',canReward=['shop-ad','shop-pending','shop-full'].includes(state);
  buttons=UI.drawShop(ctx,screen,storageReady?(state==='shop-poor'?20:5280):null,storageReady?{hammer:2,bomb:1,color:3}:null,{
   canReward,count:3,limit:coin.REWARDED_ITEM_DAILY_LIMIT,pending:state==='shop-pending',heartPending:state==='shop-pending',
   offset:scroll,heartReady:storageReady,heartCount:storageReady?(state==='shop-full'?5:2):null,heartMax:5});
 }
 else if(state.startsWith('daily')){buttons=Daily.drawDetail(ctx,screen,{challenge:DailyRules.challengeForDate('2026-10-22'),loading:state==='daily-loading',error:state==='daily-error'?'网络未连接，请重试':'',pending:state==='daily-pending',active:state==='daily-active'?{runId:'sample'}:null,completed:state==='daily-completed',claimed:state==='daily-completed',best:state==='daily-completed'?2480:0});}
 else if(state==='home'||state==='home-empty')buttons=menu(state==='home-empty');
 else if(state==='settings')buttons=UI.drawSettings(ctx,screen,{musicEnabled:true,sfxEnabled:false});
 else if(state==='solo-win'||state==='solo-revive')buttons=UI.drawResult(ctx,screen,{win:state==='solo-win',score:12480,star:3,coinReward:180,hasNext:true,maxCascade:4,specialComboCount:3,canRevive:state==='solo-revive',remainingGoals:[{type:'score',left:1800,target:15000}]});
 else if(state==='solo'){buttons=board(false);buttons.settings=UI.drawSoloSettingsButton(ctx,screen);}
 else if(state==='solo-settings'){board(false);buttons=UI.drawSoloSettings(ctx,screen,{musicEnabled:true,sfxEnabled:false});}
 else if(state==='avatar-consent'){Battle.drawWait(ctx,screen,{...shared,roomId:'sample-room-20261020',items:{freeze:2,disturb:1},itemRulesVersion:3});buttons=UI.drawAvatarConsent(ctx,screen,true);}
 else {menu();const data=RetentionModel.create();Object.assign(data,{signDay:state==='day7'?7:3,signed:state==='signed',taskProgress:[1,2,58],activity:380,claimed:[true,false,false],offset:scroll});
  if(['tasks','chests','previous'].includes(state))data.tab='tasks';
  if(state==='chests'){data.activity=500;data.offset=10000;data.claimed=[true,false,false];}
  if(state==='previous'){data.previousWeek={available:[true,true,false],claimed:[true,false,false]};data.offset=10000;}
  if(['offline','pending'].includes(state)){data.status=state;data.real=true;}
  if(state==='retention-loading')Object.assign(data,{real:true,loaded:false,busy:true,status:'loading',tab:'tasks',taskClaimMode:'manual-v1',taskClaimed:[false,false,false]});
  if(state==='retention-claiming')Object.assign(data,{real:true,loaded:true,busy:true,status:'pending',tab:'tasks',taskClaimMode:'manual-v1',taskClaimed:[false,false,false],pendingAction:'task0'});
  buttons=Retention.draw(ctx,screen,data);
 }
 if(params.get('nativeChrome')==='1'&&state==='solo'){
  const m=screen.menuButtonRect,cy=m.y+m.h/2;ctx.save();ctx.fillStyle='rgba(250,250,255,.65)';ctx.strokeStyle='#535D7C';ctx.lineWidth=1;
  ctx.beginPath();ctx.roundRect(m.x,m.y,m.w,m.h,m.h/2);ctx.fill();ctx.stroke();
  for(const dx of [-5,0,5]){ctx.beginPath();ctx.arc(m.x+23+dx,cy,1.6,0,Math.PI*2);ctx.fillStyle='#353D69';ctx.fill();}
  ctx.beginPath();ctx.moveTo(m.x+48,m.y+8);ctx.lineTo(m.x+48,m.y+m.h-8);ctx.stroke();
  ctx.beginPath();ctx.arc(m.x+67,cy,9,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(m.x+67,cy,4,0,Math.PI*2);ctx.fill();ctx.restore();
 }
 const hits=Object.entries(buttons).filter(([k,r])=>k!=='viewport'&&r&&Number.isFinite(r.x)&&Number.isFinite(r.w));
 const issues=hits.filter(([key,r])=>{const topControl=state==='solo'&&key==='settings'&&r.y>=0&&r.y+r.h<=screen.contentTop+4&&r.x+r.w<screen.menuButtonRect.x;
  return r.w<44||r.h<44||r.x<0||r.y<(topControl?0:screen.contentTop)||r.x+r.w>width||r.y+r.h>screen.height-screen.safeBottom;}).map(([k])=>k);
 window.previewEvidence={state,width,height:screen.height,dpr:2,duo:duoVariant,hits:Object.fromEntries(hits),hitIssues:issues,errors:[...errors],
  resultArt:assets.getResultArtState().status,illustrationArt:assets.getIllustrationArtState().status,headerCat:duoImages.header?'smile-candidate':'production',mainBundled:typeof Main==='function'};
 output.textContent=width+'×'+screen.height+' · '+state+' · DPR2 · result '+window.previewEvidence.resultArt+' / illustration '+window.previewEvidence.illustrationArt+' · '+hits.length+'个真实触区'+(issues.length?' · 触区待检查: '+issues.join(','):'');
}
async function save(state,suffix=''){const name=state+'-'+width+(params.has('fallback')?'-fallback':'')+suffix+(duoVariant==='current'?'':'-duo-'+duoVariant);
 const response=await fetch('/capture?name='+name,{method:'POST',body:canvas.toDataURL('image/png')});if(!response.ok)throw Error('保存失败 '+response.status);return response.text();}
document.querySelector('#width').value=width;document.querySelector('#state').value=selected;
document.querySelector('#duo').value=duoVariant;
document.querySelector('#duo').onchange=e=>{duoVariant=e.target.value;render(selected);};
document.querySelector('#width').onchange=e=>{width=+e.target.value;resize();render(selected);};
document.querySelector('#state').onchange=e=>{selected=e.target.value;scroll=0;document.querySelector('#scroll').value=0;render(selected);};
document.querySelector('#scroll').oninput=e=>{scroll=+e.target.value;render(selected);};
canvas.onwheel=e=>{if(!buttons.viewport)return;e.preventDefault();scroll=Math.max(0,Math.min(buttons.maxScroll,scroll+e.deltaY));document.querySelector('#scroll').value=scroll;render(selected);};
document.querySelector('#save').onclick=async()=>{try{output.textContent=await save(selected,scroll?'-scroll':'');}catch(e){output.textContent=String(e);}};
async function captureStates(list){const prior=scroll,evidence=[];try{const saved=[];
 async function capture(state,suffix=''){render(state);saved.push(await save(state,suffix));evidence.push({...window.previewEvidence,scroll,suffix});}
 for(const state of list){scroll=0;await capture(state);
 if(buttons.maxScroll>0&&!['chests','previous'].includes(state)){scroll=buttons.maxScroll;await capture(state,'-scroll');}}
 scroll=prior;render(selected);window.previewBatchEvidence=evidence;
 const issues=evidence.filter(frame=>frame.hitIssues.length).map(frame=>frame.state+frame.suffix+': '+frame.hitIssues.join(','));
 output.textContent=saved.join('\\n')+(issues.length?'\\n触区待检查：\\n'+issues.join('\\n'):'\\n本批触区检查无异常')+'\\n本批渲染错误 '+evidence.reduce((sum,frame)=>sum+frame.errors.length,0);
 }catch(e){scroll=prior;render(selected);window.previewBatchEvidence=evidence;output.textContent=String(e);}};
document.querySelector('#batch').onclick=()=>captureStates(states);
document.querySelector('#retention').onclick=()=>captureStates(states.slice(states.indexOf('signin'),states.indexOf('solo')));
document.querySelector('#dailyBatch').onclick=()=>captureStates(states.filter(state=>state==='daily'||state.startsWith('daily-')));
document.querySelector('#changed').onclick=()=>captureStates(${JSON.stringify(changedStates)});
document.querySelector('#duoBatch').onclick=async()=>{const prior=duoVariant,results=[];for(const v of ['a','b']){duoVariant=v;await captureStates(['wait','wait-share','wait-unjoined']);results.push(output.textContent);}duoVariant=prior;render(selected);output.textContent=results.join('\\n');};
resize();assets.preload(async()=>{try{if(!params.has('fallback')){
 const loaded=await Promise.all([assets.loadResultArt(),assets.loadIllustrationArt()]);if(loaded.some(s=>s.status!=='ready'))throw Error('正式素材未全部就绪: '+loaded.map(s=>s.status).join('/')+'；可选择fallback预览');
 await Promise.all(['a','b'].map(key=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{duoImages[key]=img;resolve();};img.onerror=()=>reject(Error('双猫候选加载失败 '+key));img.src='/candidates/duo-'+key+'.png';})));}
 else{duoVariant='current';document.querySelector('#duo').value='current';document.querySelector('#duo').disabled=true;document.querySelector('#duoBatch').disabled=true;}
 if(params.get('header')==='smile')await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{duoImages.header=image;resolve();};image.onerror=()=>reject(Error('新笑脸猫候选加载失败'));image.src='/candidates/header-smile.png';});
 myAvatar=avatar('A','#D9BEDD');oppAvatar=avatar('B','#B7D3E6');ready=true;render(selected);
}catch(e){output.textContent=String(e);}});
`;
function check() {
    if (stateNames.length !== states.length || changedStates.some(state => !states.includes(state))) throw Error('Invalid state labels or changed-page batch');
    new vm.Script(script, { filename: 'fixture.js' });
    for (const [id, source] of Object.entries(sources)) new vm.Script('(function(require,module,exports){\n' + source + '\n})', { filename: id });
    console.log('Fixture and ' + Object.keys(sources).length + ' bundled modules: syntax OK; no server started.');
}
function serve() {
    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, 'http://127.0.0.1');
            if (req.method === 'POST' && url.pathname === '/capture') {
                const name = url.searchParams.get('name');
                if (!captureNames.has(name)) { res.writeHead(400); res.end(); return; }
                const chunks = []; let size = 0;
                for await (const chunk of req) { size += chunk.length; if (size > 12 * 1024 * 1024) { res.writeHead(413); res.end(); return; } chunks.push(chunk); }
                const body = Buffer.concat(chunks).toString();
                if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(body)) { res.writeHead(400); res.end(); return; }
                const png = Buffer.from(body.slice(22), 'base64');
                const { width, height } = captureNames.get(name);
                if (png.length < 24 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || png.readUInt32BE(16) !== width * 2 || png.readUInt32BE(20) !== height * 2) { res.writeHead(400); res.end(); return; }
                fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, name + '.png'), png); res.end(name + '.png'); return;
            }
            if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
            if (url.pathname === '/compare') {
                const width = [320,390,430].includes(+url.searchParams.get('width')) ? +url.searchParams.get('width') : 390;
                const height = width===320?568:width===430?932:844;
                res.setHeader('Content-Type','text/html; charset=utf-8');
                res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>双猫方案 · 同页面比较</title><style>body{margin:24px;background:#e9edf5;color:#303b62;font:16px system-ui}main{display:flex;gap:24px;flex-wrap:wrap}iframe{border:0;width:'+width+'px;height:'+height+'px}a{margin-right:20px}h2{font-size:20px}</style><h1>双猫方案 · 同页面比较</h1><p>A 保留月牙与细毛；B 圆脸短绒，一只俯身蓄势、一只抬爪回应。B已获用户选择并接入正式素材；此处保留原图比较。</p><p><a href="/compare?width=320">320 窄屏</a><a href="/compare?width=390">390 标准屏</a><a href="/compare?width=430">430 大屏</a><a href="/">全部页面与状态</a></p><main>'+['a','b'].map(key=>'<section><h2>'+ (key==='a'?'A · 月牙备战':'B · 圆脸软萌')+'</h2><iframe title="方案 '+key.toUpperCase()+'" src="/?width='+width+'&duo='+key+'&embed=1"></iframe></section>').join('')+'</main></html>');return;
            }
            if (candidateFiles.has(url.pathname)) {
                const file=candidateFiles.get(url.pathname),real=fs.realpathSync(file);
                if(real!==file){res.writeHead(404);res.end();return;}
                res.setHeader('Content-Type','image/png');res.end(fs.readFileSync(real));return;
            }
            if (url.pathname === '/' || url.pathname === '/fixture.js') { res.setHeader('Content-Type', url.pathname === '/' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8'); res.end(url.pathname === '/' ? html : script); return; }
            const decoded = decodeURIComponent(url.pathname), file = path.resolve(root, '.' + decoded);
            if (!/^\/(res|ui-art|result-art)\//.test(decoded) || !file.startsWith(root + path.sep) || !/\.(png|jpe?g)$/i.test(file)) { res.writeHead(404); res.end(); return; }
            // realpath also prevents a resource symlink from exposing the workspace.
            let real; try { real = fs.realpathSync(file); } catch { res.writeHead(404); res.end(); return; }
            if (!['res', 'ui-art', 'result-art'].some(dir => real.startsWith(path.join(root, dir) + path.sep))) { res.writeHead(404); res.end(); return; }
            fs.readFile(real, (error, data) => { res.statusCode = error ? 404 : 200; res.setHeader('Content-Type', /\.png$/i.test(real) ? 'image/png' : 'image/jpeg'); res.end(error ? '' : data); });
        } catch (error) { res.writeHead(400); res.end('Invalid request'); }
    });
    server.listen(Number(process.argv[2]) || 0, '127.0.0.1', () => console.log('http://127.0.0.1:' + server.address().port));
}
if (process.argv.includes('--check')) check(); else if (require.main === module) serve();
module.exports = { script, states, check };
