/**
 * 体力补充流程：1000 金币购买，以及无冷却、无次数上限的广告补体力。
 */

const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const mainFile = require.resolve('../js/main');
const mainRequire = require('module').createRequire(mainFile);
let heartCount = 0;
let coins = 2000;
let rewardedShows = 0;
let rewards = 0;
let invalids = 0;
let granted = 0;

const heart = {
    HEART_CONFIG: { maxHeart: 5 },
    getHeartState: function () { return { count: heartCount }; },
    addHeart: function () { heartCount = Math.min(5, heartCount + 1); return heartCount; }
};
const coin = {
    STAMINA_PRICE: 1000,
    getCoins: function () { return coins; },
    spendCoins: function (amount) {
        if (coins < amount) return false;
        coins -= amount;
        return true;
    }
};
const ad = {
    showRewarded: function (placement) {
        assert.strictEqual(placement, 'heart_refill');
        rewardedShows++;
        return Promise.resolve(true);
    },
    markRewardGranted: function () { granted++; }
};
const audio = {
    reward: function () { rewards++; },
    invalid: function () { invalids++; }
};

const mainModule = { exports: {} };
vm.runInNewContext(fs.readFileSync(mainFile, 'utf8'), {
    module: mainModule,
    require: function (name) {
        if (name === './core/heart') return heart;
        if (name === './core/coin') return coin;
        if (name === './core/ad') return ad;
        if (name === './audio') return audio;
        return mainRequire(name);
    }
}, { filename: mainFile });

async function run() {
    const app = Object.create(mainModule.exports.prototype);
    app.staminaDialog = true;
    app.staminaDialogButtons = {};
    app.heartAdPending = false;

    app.buyHeart();
    assert.strictEqual(heartCount, 1, '1000金币应购买1点体力');
    assert.strictEqual(coins, 1000, '购买后应扣除1000金币');
    assert.strictEqual(app.staminaDialog, false, '购买成功后应关闭提醒');

    heartCount = 5;
    app.buyHeart();
    assert.strictEqual(coins, 1000, '体力已满时不得扣金币');
    assert.strictEqual(invalids, 1, '体力已满应给出无效反馈');
    await app.handleAddHeart('shop');
    assert.strictEqual(rewardedShows, 0, '体力已满时不得展示广告');
    assert.strictEqual(heartCount, 5, '体力已满时不得重复发奖');
    assert.strictEqual(invalids, 2, '体力已满的广告入口应给出无效反馈');

    heartCount = 0;
    app.staminaDialog = true;
    await app.handleAddHeart('dialog');
    app.staminaDialog = true;
    await app.handleAddHeart('dialog');
    assert.strictEqual(heartCount, 2, '连续两次完整广告应各增加1点体力');
    assert.strictEqual(rewardedShows, 2, '广告补体力不应有冷却或次数拦截');
    assert.strictEqual(granted, 2, '两次广告奖励都应记录发奖');
    assert.strictEqual(rewards, 3, '金币购买与两次广告均应播放奖励反馈');

    console.log('体力补充流程: 全部通过 ✅');
}

run().catch(function (error) {
    console.error(error);
    process.exit(1);
});
