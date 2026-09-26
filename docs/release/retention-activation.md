# 每日金币一期云端激活说明

状态：2026-09-23用户明确回复“行，做云端吧”，已授权下述既有环境云端接入及开发账号验证。4集合、4索引、清理开关及修复版云部署已完成，控制台最终更新时间20:50:56；真实微信SDK签到、任务、收据恢复及旧接口回归已通过，独立QA接受develop云候选证据。真机、双账号完整PvP及正式发布仍未完成。适用云函数：`match3-wechat/cloudfunctions/battle`。此授权不含正式客户端发布，隐私文案的运营方发布确认仍独立保留。

已授权目标：既有云环境`cloud1-d9g4pv8m8457af92a`的battle更新、下列4集合及索引、清理环境变量，以及当前开发账号的真实签到/正常任务/恢复验证。使用正常玩法与既定奖励，不清空存档、不伪造周活跃资格。预计新增身份哈希关联的进度/收据与正常云调用用量；代码可回退，已发本地奖励及未ACK云记录保留。正式客户端发布另行确认。

执行准备：`/private/tmp/retention-deploy-20260923/battle`为隔离部署候选，16份源码/配置与当前工作区逐字节一致；package.json、package-lock.json及.npmrc与上次已验证部署输入一致，复用原隔离目录的固定锁依赖。实际部署用开发者工具“上传并部署：所有文件”；工作区vendor和6894份node_modules文件与隔离依赖逐字节一致，未重新安装依赖或开启CLI服务端口。

## 实际部署进度 · 2026-09-23

- 目标环境已通过控制台核实为cloud1-d9g4pv8m8457af92a；原battle $LATEST保存为不可变版本2，备注before-retention-20260923；未切换流量。
- 4集合创建时均选择“所有用户不可读写”，已在集合列表确认存在。真实开发者工具SDK读取4集合均返回-502003，服务端身份仍可访问。未用客户端写探针改动数据。
- retention_events和retention_battle_evidence各有createdAt_1非唯一升序索引；retention_receipts有owner_ack_created（owner/acknowledged/createdAt全升序）及ack_time（acknowledged/acknowledgedAt全升序）。4索引均在控制台列表出现，无构建等待提示。
- battle配置加入RETENTION_CLEANUP_ENABLED=1并保存；原Node.js 20.19、256MB、3秒超时未改变。清理触发器未修改，实际触发日志仍待验证。控制台提醒数据库自动备份未开启；本轮不购买/变更备份套餐，新增集合保留不删除，代码使用版本2回退。
- 首轮部署后控制台显示battle已部署、更新时间20:35:05。真实SDK dailyInfo返回ok、daily-v1、500金币、当日已完成。retentionInfo返回服务异常；云日志精确定位为document.set:fail -501007“不能更新_id的值”。查询会持久化进度档案，因此可能已生成当前开发账号档案；尚未执行签到发奖或任务写入验证。
- P1已修复：normalizeProfile校验owner/结构后，从待写副本剥离_id/_openid；不重置进度。fixture新增真实SDK限制，retention-cloud和retention-integration及语法/差异检查通过。独立retention_logic_qa审阅无开放P1/P2，并独立确认未知业务字段保留、其他read→set路径无同类缺陷。
- 修复文件已同步隔离候选，第二次“上传并部署：所有文件”完成；控制台最终确认battle已部署，更新时间2026-09-23 20:50:56。最终配置复核：Node.js 20.19、index.main、256M、3s，RETENTION_CLEANUP_ENABLED显示1，cleanup-battle-rooms仍为0 0 3 * * * *。未另行手动触发清理删除旧数据，云定时执行日志仍待自然运行验证。
- 临时验证入口已恢复为原始game.js字节（73字节，独立QA cmp一致），并重新编译，CUA确认正常首页、余额1390。未上传客户端、清除存档、开启CLI端口或修改设备唤醒设置。验证脚本仅位于/private/tmp/retention-platform-driver.js及retention-stage.py。

本轮同时准备了 `privacy-policy-review.md` 的2026-09-23.2增量，仅新增每日金币披露，正文在本地候选中，尚待运营方确认。开发/线上后台声明仍须与实际配置一致。

## 真实微信开发者工具证据

平台：微信开发者工具Stable 2.02.2608040、基础库3.16.2、现有开发账号、真实微信SDK与云数据库，保留原本地存档。临时脚本通过正式Main.handleTouchStart/Move/End、真实核心/Canvas动画/适配器/钱包运行；不是mock云，也不等同人工触控或手机验收。

