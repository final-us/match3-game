/**
 * 素材资源加载器（统一管理猫咪 UI 素材）
 * 注意：素材文件名必须为纯英文/数字（微信开发者工具对中文/空格文件名做 URL 编码会报错）
 * 用法：main 启动时 assets.preload(() => { ... })
 * 渲染时 assets.get('piece1') 取图
 */

const ASSETS = {
    // 棋子（5 种猫）
    piece1: 'res/piece1.png',
    piece2: 'res/piece2.png',
    piece3: 'res/piece3.png',
    piece4: 'res/piece4.png',
    piece5: 'res/piece5.png',

    // 关卡地图节点
    nodeDone: 'res/nodeDone.png',         // 紫色 已通关
    nodeCurrent: 'res/nodeCurrent.png',   // 蓝色 当前
    nodeLocked: 'res/nodeLocked.png',     // 灰色 未解锁

    // 顶部栏（带数字素材，用作底板 + 覆盖）
    progressBar: 'res/progressBar.png',   // 步数进度条
    heartBar: 'res/heartBar.png',         // 体力胶囊
    coinBar: 'res/coinBar.png',           // 金币胶囊
    levelBadge: 'res/levelBadge.png',     // 关卡号框
    goalBar: 'res/goalBar.png',           // 目标栏（4只猫）
    movesBadge: 'res/movesBadge.png',     // 步数框

    // 道具栏
    toolBar: 'res/toolBar.png',           // 道具栏底板

    // 按钮
    btnStart: 'res/btnStart.png',         // 开始闯关（绿）
    btnContinue: 'res/btnContinue.png',   // 继续游戏（蓝）
    btnClose: 'res/btnClose.png',         // 关闭 X
    navBar: 'res/navBar.png',             // 底部导航栏
    btnBack: 'res/btnBack.png',           // 返回
    btnRefresh: 'res/btnRefresh.png'      // 刷新
};

const images = {};
let loadedCount = 0;
const total = Object.keys(ASSETS).length;
const isWx = typeof wx !== 'undefined' && wx.createImage;

/** 预加载全部素材，回调可选（同步加载环境下也会触发） */
function preload(onAllLoaded) {
    for (const key in ASSETS) {
        if (isWx) {
            const img = wx.createImage();
            img.onload = function () {
                loadedCount++;
                if (loadedCount === total && onAllLoaded) onAllLoaded();
            };
            img.onerror = function () {
                loadedCount++;
                if (loadedCount === total && onAllLoaded) onAllLoaded();
            };
            img.src = ASSETS[key];
            images[key] = img;
        } else {
            // 同步（测试/开发）：直接当已加载
            images[key] = { width: 200, height: 200, src: ASSETS[key] };
            loadedCount++;
        }
    }
    if (!isWx && onAllLoaded) onAllLoaded();
}

function get(key) { return images[key]; }

function isReady() { return loadedCount === total; }

function getProgress() { return loadedCount / total; }

module.exports = {
    ASSETS: ASSETS,
    preload: preload,
    get: get,
    isReady: isReady,
    getProgress: getProgress
};
