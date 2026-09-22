/**
 * 素材资源加载器（统一管理猫咪 UI 素材）
 * 注意：素材文件名必须为纯英文/数字（微信开发者工具对中文/空格文件名做 URL 编码会报错）
 * 用法：main 启动时 assets.preload(() => { ... })
 * 渲染时 assets.get('piece1') 取图
 */

const ASSETS = {
    // 首页（月夜花园方向，无文字背景，动态 UI 由 Canvas 绘制）
    homeBackground: 'res/home/moonlit-garden-bg.jpg',
    homeDuelCats: 'res/home/duel-cats.png',
    homeDuelIcon: 'res/home/duel-heads.png',
    homeTitleLogo: 'res/home/title-logo.png',
    homeButtonPrimary: 'res/home/button-primary.png',
    homeButtonSecondary: 'res/home/button-secondary.png',

    // 游戏内场景（同一月夜花园世界，不含文字和动态 UI）
    gameBackground: 'res/home/moonlit-garden-bg.jpg', // 与首页共用同一背景文件
    levelBackground: 'res/level-background-v2.jpg',

    // 统一月夜猫咪 UI（运行图均已压缩为小尺寸透明 PNG）
    uiCoin: 'res/ui/coin.png',
    dailyInvitation: 'res/ui/daily-invitation.png',
    uiHeart: 'res/ui/heart.png',
    uiShop: 'res/ui/shop.png',
    uiSettings: 'res/ui/settings.png',
    uiTimer: 'res/ui/timer.png',
    uiMoves: 'res/ui/moves-paw.png',
    uiToolHammer: 'res/ui/tool-hammer.png',
    uiToolBomb: 'res/ui/tool-bomb.png',
    uiToolYarn: 'res/ui/tool-yarn.png',
    uiResultHappyCat: 'res/ui/result-happy-cat.png',
    uiResultSadCat: 'res/ui/result-sad-cat.png',
    uiSpecialRowBeam: 'res/ui/special-row-beam.png',

    // 棋子（256×256 运行图；*-v2.png 为保留的 512×512 源图）
    piece1: 'res/piece1-runtime.png',
    piece2: 'res/piece2-runtime.png',
    piece3: 'res/piece3-runtime.png',
    piece4: 'res/piece4-runtime.png',
    piece5: 'res/piece5-runtime.png'
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