- 签到丢回复：初始1000金币、5体力、未签/活跃0/空队列；真实retentionSign返回ok后，临时适配器丢弃回复，界面offline、pending1、金币仍1000。
- 收据恢复：重新编译启动后，确定性签到重试取回收据，余额1100、已签、活跃20；在实际发送retentionAck前注入断线，留下acks1。再次重启正常确认，余额仍1100、ready、pending/receipts/acks均0。确认的是真实云发奖＋本机保存，网络故障为明确注入，不冒充自然弱网。
- 首轮对局driver没有等待onSwap异步动画完结，触发too_many_moves失败，该轮不作为正常对局验收。核心随后正式结算首通130及两项任务40+60，余额1330、活跃70、任务[1,1,80]；未手工补币或重置数据。修复driver等待processing=false且preferredGenerationPositions为空后，再完成27步胜局（188消除、旧关firstReward0），获得剩余第二局任务60，余额1390、活跃100、任务[1,2,80]；接着28步败局（133消除、firstReward0），余额不变、体力4。失败时任务已满，该平台样本证明失败经济/体力边界，不能单独证明未满任务时失败计数；该规则由此前本地集成/云测试支撑。
- 两次同步及再次重启均保持1390，retentionInfo待ACK收据为0，所有本地队列为空。当前活跃100时请求200门槛宝箱明确返回NOT_ELIGIBLE，不伪造周活跃资格。
- 当前日期的dailyInfo返回ok、daily-v1、500金币、completed=true；没有重置今日机会。retentionEnabled=false/true两类v2房间的create/query/leave均ok，采用正式Main.battleRequestData封装退出请求，无额外任务或奖励。早两轮诊断脚本遗漏v2参数导致退出失败，不计通过；对应空等待测试房按原10分钟失效规则自然过期，不改写记录。该回归不等同双账号正式结算/续局/evidence验证。
- CUA实看：签到“今日已领取”，任务1/1、2/2、80/80均已完成，周活跃100/500及300/500/1000奖励一致；原界面与深色标题保留。恢复入口后的首页显示1390金币；最后尝试原生点击入口时设备再次锁屏，未将该点击作为成功证据。
- 独立retention_logic_qa核对脚本、故障注入位置、数值闭合、已恢复入口及证据边界，接受develop真实云候选；无开放P1/P2。未扩大为trial/release或发布验收。

尚待发布前验收：手机实际触控/自然弱网、双账号完整PvP结算与续局证据、真实跨日/跨周观察、云清理定时执行日志及2026-09-23.2隐私增量运营方确认。周门槛与七日周期本地自动证据保留，不以篡改真实时间或进度替代平台观察。

## 集合与保留

| 集合 | 用途 | 文档标识与保留 |
| --- | --- | --- |
| `retention_profiles` | 累计签到、当日任务、本周和上周资格 | 每个哈希用户一份；功能使用期间保留。服务端发现结构损坏时失败，不以空进度覆盖。 |
| `retention_events` | 按模式规范事件编号去重 | 哈希用户＋规范事件编号；已记录事件保留35天后由定时清理。每用户每日最多接纳82个事件，任务全部完成后不再新增。 |
| `retention_receipts` | 待本地钱包应用及ACK的固定奖励 | 哈希收据编号；未ACK不得清理。ACK后保留35天再清理。查询每批最多返回100条最早待处理收据，ACK后继续拉取下一批。 |
| `retention_battle_evidence` | PvP每轮正式结算快照 | 哈希用户＋房间＋轮次；保留35天。只含必要的哈希身份、房间/轮次、得分、主动退出标记和结算时间。 |

`retention_profiles`内只保留今天、本周及仍在领取期的上周聚合；换日/换周在事务中滚动。签到累计次数独立于自然周。用户身份使用与每日挑战一致的单向哈希，不在新增集合中存OPENID或触控轨迹。

## 索引

部署前创建并等待以下索引生效：

- `retention_receipts`：`owner`升序、`acknowledged`升序、`createdAt`升序，用于稳定恢复本人待ACK收据。
- `retention_receipts`：`acknowledged`升序、`acknowledgedAt`升序，用于只清理已ACK旧收据。
- `retention_events.createdAt`单字段索引，用于35天清理。
- `retention_battle_evidence.createdAt`单字段索引，用于35天清理。

其余读取均使用确定性文档ID，不需要组合查询索引。上线环境应以微信云开发控制台实际索引提示复核字段顺序，不能在索引仍构建时开放客户端入口。

## 权限与信任边界

四个集合均设置为客户端不可读、不可写，仅允许云函数服务身份访问。所有动作从`cloud.getWXContext().OPENID`取得身份；请求体内不接收替代身份。

