# 每日金币一期接口候选

2026-09-23。本地候选合同；产品规则见 `../design/retention-v1.md`。用户已接受运行UI，要求标题使用深靛紫，并授权推进真实逻辑。尚未授权本功能云部署。

## 云函数 battle

仅通过既有 OPENID 身份入口。新增 action：

- `retentionInfo {}`：查询服务端当前状态和未确认收据。
- `retentionSign {date}`：按页面服务端日期签到；旧日期不得作为新日请求。相同日期重试恢复原收据。
- `retentionClaim {week,index}`：领取指定周标识/0..2档；当前周或仍在保留期的上周。
- `retentionRecord {event}`：事件 `{id,mode,date,cleared,validMove,completed?,levelId?,runId?,roomId?,roundId?}`。solo ID为本机持久序号、安装随机前缀及随机后缀组合（分配写入失败时仍保留唯一内存ID）；daily ID为`daily:<runId>`；PvP ID为`pvp:<roomId>:<roundId>`。只接收当天未确认事件；既有已确认事件可重复查询。单人有限可信上报，必须有效操作、`completed:true`正式结算、消除0..100000、合法关卡。daily以完成的本人daily_runs重放实际removed为准、日期取原挑战日；PvP以服务端房间结算快照/本人score>0和非主动退出资格为准，实际消除计数使用有界客户端上报，不能声称服务端棋盘回放。
- `retentionAck {receiptIds}`：本地组合奖励成功持久化后确认；只能确认本人已有收据。不改变资格/活跃度。确认记录防重仍保留，不重发已确认奖励。

成功统一 `{ok:true, state, receipts, eventStatus?}`。state：`{serverNow,date,week,weekEndsAt,signDay,signed,taskProgress:[games,games,cleared],activity,claimed:[bool,bool,bool],previousWeek?:{week,expiresAt,available:[bool,bool,bool],claimed:[bool,bool,bool]}}`；signDay为当前可签/今日已签的1..7。taskProgress可钳至[1,2,80]。收据 `{id,coins,items:{hammer:number},kind,date}`，kind为signin/task/weekly；ID必须稳定，日期/周/档仅服务端决定。所有未ACK收据必须跨日保留，查询可恢复；不得清理未确认奖励以掩盖丢失。serverNow用于校正本地任务归属日期，服务端仍决定可接受日期。

失败 `{ok:false,code,err}`；已失效未确认任务返回成功 `eventStatus:'expired'` 及最新状态（无新奖励），客户端明确提示过期；资格失败非成功。客户端固定12000ms超时，不无限加载；保存失败/未确认状态提供重试及关闭。

服务端事务必须同时写入进度、去重与收据；并发签到/重复任务不重复累计。当前及上周数据按北京时间周一转换，上一周宝箱不可消耗本周活跃度。每日签到20活跃，任务40/60/60金币与20/30/30活跃；周档200/350/500→300/500/1000；签到100/100/150/100/100/150/200，第7次hammer1。服务端数据仅服务端读写，具体集合/清理策略由实现记录。

## 客户端与本地资产

`coin.creditRewardOnce(id,{coins,items:{hammer}})` 返回 `{ok,credited,balance,reason?}`。复用旧金币收据能力并确保金币＋道具每个中断阶段恢复一次，所有钱包/道具写入须先恢复未完成奖励。旧余额/物品key不变，不能通过简单先加金币后加道具实现。

适配层管理持久outbox、服务器状态及未ACK收据。先持久化请求再发送；先成功应用收据再ACK；超时保持原请求，跨日重试不另造日期/ID。单人失败结算可先保存草稿，最终离开结算才提交以免复活重复计数；复活沿用同一局ID并更新消除总数。回到前台/打开页面重试待处理项，不阻塞既有玩法。云候选上线前仅develop渠道启用，样板夹具继续使用隔离模式，不向真实钱包假发奖励。

中断范围：普通后台/前台往返保持单人和PvP当前局的内存计数；每日挑战沿用原有持久日志恢复。已有玩法不支持进程完全结束后重建未完成的单人棋盘或PvP房间，本期不新增此能力；这些未正式结算的局不补计。已保存的单人正式结算草稿、任务outbox及已确认奖励收据可在重启后恢复。
