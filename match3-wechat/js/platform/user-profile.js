/**
 * 可选微信头像适配层。
 * 历史头像仅本地；明确选择后可在本设备后续房间复用，逐次核对微信授权。
 */

const STORAGE_KEY = 'match3_optional_avatar_v1';
const analytics = require('../core/analytics');

let avatarUrl = '';
let avatarImage = null;
let infoButton = null;
let lastBounds = '';
let buttonDisabled = false;
let imageRequest = 0;
let sharedAvatarUrl = '';
let changeListener = null;
let opponentUrl = '';
let opponentImage = null;
let opponentRequest = 0;
let sharingConsent = false;
let promptOpen = false;
let roomRequest = 0;

function saveChoice(consent) {
    sharingConsent = consent;
    try {
        if (typeof wx.setStorageSync === 'function') wx.setStorageSync(STORAGE_KEY,
            { avatarUrl: avatarUrl, sharingConsentVersion: consent ? 1 : 0 });
    } catch (e) { reportFailure('storage_write'); }
}

function dismissPrompt() {
    promptOpen = false;
    roomRequest++;
    saveChoice(false);
    destroyButton();
}

function beginRoom() {
    const request = ++roomRequest;
    sharedAvatarUrl = '';
    promptOpen = false;
    destroyButton();
    if (!canChangeAvatar()) return;
    const ask = () => { if (request === roomRequest) promptOpen = true; };
    if (!sharingConsent || typeof wx.getSetting !== 'function' || typeof wx.getUserInfo !== 'function') { ask(); return; }
    // A saved image alone never grants sharing. Also verify the currently authorized
    // profile matches the explicit saved choice before reusing it in another room.
    try {
        wx.getSetting({ success: settings => {
            if (request !== roomRequest) return;
            if (!settings || !settings.authSetting || settings.authSetting['scope.userInfo'] !== true) { saveChoice(false); ask(); return; }
            try {
                wx.getUserInfo({ withCredentials: false, success: result => {
                    if (request !== roomRequest) return;
                    const url = result && result.userInfo && result.userInfo.avatarUrl;
                    if (!isSafeAvatarUrl(url) || url !== avatarUrl) { ask(); return; }
                    sharedAvatarUrl = url;
                    if (!avatarImage) loadImage(url);
                    if (changeListener) changeListener(url);
                }, fail: ask });
            } catch (e) { ask(); }
        }, fail: ask });
    } catch (e) { ask(); }
}

function reportFailure(reason) {
    analytics.trackOnce('pvp_error', { category: 'profile', reason: reason }, 'profile_' + reason);
}

function isSafeAvatarUrl(value) {
    return typeof value === 'string' && value.length <= 768 &&
        !/[\x00-\x20\x7f\\#]/.test(value) &&
        /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*qlogo\.cn(?:[/?][^#]*)?$/i.test(value);
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
        sharingConsent = saved.sharingConsentVersion === 1;
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
    return (!avatarImage || !sharedAvatarUrl) && !buttonDisabled && typeof wx !== 'undefined' && typeof wx.createUserInfoButton === 'function';
}

function ensureButton(bounds, options) {
    const shareWithRoom = !!(options && options.shareWithRoom === true);
    if (!bounds || !canChangeAvatar()) {
        destroyButton();
        return;
    }
    const signature = [bounds.x, bounds.y, bounds.w, bounds.h].map(function (value) {
        return Math.round(Number(value) || 0);
    }).join(':') + ':' + shareWithRoom;
    if (infoButton && signature === lastBounds) return;
    destroyButton();
    if (buttonDisabled) return;
    lastBounds = signature;
    try {
        infoButton = wx.createUserInfoButton({
            type: 'image',
            image: 'res/ui/avatar-tap.png', // 透明点击层，头像及边框由 Canvas 绘制。
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
            if (!isSafeAvatarUrl(nextUrl)) { if (promptOpen) dismissPrompt(); return; }
            avatarUrl = nextUrl;
            if (shareWithRoom) {
                promptOpen = false;
                saveChoice(true);
                sharedAvatarUrl = nextUrl;
                if (changeListener) changeListener(nextUrl);
            } else saveChoice(sharingConsent);
            destroyButton();
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

function getSharedAvatarUrl() { return sharedAvatarUrl; }

function setChangeListener(listener) {
    changeListener = typeof listener === 'function' ? listener : null;
}

function clearOpponentAvatar() {
    opponentRequest++;
    opponentUrl = '';
    opponentImage = null;
}

function getOpponentAvatarImage(url) {
    const safeUrl = isSafeAvatarUrl(url) ? url : '';
    if (safeUrl === opponentUrl) return opponentImage;
    clearOpponentAvatar();
    opponentUrl = safeUrl;
    if (!safeUrl || typeof wx === 'undefined' || typeof wx.createImage !== 'function') return null;
    const request = opponentRequest;
    try {
        const image = wx.createImage();
        image.onload = function () {
            if (request === opponentRequest) opponentImage = image;
        };
        image.onerror = function () {
            if (request === opponentRequest) opponentImage = null;
        };
        image.src = safeUrl;
    } catch (e) { opponentImage = null; }
    return opponentImage;
}

function clearRoomProfile() {
    roomRequest++;
    promptOpen = false;
    imageRequest++;
    sharedAvatarUrl = '';
    clearOpponentAvatar();
    destroyButton();
}

module.exports = {
    beginRoom: beginRoom,
    isPromptOpen: () => promptOpen,
    dismissPrompt: dismissPrompt,
    init: init,
    getSharedAvatarUrl: getSharedAvatarUrl,
    setChangeListener: setChangeListener,
    getOpponentAvatarImage: getOpponentAvatarImage,
    clearOpponentAvatar: clearOpponentAvatar,
    clearRoomProfile: clearRoomProfile,
    ensureButton: ensureButton,
    destroyButton: destroyButton,
    getAvatarImage: getAvatarImage,
    canChangeAvatar: canChangeAvatar,
    isSafeAvatarUrl: isSafeAvatarUrl
};
