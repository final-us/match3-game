/**
 * 素材资源加载器（统一管理猫咪 UI 素材）
 * 注意：素材文件名必须为纯英文/数字（微信开发者工具对中文/空格文件名做 URL 编码会报错）
 * 用法：main 启动时 assets.preload(() => { ... })
 * 渲染时 assets.get('piece1') 取图
 */

const ASSETS = {
    // Only the catalog entry icon is startup-critical.
    catalogIcon: 'res/home/catalog-album.png',
    // 首页（月夜花园方向，无文字背景，动态 UI 由 Canvas 绘制）
    homeBackground: 'res/home/moonlit-garden-bg.jpg',
    homeDuelCats: 'res/home/duel-cats.png',
    homeDuelIcon: 'res/home/duel-heads.png',
    homeTitleLogo: 'res/home/title-logo.png',

    // 游戏内场景（同一月夜花园世界，不含文字和动态 UI）
    gameBackground: 'res/home/moonlit-garden-bg.jpg', // 与首页共用同一背景文件
    levelBackground: 'res/level-background-v2.jpg',

    // 统一月夜猫咪 UI（运行图均已压缩为小尺寸透明 PNG）
    uiCoin: 'res/ui/coin.png',
    uiToolBomb: 'res/ui/tool-bomb.png',
    uiHeart: 'res/ui/heart.png',
    uiAvatarTap: 'res/ui/avatar-tap.png',
    uiShop: 'res/ui/shop.png',
    uiSettings: 'res/ui/settings.png',
    uiTimer: 'res/ui/timer.png',
    uiMoves: 'res/ui/moves-paw.png',
    uiSpecialRowBeam: 'res/ui/special-row-beam.png',

    // 棋子（256×256 运行图；*-v2.png 为保留的 512×512 源图）
    piece1: 'res/piece1-runtime.png',
    piece2: 'res/piece2-runtime.png',
    piece3: 'res/piece3-runtime.png',
    piece4: 'res/piece4-runtime.png',
    piece5: 'res/piece5-runtime.png'
};

// Decorative result artwork is prefetched during solo play, outside the startup package.
const RESULT_ASSETS = {
    uiResultFrame: 'result-art/frame.png',
    uiResultWinMoon: 'result-art/win-moon.png',
    uiResultLoseMoon: 'result-art/lose-moon.png',
    uiResultGoals: 'result-art/goal-icons.png'
};

// Optional page illustrations, decoded atomically after the ui-art subpackage loads.
const ILLUSTRATION_ASSETS = {
    dailyInvitation: 'ui-art/daily-invitation.png',
    uiToolHammer: 'ui-art/tool-hammer.png',
    uiToolYarn: 'ui-art/tool-yarn.png',
    uiResultHappyCat: 'ui-art/result-happy-cat.png',
    uiResultSadCat: 'ui-art/result-sad-cat.png',
    uiIllustrationItems: 'ui-art/items.png',
    uiIllustrationChests: 'ui-art/chests.png',
    uiIllustrationFrame: 'ui-art/paper-frame.png',
    uiIllustrationHeaderCat: 'ui-art/header-cat.png',
    uiIllustrationDay7Cat: 'ui-art/day7-cat.png',
    uiIllustrationBlossom: 'ui-art/blossom-cluster.png',
    uiIllustrationDrawCat: 'ui-art/draw-cat.png',
    uiIllustrationPrepDuo: 'ui-art/prep-duo.png',
    uiIllustrationCoins: 'ui-art/reward-coins.png',
    uiIllustrationResultFrame: 'ui-art/result-frame.png'
};

