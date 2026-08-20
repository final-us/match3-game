# 消消乐小游戏（微信小游戏）

一个完整的微信小游戏「三消消消乐」项目，含单人闯关 + 双人实时对战。

## 项目结构

```
match3-game/
├── match3-wechat/              # 微信小游戏（前端）
│   ├── game.js / game.json     # 小游戏入口与配置
│   ├── js/
│   │   ├── main.js             # 场景管理（菜单/关卡/商店/对战）
│   │   ├── core/               # 逻辑层（消除/关卡/体力/金币/道具/分享）
│   │   ├── render/             # 渲染层（棋盘/UI/主题/素材/对战UI）
│   │   └── net/                # 网络层（云函数对战客户端）
│   ├── levels/                 # 关卡数据（level1-20.js）
│   ├── res/                    # UI 素材（猫咪风格）
│   ├── cloudfunctions/battle/  # 云函数（双人对战后端）
│   ├── test/                   # 单元测试
│   └── tools/                  # 关卡生成脚本
└── match3-server/              # 双人对战后端（备选 WebSocket 版）
```

## 功能清单

- 单人闯关：20 关（果冻/冰块障碍、特殊棋子、三星评分）
- 经济系统：体力 + 金币 + 商店道具（锤子/炸弹/换色）
- 变现：激励视频广告（复活/补心）+ 分享裂变
- 双人对战：微信好友邀请、60 秒比分、冰冻/干扰道具（云函数 + 云数据库）

## 技术栈

- 前端：原生 Canvas 2D（无框架），微信小游戏 API
- 后端：微信云开发（云函数 `battle` + 云数据库 `battle_rooms`）
- 对战备选：`match3-server/`（Node.js + WebSocket，云托管版）

## 快速开始

1. 用微信开发者工具打开 `match3-wechat` 目录
2. 配置云开发环境（详见 `match3-server/README.md`）
3. 编译运行

## 测试

```bash
cd match3-wechat
node test/simulate.js      # 逻辑回归
node test/winrate.js       # 关卡难度标定
```

## 环境

- AppID：wxbb9c6873719cd2b3
- 云开发环境 ID：cloud1-d9g4pv8m8457af92a
