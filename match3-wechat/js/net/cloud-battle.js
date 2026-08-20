/**
 * 云函数对战客户端封装
 * 用 wx.cloud.callFunction + 轮询替代 WebSocket（免付费方案）
 */

const CLOUD_ENV = 'cloud1-d9g4pv8m8457af92a'; // 云开发环境 ID

function init() {
    if (typeof wx !== 'undefined' && wx.cloud) {
        try {
            wx.cloud.init({ env: CLOUD_ENV, traceUser: true });
        } catch (e) {
            // 已初始化则忽略
        }
    }
}

/**
 * 调用 battle 云函数
 * @param {string} action create/join/ready/syncScore/useItem/leave/query
 * @param {object} data 附加参数
 * @returns {Promise<object>} 云函数返回的 result
 */
function call(action, data) {
    return new Promise(function (resolve, reject) {
        if (typeof wx === 'undefined' || !wx.cloud) {
            reject(new Error('云开发不可用'));
            return;
        }
        const payload = Object.assign({ action: action }, data || {});
        wx.cloud.callFunction({
            name: 'battle',
            data: payload,
            success: function (res) {
                resolve(res.result || {});
            },
            fail: function (err) {
                reject(err);
            }
        });
    });
}

module.exports = {
    CLOUD_ENV: CLOUD_ENV,
    init: init,
    call: call
};
