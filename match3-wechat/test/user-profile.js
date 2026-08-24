/** 可选头像适配层：输入校验与拒绝授权降级。 */

const assert = require('assert');

let tapHandler = null;
let destroyed = 0;
global.wx = {
    getStorageSync: function () { return null; },
    setStorageSync: function () {},
    createImage: function () { return {}; },
    createUserInfoButton: function () {
        return {
            onTap: function (handler) { tapHandler = handler; },
            destroy: function () { destroyed++; }
        };
    }
};

const profile = require('../js/platform/user-profile');

assert.strictEqual(profile.isSafeAvatarUrl('https://thirdwx.qlogo.cn/avatar/132'), true);
assert.strictEqual(profile.isSafeAvatarUrl('http://example.com/a.png'), false);
assert.strictEqual(profile.isSafeAvatarUrl('javascript:alert(1)'), false);

profile.init();
profile.ensureButton({ x: 10, y: 20, w: 80, h: 80 });
assert.strictEqual(typeof tapHandler, 'function', '可选头像按钮未创建');
tapHandler({ errMsg: 'getUserInfo:fail auth deny' });
assert.strictEqual(profile.getAvatarImage(), null, '拒绝授权后不应伪造头像');
profile.destroyButton();
assert(destroyed >= 1, '离开等待页时按钮未销毁');

console.log('可选头像降级测试: 通过');
