/**
 * 可选微信头像适配层。
 * 头像只保存在当前设备本地并用于等待页展示，不上传到云函数；拒绝授权不影响对战。
 */

const STORAGE_KEY = 'match3_optional_avatar_v1';

let avatarUrl = '';
let avatarImage = null;
let infoButton = null;
let lastBounds = '';

function isSafeAvatarUrl(value) {
    return typeof value === 'string' && value.length <= 768 && /^https:\/\//i.test(value);
}

function loadImage(url, callback) {
    if (!isSafeAvatarUrl(url) || typeof wx === 'undefined' || typeof wx.createImage !== 'function') return;
    const image = wx.createImage();
    image.onload = function () {
        avatarImage = image;
        if (callback) callback(image);
    };
    image.onerror = function () {
        avatarImage = null;
    };
    image.src = url;
}

function init() {
    if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') return;
    const saved = wx.getStorageSync(STORAGE_KEY);
    if (saved && isSafeAvatarUrl(saved.avatarUrl)) {
        avatarUrl = saved.avatarUrl;
        loadImage(avatarUrl);
    }
}

function destroyButton() {
    if (infoButton && typeof infoButton.destroy === 'function') infoButton.destroy();
    infoButton = null;
    lastBounds = '';
}

function ensureButton(bounds) {
    if (avatarImage || !bounds || typeof wx === 'undefined' || typeof wx.createUserInfoButton !== 'function') {
        destroyButton();
        return;
    }
    const signature = [bounds.x, bounds.y, bounds.w, bounds.h].map(function (value) {
        return Math.round(Number(value) || 0);
    }).join(':');
    if (infoButton && signature === lastBounds) return;
    destroyButton();
    lastBounds = signature;
    infoButton = wx.createUserInfoButton({
        type: 'image',
        image: 'res/piece1-runtime.png',
        style: {
            left: Math.round(bounds.x),
            top: Math.round(bounds.y),
            width: Math.round(bounds.w),
            height: Math.round(bounds.h)
        }
    });
    if (!infoButton || typeof infoButton.onTap !== 'function') return;
    infoButton.onTap(function (res) {
        const userInfo = res && res.userInfo;
        const nextUrl = userInfo && userInfo.avatarUrl;
        if (!isSafeAvatarUrl(nextUrl)) return;
        avatarUrl = nextUrl;
        if (typeof wx.setStorageSync === 'function') wx.setStorageSync(STORAGE_KEY, { avatarUrl: avatarUrl });
        loadImage(avatarUrl, destroyButton);
    });
}

function getAvatarImage() {
    return avatarImage;
}

module.exports = {
    init: init,
    ensureButton: ensureButton,
    destroyButton: destroyButton,
    getAvatarImage: getAvatarImage,
    isSafeAvatarUrl: isSafeAvatarUrl
};
