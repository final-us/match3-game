/**
 * 广告管理器：统一封装激励视频广告（wx.createRewardedVideoAd）
 * 所有广告调用都走这里，换广告位/改频率只改配置，不碰业务代码
 * 广告位 ID 留空时（开发调试）直接返回"未观看完成"，方便联调
 */

const config = require('./config');

let rewardedAd = null;
let pendingResolve = null; // 当前等待中的 Promise resolve

/** 创建激励视频广告实例（复用，避免重复创建） */
function createRewardedAd() {
    if (typeof wx === 'undefined' || !wx.createRewardedVideoAd) return null;
    const adUnitId = config.AD_CONFIG.rewardedAdUnitId;
    if (!adUnitId) return null;

    try {
        const ad = wx.createRewardedVideoAd({ adUnitId: adUnitId });

        // 关闭监听：isEnded=true 表示完整看完
        ad.onClose(function (res) {
            const completed = res && res.isEnded;
            if (pendingResolve) {
                pendingResolve(!!completed);
                pendingResolve = null;
            }
        });

        // 错误监听：广告异常时不阻塞游戏
        ad.onError(function () {
            if (pendingResolve) {
                pendingResolve(false);
                pendingResolve = null;
            }
        });

        return ad;
    } catch (e) {
        return null;
    }
}

/**
 * 展示激励视频广告
 * @returns {Promise<boolean>} 完整观看返回 true，否则 false
 */
function showRewarded() {
    return new Promise(function (resolve) {
        // 开发模式（未配置广告位 ID）：模拟"看完广告"，方便联调完整流程
        if (!config.AD_CONFIG.rewardedAdUnitId) {
            setTimeout(function () { resolve(true); }, 300);
            return;
        }

        if (!rewardedAd) {
            rewardedAd = createRewardedAd();
        }
        if (!rewardedAd) {
            resolve(false);
            return;
        }

        pendingResolve = resolve;

        rewardedAd.show().catch(function () {
            // 首次 show 失败：先 load 再 show
            rewardedAd.load()
                .then(function () { return rewardedAd.show(); })
                .catch(function () {
                    if (pendingResolve) {
                        pendingResolve(false);
                        pendingResolve = null;
                    }
                });
        });
    });
}

module.exports = {
    showRewarded: showRewarded
};
