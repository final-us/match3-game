// Isolated local fixture: actual Main/UI/Core/Board, in-memory storage; no cloud or user save.
const fs = require('fs');
const path = require('path');
const http = require('http');
const root = path.resolve(__dirname, '../match3-wechat');
const sources = {};
function collect(file) {
    const id = path.relative(root, file).replaceAll('\\', '/');
    if (sources[id]) return;
    sources[id] = fs.readFileSync(file, 'utf8');
    for (const m of sources[id].matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
        if (m[1].startsWith('.')) collect(path.resolve(path.dirname(file), m[1] + '.js'));
    }
}
collect(path.join(root, 'js/main.js'));
const html = `<!doctype html><meta charset="utf-8"><title>第一关入口隔离验证</title>
<style>body{font:16px sans-serif;background:#dbe3f2;margin:12px}canvas{display:block;touch-action:none}pre{white-space:pre-wrap}</style>
<a href="?width=320">320×568</a> · <a href="?width=390">390×844</a> · <a href="?width=430">430×932</a>
<p>点击地图第一关。仅使用内存测试存档，不访问微信账号或云端。</p>
<section id="content" hidden><label>试玩关卡 <select id="level">${[1,2,3,4,5,6,7,8,9,10,11,13,14,16,19,20,21,22,23,26,30,31,32,41,51,61,70,81,91,100,101,121,129,140,151,159,164,180,198,200,210,228,244].map(id=>'<option>'+id+'</option>').join('')}</select></label>
<button id="start-content">开始试玩</button><button id="valid-move">演示一次合法交换</button><button id="export-canvas">保存棋盘画面</button><span>拖动棋子即可游玩；试玩不使用实际存档或体力。</span></section>
<section id="tool-ads" hidden><p>局内道具验证：隔离SDK，只操作本页内存，不请求真实广告。</p>
<button id="ad-shop">进入商店验广告</button><button id="ad-home">进入首页验补心</button><button id="ad-stamina">打开体力弹窗</button>
<button id="ad-consent">确认观看</button><button id="ad-decline">取消观看</button>
<button id="ad-complete">模拟完整观看</button><button id="ad-cancel">模拟提前关闭</button><button id="ad-error">模拟无广告</button><button id="ad-load-error">下次加载失败1004</button>
<button id="items-zero">库存全为0</button><button id="items-sample">库存2/1/12</button><p id="tool-ad-status" role="status"></p></section>
<section id="new-obstacles" hidden><p>月相花苞与小鱼干包裹 · 固定代表场景，使用真实核心规则。正式第9/10关请在上方选择。</p>
<button data-obstacle="moonbud">月相花苞 · 开放</button><button data-obstacle="moonbud-closed">月相花苞 · 闭合</button>
<button data-obstacle="parcel">包裹 · 清出出口</button><button data-obstacle="parcel-ice">包裹 · 拆开路径冰块</button>
<button id="obstacle-exchange">演示一次目标消除</button><button id="obstacle-guide">查看本类教学</button>
<label><input id="obstacle-reduced" type="checkbox">减弱动效</label><p id="new-obstacle-note" role="status"></p></section>
<section id="paw" hidden><p>两枚新特殊棋子：真实核心与Canvas；演示按钮使用隔离固定棋盘，正式第3/4关请在上方选择。</p>
<button id="combo-open">9组组合试玩</button>
<div id="combo-controls" hidden>
<button data-combo="paw-rocket-h">猫爪＋横火箭</button><button data-combo="paw-rocket-v">猫爪＋竖火箭</button>
<button data-combo="paw-bomb">猫爪＋炸弹</button><button data-combo="paw-paw">双猫爪</button>
<button data-combo="bell-rocket-h">铃铛＋横火箭</button><button data-combo="bell-rocket-v">铃铛＋竖火箭</button>
<button data-combo="bell-bomb">铃铛＋炸弹</button><button data-combo="bell-paw">铃铛＋猫爪</button><button data-combo="bell-bell">双铃铛</button>
<button data-combo="paw-ball">猫爪＋彩球</button><button data-combo="bell-ball">铃铛＋彩球</button>
<label><input id="combo-reversed" type="checkbox">反向交换（重置棋盘）</label>
<p id="combo-caption" role="status"></p><details><summary>查看真实Core首轮数据</summary><pre id="combo-event" aria-label="真实Core首轮事件"></pre></details></div>
<details><summary>单体 / 连锁与现有效果对照</summary><p><button data-paw="reference-rocket">现有火箭 · 风格基准</button><button data-paw="reference-bomb">现有炸弹 · 风格基准</button><button data-paw="reference-orb">现有彩球 · 风格基准</button><button data-combo="bell-cross-chain">交叉连锁核对</button></p>
<button data-paw="create">合成猫爪</button><button data-paw="jelly-single">单层果冻 · 命中清除</button>
<button data-paw="jelly">双层果冻 · 2→1</button><button id="paw-jelly-again">再命中剩余果冻</button><button data-paw="ice">追踪冰块</button>
<button data-paw="jelly-colors">五色猫与果冻表面</button>
<button data-paw="yarn">追踪毛线</button><button data-paw="collect">颜色收集</button><button data-paw="chain">无障碍连锁</button><button data-paw="relay">猫爪接力</button>
<button data-paw="bell-target">猫爪追踪铃铛 · 音画连锁</button>
<br><button data-bell="create">Z形合成铃铛</button><button data-bell="dye">选择颜色 · 只染不消</button>
<button data-bell="rocket">染色合成火箭</button><button data-bell="ball">染色合成彩球</button>
<button data-bell="blocked">跳过锁定格</button><button data-bell="chain">铃铛与猫爪连锁</button><button data-bell="relay">双铃铛分时染色</button></details><p id="special-note"></p><p id="obstacle-state"></p>
<button id="paw-move">演示当前交换</button><label><input id="paw-reduced" type="checkbox">减弱动效</label>
<label><input id="specials-audio" type="checkbox">开启音效</label><p id="special-audio-state" role="status"></p></section>
<section id="motion" hidden><p>换位失败预览：真实棋盘与音效，本地内存状态。</p>
<button data-case="plain">普通换位失败</button><button data-case="ice">碰到冰块</button><button data-case="jelly">碰到果冻</button>
<label><input id="muted" type="checkbox">关闭音效</label><label><input id="reduced" type="checkbox">减弱动效</label>
<button id="sequence">连续演示三种反馈</button></section>
<pre id="status">加载中</pre><canvas id="game"></canvas><script src="/fixture.js"></script>`;
const script = `
const sources=${JSON.stringify(sources)},cache={},storage={match3_music_enabled_v1:false,match3_sfx_enabled_v1:false};
const replayMode=new URLSearchParams(location.search).has('replay');
const obstacleSeedMode=new URLSearchParams(location.search).has('obstacles');
const boardMath=Object.create(Math);let replayDraws=0;
boardMath.random=()=>{replayDraws++;return window.replayRandom?window.replayRandom():Math.random();};
window.wx={createImage:()=>new Image(),getStorageSync:k=>storage[k],setStorageSync:(k,v)=>{storage[k]=v;}};
wx.getFileSystemManager=()=>({readFile:request=>fetch('/'+request.filePath).then(r=>{
 if(!r.ok)throw new Error('missing audio');return r.arrayBuffer().then(data=>{data.previewFile=request.filePath;return data;});
}).then(data=>request.success({data})).catch(request.fail)});
function load(id){
 if(cache[id])return cache[id].exports;
 const m=cache[id]={exports:{}};
 const req=rel=>{const parts=id.split('/');parts.pop();rel.split('/').forEach(p=>p==='..'?parts.pop():p!=='.'&&parts.push(p));return load(parts.join('/')+'.js');};
 new Function('require','module','exports','Math',sources[id])(req,m,m.exports,(replayMode||obstacleSeedMode)&&id==='js/core/grid.js'?boardMath:Math);return m.exports;
}
const widths={320:568,375:812,390:844,430:932},params=new URLSearchParams(location.search);
const width=widths[params.get('width')]?+params.get('width'):390,height=widths[width];
const motionPreview=params.get('preview')==='invalid';
const privacyPreview=params.get('preview')==='privacy';
const contentPreview=params.get('preview')==='content';
const pawPreview=contentPreview&&(params.has('paw')||params.has('specials'));
const obstaclePreview=contentPreview&&params.has('obstacles');
const audioTrace={decoded:[],played:[]},audioFiles=new WeakMap();
function showAudioTrace(){
 if(!pawPreview)return;
 document.getElementById('special-audio-state').textContent='已解码：'+audioTrace.decoded.join('、')+'；最近播放：'+audioTrace.played.map(item=>item.cue+'（延迟'+item.delay+'ms，'+item.duration+'s，速率'+item.rate+'，'+item.state+'）').join(' → ');
}
wx.createWebAudioContext=()=>{
 const context=new AudioContext(),decode=context.decodeAudioData.bind(context),create=context.createBufferSource.bind(context);
 context.decodeAudioData=(data,success,fail)=>decode(data,buffer=>{
  audioFiles.set(buffer,data.previewFile);audioTrace.decoded.push(data.previewFile);showAudioTrace();if(success)success(buffer);
 },fail);
 context.createBufferSource=()=>{
  const source=create(),start=source.start.bind(source),stop=source.stop.bind(source);let traced=null;
  source.stop=(...args)=>{if(traced){traced.state='取消';showAudioTrace();}return stop(...args);};
  source.start=(when,offset,duration)=>{
   const file=audioFiles.get(source.buffer),bank=load('js/sfx-new-specials-map.js');
   const cue=file===bank.file?(offset===0?'猫爪 A':'铃铛 A'):'旧音效';
   const item={cue,delay:Math.round(Math.max(0,when-context.currentTime)*1000),duration:Number((duration==null?source.buffer.duration:duration).toFixed(3)),rate:source.playbackRate.value,state:'开始'};traced=item;
   audioTrace.played.push(item);audioTrace.played=audioTrace.played.slice(-6);showAudioTrace();
   source.addEventListener('ended',()=>{if(item.state!=='取消')item.state='结束';showAudioTrace();});
   return start(when,offset,duration);
  };
  return source;
 };
 return context;
};
const canvas=document.getElementById('game'),status=document.getElementById('status');
canvas.width=width*2;canvas.height=height*2;canvas.style.width=width+'px';canvas.style.height=height+'px';
const ctx=canvas.getContext('2d');ctx.scale(2,2);
const Main=load('js/main.js'),UI=load('js/render/ui.js');
const app=Object.create(Main.prototype);
Object.assign(app,{ctx,screen:{width,height,safeTop:47,contentTop:91,safeBottom:34},state:'levelselect',progress:{unlockedLevel:1,failures:{},stars:{}},guide:null,guideQueue:[],levelMapOffset:0});
if(params.has('toolads')){
 document.getElementById('tool-ads').hidden=false;
 let activeAd=null,activeModal=null,requests=0,nextLoadError=false;
 wx.getAccountInfoSync=()=>({miniProgram:{envVersion:'develop'}});
 const inventory=load('js/core/coin.js');
 const report=message=>document.getElementById('tool-ad-status').textContent=message+'；请求'+requests+'次；库存'+JSON.stringify(inventory.getItems())+'；商店已领'+inventory.getRewardedItemState().count+'次';
 wx.showToast=options=>report(options.title);
 document.getElementById('ad-load-error').onclick=()=>{nextLoadError=true;report('下一次模拟加载1004');};
 wx.showModal=options=>{activeModal=options;report(options.content);};
 const consent=confirm=>{if(!activeModal)return;const modal=activeModal;activeModal=null;modal.success({confirm});if(modal.complete)modal.complete({confirm});setTimeout(()=>report(confirm?'已确认观看':'已取消观看'),0);};
 document.getElementById('ad-consent').onclick=()=>consent(true);
 document.getElementById('ad-decline').onclick=()=>consent(false);
 wx.createRewardedVideoAd=options=>{
  if(options.disableFallbackSharePage!==true)throw new Error('share fallback must be disabled');
  const closes=new Set(),errors=new Set();
  const instance={onClose:fn=>closes.add(fn),offClose:fn=>closes.delete(fn),onError:fn=>errors.add(fn),offError:fn=>errors.delete(fn),
   show(){requests++;activeAd=instance;report('隔离视频等待操作');return Promise.resolve();},load(){if(nextLoadError){nextLoadError=false;return Promise.reject({errCode:1004});}return Promise.resolve();},
   finish(done){activeAd=null;for(const fn of [...closes])fn({isEnded:done});},fail(){activeAd=null;for(const fn of [...errors])fn({errCode:1004});}};
  return instance;
 };
 const finish=mode=>{if(!activeAd)return;mode==='error'?activeAd.fail():activeAd.finish(mode==='complete');setTimeout(()=>report('隔离视频已结束'),0);};
 document.getElementById('ad-complete').onclick=()=>finish('complete');
 document.getElementById('ad-cancel').onclick=()=>finish('cancel');
 document.getElementById('ad-error').onclick=()=>finish('error');
 const seed=items=>{if(activeAd)return;storage.match3_items_v1=items;if(app.board)app.board.setTools(items);report('内存测试库存');};
 document.getElementById('ad-shop').onclick=()=>{if(app.adFlow)return;app.handleTouchCancel();app.guide=null;app.staminaDialog=false;app.state='shop';draw();};
 document.getElementById('ad-home').onclick=()=>{if(app.adFlow)return;app.handleTouchCancel();app.guide=null;app.staminaDialog=false;storage.match3_heart_v1={count:0,lastLossTime:Date.now()};app.state='menu';draw();};
 document.getElementById('ad-stamina').onclick=()=>{if(app.adFlow)return;app.handleTouchCancel();storage.match3_heart_v1={count:0,lastLossTime:Date.now()};app.showStaminaDialog();draw();};
 document.getElementById('items-zero').onclick=()=>seed({hammer:0,bomb:0,color:0});
 document.getElementById('items-sample').onclick=()=>seed({hammer:2,bomb:1,color:12});
 report('尚未请求广告');
 document.querySelectorAll('a').forEach(a=>a.href+='&toolads=1');
}
if(contentPreview){
 document.title='关卡与策略反馈 · 本地试玩';document.getElementById('content').hidden=false;
 document.querySelector('p').textContent='正式关卡本地试玩：第6–10关依次介绍五类障碍；第11关起混合目标，第100关进入最高难度档。随机棋盘，仅内存存档。';
 document.querySelectorAll('a').forEach(a=>a.href+='&preview=content');
 storage.match3_onboarding_v1={solo_intro:true,special_piece:true,obstacle:true,solo_item:true,pvp_wait:true,
  yarn_spread:true,collect_cats:true,special_combo:true,tracking_paw:true,color_bell:true};
 if(params.has('fresh'))storage.match3_onboarding_v1={};
 app.progress.unlockedLevel=42;
 window.previewApp=app;
 window.previewStart=id=>{
  window.previewComboKind=null;window.previewComboEvent=null;
  document.getElementById('combo-caption').textContent='';document.getElementById('combo-event').textContent='';
  storage.match3_heart_v1={count:5,lastLossTime:0};app.startGame(id);
 };
 window.previewMove=()=>{
  if(app.state!=='playing'||app.guide||!app.core.isPlaying())return false;
  const core=app.core;
  for(let r=0;r<core.grid.length;r++)for(let c=0;c<core.grid[r].length;c++){
   const a={row:r,column:c};
   for(const b of [{row:r,column:c+1},{row:r+1,column:c}]){
    if(b.row>=core.grid.length||b.column>=core.grid[0].length||core.isBlocked(a)||core.isBlocked(b)||!core.validateMove(a,b))continue;
    const from=app.board.pieceCenter(a.row,a.column),to=app.board.pieceCenter(b.row,b.column);
    app.handleTouchStart({touches:[{clientX:from.x,clientY:from.y}]});
    app.handleTouchMove({touches:[{clientX:to.x,clientY:to.y}]});
    app.handleTouchEnd({changedTouches:[{clientX:to.x,clientY:to.y}]});
    return true;
   }
  }
  return false;
 };
 if(replayMode){
  const clockModule={exports:{}};
  new Function('module', ${JSON.stringify(fs.readFileSync(path.join(root,'test/helpers/virtual-animation-clock.js'),'utf8'))})(clockModule);
  const checkpoint=()=>new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=()=>{channel.port1.close();channel.port2.close();resolve();};channel.port2.postMessage(null);});
  window.replayAdvance=ms=>{for(let left=ms;left>0;){const dt=Math.min(16,left);app.update(dt);left-=dt;}draw();};
  window.replayBegin=({levelId,seed,reduceEffects})=>{
   let state=seed>>>0;window.replayRandom=()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
   replayDraws=0;
   storage.match3_onboarding_v1=Object.fromEntries(Object.values(load('js/core/onboarding.js').GUIDE_KEYS).map(k=>[k,true]));
   app.progress={unlockedLevel:2000,stars:{},failures:{}};app.screen.reduceEffects=!!reduceEffects;
   window.replayResult=null;window.replayPending=null;window.replayWaits=[];
   previewStart(levelId);
   window.replayClock=clockModule.exports(replayAdvance,checkpoint);
   app.board.wait=replayClock.wait;
   window.replayDrain=()=>replayClock.drain(replayPending);
   window.replayReset=()=>{replayClock.reset();window.replayWaits=replayClock.tape;window.replayPending=null;};
   replayReset();
   const swap=app.core.trySwap.bind(app.core),finish=app.core.callbacks.onLevelEnd;
   app.core.trySwap=(...args)=>{window.replayPending=swap(...args);return replayPending;};
   app.core.callbacks.onLevelEnd=r=>{window.replayResult=r;finish(r);};
   draw();
  };
  window.replaySnapshot=()=>{const c=app.core;return JSON.parse(JSON.stringify({grid:c.grid,jelly:c.jellyGrid,ice:c.iceGrid,yarn:c.yarnSource,vines:c.yarnVines,yarnTurns:c.yarnTurns,bases:c.specialBases,
   score:c.score,moves:c.movesLeft,time:c.timeLeftMs,started:c.timerStarted,ended:c.ended,won:c.won,collected:c.collectedCounts,
   cascade:c.maxCascade,combos:c.specialComboCount,moonbuds:c.moonbudCells,moonbudOpen:c.moonbudOpen,
   parcels:c.parcels,parcelDelivered:c.parcelDelivered,draws:replayDraws,result:replayResult}));};
 }
 document.getElementById('start-content').onclick=()=>window.previewStart(+document.getElementById('level').value);
 document.getElementById('valid-move').onclick=()=>window.previewMove();
 document.getElementById('export-canvas').onclick=()=>{
  draw();canvas.toBlob(blob=>fetch('/snapshot?level='+app.core.level.id+'&width='+width,{method:'POST',body:blob}),'image/png');
 };
 const selectedLevel=Array.from(document.querySelectorAll('#level option')).some(option=>+option.value===+params.get('level'))?Number(params.get('level')):6;
 document.getElementById('level').value=selectedLevel;window.previewStart(selectedLevel);
 if(obstaclePreview){
  document.title='月相花苞与小鱼干包裹 · 本地样板';
  document.getElementById('new-obstacles').hidden=false;
  document.getElementById('content').hidden=true;
  document.querySelector('p').textContent='两类新玩法代表样板；固定棋盘、内存存档，不访问微信或云账号。';
  document.querySelectorAll('a').forEach(a=>a.href+='&obstacles=1');
  const levels=load('js/core/level.js'),config=load('js/core/config.js'),onboarding=load('js/core/onboarding.js');
  window.previewObstacle=kind=>{
   if(app.core&&app.core.processing)return false;
   storage.match3_onboarding_v1=Object.fromEntries(Object.values(onboarding.GUIDE_KEYS).map(key=>[key,true]));
   const flower=kind.startsWith('moonbud'),ice=kind==='parcel-ice';
   const hudMixed=flower&&params.get('obstacleHud')==='timed-mixed';
   let seed=20261002;window.replayRandom=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
   const level={...levels.getLevel(21),id:21,name:flower?'月相花园':'小鱼干配送',contentRevision:'obstacles-local-sample-v1',
    moveCount:25,timeLimitSec:hudMixed?165:0,underlays:{},obstacles:ice?{'4:3':1}:{},yarn:null,initialSpecials:[],
    goals:[{type:flower?'moonbud':'parcel',target:flower?2:1}].concat(hudMixed?
     [{type:'score',target:1000},{type:'collect',pieceType:1,target:10}]:[]),
    moonbuds:flower?['3:3','7:7']:[],parcels:flower?[]:[{id:'parcel-1',row:1,column:3}],parcelExits:flower?[]:[3]};
   const getLevel=levels.getLevel;
   levels.getLevel=()=>level;
   try{previewStart(21);}finally{levels.getLevel=getLevel;}
   const core=app.core;
   core.grid=Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>(r*2+c)%5+1));
   if(flower){
    core.grid[3][2]=1;core.grid[3][3]=1;core.grid[3][4]=2;core.grid[2][4]=1;
    core.moonbudOpen=kind!=='moonbud-closed';
    window.previewObstacleExchange=[{row:2,column:4},{row:3,column:4}];
   }else{
    core.grid[1][3]=config.OBJECT_TYPES.PARCEL;
    const rocketRow=ice?6:5;
    core.grid[rocketRow][3]=config.SPECIAL_TYPES.V_ROCKET;core.setSpecialBaseType({row:rocketRow,column:3},2);
    window.previewObstacleExchange=[{row:rocketRow,column:3},{row:rocketRow-1,column:3}];
   }
   app.board.setGame(core);
   app.guide=null;app.guideQueue=[];
   window.previewObstacleKind=kind;
   window.previewObstacleEvents=[];
   const match=core.callbacks.onMatch,delivery=core.callbacks.onParcelDelivered,phase=core.callbacks.onMoonbudPhase;
   core.callbacks.onMatch=data=>{previewObstacleEvents.push({kind:'match',buds:data.moonbudHits||[],closed:data.moonbudClosedHits||[],removed:data.removed.length});return match(data);};
   core.callbacks.onParcelDelivered=data=>{previewObstacleEvents.push({kind:'delivery',...data});return delivery?delivery(data):Promise.resolve();};
   core.callbacks.onMoonbudPhase=data=>{previewObstacleEvents.push({kind:'phase',...data});return phase?phase(data):Promise.resolve();};
   document.getElementById('new-obstacle-note').textContent=flower?'':
    (ice?'纵向火箭先拆路径冰块；包裹会停在仍保留的猫上方，继续清路才能送达。':'包裹不会被火箭打碎；清空同列下方后，沿竖直方向落到金色箭头出口。');
   return true;
  };
  const exchange=()=>{
   if(!app.core.isPlaying()||app.guide||!previewObstacleExchange)return false;
   const [a,b]=previewObstacleExchange,from=app.board.pieceCenter(a.row,a.column),to=app.board.pieceCenter(b.row,b.column);
   app.handleTouchStart({touches:[{clientX:from.x,clientY:from.y}]});
   app.handleTouchMove({touches:[{clientX:to.x,clientY:to.y}]});
   app.handleTouchEnd({changedTouches:[{clientX:to.x,clientY:to.y}]});
   return true;
  };
  document.querySelectorAll('[data-obstacle]').forEach(button=>button.onclick=()=>previewObstacle(button.dataset.obstacle));
  document.getElementById('obstacle-exchange').onclick=exchange;
  document.getElementById('obstacle-guide').onclick=()=>{
   if(!app.core.isPlaying())return;
   const key=previewObstacleKind.startsWith('moonbud')?onboarding.GUIDE_KEYS.MOONBUD:onboarding.GUIDE_KEYS.PARCEL;
   storage.match3_onboarding_v1[key]=false;app.showGuide(key);
  };
  document.getElementById('obstacle-reduced').onchange=event=>{app.screen.reduceEffects=event.target.checked;};
  previewObstacle(params.get('case')||'moonbud');
 }
 if(pawPreview){
  document.title='追踪猫爪与染色铃铛 · 本地试玩';document.getElementById('paw').hidden=false;
  document.querySelectorAll('a').forEach(a=>a.href+='&specials=1');
  const comboKinds={
   'paw-rocket-h':[105,101,'猫爪把横火箭运到目标，清目标所在横线。'],
   'paw-rocket-v':[105,102,'猫爪把竖火箭运到目标，清目标所在竖线。'],
   'paw-bomb':[105,103,'猫爪把炸弹运到目标，命中目标周围3×3。'],
   'paw-paw':[105,105,'双猫爪追踪远端最多3个不同目标。'],
   'bell-rocket-h':[106,101,'原横火箭发动；最多2只铃铛自身底色普通猫转换为横火箭并立即发动。'],
   'bell-rocket-v':[106,102,'原竖火箭发动；最多2只铃铛自身底色普通猫转换为竖火箭并立即发动。'],
   'bell-bomb':[106,103,'原炸弹发动；最多2只铃铛自身底色普通猫转换为炸弹并立即发动。'],
   'bell-paw':[106,105,'原猫爪发动；最多2只铃铛自身底色普通猫转换为猫爪并立即发动。'],
   'bell-bell':[106,106,'双铃铛在落点3×3染成落点底色，先匹配后掉落。'],
   'paw-ball':[105,104,'彩球把猫爪底色对应的可转换普通猫批量变为猫爪并发动，不受2枚增援上限限制。'],
   'bell-ball':[106,104,'彩球把铃铛底色对应的可转换普通猫批量变为铃铛，各自染色四邻，再判匹配后掉落；不是全屏染色。'],
   'bell-cross-chain':[106,101,'铃铛＋横火箭交叉链：原火箭立即命中(4,2)炸弹，增援稍后发动。另有(0,2)竖火箭。']
  };
  window.previewCombo=(kind,reversed=false)=>{
   if(!comboKinds[kind]||app.core&&(app.core.processing||app.core.swapFeedbackPending))return false;
   const [first,second,rule]=comboKinds[kind];
   const levels=load('js/core/level.js'),getLevel=levels.getLevel;
   const level={id:6,name:'9组组合试玩',contentRevision:'special-combos-local-v2',rows:8,columns:8,colorCount:5,
    moveCount:25,timeLimitSec:0,trackingPaw:true,colorBell:true,
    goals:[{type:'score',target:999999}],underlays:{'1:1':2,'1:6':2,'6:1':2},obstacles:{'6:6':1},
    yarn:null,moonbuds:[],parcels:[],parcelExits:[],initialSpecials:[]};
   storage.match3_onboarding_v1=Object.fromEntries(Object.values(load('js/core/onboarding.js').GUIDE_KEYS).map(key=>[key,true]));
   levels.getLevel=()=>level;
   try{previewStart(6);}finally{levels.getLevel=getLevel;}
   const core=app.core;
   core.grid=Array.from({length:8},(_,row)=>Array.from({length:8},(_,column)=>(row*2+column)%5+1));
   core.grid[4][3]=first;core.grid[4][4]=second;
   core.setSpecialBaseType({row:4,column:3},2);core.setSpecialBaseType({row:4,column:4},3);
   if(kind==='bell-cross-chain'){core.grid[0][2]=102;core.grid[4][2]=103;}
   app.guide=null;app.guideQueue=[];app.board.setGame(core);
   window.previewComboKind=kind;window.previewComboReversed=!!reversed;
   window.previewComboColorEvents=[];window.previewPawCase=null;window.previewPawEvent=null;window.previewBellEvents=[];
   window.previewPawExchange=reversed?[{row:4,column:4},{row:4,column:3}]:[{row:4,column:3},{row:4,column:4}];
   document.getElementById('combo-controls').hidden=false;
   document.getElementById('combo-reversed').checked=!!reversed;
   document.getElementById('special-note').textContent='固定组合已就绪；手动拖动或点击“演示当前交换”。';
   document.getElementById('obstacle-state').textContent='';
   const caption=document.getElementById('combo-caption'),eventNote=document.getElementById('combo-event');
   const description='已批准规则：'+rule+' 障碍按现有规则结算。坐标从0开始；特殊起点(4,3)底色2、(4,4)底色3；'+
    (reversed?'反向(4,4)→(4,3)。':'正向(4,3)→(4,4)。')+
    '远端双层果冻(1,1)/(1,6)/(6,1)，冰块(6,6)。';
   caption.textContent=description+' 等待真实Core首轮触发/染色事件。';
   const match=core.callbacks.onMatch,colorChange=core.callbacks.onColorChange;
   core.callbacks.onMatch=data=>{
    if(window.previewComboEvent===null){
     window.previewComboEvent=JSON.parse(JSON.stringify(data));
     const triggers=data.triggeredSpecials||[],paws=triggers.flatMap(item=>item.pawTargets||(item.target?[item]:[]));
     const replicas=triggers.flatMap(item=>item.replicas||[]);
     caption.textContent=description+' 实际首轮：'+triggers.length+'次特殊触发，'+paws.length+'处追踪，'+
      (first===104||second===104?'':replicas.length+'枚增援，')+(data.colorChanges||[]).length+'格染色。可展开查看真实数据。';
     eventNote.textContent=JSON.stringify({match:window.previewComboEvent,colorEvents:window.previewComboColorEvents},null,2);
    }
    return match(data);
   };
   core.callbacks.onColorChange=data=>{
    if(window.previewComboEvent===null)window.previewComboColorEvents.push(JSON.parse(JSON.stringify(data)));
    return colorChange?colorChange(data):Promise.resolve();
   };
   draw();return true;
  };
  document.getElementById('combo-open').onclick=()=>previewCombo(window.previewComboKind||'paw-rocket-h',document.getElementById('combo-reversed').checked);
  document.querySelectorAll('[data-combo]').forEach(button=>button.onclick=()=>previewCombo(button.dataset.combo,document.getElementById('combo-reversed').checked));
  document.getElementById('combo-reversed').onchange=event=>{if(window.previewComboKind)previewCombo(window.previewComboKind,event.target.checked);};
  window.previewPaw=kind=>{
   storage.match3_onboarding_v1=Object.fromEntries(Object.values(load('js/core/onboarding.js').GUIDE_KEYS).map(k=>[k,true]));
   previewStart(16);const core=app.core;
   core.level={...core.level,goals:[{type:'score',target:999999}],trackingPaw:true,timeLimitSec:0};
   core.timeLimitMs=0;core.timeLeftMs=0;core.timerStarted=false;
   core.grid=core.grid.map((row,r)=>row.map((_,c)=>(r*2+c)%5+1));
   core.jellyGrid=core.grid.map(row=>row.map(()=>0));core.iceGrid=core.grid.map(row=>row.map(()=>0));
   core.yarnSource=null;core.yarnVines={};core.specialBases={};core.jellyTotal=0;
   window.previewPawCase=kind;window.previewPawEvent=null;
   document.getElementById('obstacle-state').textContent=kind==='jelly'?'当前目标：双层果冻，需要命中两次。':kind==='jelly-single'?'当前目标：单层果冻，命中一次清除。':'';
   document.getElementById('special-note').textContent=kind==='create'?'交换紫猫，拼出2×2同色方块，保留一枚追踪猫爪。':'交换猫爪：先清近身十字，再命中远处目标。';
   const match=core.callbacks.onMatch;core.callbacks.onMatch=async data=>{
    if(!previewPawEvent)window.previewPawEvent=data;
    await match(data);
    const trigger=(data.triggeredSpecials||[]).find(piece=>piece.type===105&&piece.targetJelly>0);
    if(trigger){
     const remaining=core.jellyGrid[trigger.target.row][trigger.target.column];
     document.getElementById('obstacle-state').textContent='果冻 '+trigger.targetJelly+' → '+remaining+(remaining?'：已破一层，剩余一层；猫咪保留。':'：果冻已清除；猫咪保留。');
    }
   };
   if(kind==='create'){
    [[3,2],[3,3],[4,2],[4,4]].forEach(([r,c])=>core.grid[r][c]=4);
    core.grid[4][3]=2;core.grid[5][3]=1;
    window.previewPawExchange=[{row:4,column:4},{row:4,column:3}];
   }else if(kind==='jelly-colors'){
    core.level.underlays={};
    for(let c=0;c<5;c++){
     for(const r of [2,4,6])core.grid[r][c+1]=c+1;
     for(const [r,layers] of [[2,1],[4,2]]){core.jellyGrid[r][c+1]=layers;core.level.underlays[r+':'+(c+1)]=layers;}
    }
    core.jellyTotal=15;core.level.goals=[{type:'jelly',target:15}];
    window.previewPawExchange=null;
    document.getElementById('special-note').textContent='第3排单层淡粉、第5排双层淡紫、第7排原猫，五种颜色逐列对照。';
   }else{
    core.grid[4][3]=105;core.setSpecialBaseType({row:4,column:3},1);
    const referenceTypes={'reference-rocket':101,'reference-bomb':103,'reference-orb':104};
    if(referenceTypes[kind]){
     core.grid[4][3]=referenceTypes[kind];
     document.getElementById('special-note').textContent='现有特殊棋子基准：同一棋盘与缩放，点击“演示当前交换”比较触发效果。';
    }
    window.previewPawExchange=[{row:4,column:3},{row:4,column:4}];
    if(kind==='jelly')core.jellyGrid[1][6]=2;
    if(kind==='jelly-single')core.jellyGrid[1][6]=1;
    if(kind==='jelly'||kind==='jelly-single'){
     core.jellyTotal=core.jellyGrid[1][6];
     core.level.goals.unshift({type:'jelly',target:core.jellyTotal});
    }
    if(kind==='ice')core.iceGrid[1][6]=1;
    if(kind==='chain')core.grid[1][6]=101;
    if(kind==='relay'){core.grid[1][6]=105;core.setSpecialBaseType({row:1,column:6},4);}
    if(kind==='bell-target'){core.grid[1][6]=106;core.setSpecialBaseType({row:1,column:6},4);}
    if(kind==='collect')core.level.goals=[{type:'collect',pieceType:5,target:20},{type:'score',target:999999}];
    if(kind==='yarn'){
     core.level.yarn={source:'1:6',health:3,spreadEvery:2,maxVines:3};
     core.yarnSource={row:1,column:6,health:3,maxHealth:3};
    }
   }
   app.board.syncPiecesFromGrid();draw();
  };
  window.previewBell=kind=>{
   storage.match3_onboarding_v1=Object.fromEntries(Object.values(load('js/core/onboarding.js').GUIDE_KEYS).map(k=>[k,true]));
   previewStart(6);const core=app.core;
   core.level={...core.level,goals:[{type:'score',target:999999}],trackingPaw:true,colorBell:true,timeLimitSec:0};
   core.timeLimitMs=0;core.timeLeftMs=0;core.timerStarted=false;
   core.grid=core.grid.map((row,rowIndex)=>row.map((pieceType,column)=>(rowIndex*2+column)%5+1));
   core.jellyGrid=core.grid.map(row=>row.map(()=>0));core.iceGrid=core.grid.map(row=>row.map(()=>0));
   core.yarnSource=null;core.yarnVines={};core.specialBases={};core.jellyTotal=0;
   window.previewBellCase=kind;window.previewBellEvents=[];
   document.getElementById('obstacle-state').textContent='';
   const match=core.callbacks.onMatch;core.callbacks.onMatch=data=>{previewBellEvents.push({data,collected:{...core.collectedCounts}});return match(data);};
   if(kind==='create'){
    [[3,2],[3,3],[4,3],[4,5]].forEach(([row,column])=>core.grid[row][column]=4);
    core.grid[4][4]=2;core.grid[5][3]=1;
    window.previewPawExchange=[{row:4,column:5},{row:4,column:4}];
   }else{
    core.grid[4][3]=106;core.setSpecialBaseType({row:4,column:3},2);
    window.previewPawExchange=[{row:4,column:3},{row:4,column:4}];
    if(kind==='rocket'||kind==='ball'){
     const columns=kind==='rocket'?[3,5,6]:[2,3,5,6];
     columns.forEach(column=>core.grid[3][column]=3);
     core.grid[3][4]=2;core.grid[2][3]=1;core.grid[3][1]=2;
    }
    if(kind==='blocked'){core.jellyGrid[3][4]=2;core.iceGrid[5][4]=1;}
    if(kind==='chain'||kind==='relay'){core.grid[4][4]=105;core.setSpecialBaseType({row:4,column:4},1);}
    if(kind==='relay'){core.grid[1][6]=106;core.setSpecialBaseType({row:1,column:6},5);}
   }
   document.getElementById('special-note').textContent=kind==='create'?'交换紫猫，拼出四只同色Z形，保留一枚染色铃铛。':'与普通猫交换选择颜色；邻猫先变色，凑成三连才消除，四连/五连继续合成火箭/彩球。';
   app.board.syncPiecesFromGrid();draw();
  };
  document.querySelectorAll('[data-paw]').forEach(button=>button.onclick=()=>{if(!app.core.processing)previewPaw(button.dataset.paw);});
  document.querySelectorAll('[data-bell]').forEach(button=>button.onclick=()=>{if(!app.core.processing)previewBell(button.dataset.bell);});
  document.getElementById('paw-jelly-again').onclick=()=>{
   const core=app.core;
   if(!core.isPlaying()||window.previewPawCase!=='jelly'||core.jellyGrid[1][6]!==1)return;
   core.grid=core.grid.map((row,rowIndex)=>row.map((pieceType,column)=>(rowIndex*2+column)%5+1));
   core.specialBases={};core.grid[4][3]=105;core.setSpecialBaseType({row:4,column:3},1);
   app.board.specialEffects=[];app.board.syncPiecesFromGrid();window.previewPawEvent=null;
   window.previewPawExchange=[{row:4,column:3},{row:4,column:4}];
   document.getElementById('special-note').textContent='已保留上一轮剩余的一层果冻，并摆回猫爪演示位置；点击“演示当前交换”。';draw();
  };
  document.getElementById('paw-reduced').onchange=e=>{app.screen.reduceEffects=e.target.checked;};
  document.getElementById('paw-move').onclick=()=>{
   if(!app.core.isPlaying()||app.guide||!window.previewPawExchange)return;
   const [a,b]=previewPawExchange,from=app.board.pieceCenter(a.row,a.column),to=app.board.pieceCenter(b.row,b.column);
   app.handleTouchStart({touches:[{clientX:from.x,clientY:from.y}]});
   app.handleTouchMove({touches:[{clientX:to.x,clientY:to.y}]});app.handleTouchEnd({changedTouches:[{clientX:to.x,clientY:to.y}]});
  };
  if(params.has('combo'))previewCombo(params.get('combo'),params.get('reversed')==='1');
  else if(params.has('paw'))previewPaw('create');
 }
 let previous=performance.now();
 function frame(now){const dt=now-previous;previous=now;if(!replayMode)app.update(dt);draw();requestAnimationFrame(frame);}
 requestAnimationFrame(frame);
}
if(privacyPreview){
 app.state='settings';app.privacyOffset=0;
 document.title='本地隐私协议阅读验证';
 document.querySelector('p').textContent='设置 → 隐私说明。断开微信接口的本地阅读验证；'+(load('js/core/privacy-policy.js').publication.approvedForRelease?'正文已确认，后台声明与真机验收仍须核实。':'正文待确认，暂勿送审。');
 document.querySelectorAll('a').forEach(a=>a.href+='&preview=privacy');
 if(params.get('privacyApi')==='silent'){
  wx.openPrivacyContract=()=>{};
  document.querySelector('p').textContent='仅本地模拟接口无回调：点击隐私说明后显示等待，5秒后进入本地阅读页。不是微信接口验证。';
  setInterval(draw,100);
 }
}
let previewCase='plain',previewError='',feedbackCount=0;
const audio=load('js/audio.js');
if(pawPreview){
 const toggle=document.getElementById('specials-audio');
 toggle.checked=params.has('audio');audio.init();audio.setSfxEnabled(toggle.checked);
 toggle.onchange=()=>{audio.setSfxEnabled(toggle.checked);if(toggle.checked)audio.unlock();};
 document.getElementById('paw-move').addEventListener('click',()=>audio.unlock(),{capture:true});
}
if(motionPreview){
 document.getElementById('motion').hidden=false;
 document.querySelectorAll('a').forEach(a=>a.href+='&preview=invalid');
 app.startGame(1);app.guide=null;
 app.core.level={...app.core.level,goals:[{type:'score',target:99999}]};
 app.core.grid=app.core.grid.map((row,r)=>row.map((_,c)=>(r*2+c)%5+1));
 app.core.jellyGrid=app.core.grid.map(row=>row.map(()=>0));
 app.core.iceGrid=app.core.grid.map(row=>row.map(()=>0));
 app.core.jellyTotal=0;app.board.syncPiecesFromGrid();
 const feedback=app.core.callbacks.onInvalidSwap;
 app.core.callbacks.onInvalidSwap=(a,b)=>{feedbackCount++;return feedback(a,b);};
 audio.init();audio.setSfxEnabled(true);
 document.getElementById('muted').onchange=e=>audio.setSfxEnabled(!e.target.checked);
 document.getElementById('reduced').onchange=e=>{app.screen.reduceEffects=e.target.checked;};
 window.addEventListener('unhandledrejection',e=>{previewError=String(e.reason);});
 function attempt(kind){
  if(!app.core.isPlaying())return;
  previewCase=kind;
  app.core.iceGrid[2][3]=kind==='ice'?1:0;
  app.core.jellyGrid[3][2]=kind==='jelly'?2:0;
  const a=app.board.pieceCenter(2,2),b=kind==='jelly'?app.board.pieceCenter(3,2):app.board.pieceCenter(2,3);
  audio.unlock();app.board.onTouchStart(a.x,a.y);app.board.onTouchMove(b.x,b.y);app.board.onTouchEnd();
 }
 document.querySelectorAll('[data-case]').forEach(button=>button.onclick=()=>attempt(button.dataset.case));
 document.getElementById('sequence').onclick=async()=>{
  for(const kind of ['plain','ice','jelly']){attempt(kind);await new Promise(r=>setTimeout(r,850));}
 };
 let last=performance.now();
 function frame(now){const dt=now-last;last=now;app.board.update(dt);draw();requestAnimationFrame(frame);}
 requestAnimationFrame(frame);
}
function draw(){
 ctx.clearRect(0,0,width,height);
 if(contentPreview){
  app.render();
  if(obstaclePreview&&app.core){
   const busy=app.core.processing||app.core.swapFeedbackPending;
   document.querySelectorAll('[data-obstacle],#obstacle-reduced,#obstacle-guide').forEach(button=>button.disabled=!!busy);
   document.getElementById('obstacle-exchange').disabled=!!busy||!!app.guide||app.core.ended||app.core.movesLeft<25;
   if(window.previewObstacleKind&&previewObstacleKind.startsWith('moonbud')){
    const phase=app.core.moonbudOpen?'当前开放：猫被固定，命中可消猫并收花。':'当前闭合：猫被固定，命中保留原猫和花苞；成功操作后开放。';
    document.getElementById('new-obstacle-note').textContent=phase+(app.core.movesLeft===25?
     '点击“演示一次目标消除”，或自行拖动观察。':'可继续手动试玩；上方开放/闭合按钮可重置对照场景。');
   }
   status.textContent=JSON.stringify({sample:previewObstacleKind,state:app.state,moves:app.core.movesLeft,open:app.core.moonbudOpen,
    buds:app.core.getMoonbudsLeft(),parcels:app.core.parcels,delivered:app.core.parcelDelivered,ended:app.core.ended,won:app.core.won,guide:app.guide&&app.guide.key});
   return;
  }
  if(pawPreview&&app.core){
   const busy=app.core.processing||app.core.swapFeedbackPending||app.core.preferredGenerationPositions.length>0;
   document.querySelectorAll('[data-paw],[data-bell],[data-combo],#combo-open,#combo-reversed,#start-content,#paw-reduced').forEach(button=>button.disabled=!!busy);
   document.getElementById('paw-move').disabled=!!busy||!!app.guide||!window.previewPawExchange;
   document.getElementById('paw-jelly-again').disabled=!!busy||window.previewPawCase!=='jelly'||app.core.jellyGrid[1][6]!==1;
  }
  status.textContent=JSON.stringify({state:app.state,level:app.core&&app.core.level.id,score:app.core&&app.core.score,
   moves:app.core&&app.core.movesLeft,collected:app.core&&app.core.collectedCounts,
   jelly:app.core&&app.core.getJellyLeft(),ice:app.core&&app.core.getIceLeft(),yarn:app.core&&app.core.getYarnHealth(),
   buds:app.core&&app.core.getMoonbudsLeft(),open:app.core&&app.core.moonbudOpen,
   parcels:app.core&&app.core.getParcelsLeft(),delivered:app.core&&app.core.parcelDelivered,
   maxCascade:app.core&&app.core.maxCascade,specialComboCount:app.core&&app.core.specialComboCount,
   guide:app.guide&&app.guide.key,unlocked:app.progress.unlockedLevel});
  return;
 }
 if(app.state==='settings'){
  app.settingsButtons=UI.drawSettings(ctx,app.screen,{privacyPending:!!app.privacyRequest});
  status.textContent=app.privacyRequest?'设置：等待官方接口回调':'设置：点击隐私说明';
 }else if(app.state==='privacy'){
  app.privacyButtons=UI.drawPrivacy(ctx,app.screen,app.privacyOffset);app.privacyOffset=app.privacyButtons.offset;
  status.textContent=JSON.stringify({state:app.state,offset:app.privacyOffset,max:app.privacyButtons.maxScroll});
 }else if(app.state==='menu'&&privacyPreview){
  app.menuButtons=UI.drawMenu(ctx,app.screen,1,{count:5,canPlay:true,timeLeftText:'00:00'},{coins:0});
  status.textContent='首页：可返回设置';
 }else if(app.state==='levelselect'){
  app.levelSelectButtons=UI.drawLevelSelect(ctx,app.screen,1,0,{},{});
  const hit=app.levelSelectButtons.level_1;
  status.textContent=JSON.stringify({viewport:[width,height],state:app.state,firstLevelHit:hit||null});
 }else if(app.state==='playing'){
  app.board.draw();
  if(app.guide)load('js/render/onboarding.js').draw(ctx,app.screen,app.guide.key);
  status.textContent=motionPreview?JSON.stringify({case:previewCase,feedbackCount,moves:app.core.movesLeft,
   pending:app.core.swapFeedbackPending,offset:app.board.invalidSwapOffset(2,2),error:previewError})
   :JSON.stringify({result:'PASS',state:app.state,level:app.core.level.id,pieces:app.board.pieces.length,testHearts:storage.match3_heart_v1.count,guide:app.guide&&app.guide.key});
 }
}
canvas.addEventListener('click',e=>{
 if(motionPreview||privacyPreview||contentPreview)return;
 const r=canvas.getBoundingClientRect(),point={clientX:(e.clientX-r.left)*width/r.width,clientY:(e.clientY-r.top)*height/r.height};
 try{app.handleTouchStart({touches:[point]});app.handleTouchEnd({changedTouches:[point]});draw();}
 catch(error){status.textContent='FAIL '+error.stack;}
});
if(privacyPreview||contentPreview){
 const point=e=>{const r=canvas.getBoundingClientRect();return{clientX:(e.clientX-r.left)*width/r.width,clientY:(e.clientY-r.top)*height/r.height};};
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);app.handleTouchStart({touches:[point(e)]});draw();});
 canvas.addEventListener('pointermove',e=>{if(e.buttons){app.handleTouchMove({touches:[point(e)]});draw();}});
 canvas.addEventListener('pointerup',e=>{app.handleTouchEnd({changedTouches:[point(e)]});draw();});
 canvas.addEventListener('pointercancel',()=>app.handleTouchCancel());
 canvas.addEventListener('wheel',e=>{if(app.state!=='privacy')return;e.preventDefault();app.privacyOffset=Math.max(0,Math.min(app.privacyButtons.maxScroll,app.privacyOffset+e.deltaY));draw();},{passive:false});
}
load('js/render/assets.js').preload(draw);
`;
http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
    if (url.pathname === '/fixture.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(script); return; }
    if (url.pathname === '/snapshot' && req.method === 'POST') {
        const id = Number(url.searchParams.get('level')), width = Number(url.searchParams.get('width'));
        if (!Number.isInteger(id) || id < 1 || id > 10000 || ![320,375,390,430].includes(width)) { res.writeHead(400); res.end(); return; }
        const chunks = []; let bytes = 0;
        req.on('data', chunk => { bytes += chunk.length; if (bytes > 3000000) req.destroy(); else chunks.push(chunk); });
        req.on('end', () => fs.writeFile('/private/tmp/m3-level-' + id + '-' + width + '.png', Buffer.concat(chunks), err => {
            res.statusCode = err ? 500 : 200; res.end(err ? 'failed' : 'saved');
        })); return;
    }
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!file.startsWith(path.join(root, 'res') + path.sep)) { res.writeHead(404); res.end(); return; }
    fs.readFile(file, (err, data) => {
        res.statusCode = err ? 404 : 200;
        const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' }[path.extname(file)];
        if (mime) res.setHeader('Content-Type', mime);
        res.end(err ? 'missing' : data);
    });
}).listen(Number(process.env.MATCH3_PREVIEW_PORT) || 0, '127.0.0.1', function () { console.log('Entry fixture: http://127.0.0.1:' + this.address().port); });
