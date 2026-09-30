# 每日金币一期接口候选

2026-09-30更新：用户批准每日任务手动领取。云端增量已部署并完成真实SDK查询与页面检查，客户端尚待上传；独立复核及真机领奖链路仍待完成，实际发布状态以 `../../project-status/development-steps.md` 为准。产品规则见 `../design/retention-v1.md`。

## 手动领取增量（manual-v1）

- 新客户端每次同步先请求 `retentionInfo {taskClaimMode:'manual-v1'}`，确认返回同名模式和三项 `taskClaimed` 后，才提交待处理操作；旧云缺少能力时显示“任务领奖功能更新中”，保留待处理请求，不向旧云提交可能自动发奖的进度。
- 服务端 `retention_profiles.taskClaimMode` 一旦切换为 `manual-v1` 不回退；`day.tasks` 仍表示完成条件，新增 `day.claimed` 表示奖励已发。旧档缺少 claimed 时按旧 tasks 迁移，因为旧完成记录已发金币收据与活跃度。不得回收资产或再次计入活跃度。
- `retentionClaimTask {date,index}`：按服务端北京时间日期、任务编号0..2领取。资格由本人服务端完成进度决定，不接受客户端奖励数额/身份。事务内写 claimed、活跃度和原有确定性 task 收据；重复/并发请求不重发。
- 未领取任务当天零点后过期；先查已有收据再判断日期，使已确认但丢回包的领取可跨日恢复。未ACK旧收据继续沿用原恢复机制。仅完成任务不产生收据或活跃度。
- state 增加 `taskClaimMode:'manual-v1'|'legacy-auto'`、`taskClaimed:[bool,bool,bool]`。客户端存储key保持不变，旧缓存允许读取，新待处理队列增加 retentionClaimTask。
- 灰度兼容：先更新云端，再发布客户端。尚未升级账号保留旧行为；账号首次新客户端握手后，旧客户端也不再自动发放新任务奖励，但旧客户端没有领取按钮，需回到新版领取。签到、周宝箱、普通通关、每日挑战及鱼干不改规则。
- 回退：客户端可回退，但已升级账号的云端手动标记/claimed字段不能直接交给旧版云代码处理。需保留本次兼容云逻辑或准备显式迁移；不要直接覆盖旧云版本导致未领任务状态丢失。

## 云函数 battle

仅通过既有 OPENID 身份入口。新增 action：

- `retentionInfo {taskClaimMode?}`：查询服务端当前状态和未确认收据；模式升级见上。
- `retentionSign {date}`：按页面服务端日期签到；旧日期不得作为新日请求。相同日期重试恢复原收据。
- `retentionClaim {week,index}`：领取指定周标识/0..2档；当前周或仍在保留期的上周。
- `retentionRecord {event}`：事件 `{id,mode,date,cleared,validMove,completed?,levelId?,runId?,roomId?,roundId?}`。solo ID为本机持久序号、安装随机前缀及随机后缀组合（分配写入失败时仍保留唯一内存ID）；daily ID为`daily:<runId>`；PvP ID为`pvp:<roomId>:<roundId>`。只接收当天未确认事件；既有已确认事件可重复查询。单人有限可信上报，必须有效操作、`completed:true`正式结算、消除0..100000、合法关卡。daily以完成的本人daily_runs重放实际removed为准、日期取原挑战日；PvP以服务端房间结算快照/本人score>0和非主动退出资格为准，实际消除计数使用有界客户端上报，不能声称服务端棋盘回放。
- `retentionAck {receiptIds}`：本地组合奖励成功持久化后确认；只能确认本人已有收据。不改变资格/活跃度。确认记录防重仍保留，不重发已确认奖励。

成功统一 `{ok:true, state, receipts, eventStatus?}`。state：`{serverNow,date,week,weekEndsAt,signDay,signed,taskProgress:[games,games,cleared],activity,claimed:[bool,bool,bool],previousWeek?:{week,expiresAt,available:[bool,bool,bool],claimed:[bool,bool,bool]}}`；signDay为当前可签/今日已签的1..7。taskProgress可钳至[1,2,80]。收据 `{id,coins,items:{hammer:number},kind,date}`，kind为signin/task/weekly；ID必须稳定，日期/周/档仅服务端决定。所有未ACK收据必须跨日保留，查询可恢复；不得清理未确认奖励以掩盖丢失。serverNow用于校正本地任务归属日期，服务端仍决定可接受日期。

失败 `{ok:false,code,err}`；已失效未确认任务返回成功 `eventStatus:'expired'` 及最新状态（无新奖励），客户端明确提示过期；资格失败非成功。客户端固定12000ms超时，不无限加载；保存失败/未确认状态提供重试及关闭。

服务端进度事务写入计数与事件去重，手动领取事务写入领取状态、活跃度与收据；并发签到/重复任务不重复累计。当前及上周数据按北京时间周一转换，上一周宝箱不可消耗本周活跃度。每日签到20活跃，任务40/60/60金币与20/30/30活跃；周档200/350/500→300/500/1000；签到100/100/150/100/100/150/200，第7次hammer1。服务端数据仅服务端读写，具体集合/清理策略由实现记录。

## 客户端与本地资产

`coin.creditRewardOnce(id,{coins,items:{hammer}})` 返回 `{ok,credited,balance,reason?}`。复用旧金币收据能力并确保金币＋道具每个中断阶段恢复一次，所有钱包/道具写入须先恢复未完成奖励。旧余额/物品key不变，不能通过简单先加金币后加道具实现。

适配层管理持久outbox、服务器状态及未ACK收据。先持久化请求再发送；先成功应用收据再ACK；超时保持原请求，跨日重试不另造日期/ID。单人失败结算可先保存草稿，最终离开结算才提交以免复活重复计数；复活沿用同一局ID并更新消除总数。回到前台/打开页面重试待处理项，不阻塞既有玩法。云候选上线前仅develop渠道启用，样板夹具继续使用隔离模式，不向真实钱包假发奖励。

中断范围：普通后台/前台往返保持单人和PvP当前局的内存计数；每日挑战沿用原有持久日志恢复。已有玩法不支持进程完全结束后重建未完成的单人棋盘或PvP房间，本期不新增此能力；这些未正式结算的局不补计。已保存的单人正式结算草稿、任务outbox及已确认奖励收据可在重启后恢复。
