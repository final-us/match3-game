# 猫猫开心消 · 微信小游戏

三消小游戏，原生代码开发（零依赖、零构建），canvas 渲染。
核心棋盘算法采用 [pixi-game-match3](https://github.com/xiaozhu188/pixi-game-match3) 的 `src/match3/Match3Utility.ts`（采用提交 `658679250f30ef8d01ff570eb976017c5727cbf0`）并做本地微信小游戏适配；上游 MIT 文本与本地修改摘要见 [`THIRD_PARTY_NOTICES.txt`](THIRD_PARTY_NOTICES.txt)。本项目本身未添加开源许可证，保留默认版权。

## 项目结构

```
match3-wechat/
├── game.js              # 入口（不要动）
├── game.json            # 小游戏配置（方向/超时等）
├── project.config.json  # 开发者工具项目配置（appid 在这里填）
├── js/
│   ├── main.js          # 主入口：场景管理 + 主循环 + 触摸
│   ├── audio.js         # 本地 AAC BGM + WebAudio 音效与故障回退
│   ├── core/            # 核心逻辑（纯算法，无平台依赖）
│   │   ├── grid.js      # 棋盘/匹配/重力/填充算法
│   │   ├── config.js    # 棋子类型配置（改这里换颜色/图标）
│   │   ├── level.js     # 确定性无限关卡生成器
│   │   └── game-core.js # 游戏状态机：交换/消除/计分/胜负（异步分步动画）
│   └── render/
│       ├── board-render.js  # 棋盘渲染 + 动画 + 粒子 + 滑动交互
│       └── ui.js            # 主菜单 / 结算页
├── levels/              # 旧 20 关标定样本（已从客户端包排除）
│   ├── level1.js
│   ├── ...
│   └── level20.js
└── test/                # Node 环境测试脚本（开发用）
    ├── simulate.js      # 单局模拟
    └── winrate.js       # 难度标定（胜率统计）
```

首次运行包含 SDK 兼容检查的测试前，先在 `cloudfunctions/battle/` 执行 `npm ci --ignore-scripts` 安装锁定依赖。包体资源检查：`node test/package-budget.js`；授权与素材合规检查：`node test/open-source-and-assets.js`。运行时棋子使用 `res/piece1-runtime.png` 至 `res/piece5-runtime.png`（256×256 透明 PNG）；`piece1-v2.png` 至 `piece5-v2.png` 仅作为 512×512 源图保留。

## 如何在微信开发者工具中运行

1. 打开「微信开发者工具」（需先安装：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html）
2. 登录（用你的微信扫码）
3. 点「导入项目」→ 选择本目录 `match3-wechat`
4. 使用 `project.config.json` 中配置的小游戏 AppID 导入项目；切换项目时按下方说明替换 `appid`
5. 导入后点「编译」即可预览

> 注意：云开发、真机和发布验证需使用与项目匹配的小游戏 AppID。

## 如何配置 AppID

`project.config.json` 已配置当前项目的小游戏 AppID。切换项目时，将其中的 `appid` 替换为目标小游戏 AppID，并使用对应环境完成开发者工具和真机验证。

## 无限关卡如何生成

- `js/core/level.js` 是唯一运行时关卡源：输入关卡号后，根据固定 `generatorVersion`、胜率档位和障碍模板生成配置。
- 同一生成器版本下重复进入同一关，名称、目标、步数、限时和障碍布局保持一致；初始棋盘和掉落棋子仍会随机变化。
- 地图每屏显示连续 5 关，通关后持续向深处延伸，不设置最终关卡。
- `levels/level1.js` 至 `level20.js` 只保留为旧难度标定样本，并由 `project.config.json` 排除，不参与运行和打包。
- 修改生成规则后必须同步更新 `GENERATOR_VERSION`，并执行 `node test/infinite-levels.js` 与 `node test/winrate.js`。

## 如何调难度

跑 `node test/winrate.js` 检查第 1–40 关和远端一个完整周期的固定种子“随机合法走棋胜率”；脚本会同时模拟 `timeLimitSec`：
- 回归容差为目标胜率上下 12 个百分点；该模拟只用于工程标定，不代表真人通过率。
- 目标太高 → 提高目标或减少步数；目标太低 → 降低目标或增加步数；超时偏多 → 增加 `timeLimitSec`。
- 当前完整曲线、限时分段、连败助力和版本规则见 `../docs/design/level-difficulty-v3.md`。

## 当前版本已包含

- 核心消除玩法（交换/消除/下落/填充/连消，异步分步动画）
- 动画：交换滑动/无效撞墙/消除缩小/下落/新棋子掉落/碎屑粒子
- 音频：Dylann Taylor 的 PLAYFUL PIANO CC0 本地 AAC 循环（舒缓/PvP）+ WebAudio 音效与 BGM 故障回退；音乐与音效可独立关闭
- 果冻（消除破层，棋子保留）与冰块（相邻波及融化）障碍
- 特殊棋子：4连横→横火箭、4连竖→竖火箭、5连→炸弹（交换或波及触发，可连锁）
- 确定性无限关卡（纯分、果冻、冰块与组合目标）+ 分段限时 + 两档连败助力
- 目标系统（分数/果冻多目标）
- 主菜单 / 结算页（胜利解锁下一关）+ 本地进度存档
- 体力、金币、商店和局外道具
- 商业化适配层（激励视频复活/补体力 + 单人结算插屏；当前总开关关闭、广告位 ID 留空）
- 匿名本地商业事件缓冲（最多 200 条、保留 7 天，不上传身份信息）
- 首页、单人和 PvP 核心漏斗事件（低敏白名单、本地保存、远端默认关闭）
- 零图片的一次性情境引导（单人操作/特殊棋子/障碍/道具/PvP 配装，可跳过）
- 上线可靠性适配（全局错误分类、非对局更新提示、微信官方隐私合同入口；远程上报默认关闭）
- 微信云开发双人对战（好友邀请、准备、倒计时、比分与结算）
- PvP 服务端事务建房限流（每分钟 5 次、每 UTC 日 60 次）
- 月夜猫咪花园首页、透视关卡小路、统一 HUD/道具/结算与特殊棋子动态效果

## 上线前仍需完成

- 完成测试云环境的双账号 PvP 真机回归（`battle` 已部署，`battle_rooms` 已限制为仅服务端访问）
- 开通流量主后配置激励视频与插屏广告位，并按 `../docs/release/monetization.md` 做真机回归
- 在公众平台配置匿名事件映射、运营主体信息与隐私合同，并完成更新/隐私真机回归
- 完成音频真机试听调优及剩余页面视觉统一
- 发布前复核[开源与素材合规台账](../docs/release/open-source-and-assets.md)，确认生成账户适用条款和原始记录；云函数传递依赖中的未声明许可证项已登记为厂商依赖例外，不再作为技术阻断项，但仍保留合规风险
