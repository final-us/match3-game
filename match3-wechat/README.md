# 消消乐 · 微信小游戏（第一版）

三消小游戏，原生代码开发（零依赖、零构建），canvas 渲染。
核心算法移植自开源项目 pixi-game-match3（MIT License），功能设计参考 Gem-Match3。

## 项目结构

```
match3-wechat/
├── game.js              # 入口（不要动）
├── game.json            # 小游戏配置（方向/超时等）
├── project.config.json  # 开发者工具项目配置（appid 在这里填）
├── js/
│   ├── main.js          # 主入口：场景管理 + 主循环 + 触摸
│   ├── audio.js         # 音效合成（WebAudio 实时生成，零素材文件）
│   ├── core/            # 核心逻辑（纯算法，无平台依赖）
│   │   ├── grid.js      # 棋盘/匹配/重力/填充算法
│   │   ├── config.js    # 棋子类型配置（改这里换颜色/图标）
│   │   ├── level.js     # 关卡加载（引用 levels/*.js）
│   │   └── game-core.js # 游戏状态机：交换/消除/计分/胜负（异步分步动画）
│   └── render/
│       ├── board-render.js  # 棋盘渲染 + 动画 + 粒子 + 滑动交互
│       └── ui.js            # 主菜单 / 结算页
├── levels/              # 关卡数据（加关卡=加 JS 文件，见下方说明）
│   ├── level1.js
│   ├── level2.js
│   └── level3.js
└── test/                # Node 环境测试脚本（开发用）
    ├── simulate.js      # 单局模拟
    └── winrate.js       # 难度标定（胜率统计）
```

## 如何在微信开发者工具中运行

1. 打开「微信开发者工具」（需先安装：https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html）
2. 登录（用你的微信扫码）
3. 点「导入项目」→ 选择本目录 `match3-wechat`
4. AppID：先选「测试号」，**或**填入你的小游戏 AppID（在 project.config.json 的 `appid` 字段）
5. 导入后点「编译」即可预览

> 注意：若使用测试号，进度存档功能正常但无法真机预览；使用正式 AppID 后可在手机上预览体验。

## 如何换正式 AppID

打开 `project.config.json`，把 `"appid": "touristappid"` 改成你的 AppID 字符串即可。

## 如何加新关卡（数据驱动，不用改代码）

> 注意：微信小游戏不支持 require JSON 文件，所以关卡数据用 `.js` 模块存储，内容就是纯数据，维护方式和 JSON 一样。

1. 在 `levels/` 下新建 `level4.js`，格式参考 level3.js：

```js
// 关卡数据：第 4 关
module.exports = {
  id: 4,
  name: '关卡名称',
  rows: 8,
  columns: 8,
  moveCount: 20,
  goals: [{ type: 'score', target: 8000 }]
};
```

2. 在 `js/core/level.js` 的 `LEVELS` 数组加一行引用即可。

## 如何调难度

跑 `node test/winrate.js` 看各关"随机走棋胜率"：
- 简单关 60-80% | 中等关 30-50% | 挑战关 20-40%（真人玩家会更高）
- 目标太高 → 降低 `target`；步数不够 → 增加 `moveCount`

## 当前版本已包含

- 核心消除玩法（交换/消除/下落/填充/连消，异步分步动画）
- 动画：交换滑动/无效撞墙/消除缩小/下落/新棋子掉落/碎屑粒子
- 音效：WebAudio 合成（交换/消除/掉落/撞墙/胜利/失败）
- 果冻（消除破层，棋子保留）与冰块（相邻波及融化）障碍
- 特殊棋子：4连横→横火箭、4连竖→竖火箭、5连→炸弹（交换或波及触发，可连锁）
- 3 个关卡（难度梯度：纯分 → 果冻 → 果冻+冰块+特殊）
- 目标系统（分数/果冻多目标）
- 主菜单 / 结算页（胜利解锁下一关）+ 本地进度存档

## 待后续版本（见《三消小游戏功能补充方案》）

- 体力系统、激励视频广告（复活/补体力）
- 金币商店、局外道具
- 关卡地图、分享裂变、排行榜、转盘活动
- 正式美术素材替换（当前为色块+emoji 占位）、音效素材替换
- 体力系统、激励视频广告、Banner
- 关卡地图、商店、道具、活动