// Loaded only after the native catalog subpackage is ready.
const CATALOG_ASSETS = {
    catalogPortraits: 'catalog/portraits-atlas.jpg',
    catalogCreamSilhouette: 'catalog/cream-silhouette.png',
    catalogRagdollSilhouette: 'catalog/ragdoll-silhouette.png',
    catalogSiameseSilhouette: 'catalog/siamese-silhouette.png',
    catalogCalicoSilhouette: 'catalog/calico-silhouette.png',
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
const lockedPortraits = {};
let loadedCount = 0;
const total = Object.keys(ASSETS).length;
const isWx = typeof wx !== 'undefined' && wx.createImage;

/** 预加载全部素材，回调可选（同步加载环境下也会触发） */
function preload(onAllLoaded) {
    const sourceKeys = new Map();
    for (const key in ASSETS) {
        const source = ASSETS[key];
        if (!sourceKeys.has(source)) sourceKeys.set(source, []);
        sourceKeys.get(source).push(key);
    }
    sourceKeys.forEach(function (keys, source) {
        if (isWx) {
            const img = wx.createImage();
            let settled = false;
            img.onload = img.onerror = function () {
                if (settled) return;
                settled = true;
                loadedCount += keys.length;
                if (loadedCount === total && onAllLoaded) onAllLoaded();
            };
            keys.forEach(function (key) { images[key] = img; });
            img.src = source;
        } else {
            // 同步（测试/开发）：直接当已加载
            const img = { width: 200, height: 200, src: source };
            keys.forEach(function (key) { images[key] = img; });
            loadedCount += keys.length;
        }
    });
    if (!isWx && onAllLoaded) onAllLoaded();
}

function get(key) { return images[key]; }

function getLockedPortrait(cat) {
    if(lockedPortraits[cat.id])return lockedPortraits[cat.id];
    const maskKey={cream:'catalogCreamSilhouette',ragdoll:'catalogRagdollSilhouette',siamese:'catalogSiameseSilhouette',calico:'catalogCalicoSilhouette'}[cat.id];
    const image=images.catalogPortraits,mask=images[maskKey];
    if(!isWx || !image || !image.width || !mask || !mask.width)return null;
    const createLockedArt=require('./catalog-locked-art');
    return lockedPortraits[cat.id]=createLockedArt(image,mask,cat.crop,()=>wx.createCanvas());
}

function isReady() { return loadedCount === total; }

function getProgress() { return loadedCount / total; }

let resultArtState = { status: 'idle' }, resultArtPending = null;
function getResultArtState() { return resultArtState; }
function loadResultArt() {
    if (resultArtState.status === 'ready') return Promise.resolve(resultArtState);
    if (resultArtPending) return resultArtPending;
    if (!isWx || typeof wx.loadSubpackage !== 'function') {
        resultArtState = { status: 'unavailable' };
        return Promise.resolve(resultArtState);
    }
    resultArtState = { status: 'loading' };
    let resolveLoad;
    resultArtPending = new Promise(resolve => { resolveLoad = resolve; });
    const pending = resultArtPending, staged = {}, requested = [];
    let finished = false, decoding = false, decoded = 0;
    const timer = setTimeout(() => finish('error'), 20000);
    function finish(status) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        requested.forEach(img => { img.onload = img.onerror = null; });
        if (status === 'ready') Object.assign(images, staged);
        resultArtState = { status };
        resultArtPending = null;
        resolveLoad(resultArtState);
    }
    try {
        wx.loadSubpackage({ name: 'result-art', success() {
            if (finished || decoding) return;
            decoding = true;
            try {
                Object.keys(RESULT_ASSETS).forEach(key => {
                    if (finished) return;
                    const img = wx.createImage(); requested.push(img);
                    let settled = false;
                    img.onload = () => {
                        if (finished || settled) return;
                        settled = true;
                        if (!img.width || !img.height) return finish('error');
                        staged[key] = img;
                        if (++decoded === Object.keys(RESULT_ASSETS).length) finish('ready');
                    };
                    img.onerror = () => finish('error');
                    img.src = RESULT_ASSETS[key];
                });
            } catch (error) { finish('error'); }
        }, fail() { finish('error'); } });
    } catch (error) { finish('error'); }
    return pending;
}


let illustrationArtState = { status: 'idle' }, illustrationArtPending = null;
function getIllustrationArtState() { return illustrationArtState; }
function loadIllustrationArt() {
    if (illustrationArtState.status === 'ready') return Promise.resolve(illustrationArtState);
    if (illustrationArtPending) return illustrationArtPending;
    if (!isWx || typeof wx.loadSubpackage !== 'function') {
        illustrationArtState = { status: 'unavailable' };
        return Promise.resolve(illustrationArtState);
    }
    illustrationArtState = { status: 'loading' };
    let resolveLoad;
    illustrationArtPending = new Promise(resolve => { resolveLoad = resolve; });
    const pending = illustrationArtPending, staged = {}, requested = [];
    let finished = false, decoding = false, decoded = 0;
    const timer = setTimeout(() => finish('error'), 20000);
    function finish(status) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        requested.forEach(img => { img.onload = img.onerror = null; });
        if (status === 'ready') Object.assign(images, staged);
        illustrationArtState = { status };
        illustrationArtPending = null;
        resolveLoad(illustrationArtState);
    }
    try {
        wx.loadSubpackage({ name: 'ui-art', success() {
            if (finished || decoding) return;
            decoding = true;
            try {
                Object.keys(ILLUSTRATION_ASSETS).forEach(key => {
                    if (finished) return;
                    const img = wx.createImage(); requested.push(img);
                    let settled = false;
                    img.onload = () => {
                        if (finished || settled) return;
                        settled = true;
                        if (!img.width || !img.height) return finish('error');
                        staged[key] = img;
                        if (++decoded === Object.keys(ILLUSTRATION_ASSETS).length) finish('ready');
                    };
                    img.onerror = () => finish('error');
                    img.src = ILLUSTRATION_ASSETS[key];
                });
            } catch (error) { finish('error'); }
        }, fail() { finish('error'); } });
    } catch (error) { finish('error'); }
    return pending;
}


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
    ILLUSTRATION_ASSETS: ILLUSTRATION_ASSETS,
    loadIllustrationArt: loadIllustrationArt,
    getIllustrationArtState: getIllustrationArtState,
    RESULT_ASSETS: RESULT_ASSETS,
    loadResultArt: loadResultArt,
    getResultArtState: getResultArtState,
    CATALOG_ASSETS: CATALOG_ASSETS,
    loadCatalog: loadCatalog,
    getCatalogState: getCatalogState,
    preload: preload,
    get: get,
    getLockedPortrait: getLockedPortrait,
    isReady: isReady,
    getProgress: getProgress
};
