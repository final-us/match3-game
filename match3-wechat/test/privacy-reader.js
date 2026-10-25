'use strict';

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const policy = require('../js/core/privacy-policy');
const reader = require('../js/render/privacy-reader');
const UI = require('../js/render/ui');
const drawn = [];
const ctx = new Proxy({}, {
    get: function (target, key) {
        if (key in target) return target[key];
        if (key === 'measureText') return text => ({ width: Array.from(String(text)).length * 18 });
        if (key === 'fillText') return (text, x, y) => drawn.push({ text, x, y });
        if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => ({ addColorStop() {} });
        return function () {};
    }
});
const mainFile = require.resolve('../js/main');
const requireMain = require('module').createRequire(mainFile);
const moduleFixture = { exports: {} };
let platformOpens = 0;
vm.runInNewContext(fs.readFileSync(mainFile, 'utf8'), {
    module: moduleFixture,
    Date,
    require(name) {
        if (name === './audio') return { unlock() {}, click() {} };
        if (name === './core/runtime') return { privacyDiagnostic() {}, openPrivacyContract(done) { platformOpens++; done(false); return false; } };
        return requireMain(name);
    }
}, { filename: mainFile });
const Main = moduleFixture.exports;

assert.strictEqual(policy.publication.operator, '任务');
assert.strictEqual(policy.publication.email, '452330817@qq.com');
assert.strictEqual(policy.sections().length, 16);
assert.strictEqual(policy.publication.effectiveDate, '2026年9月19日');
assert.strictEqual(policy.publication.updatedDate, '2026年10月25日');
assert.strictEqual(policy.publication.version, '2026-10-25.2');
const avatarText=policy.sections().find(s=>s.title==='可选微信头像').paragraphs.join('');
assert(avatarText.includes('用于双方准备、对局及结算页展示'), '头像披露须覆盖已实现的局内展示');
for(const fact of ['首次进入好友对战房间','选择暂时不用','选择版本','先检查微信授权状态','头像变化或检查失败','不把历史头像记录当作分享同意'])assert(avatarText.includes(fact));
const adText=policy.sections().find(s=>s.title==='广告与第三方处理').paragraphs.join('');
assert(adText.includes('本版本使用微信小游戏提供的原生激励视频和插屏广告能力'));
assert(adText.includes('完整观看后获得'));
assert(adText.includes('已禁用分享兜底'));
assert(adText.includes('其他通用自定义事件和监控上报仍保持关闭'));
const levelText=policy.sections().find(s=>s.title==='普通单人关卡分析').paragraphs.join('');
for (const fact of ['本版本启用微信小游戏官方关卡分析','关卡目标进度','成功通关前台用时','清除本地数据后重置','不能据此宣称平台数据完全匿名']) assert(levelText.includes(fact));
const homeText=policy.sections().find(s=>s.title==='首页入口分析').paragraphs.join('');
for (const fact of ['本版本通过微信小游戏原生场景分析','场景分支标识和事件类型','不在这些事件中额外附加账号标识','不为此另存']) assert(homeText.includes(fact));
const startupText=policy.sections().find(s=>s.title==='启动分析').paragraphs.join('');
for (const fact of ['本版本通过微信小游戏原生启动分析','仅提供固定场景编号','由微信']) assert(startupText.includes(fact));
for (const text of [levelText,homeText,startupText]) assert(!text.includes('正式版本尚未启用') && !text.includes('仅在开发版和体验版'));
assert(!adText.includes('尚未启用真实广告'));
assert(!adText.includes('广告位标识为空'));
const localText=policy.sections().find(s=>s.title==='单人游戏与本地记录').paragraphs.join('');
for(const fact of ['重放所需随机种子','没有固定的自动过期期限','不提供普通单人原局或完整钱包的跨设备恢复','未提供单独删除']) assert(localText.includes(fact));
assert(localText.includes('未启用对应远程指标事件'));
const catalogText=policy.sections().find(s=>s.title==='猫咪领养、成长与陪伴').paragraphs.join('');
for(const fact of ['不是匿名数据','亲密度','35天','删除本地数据不会删除云端','这些偏好不上传云端','开发演示'])assert(catalogText.includes(fact));
const review = fs.readFileSync(require('path').join(__dirname, '../../docs/release/privacy-policy-review.md'), 'utf8');
const expectedBody = policy.sections().map(s => '## ' + s.title + '\n\n' + s.paragraphs.join('\n\n')).join('\n\n');
assert.strictEqual(review.split('\n---\n\n')[1].trim(), expectedBody, '确认稿须与运行正文逐段一致');
const dailyText = policy.sections().find(s => s.title === '每日挑战与云端记录').paragraphs.join('');
for (const fact of ['不是匿名数据', '最多25步交换坐标', '有效7天', '超过30天', '不会删除云端每日记录', '跨日续局需保留本地局标识']) {
    assert(dailyText.includes(fact), '缺少每日挑战披露: ' + fact);
}
const actualApproval = policy.publication.approvedForRelease;
policy.publication.approvedForRelease = false;
assert(policy.releaseIssues().includes('本地隐私协议正文待运营方确认'));
policy.publication.approvedForRelease = true;
assert.deepStrictEqual(policy.releaseIssues(), []);
policy.publication.approvedForRelease = actualApproval;
const full = policy.sections().flatMap(s => [s.title].concat(s.paragraphs));
assert(!full.join('').includes('待用户填写'));

