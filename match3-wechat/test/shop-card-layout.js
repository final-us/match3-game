'use strict';
const assert = require('assert');
const shop = require('../js/render/shop-card');
const assets = require('../js/render/assets');
const art = require('../js/render/illustration-art');
const text = [], images = [], dividers = [], painted=[];
const ctx = new Proxy({}, {
    get(target, key) {
        if (key in target) return target[key];
        if (key === 'measureText') return value => ({ width: String(value).length * 8 });
        if (key === 'fillText') return (value, x, y) => text.push({ value: String(value), x, y, font: target.font, color: target.fillStyle });
        if (key === 'drawImage') return (...args) => images.push(args);
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
        return () => {};
    },
    set(target, key, value) { target[key] = value; return true; }
});
const get = assets.get;
const rule = art.rule, originalButton=art.button;
art.button=(ctx,x,y,w,h,label,tone,...rest)=>{painted.push({x,y,w,h,label,tone});return originalButton(ctx,x,y,w,h,label,tone,...rest);};
art.rule = (ctx,x,y,w) => { dividers.push(y); return rule(ctx,x,y,w); };
try {
    for (const withArt of [false, true]) for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
        assets.get = key => withArt ? { width: key === 'uiIllustrationItems' ? 768 : 640, height: key === 'uiIllustrationItems' ? 384 : 852 } : null;
        const screen = { width, height, contentTop: 91, safeTop: 47, safeBottom: 34 };
        for (const canReward of [false, true]) for (const state of ['ready', 'pending', 'limit', 'full', 'unavailable']) {
            text.length = images.length = dividers.length = 0;
            const unavailable = state === 'unavailable';
            const options = { canReward, count: state === 'limit' ? 10 : 2, limit: 10, pending: state === 'pending', heartPending: state === 'pending', heartCount: state === 'full' ? 5 : 2, heartReady: !unavailable, heartMax: 5 };
            const render=offset=>{
                // Compare glyphs and dividers from one rendered viewport only.
                text.length=images.length=dividers.length=painted.length=0;
                return shop.draw(ctx,screen,unavailable?null:999999999,unavailable?null:{hammer:9999,bomb:2,color:0},{...options,offset});
            };
            painted.length=0;
            const first=render(0),seen=new Set();
            for(const offset of [...new Set([0,first.maxScroll/2,first.maxScroll])]){
                const b=render(offset),rects=Object.entries(b).filter(([key,r])=>key!=='viewport'&&r&&Number.isFinite(r.x));
                for(const [key,r] of rects){
                    seen.add(key);
                    assert(r.w>=44&&r.h>=44&&r.x>=0&&r.x+r.w<=width&&r.y>=91&&r.y+r.h<=height-34,'safe 44px hit area');
                    if(key!=='back')assert(r.y>=b.viewport.y&&r.y+r.h<=b.viewport.y+b.viewport.h,'partly clipped action never receives a hit');
                    assert.deepEqual(b.back,first.back,'return action stays fixed while the list scrolls');
                }
                for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
                    const a=rects[i][1],c=rects[j][1];assert(!(a.x<c.x+c.w&&a.x+a.w>c.x&&a.y<c.y+c.h&&a.y+a.h>c.y),'distinct hit areas');
                }
                for(const key of ['hammer','bomb','color','heart']){
                    const buy=b['buy_'+key],ad=b['reward_'+key];
                    if(buy&&ad)assert(buy.x===ad.x&&buy.w===ad.w&&ad.y>=buy.y+buy.h+6,'purchase above ad in one column');
                }
            }
            for(const key of ['hammer','bomb','color','heart']){
                assert.equal(seen.has('buy_'+key),!unavailable,'all purchase actions reachable, original storage boundary');
                assert.equal(seen.has('reward_'+key),canReward,'all eligible ad slots reachable, hidden when unavailable');
            }
            if(canReward&&state==='ready')assert(painted.some(b=>b.tone==='ad'),'available advertising has its distinct bright blue role');
            for (const price of ['900', '1300', '1100', '1000']) {
                const p = text.find(t => t.value === price);
                assert(p && Number(p.font.match(/(\d+)px/)[1]) >= 16, 'coin prices remain legible');
            }
            for(const line of text.filter(t=>t.color==='#786486')){
                const next=dividers.find(y=>y>line.y);
                if(next!==undefined)assert(next-line.y>=Number(line.font.match(/(\d+)px/)[1])/2+1,'row divider clears the complete description glyph');
            }
            if (canReward && state === 'pending') assert(text.some(t => t.value === '领取中'));
            if (canReward && state === 'limit') assert(text.some(t => t.value === '今日已满'));
            if (canReward && state === 'full') assert(text.some(t => t.value === '已满'));
            if (unavailable) assert(text.map(t=>t.value).join('').includes('奖励待保存，请重试'));
            if (withArt) assert(images.some(a => a.length === 9), 'atlas/sliced art is used');
        }
        text.length = 0;
        shop.draw(ctx, screen, 0, { hammer: 0, bomb: 0, color: 0 }, {});
        assert(text.some(t => t.value === '金币不足'));
    }
} finally { assets.get = get; art.rule = rule; art.button=originalButton; }
console.log('shop card: three safe viewports, 44px distinct actions, readable prices, optional art/ads and existing storage/reward states passed');
