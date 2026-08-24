# 商业化接入清单

## 当前安全默认值

广告配置位于 `match3-wechat/js/core/config.js`。当前必须保持：

```js
enabled: false,
debugMockAds: false,
rewardedAdUnitId: '',
interstitialAdUnitId: ''
```

在此状态下不会创建微信广告实例、不会显示广告按钮、不会发放模拟奖励，也没有 Banner 广告或空白占位。

## 开通流量主后

1. 在微信公众平台创建一个激励视频广告位和一个插屏广告位。
2. 将两个广告位 ID 分别填入 `rewardedAdUnitId` 和 `interstitialAdUnitId`。
3. 确认 `debugMockAds` 为 `false`，再将 `enabled` 改为 `true`。
4. 只在真机验证广告；开发者工具不能代替无填充、关闭回调和弱网测试。

## 已冻结的展示规则

- 补体力：完整观看激励视频后增加 1 点体力，30 分钟冷却。
- 失败复活：完整观看后增加 5 步，同一局次数不限。
- 插屏：仅单人模式最终离开结算时计数；每 3 局最多一次，且两次展示至少间隔 120 秒。
- PvP、复活过程和首次启动不展示插屏。
- 不接入 Banner。

## 真机验收

- 激励视频完整看完才到账；提前关闭、加载失败、无填充均不发奖励。
- 广告不可用时入口隐藏，正常游戏和结算导航不被阻塞。
- 同一局可以重复复活，每次都必须重新完整观看。
- 第 1、2 局不展示插屏，第 3 局在点击离开结算后展示；120 秒内不重复展示。
- 插屏关闭、报错或无填充后都能继续原本的下一关、重试或返回首页操作。
- PvP 全流程不出现任何广告。

## 本地事件

`js/core/analytics.js` 仅在本地保存最近 200 条、7 天内的低敏标量事件，不上传数据。当前广告漏斗事件包括：

- `ad_request`
- `ad_show`
- `ad_complete`
- `ad_cancel`
- `ad_fail`
- `ad_reward_granted`
- `ad_frequency_blocked`

玩法核心漏斗同时包括 `home_exposure`，单人 `solo_level_select/solo_start/solo_complete`，以及 PvP `pvp_click/pvp_create/pvp_invite_share/pvp_join/pvp_ready/pvp_start/pvp_complete/pvp_error`。这些事件仍只进入本地缓冲；上线前配置明确的微信事件 ID 并复核字段后，才可打开远端上报。

禁止写入 OpenID、UnionID、昵称、头像、设备标识、手机号、邮箱、令牌或其他身份信息。
