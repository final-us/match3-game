/**
 * 素材资源加载器（统一管理猫咪 UI 素材）
 * 注意：素材文件名必须为纯英文/数字（微信开发者工具对中文/空格文件名做 URL 编码会报错）
 * 用法：main 启动时 assets.preload(() => { ... })
 * 渲染时 assets.get('piece1') 取图
 */

const ASSETS = {
    // Accepted v8 concept sampled only for its four illustration regions.
    catalogPortraits: 'res/catalog/portraits-atlas.jpg',
    catalogIcon: 'res/home/catalog-album.png',
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

// Loaded only after the native catalog subpackage is ready.
const CATALOG_ASSETS = {
    catalogNaitangFamiliar: 'catalog/naitang-familiar.jpg',
    catalogNaitangTrust: 'catalog/naitang-trust.jpg',
    catalogNaitangAttachment: 'catalog/naitang-attachment.jpg',
    catalogNaitangBestFriend: 'catalog/naitang-best-friend.jpg',
    catalogRagdollFamiliar: 'catalog/tuanzi-familiar.jpg',
    catalogRagdollTrust: 'catalog/tuanzi-trust.jpg',
    catalogRagdollAttachment: 'catalog/tuanzi-attachment.jpg',
    catalogRagdollBestFriend: 'catalog/tuanzi-best-friend.jpg',
    catalogSiameseFamiliar: 'catalog/zhima-familiar.jpg',
    catalogSiameseTrust: 'catalog/zhima-trust.jpg',
    catalogSiameseAttachment: 'catalog/zhima-attachment.jpg',
    catalogSiameseBestFriend: 'catalog/zhima-best-friend.jpg',
    catalogCalicoFamiliar: 'catalog/buding-familiar.jpg',
    catalogCalicoTrust: 'catalog/buding-trust.jpg',
    catalogCalicoAttachment: 'catalog/buding-attachment.jpg',
    catalogCalicoBestFriend: 'catalog/buding-best-friend.jpg',
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


let catalogState = { status: 'idle', progress: 0, message: '' };
let catalogPending = null;
function getCatalogState() { return catalogState; }
function loadCatalog() {
    if (catalogState.status === 'ready') return Promise.resolve(catalogState);
    if (catalogPending) return catalogPending;
    if (!isWx || typeof wx.loadSubpackage !== 'function') {
        catalogState = { status: 'error', progress: 0, message: '请更新微信后重试' };
        return Promise.resolve(catalogState);
    }
    catalogState = { status: 'loading', progress: 0, message: '' };
    let resolveLoad;
    const pending = new Promise(resolve => { resolveLoad = resolve; });
    catalogPending = pending;
    let finished = false, decoding = false, decoded = 0;
    const staged = {}, requested = [];
    const timer = setTimeout(() => finish('error', '加载超时，请检查网络后重试'), 20000);
    function finish(status, message) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        requested.forEach(img => { img.onload = img.onerror = null; });
        if (status === 'ready') Object.assign(images, staged);
        catalogState = { status, progress: status === 'ready' ? 100 : 0, message: message || '' };
        catalogPending = null;
        resolveLoad(catalogState);
    }
    try {
        const task = wx.loadSubpackage({
            name: 'catalog',
            success() {
                if (finished || decoding) return;
                decoding = true;
                catalogState = { status: 'loading', progress: 80, message: '' };
                try {
                    Object.keys(CATALOG_ASSETS).forEach(key => {
                        if (finished) return;
                        const img = wx.createImage();
                        requested.push(img);
                        let settled = false;
                        img.onload = () => {
                            if (finished || settled) return;
                            settled = true;
                            if (!img.width || !img.height) return finish('error', '原画读取失败，请重试');
                            staged[key] = img;
                            decoded++;
                            catalogState = { status: 'loading', progress: 80 + Math.floor(decoded / Object.keys(CATALOG_ASSETS).length * 20), message: '' };
                            if (decoded === Object.keys(CATALOG_ASSETS).length) finish('ready');
                        };
                        img.onerror = () => finish('error', '原画读取失败，请重试');
                        img.src = CATALOG_ASSETS[key];
                    });
                } catch (error) { finish('error', '原画读取失败，请重试'); }
            },
            fail() { finish('error', '下载失败，请检查网络后重试'); }
        });
        if (task && typeof task.onProgressUpdate === 'function') task.onProgressUpdate(event => {
            if (!finished && !decoding && event && Number.isFinite(event.progress))
                catalogState = { status: 'loading', progress: Math.max(0, Math.min(80, Math.floor(event.progress * .8))), message: '' };
        });
    } catch (error) { finish('error', '暂时无法加载，请重试'); }
    return pending;
}

module.exports = {
    ASSETS: ASSETS,
    CATALOG_ASSETS: CATALOG_ASSETS,
    loadCatalog: loadCatalog,
    getCatalogState: getCatalogState,
    preload: preload,
    get: get,
    isReady: isReady,
    getProgress: getProgress
};
