/** Optional avatar consent, URL boundary and asynchronous room lifetime. */
'use strict';
const assert = require('assert');
const safe = 'https://thirdwx.qlogo.cn/avatar/132';
let tapHandler; let destroyed = 0; const images = []; const buttons = []; let stored;
global.wx = {
    getStorageSync: () => ({ avatarUrl: safe }),
    setStorageSync: (key, value) => { stored = value; },
    createImage: () => { const image = {}; images.push(image); return image; },
    createUserInfoButton: options => {
        buttons.push(options);
        return { onTap: handler => { tapHandler = handler; }, destroy: () => { destroyed++; } };
    }
};
const profile = require('../js/platform/user-profile');
const unsafe = ['http://qlogo.cn/a', 'https://example.com/a', 'https://qlogo.cn.evil.com/a',
    'https://evilqlogo.cn/a', 'https://user@qlogo.cn/a', 'https://qlogo.cn/a#x',
    'https://qlogo.cn:443/a', 'https://qlogo.cn\\evil/a', 'https://qlogo.cn/a\n',
    'https://-x.qlogo.cn/a', 'https://qlogo.cn/' + 'x'.repeat(768), null];
assert(profile.isSafeAvatarUrl(safe));
assert(profile.isSafeAvatarUrl('https://qlogo.cn/a?x=1'));
unsafe.forEach(url => assert.strictEqual(profile.isSafeAvatarUrl(url), false, String(url)));
profile.init(); images[0].onload();
assert(profile.getAvatarImage());
assert.strictEqual(profile.getSharedAvatarUrl(), '', 'legacy storage is not room-sharing consent');
assert(profile.canChangeAvatar(), 'legacy local avatar may be selected again for sharing');
const bounds = { x: 10, y: 20, w: 80, h: 80 };
profile.ensureButton(bounds);
assert.strictEqual(buttons[0].type, 'image');
assert.strictEqual(buttons[0].image, 'res/ui/avatar-tap.png', 'native overlay uses transparent hit surface');
assert.deepStrictEqual(buttons[0].style, { left: 10, top: 20, width: 80, height: 80 });
const legacyImage = profile.getAvatarImage();
tapHandler({ userInfo: { avatarUrl: safe } });
assert.strictEqual(profile.getSharedAvatarUrl(), '', 'missing notice cannot grant consent');
let changed = [];
profile.setChangeListener(url => changed.push('obsolete'));
profile.setChangeListener(url => changed.push(url));
profile.ensureButton(bounds, { shareWithRoom: true });
tapHandler({ errMsg: 'getUserInfo:fail auth deny' });
assert.strictEqual(changed.length, 0);
assert.strictEqual(profile.getAvatarImage(), legacyImage, 'denial preserves visible local avatar');
tapHandler({ userInfo: { avatarUrl: safe, nickName: 'unused' } });
assert.deepStrictEqual(changed, [safe]);
assert.strictEqual(profile.getSharedAvatarUrl(), safe);
assert.deepStrictEqual(stored, { avatarUrl: safe, sharingConsentVersion: 1 }, 'persist only chosen URL and explicit reuse consent version');
const oldRoomTap = tapHandler;
const pendingSelf = images[images.length - 1];
profile.clearRoomProfile();
assert.strictEqual(profile.getSharedAvatarUrl(), '');
profile.ensureButton(bounds, { shareWithRoom: true });
const destroysBeforeLateSelf = destroyed;
oldRoomTap({ userInfo: { avatarUrl: 'https://qlogo.cn/late' } });
assert.strictEqual(profile.getSharedAvatarUrl(), '', 'late old native button cannot grant sharing in a new room');
assert.deepStrictEqual(changed, [safe]);
pendingSelf.onload();
assert.strictEqual(profile.getAvatarImage(), legacyImage, 'late own image preserves currently visible avatar');
assert.strictEqual(destroyed, destroysBeforeLateSelf, 'late self load must not destroy a new room button');
assert.strictEqual(profile.getOpponentAvatarImage(safe), null);
const first = images[images.length - 1];
const next = 'https://wx.qlogo.cn/next';
profile.getOpponentAvatarImage(next);
const second = images[images.length - 1];
first.onload();
assert.strictEqual(profile.getOpponentAvatarImage(next), null, 'late old URL must not show');
second.onload();
assert.strictEqual(profile.getOpponentAvatarImage(next), second);
profile.clearOpponentAvatar();
assert.strictEqual(profile.getOpponentAvatarImage(next), null);
second.onload();
assert.strictEqual(profile.getOpponentAvatarImage(next), null, 'same URL in new room must await new load');
images[images.length - 1].onerror();
assert.strictEqual(profile.getOpponentAvatarImage(next), null, 'failure uses fallback without per-frame retry');
profile.getOpponentAvatarImage('https://evil.com/avatar');
assert(destroyed > 0);

// A new controller must recheck platform permission and the current profile before reuse.
let settingReply,infoReply;
global.wx.getStorageSync=()=>({avatarUrl:safe,sharingConsentVersion:1});
global.wx.getSetting=options=>{settingReply=options;};
global.wx.getUserInfo=options=>{infoReply=options;};
delete require.cache[require.resolve('../js/platform/user-profile')];
const restored=require('../js/platform/user-profile');restored.init();
assert.strictEqual(restored.getSharedAvatarUrl(),'','saved consent does not itself publish a portrait');
restored.beginRoom();assert.strictEqual(restored.isPromptOpen(),false);
settingReply.success({authSetting:{'scope.userInfo':true}});
infoReply.success({userInfo:{avatarUrl:safe,nickName:'discard'}});
assert.strictEqual(restored.getSharedAvatarUrl(),safe,'authorized matching profile reuses explicit choice');
restored.clearRoomProfile();restored.beginRoom();
const staleSetting=settingReply;
restored.clearRoomProfile();staleSetting.success({authSetting:{'scope.userInfo':true}});
assert.strictEqual(restored.getSharedAvatarUrl(),'','late permission callback cannot enter a new room');
restored.beginRoom();settingReply.success({authSetting:{'scope.userInfo':false}});
assert(restored.isPromptOpen(),'revoked permission prompts with a skippable native choice');
assert.strictEqual(stored.sharingConsentVersion,0);
restored.dismissPrompt();assert.strictEqual(restored.isPromptOpen(),false);
restored.beginRoom();assert(restored.isPromptOpen(),'a player without consent sees the entry prompt');
restored.ensureButton(bounds,{shareWithRoom:true});
tapHandler({errMsg:'getUserInfo:fail auth deny'});
assert(!restored.isPromptOpen(),'denial dismisses the card without blocking the room');
assert.strictEqual(restored.getSharedAvatarUrl(),'');
restored.beginRoom();restored.ensureButton(bounds,{shareWithRoom:true});
tapHandler({userInfo:{avatarUrl:safe}});
assert.strictEqual(restored.getSharedAvatarUrl(),safe);
restored.clearRoomProfile();restored.beginRoom();settingReply.success({authSetting:{'scope.userInfo':true}});
infoReply.success({userInfo:{avatarUrl:'https://wx.qlogo.cn/different/132'}});
assert(restored.isPromptOpen(),'a different authorized profile requires a fresh explicit choice');
assert.strictEqual(restored.getSharedAvatarUrl(),'');
restored.clearRoomProfile();
console.log('optional avatar consent/lifetime tests passed');