- 服务端北京时间决定签到日、当前周、周截止时间和`state.serverNow`。旧的未确认签到/宝箱请求先按确定性收据编号恢复；确实未确认且已过期才返回`eventStatus:'expired'`。
- 单人模式是明确的有限可信输入：要求`completed:true`、有效操作、合法关卡、当天日期和0..100000消除数；进度在服务端钳至2局/80枚，每天最多持久化82个规范事件。它不用于排行或竞争结算。
- 每日挑战忽略客户端日期及消除数，只接受本人已完成的`daily_runs`，用冻结`daily-v1`核心重放moves，并从`onMatch.removed`累计实际消除数。规范事件编号固定为`daily:<runId>`。
- PvP忽略客户端日期；房间必须通过`retentionEnabled:true`显式加入候选链路。正式结算在原房间事务内写入每人每轮快照，续局覆盖房间状态前必须已成功写入。资格要求本人得分大于0且不是主动退出者。消除数仍是0..100000的有限可信客户端遥测，不从分数反推，也不宣称服务端棋盘回放；每日任务最终只累计到80。规范事件编号固定为`pvp:<roomId>:<roundId>`。
- 无法证明的身份、格式、归属、完成或资格返回稳定错误码及`terminal:true`；暂未达到本周门槛可稍后重试。数据库/事务异常由入口返回可重试的`服务异常`，不得重置或补造进度。

## 定时清理

复用现有battle清理定时入口。集合和索引就绪后，在battle云函数环境变量中设置`RETENTION_CLEANUP_ENABLED=1`；未设置该变量时，旧定时任务只继续清理旧房间与daily记录。启用后新增：

- 删除`createdAt < 当前时间-35天`的`retention_events`和`retention_battle_evidence`；
- 只删除`acknowledged:true`且`acknowledgedAt < 当前时间-35天`的`retention_receipts`；
- 不删除未ACK收据，不定时删除`retention_profiles`。

只有云数据库明确返回“集合不存在”时，留存清理才跳过该集合；权限、配额、网络及其他错误会让定时任务失败并进入监控，不能误报清理成功。正式激活前必须创建集合、更新触发事件并检查清理日志不再出现跳过记录。

## 部署顺序

部署及真实云写入需另行取得用户授权。获批后按以下顺序执行，每步失败即停止，不扩到下一步：

1. 在目标云环境确认备份/导出策略，创建四个集合，设置仅云函数访问，并创建上述索引；索引生效后在battle云函数配置中设置环境变量`RETENTION_CLEANUP_ENABLED=1`，重新部署配置并用一次定时/隔离调用确认留存清理已启用。不得修改现有定时事件结构或依赖未验证的自定义事件字段。
2. 部署含`retention.js`的battle云函数，但客户端留存入口保持关闭；执行只读身份/时间检查及隔离测试账号的签到、记录、宝箱、ACK冒烟。
3. 验证PvP候选房间带`retentionEnabled:true`，结算事务生成两份稳定轮次快照，续局后旧快照不变；未带标志的既有v2房间仍按原逻辑运行。
4. 仅在develop渠道开启真实适配层，验证丢响应重试、跨午夜、钱包保存中断、未ACK恢复及旧daily/PvP回归。不得用本地测试替代微信开发者工具和真机证据。
5. 独立QA接受云端证据后，再单独申请trial/release或正式发布授权。本说明不构成部署、发布或数据采集授权。

## 回滚

优先关闭develop渠道入口及新建房的`retentionEnabled`标志，停止产生新请求和新PvP证据；此操作不删除数据，可恢复。保留当前云函数的查询、ACK及确定性重试动作，让已确认收据完成本地入账和ACK。

若云函数版本本身必须回滚，先确认客户端outbox已停止发送并记录仍未ACK收据数量；不能先删集合或退回不认识留存action的版本，否则会把可恢复奖励变成永久重试。数据集合、索引和未ACK收据保留到问题修复并完成对账。只有在另行批准的数据删除计划、确认无未ACK收据并满足保留要求后，才可删除集合。回滚不逆向扣除已经本地成功应用的金币或锤子。

## 本地证据与未验证项

`node match3-wechat/test/retention-cloud.js`覆盖事务并发、稳定重试、累计签到第7天与新轮、漏签续进度、周结转/到期、solo/daily/PvP身份与资格、旧daily、ACK恢复、持久状态损坏和服务异常不重置。`battle-cloud-function.js`、`battle-rematch.js`、`battle-logic.js`、`daily-cloud.js`、`daily-core.js`用于受影响旧链路回归。

已取得集合/索引/权限、修复版部署、真实SDK签到/任务/恢复及旧daily/PvP接口回归证据，详见上方进度。剩余平台与发布前验收项见真实证据节；没有trial/release或客户端发布。

独立源码/本地行为审阅无开放P1/P2，便携回归为 `retention-qa-client.js`、`retention-qa-routes.js`、`retention-qa-recovery.js`。真实Canvas的320/390完整流程已通过，详情统一见 `project-status/development-steps.md`。普通后台/前台往返保留当前solo/PvP计数；进程完全结束后不重建尚未结算的solo/PvP局。每日挑战沿用已有日志，已结算草稿/outbox/已确认收据可重启恢复。
