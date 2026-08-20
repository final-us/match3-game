# 消消乐双人对战后端（云函数方案）

> 已从 WebSocket（云托管）方案改为**云函数 + 云数据库 + 前端轮询**，免付费、个人开发者可用。

## 为什么用云函数
- 微信云开发（云函数）有**免费额度**，个人主体小程序即可开通，无需企业资质
- 双人对战是「60 秒比分 + 低频道具」，**1 秒轮询延迟无感**
- 量大了再迁云托管/自建 WebSocket（代码 `index.js` 是老的 WebSocket 版，留作升级参考）

## 架构
```
小游戏 A/B  ──wx.cloud.callFunction──►  云函数 battle
    ▲                                      │ 读写
    │ 每 1 秒轮询 query                     ▼
    └───────────────────────  云数据库 battle_rooms 集合
```

## 目录
```
match3-server/
├── index.js                  # 旧 WebSocket 版（备选，暂不用）
├── cloudfunctions/battle/    # ★ 云函数（当前方案）
│   ├── index.js              # 房间管理 + 道具 + 结算
│   ├── package.json          # 依赖 wx-server-sdk
│   └── config.json
└── README.md
```

## 部署步骤（微信开发者工具）

### 1. 创建云数据库集合
1. 微信开发者工具 → 云开发控制台 → **数据库** → 新建集合
2. 集合名：`battle_rooms`
3. 权限选「仅创建者可读写」或自定义（云函数是服务端，不受限）

### 2. 上传云函数
1. 云开发控制台 → **云函数** → 新建云函数
2. 名称：`battle`
3. 上传方式：**本地创建**（在项目目录里右键 cloudfunctions/battle → 上传并部署）
   - 或者直接把 `cloudfunctions/battle/` 里的三个文件内容复制进去
4. 部署（云端安装依赖 wx-server-sdk）

### 3. 环境信息
- 环境 ID：`cloud1-d9g4pv8m8457af92a`

## 前端调用（下一轮改造）
前端需把 `ws-client.js` 替换为云函数调用 + 轮询：

```js
// 初始化云开发
wx.cloud.init({ env: 'cloud1-d9g4pv8m8457af92a' });

// 建房
const res = await wx.cloud.callFunction({
    name: 'battle',
    data: { action: 'create', nickname: '我' }
});
const roomId = res.result.roomId;

// 加入 / 准备 / 报分 / 用道具
wx.cloud.callFunction({ name: 'battle', data: { action: 'join', roomId } });
wx.cloud.callFunction({ name: 'battle', data: { action: 'ready', roomId } });
wx.cloud.callFunction({ name: 'battle', data: { action: 'syncScore', roomId, score } });
wx.cloud.callFunction({ name: 'battle', data: { action: 'useItem', roomId, item: 'freeze' } });

// 轮询（每 1 秒）
setInterval(async () => {
    const r = await wx.cloud.callFunction({ name: 'battle', data: { action: 'query', roomId } });
    const data = r.result; // { status, opp:{score,...}, effects, result, myItems }
}, 1000);
```

## 云函数 action 一览
| action | 说明 |
|--------|------|
| `create` | 建房，返回 roomId |
| `join` | 加入房间 |
| `ready` | 准备（双方就绪 3 秒后开局） |
| `syncScore` | 分数上报 |
| `useItem` | 用道具 freeze/disturb |
| `leave` | 退出 |
| `query` | 轮询房间状态（含结算判断） |

## 参数（cloudfunctions/battle/index.js 顶部）
- 对战 60s、开局倒计时 3s、冰冻 3s、干扰 5s、断线判负 10s
- 道具：开局各送 1 个、每局上限 5 个