for (const [width, height] of [[320, 568], [390, 844], [430, 932]]) {
    const screen = { width, height, safeTop: 47, contentTop: 91, safeBottom: 34 };
    const pendingButtons = UI.drawSettings(ctx, screen, { privacyPending: true });
    assert(drawn.some(item => item.text === '正在打开…'), '请求期间必须显示等待反馈');
    assert(pendingButtons.privacy.w >= 44 && pendingButtons.back.h >= 44);
    const app = Object.create(Main.prototype);
    Object.assign(app, { state: 'settings', guide: null, battleCreating: false,
        settingsButtons: UI.drawSettings(ctx, screen, {}), privacyOffset: 0 });
    const tap = rect => app.handleTouchStart({ touches: [{ clientX: rect.x + rect.w / 2, clientY: rect.y + rect.h / 2 }] });
    const render = () => { app.privacyButtons = UI.drawPrivacy(ctx, screen, app.privacyOffset); app.privacyOffset = app.privacyButtons.offset; };
    tap(app.settingsButtons.privacy);
    assert.strictEqual(app.state, 'privacy', '官方协议不可用时应进入本地页');
    render();
    const p = app.privacyButtons;
    assert(p.viewport.h > 180);
    assert(p.viewport.y >= screen.contentTop);
    assert(p.viewport.y + p.viewport.h < p.prev.y);
    for (const key of ['prev', 'next', 'back']) {
        const b = p[key];
        assert(b.w >= 44 && b.h >= 44);
        assert(b.x >= 0 && b.x + b.w <= width);
        assert(b.y + b.h <= height - screen.safeBottom);
    }
    const text = reader.layout(ctx, p.viewport.w);
    assert.strictEqual(text.lines.map(l => l.text).join(''), full.join(''), '换行不得丢失正文');
    assert.strictEqual(text, reader.layout(ctx, p.viewport.w), '同尺寸复用排版');
    text.lines.forEach(l => assert(ctx.measureText(l.text).width <= p.viewport.w));
    assert.strictEqual(p.prevEnabled, false);
    let steps = 0;
    while (app.privacyButtons.nextEnabled) {
        tap(app.privacyButtons.next); render();
        assert(++steps < 300, '翻阅必须能到达末尾');
    }
    assert.strictEqual(app.privacyOffset, app.privacyButtons.maxScroll);
    assert(drawn.some(item => item.text === '已到末尾'));
    tap(app.privacyButtons.prev); render();
    assert(app.privacyOffset < app.privacyButtons.maxScroll);
    tap(app.privacyButtons.viewport);
    app.handleTouchMove({ touches: [{ clientX: 100, clientY: 100000 }] }); render();
    assert.strictEqual(app.privacyOffset, 0, '向上边界夹紧');
    app.handleTouchMove({ touches: [{ clientX: 100, clientY: -100000 }] }); render();
    assert.strictEqual(app.privacyOffset, app.privacyButtons.maxScroll, '向下边界夹紧');
    app.handleTouchEnd({});
    assert.strictEqual(app.privacyTouch, null);
    tap(app.privacyButtons.back);
    assert.strictEqual(app.state, 'settings');
    tap(app.settingsButtons.privacy); render();
    assert.strictEqual(app.privacyOffset, 0, '再次打开从顶部阅读');
    tap(app.privacyButtons.viewport); app.handleHide();
    assert.strictEqual(app.privacyTouch, null, '退后台清理拖动状态');
    const clamped = UI.drawPrivacy(ctx, screen, Infinity);
    assert.strictEqual(clamped.offset, clamped.maxScroll);
}
assert.strictEqual(platformOpens, 6, '每次从设置打开先尝试官方接口，本地翻页不再调用');
assert(drawn.some(item => item.text === (actualApproval ? '猫猫开心消 · 可离线阅读' : '正文待确认 · 暂勿送审')),
    '阅读页应按实际正文确认状态展示副标题');
if (actualApproval) assert(!drawn.some(item => /正文待确认|暂勿送审/.test(item.text)), '已确认正文不得继续显示草案提示');
console.log('privacy reader: offline entry, full text, cache, 3 viewport layouts, paging, dragging, return, draft gate passed');
