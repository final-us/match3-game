'use strict';
const assert = require('assert');
const assets = require('../js/render/assets');
const BattleUI = require('../js/render/battle-ui');
const art = require('../js/render/illustration-art');
const images = [], text = [], paintedButtons = [], cards = [];
let transform = {x:0,y:0,sx:1,sy:1};
const saves = [];
const fontSize = font => Number(String(font).match(/(\d+)px/)[1]);
const textWidth = (value, font) => Array.from(String(value)).reduce((w, ch) => w + (/[\u3000-\uffff]/.test(ch) ? 1 : .56) * fontSize(font), 0);
const ctx = new Proxy({}, {
    get(t, key) {
        if (key in t) return t[key];
        if (key === 'save') return () => saves.push({ transform: {...transform}, state: {...t} });
        if (key === 'restore') return () => { const prior=saves.pop(); transform=prior.transform; Object.assign(t,prior.state); };
        if (key === 'translate') return (x,y) => { transform.x+=x*transform.sx; transform.y+=y*transform.sy; };
        if (key === 'scale') return (x,y) => { transform.sx*=x; transform.sy*=y; };
        if (key === 'measureText') return value => ({ width: textWidth(value, t.font) });
        if (key === 'fillText') return (value, x, y) => text.push({ value: String(value), x, y, font: t.font });
        if (key === 'drawImage') return (...args) => {
            const i=args.length===9?5:1; args[i]=transform.x+args[i]*transform.sx; args[i+1]=transform.y+args[i+1]*transform.sy; args[i+2]*=transform.sx; args[i+3]*=transform.sy; images.push(args);
        };
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
        return () => {};
    },
    set(t, key, value) { t[key] = value; return true; }
});
const skins = {};
for (const key of ['uiIllustrationItems', 'uiCoin', 'uiResultFrame', 'uiResultWinMoon', 'uiResultLoseMoon', 'uiIllustrationWinCat', 'uiIllustrationDrawCat', 'uiIllustrationPrepDuo', 'uiIllustrationCoins', 'uiIllustrationResultFrame', 'homeDuelIcon', 'piece1', 'piece2', 'piece5']) skins[key] = { width: 640, height: key === 'uiResultFrame' ? 852 : 320, key };
skins.uiIllustrationFrame={width:512,height:680,key:'uiIllustrationFrame'};
const originalGet = assets.get;
const originalButton = art.button, originalCard = art.card;
assets.get = key => skins[key];
art.button = (ctx, x, y, w, h, value, ...rest) => {
    paintedButtons.push({ x, y, w, h, value });
    return originalButton(ctx, x, y, w, h, value, ...rest);
};
art.card = (ctx,x,y,w,h,...rest) => { cards.push({x,y,w,h}); return originalCard(ctx,x,y,w,h,...rest); };
const myAvatar = { key: 'my-avatar', width: 120, height: 80 }, oppAvatar = { key: 'opp-avatar', width: 80, height: 120 };
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function checkControls(buttons, screen) {
    const controls = Object.values(buttons);
    for (const control of controls) {
        assert(control.w >= 44 && control.h >= 44, '44px targets');
        assert(control.x >= 0 && control.x + control.w <= screen.width, 'horizontal safe area');
        assert(control.y >= screen.contentTop && control.y + control.h <= screen.height - screen.safeBottom, 'vertical safe area');
        for (const other of controls) if (control !== other) assert(!overlaps(control, other), 'separate targets');
    }
}
function checkAllocationContent() {
    // Derive the gold/body bounds from transformed nine-slice draws. The
    // frame's four flower corners remain outside the actual item cards.
    const frame = images.filter(a => a[0] === skins.uiIllustrationFrame).slice(-9);
    const left = frame[3], right = frame[5], base = frame[6], crown = frame[0];
    const inner = { x: left[5] + 35 / left[3] * left[7], y: crown[6] + 114 / crown[4] * crown[8],
        right: right[5] + (477 - right[1]) / right[3] * right[7], bottom: base[6] };
    const inside = r => r.x >= inner.x + 2 && r.x + r.w <= inner.right - 2 && r.y >= inner.y && r.y + r.h <= inner.bottom;
    const itemArt = images.filter(a => a[0] === skins.uiIllustrationItems);
    const cells = paintedButtons.filter(b => b.value === '+' || b.value === '−');
    const inCard = r => cards.some(c => r.x >= c.x && r.x + r.w <= c.x + c.w && r.y >= c.y && r.y + r.h <= c.y + c.h);
    const itemCards = cards.filter(c => itemArt.some(a => a[5] >= c.x && a[5]+a[7] <= c.x+c.w && a[6] >= c.y && a[6]+a[8] <= c.y+c.h));
    assert.equal(itemCards.length, 4, 'four separate pearl allocation cards');
    for (const c of itemCards) assert(inside(c), 'cards inside gold and above flowers');
    assert.equal(cells.length, 8, 'enabled and disabled allocation controls are drawn');
    for (const b of cells) assert(inside(b) && inCard(b) && b.w === b.h, 'round jewel faces remain inside cards');
    for (const a of itemArt) assert(inside({x:a[5],y:a[6],w:a[7],h:a[8]}) && inCard({x:a[5],y:a[6],w:a[7],h:a[8]}), 'whole atlas image inside its card');
    const names = ['冰霜冻结', '四连魔咒', '镜面反弹', '猫咪鼓舞'];
    const descriptions = ['冻结对手3秒', '5秒需四连', '5秒反弹一次', '5秒得分×2'];
    for(let i=0;i<names.length;i++){
        const name=text.find(t=>t.value===names[i]),desc=text.find(t=>t.value===descriptions[i]);
        assert(desc.y-fontSize(desc.font)/2-(name.y+fontSize(name.font)/2)>=2,'name and description have separate glyph bounds');
    }
    for (const t of text.filter(t => names.includes(t.value) || descriptions.includes(t.value))) {
        assert(t.font.includes('Songti SC'), 'reference serif type');
        const w=textWidth(t.value,t.font),h=fontSize(t.font),box={x:t.x-w/2,y:t.y-h/2,w,h};
        assert(inside(box) && inCard(box), 'complete text inside its card: '+t.value);
        assert(!cells.some(b=>overlaps(box,b)), 'text does not overlap visible control faces: '+JSON.stringify({text:t.value,box,controls:cells.filter(b=>overlaps(box,b))}));
        assert(!itemArt.some(a=>overlaps(box,{x:a[5],y:a[6],w:a[7],h:a[8]})), 'text does not overlap item art');
    }
}
try {
    for (let i = 0; i < 500; i++) {
        const name = BattleUI.roomDisplayName('room-' + i);
        assert(/[猫爪]/.test(name), 'every room is a cat place');
        assert.strictEqual(name, BattleUI.roomDisplayName('room-' + i), 'stable room title');
    }
    for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
        const screen = { width, height, contentTop: 91, safeBottom: 34 };
        const data = { itemRulesVersion: 3, protocolVersion: 2, roundNumber: 2, myWins: 1, oppWins: 0, roomId: 'cat-room', myAvatar, oppAvatar, oppJoined: true, myName: '月光小猫', oppName: '星星猫咪', items: { freeze: 1, disturb: 1, reflect: 1, cheer: 1 } };
        images.length = text.length = 0;
        BattleUI.drawTop(ctx,screen,{...data,timeLeft:38,myScore:2480,oppScore:1960});
        assert(images.some(a=>a[0]===myAvatar)&&images.some(a=>a[0]===oppAvatar),'both in-game score portraits use player images');
        assert(!images.some(a=>a[0]===skins.piece1||a[0]===skins.piece2),'available player portraits replace default kitten heads');
        for (const state of [{}, { myReady: true }, { offline: true }, { actionPending: true }, { items: { freeze: 2, disturb: 1, reflect: 1, cheer: 1 } }, { isHost: true, oppJoined: false }]) {
            images.length = text.length = paintedButtons.length = cards.length = 0;
            const buttons = BattleUI.drawWait(ctx, screen, { ...data, ...state });
            checkControls(buttons, screen);
            checkAllocationContent();
            assert(images.some(a=>a[0]===skins.uiIllustrationPrepDuo&&a.length===5),'central preparation duo coexists with player portraits');
            if(state.oppJoined===false)assert(images.some(a=>a[0]===skins.uiIllustrationPrepDuo&&a.length===9),'vacant player uses a local crop of the illustrated kitten');
            assert(text.some(t => t.value.includes('各道具冷却10秒')), 'per-item cooldown copy');
            assert.equal(text.filter(t => t.value.includes('累计胜场')).length, 1, 'round score appears once');
            assert(images.some(args => args[0] === myAvatar));
            assert.strictEqual(images.some(args => args[0] === oppAvatar), state.oppJoined !== false);
            assert.strictEqual(!!buttons.invite, !!state.isHost);
            assert.strictEqual(!!buttons.freezeMinus, !(state.myReady || state.offline || state.actionPending));
            if (state.items) assert(!buttons.freezePlus, 'full budget');
            for (const key of ['freeze', 'disturb', 'reflect', 'cheer']) {
                const index = ['freeze', 'disturb', 'reflect', 'cheer'].indexOf(key);
                assert(images.some(args => args[0] === skins.uiIllustrationItems && args[1] === index * 160), 'specific atlas cell');
            }
            for (const name of ['冰霜冻结', '四连魔咒', '镜面反弹', '猫咪鼓舞']) {
                const label = text.find(t => t.value === name);
                assert(label && label.y > screen.contentTop && label.y < buttons.ready.y);
            }
        }
        // A local image does not imply consent to send it to the room.
        for (const itemRulesVersion of [2, 3]) for (const state of [{}, { avatarShared: true }, { canChangeAvatar: false }]) {
            text.length = 0;
            const buttons = BattleUI.drawWait(ctx, screen, { ...data, itemRulesVersion, ...state });
            const consent = text.find(t => t.value === '向本房间好友展示');
            const expected = !state.avatarShared && state.canChangeAvatar !== false;
            assert.strictEqual(!!consent, expected, 'explicit room-sharing cue, including existing local avatar');
            assert.strictEqual(text.some(t => t.value.includes('点头像设置')), expected, 'active avatar choice cue');
            if (consent) {
                assert(Number(consent.font.match(/(\d+)px/)[1]) >= 11, 'readable sharing disclosure');
                const instruction = text.find(t => t.value.includes('点头像设置'));
                const name = text.find(t => t.value === data.myName);
                const gridTitle = text.find(t => t.value.startsWith('对战道具 '));
                assert(consent.y > instruction.y + 10 && instruction.y > name.y + 10, 'name/action/disclosure remain distinct');
                assert(consent.y + 6 < gridTitle.y - 6, 'disclosure above allocation grid');
                assert(consent.y < buttons.ready.y, 'disclosure above main action');
            }
        }
        for (const result of ['win', 'lose', 'draw']) for (const state of [{}, { rewardPending: true }, { expired: true }, { myRematch: true }, { offline: true }, { actionPending: true }]) {
            images.length = text.length = 0;
            const dataResult = { ...data, result, myScore: 123456789, oppScore: 87654321, coinReward: 150, oppOnline: true, retentionMessage: '保存失败，请重试', ...state };
            const buttons = BattleUI.drawResult(ctx, screen, dataResult);
            checkControls(buttons, screen);
            const frame = images.filter(a => a[0] === skins.uiIllustrationResultFrame);
            assert.equal(frame.length,9,'arched result frame');
            assert(buttons.again.y >= frame[8][6]+frame[8][8], 'actions below the flowered paper frame');
            assert.equal(images.filter(a=>a[0]===skins.uiIllustrationCoins).length,1,'illustrated reward coin pile');
            for(const value of [data.myName,data.oppName,'123456789','87654321','VS','奖励','+150 金币']) {
                const t=text.find(t=>t.value===value); assert(t&&t.font.includes('Songti SC'),'native serif result content: '+value);
            }
            assert(images.some(args => args[0] === myAvatar) && images.some(args => args[0] === oppAvatar), 'real score avatars');
            assert(images.some(args => args[0] === skins[result === 'draw' ? 'uiIllustrationDrawCat' : result === 'win' ? 'uiResultWinMoon' : 'uiResultLoseMoon']), 'moon hero shared with solo victory');
            assert(text.some(t => t.value === '保存失败，请重试'));
            if (state.rewardPending) assert(buttons.reward && text.some(t => t.value === '金币待保存 · 点击重试'));
            if (state.myRematch) assert(text.some(t => t.value === '取消等待'));
            if (state.expired) assert(text.some(t => t.value === '重新邀请'));
        }
        text.length=0;
        BattleUI.drawWait(ctx,screen,{...data,myName:'我',oppName:'猫咪玩家'});
        assert(text.some(t=>t.value==='月光小猫')&&text.some(t=>t.value==='星星猫咪'),'generic protocol names use local cat labels');
        images.length = 0;
        const dock = BattleUI.drawItems(ctx, screen, { itemRulesVersion: 3, freeze: 1, disturb: 1, reflect: 1, cheer: 1, cooldowns: { freeze: 10000 } });
        checkControls(dock, screen);
        assert.strictEqual(images.filter(args => args[0] === skins.uiIllustrationItems).length, 4, 'same art in game');
        images.length = 0;
        BattleUI.drawWait(ctx, screen, { ...data, itemRulesVersion: 2, items: { freeze: 1, disturb: 2 } });
        assert(images.some(args => args[0] === oppAvatar), 'legacy opponent avatar');
    }
    console.log('battle illustration UI: geometry, states, avatars, atlas and legacy checks passed');
} finally { assets.get = originalGet; art.button = originalButton; art.card = originalCard; }
