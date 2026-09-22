# 好友续局 v2 · 本地实现契约

范围来自已批准的 `docs/content-update-1235.md`。60秒、既有道具配额、每局奖励、无广告规则保持；同房间双方确认续局后重新配置并准备。用户已接受步骤1，当前开始步骤2。未授权部署或线上写入。

## 协议与房间

- 新客户端 create/join/query 发送 `protocolVersion:2`。create/join 返回 `protocolVersion`、正整数 `roundId` 与正整数 `roundNumber`。roundId 是不可复用的协议失效令牌；roundNumber 是同一对手的显示局次，首局/换人重置为1，仅双方确认续局后递增。旧服务不返回版本时，新客户端按旧单局处理，不假装支持续局。
- 新服务继续支持 v1 房间的旧单局；旧客户端不得加入 v2 房间，返回 `UPDATE_REQUIRED`。新版加入旧房间保持单局，不原地升级存量房间。
- v2 的 ready/configureItems/syncScore/useItem/leave/rematch 必须携带协议和当前 roundId；旧局/缺省局号返回 `STALE_ROUND`，不得改变新局。query 返回最新局，供断线恢复；客户端替换本局状态对象后，旧局异步回调失效。
- v2 ready 使用明确 `ready:boolean`，不是重试会反转的toggle。rematch 使用 `accept:boolean`，只在finished受理；重复同意/取消幂等。两位成员均同意且当前在线时，事务中仅推进一次 roundId，清零分数、效果、准备及道具消耗，回到waiting。
- query 在既有字段之外返回 `protocolVersion, roundId, roundNumber, myWins, oppWins, myRematch, oppRematch, canRematch, oppLeft`。finished结果包含 `roundId, settlementId, coinReward`；settlementId是服务端产生、不含原始身份的每人每局稳定标识。
- 累计胜场只在每局首次结算时更新，平局不增胜场。结果轮询不重复计胜。离开已结算房间后，不通过query恢复已退出成员；对手看到离开提示并可重新邀请。
- waiting中离开或替换成员须使陈旧准备请求无效并清零战绩；新玩家不继承旧对手战绩。playing中离开按既有输赢规则结算，finished离开不改已有输赢。
- waiting/finished续局窗口各10分钟；窗口以对应等待起点/结算时间计算，保留原房间createdAt供既有7天清理，不因续局无界延长房间生命周期。

## 客户端与入账

- finished继续轮询，展示对方是否同意、取消等待、退出、连接失败和房间失效；v1仍支持重新邀请开新房间。
- 只用服务端返回累计胜场，不在客户端猜测；新局清理冰冻、干扰、计时、输入关闭、轮询游标与上局个人统计。
- v2每局金币使用服务端稳定settlementId去重入账。保持旧金币整数key，通过持久化小型入账日志恢复中断；所有本地钱包读写先完成未结束入账，避免“先标记后丢钱”或重试重复发奖。不迁移整个经济系统，不声称能抵御篡改本地存档。
- 本轮不主动采集昵称之外的新个人资料，不开放远程统计；协议字段与错误不显示内部标识。复用已接受视觉与素材。

## 验证边界

本地事务模拟验证两人确认、取消、重复/并发、旧局比分/道具/退出、成员变化、过期、身份、重复结算。钱包覆盖各持久化失败点与恢复。客户端用真实Main状态机和渲染检查第二局、弱网/迟到回复、退出与三档屏幕；非实现者独立检查改变的服务端信任边界。微信真实云安装与双账号/设备仍需部署授权和对应环境证据。

## 服务端本地证据 · 2026-09-22

- `cloudfunctions/battle` 对 `protocolVersion:2` 房间在事务内保存正整数 `roundId` 和 `roundNumber`；roundId 负责失效保护，roundNumber 仅为服务端下发的同对手显示局次。v1 房间保留原单局动作，旧客户端加入 v2 返回 `UPDATE_REQUIRED`。v2 的 ready/configureItems/syncScore/useItem/leave/rematch 必须精确匹配协议和局号，否则返回 `STALE_ROUND`，ready 使用显式布尔值。
- 每局首次结束时写入每位玩家稳定的非身份明文 `settlementId`、`coinReward` 与累计胜场；重复 query 不重复计胜。两方续局确认在同一房间事务内只推进一次局号，并清空局内状态；等待成员变动同样推进局号并清零战绩，避免新成员继承。
- 已执行：`node match3-wechat/test/battle-rematch.js`、`node match3-wechat/test/battle-logic.js`、`node match3-wechat/test/battle-cloud-function.js` 及受影响服务端/测试脚本 `node --check`，全部通过。rematch 模拟覆盖并发双确认后迟到取消/退出/比分/道具、旧结果重复轮询、成员替换和显式准备重试、v1/v2 隔离、10分钟窗口及离开后的查询边界。
- 限制：这是内存事务夹具的本地证据；未部署云函数、未进行微信双账号或真机验证。
