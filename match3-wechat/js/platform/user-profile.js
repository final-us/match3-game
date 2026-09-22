/**
 * 可选微信头像适配层。
 * 头像只保存在当前设备本地并用于等待页展示，不上传到云函数；拒绝授权不影响对战。
 */

const STORAGE_KEY = 'match3_optional_avatar_v1';
const analytics = require('../core/analytics');

let avatarUrl = '';
let avatarImage = null;
let infoButton = null;
let lastBounds = '';
let buttonDisabled = false;
let imageRequest = 0;

function reportFailure(reason) {
    analytics.trackOnce('pvp_error', { category: 'profile', reason: reason }, 'profile_' + reason);
}

function isSafeAvatarUrl(value) {
    return typeof value === 'string' && value.length <= 768 && /^https:\/\//i.test(value);
}

function loadImage(url, callback) {
    if (!isSafeAvatarUrl(url) || typeof wx === 'undefined' || typeof wx.createImage !== 'function') return;
    const request = ++imageRequest;
    try {
        const image = wx.createImage();
        image.onload = function () {
            if (request !== imageRequest) return;
            avatarImage = image;
            if (callback) callback(image);
        };
        image.onerror = function () {
            if (request !== imageRequest) return;
            avatarImage = null;
            reportFailure('image_load');
        };
        image.src = url;
    } catch (e) {
        avatarImage = null;
        reportFailure('image_load');
    }
}

function init() {
    if (typeof wx === 'undefined' || typeof wx.getStorageSync !== 'function') return;
    let saved;
    try { saved = wx.getStorageSync(STORAGE_KEY); }
    catch (e) { reportFailure('storage_read'); return; }
    if (saved && isSafeAvatarUrl(saved.avatarUrl)) {
        avatarUrl = saved.avatarUrl;
        loadImage(avatarUrl);
    }
}

function destroyButton() {
    const button = infoButton;
    infoButton = null;
    lastBounds = '';
    try {
        if (button && typeof button.destroy === 'function') button.destroy();
    } catch (e) {
        buttonDisabled = true;
        reportFailure('button_destroy');
    }
}

function canChangeAvatar() {
    return !avatarImage && !buttonDisabled && typeof wx !== 'undefined' && typeof wx.createUserInfoButton === 'function';
}

function ensureButton(bounds) {
    if (!bounds || !canChangeAvatar()) {
        destroyButton();
        return;
    }
    const signature = [bounds.x, bounds.y, bounds.w, bounds.h].map(function (value) {
        return Math.round(Number(value) || 0);
    }).join(':');
    if (infoButton && signature === lastBounds) return;
    destroyButton();
    if (buttonDisabled) return;
    lastBounds = signature;
    try {
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
        if (!infoButton || typeof infoButton.onTap !== 'function') throw new Error('button unavailable');
        const button = infoButton;
        button.onTap(function (res) {
            if (infoButton !== button) return;
            const userInfo = res && res.userInfo;
            const nextUrl = userInfo && userInfo.avatarUrl;
            if (!isSafeAvatarUrl(nextUrl)) return;
            avatarUrl = nextUrl;
            try {
                if (typeof wx.setStorageSync === 'function') wx.setStorageSync(STORAGE_KEY, { avatarUrl: avatarUrl });
            } catch (e) { reportFailure('storage_write'); }
            loadImage(avatarUrl, destroyButton);
        });
    } catch (e) {
        buttonDisabled = true; // 本次运行不逐帧重试可选接口；默认猫咪头像不影响对战。
        destroyButton();
        reportFailure('button_create');
    }
}

function getAvatarImage() {
    return avatarImage;
}

module.exports = {
    init: init,
    ensureButton: ensureButton,
    destroyButton: destroyButton,
    getAvatarImage: getAvatarImage,
    canChangeAvatar: canChangeAvatar,
    isSafeAvatarUrl: isSafeAvatarUrl
};
