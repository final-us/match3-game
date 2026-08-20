/**
 * 金币与道具系统测试（Node 环境，mock wx storage）
 * 用法: node test/coin.js
 */

const store = {};
global.wx = {
    getStorageSync: function (k) { return store[k]; },
    setStorageSync: function (k, v) { store[k] = v; }
};

const coin = require('../js/core/coin');

function assert(name, cond) {
    console.log((cond ? '✅' : '❌') + ' ' + name);
    return cond;
}

let allOk = true;

// 1. 初始金币 0
allOk = assert('初始金币0', coin.getCoins() === 0) && allOk;

// 2. 加金币
coin.addCoins(500);
allOk = assert('加500金币', coin.getCoins() === 500) && allOk;

// 3. 消费
allOk = assert('花费300成功', coin.spendCoins(300)) && allOk;
allOk = assert('余额200', coin.getCoins() === 200) && allOk;
allOk = assert('超支失败', coin.spendCoins(500) === false) && allOk;
allOk = assert('超支后余额不变', coin.getCoins() === 200) && allOk;

// 4. 通关奖励（含星级加成）
allOk = assert('胜利奖励: 基础100+步数10x5+1星30', coin.calcWinCoins(5, 1) === 180) && allOk;
allOk = assert('胜利奖励: 0步1星', coin.calcWinCoins(0, 1) === 130) && allOk;
allOk = assert('3星加成更多', coin.calcWinCoins(5, 3) > coin.calcWinCoins(5, 1)) && allOk;
allOk = assert('星数: 剩35%步数→3星', coin.calcStars(7, 20) === 3) && allOk;
allOk = assert('星数: 剩15%步数→2星', coin.calcStars(3, 20) === 2) && allOk;
allOk = assert('星数: 剩0步→1星', coin.calcStars(0, 20) === 1) && allOk;

// 5. 道具
let items = coin.getItems();
allOk = assert('初始道具全0', items.hammer === 0 && items.bomb === 0 && items.color === 0) && allOk;

coin.addItem('hammer', 2);
coin.addItem('bomb', 1);
items = coin.getItems();
allOk = assert('加道具 锤2/炸1', items.hammer === 2 && items.bomb === 1) && allOk;

allOk = assert('使用锤子成功', coin.useItem('hammer')) && allOk;
allOk = assert('锤子剩1', coin.getItems().hammer === 1) && allOk;

allOk = assert('空道具使用失败', coin.useItem('color') === false) && allOk;

// 6. 完整流程：买道具 → 消耗
coin.addCoins(1000);
coin.spendCoins(coin.ITEM_DEFS.bomb.price);
allOk = assert('买炸弹后金币', coin.getCoins() === 200 + 1000 - 300) && allOk;

console.log('========================================');
console.log('金币道具系统: ' + (allOk ? '全部通过 ✅' : '存在失败 ❌'));
process.exit(allOk ? 0 : 1);
