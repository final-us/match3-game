# 猫猫开心消（微信小游戏）

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

授权与素材合规记录见 [`docs/release/open-source-and-assets.md`](docs/release/open-source-and-assets.md)；小游戏主包第三方通知见 [`match3-wechat/THIRD_PARTY_NOTICES.txt`](match3-wechat/THIRD_PARTY_NOTICES.txt)。

## 功能清单

- 单人闯关：20 关（果冻/冰块障碍、特殊棋子、三星评分）
- 经济系统：体力 + 金币 + 商店道具（锤子/炸弹/换色）
- 变现：激励视频（无限次复活/补体力）+ 单人结算插屏；流量主未开通前默认关闭并隐藏入口
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

首次运行包含 SDK 兼容检查的测试前，先在 `match3-wechat/cloudfunctions/battle/` 执行 `npm ci --ignore-scripts` 安装锁定的云函数依赖。

```bash
cd match3-wechat
node test/simulate.js      # 逻辑回归
node test/winrate.js       # 关卡难度标定
node test/audio.js         # 音乐/音效设置与生命周期
node test/runtime.js       # 更新、错误与隐私入口
node test/commercialization.js
node test/ui-smoke.js
node test/package-budget.js # 运行时素材尺寸、忽略规则与包体预算
node test/open-source-and-assets.js
```

运行时棋子使用 `res/piece1-runtime.png` 至 `res/piece5-runtime.png`（256×256 透明 PNG）；`piece1-v2.png` 至 `piece5-v2.png` 保留为 512×512 源图但不进入小游戏包体。完整忽略规则与体积快照见 `docs/release/package-structure.md`。

## 上线可靠性与隐私

- `match3-wechat/js/core/runtime.js` 负责微信更新、错误分类和官方隐私说明入口；上报默认关闭，详见 `docs/release/privacy.md`。
- 运营主体名称、联系方式和平台隐私合同内容必须由用户在微信公众平台填写，发布前不得保留占位信息或自行编造。

## 环境

- AppID：wxbb9c6873719cd2b3
- 云开发环境 ID：cloud1-d9g4pv8m8457af92a
