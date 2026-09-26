# 图鉴样板素材来源

采用范围：开发阶段图鉴样板的四只猫咪画面。用户明确接受v8并授权开始实现。角色为奶糖（英短）、团子（布偶）、芝麻（暹罗）、布丁（圆脸短毛三花、正面趴卧）。三花为毛色描述。

- 来源：本任务内置ImageGen原创生成/定向编辑，接受稿 `assets/_incoming/cat-catalog-v1/catalog-concept-v8-round-calico.png`。最后原始工具输出为 `exec-44e93d67-c668-43fa-9b6b-24eb93afec22.png`；图像模型内部版本、种子和实际费用未由工具披露，不编造。
- 原始规格与提示：同目录 `concept-brief.md`、`concept-v8-round-calico-prompt.txt` 和各次定向修改说明；编辑仅引用本任务已生成图片，未上传私人照片或项目代码。
- 用户接受：在v8之后明确“可以，就按这版吧”；随后“开始吧”授权本阶段实现。完整运行页面仍待用户视觉验收。
- 处理：`node tools/prepare-catalog-assets.cjs`读取接受稿，利用本地Canvas截取四块可见插画并组合为700×776 JPEG、质量0.84；未重绘猫咪。输出 `match3-wechat/res/catalog/portraits-atlas.jpg`，102460字节。没有新生成调用或新增外部服务。
- 使用：注册键 `catalogPortraits`。图集仅含四块插画；动态文本、按钮、卡片边框和状态由Canvas独立绘制，背景复用现有homeBackground。图集不能冒充20张独立成长原画，不能用整张概念UI充当交互界面。
- 技术核对：真实Main运行截图检查四猫、原生控件和三档尺寸；具体包体/交互证据统一在 `project-status/development-steps.md`，不在此重复。
- 权利边界：沿用项目内置生成素材的处理方式与[OpenAI使用条款](https://openai.com/policies/terms-of-use/)。未重新核实账户特有条款，不作独占性或权利保证，不改变项目默认版权。此来源记录不构成部署或发布批准。

原始候选与提示保留在Git忽略的 `assets/_incoming/`；不自动提交或上传。未接受旧版本不作为运行素材。

## 图鉴入口图标修订（2026-09-24）

用户要求重新设计入口图标；新增内置ImageGen生成的淡紫色猫耳收藏册，奶油猫爪、珍珠边沿与书签。原始输出 `exec-74e0683f-f5c3-4e00-8241-f075565ef48a.png`，保留为 `assets/_incoming/cat-catalog-v1/catalog-icon-v1.png`（1254×1254）；提示为同目录 `catalog-icon-v1-prompt.txt`。本次无参考图上传、无外部创作服务；工具未披露内部模型版本、种子和实际费用。

`node tools/prepare-catalog-icon.cjs` 使用本地Canvas高质量缩放至160×160透明PNG，输出 `res/home/catalog-album.png`（37859字节），注册为 `catalogIcon`，首页44×44槽位使用。真实alpha检查通过，12376个全透明像素；44px浅色/深色背景边缘证据为 `catalog-icon-44px-alpha-proof.png`，没有去背或重绘。列表底板、详情内衬及淡紫按钮为原生Canvas，不是新增生成背景。原四猫图集不变。集成后的新图标与页面视觉待用户验收；权利边界沿用上文。

## 奶糖成长原画（2026-09-24）

用户已接受第二阶段「熟悉」原画，源 `assets/_incoming/cat-growth-naitang-v1/naitang-stage-2-familiar-v1.png`（1254×1254）。内置ImageGen以已接受v8概念左上奶糖为角色身份参考生成，原始输出 `exec-59b15f65-3105-4577-a3ea-4b3149cc1582.png`；提示和来源保存在该目录。不是年龄增长：圆脸、毛色与月夜场景保持，姿态为伏低伸爪。

`node tools/prepare-catalog-growth.cjs`等比例缩小完整构图至512×512 JPEG质量0.84，50642字节，输出 `res/catalog/naitang-familiar.jpg`，注册为 `catalogNaitangFamiliar`。奶糖的升级弹窗、详情、回顾及选择后的图鉴卡片复用该图；可切回初见且不减少亲密度。不覆盖其他猫，不新增第三/四只规则。无外部创作API、照片/代码上传或模型切换；费用/种子未由工具披露。运行与包体证据见当前任务条目。

2026-09-25，用户接受第三「信任」及第四「依恋」/第五「挚友」，三张均已集成。源图1254×1254，完整保留在同一incoming目录，原始输出/参考/提示见该目录README。`prepare-catalog-growth.cjs`支持阶段2–5，仍按512×512 JPEG质量0.84等比处理，不裁切或重绘。

| 阶段 | 运行文件（相对res/catalog） | 注册键 | 字节 |
| --- | --- | --- | --- |
| 信任 | naitang-trust.jpg | catalogNaitangTrust | 52149 |
| 依恋 | naitang-attachment.jpg | catalogNaitangAttachment | 52194 |
| 挚友 | naitang-best-friend.jpg | catalogNaitangBestFriend | 53058 |

当时只做已接受图片的本地转换与Canvas动效，无新生成、上传或付费调用。动效后续按用户要求改为奶糖头部/胸腹局部网格及星光，外部背景锚定；未重新生成动画资产或增加帧图集；奶糖五阶段完整，其他猫仍只有初见。仅develop内存样板，未部署/发布；完整20张资产仍未完成。

## 全阶段补图与静态回退（2026-09-25）

用户明确先恢复原画、动画留到下一版本，并要求完成所有原画。当前运行只绘制静态图，此前局部网格与粒子已归档并移出主包。奶糖五阶段及原四猫初见保持不变。

新增12张来自本任务内置ImageGen，每图一次，均1254×1254：`assets/_incoming/cat-growth-complete-v1/{tuanzi,zhima,buding}-stage-{2..5}-v1.png`。参考1是已接受v8概念中对应猫；阶段3–5另用同猫本轮阶段2作为身份/渲染参考，不等于该候选已被用户接受。完整提示、来源文件、参考范围逐张记录于该目录 `provenance.json` 与 `*-full-prompt.txt`。无CLI/外部创作服务、新购买、代码或私人照片上传；实际模型版本/费用/种子未知。

主任务已目视全部输出。团子保留蓝眼、倒V面纹与长毛胸围；芝麻保留重点色、大耳与修长体态；布丁保留圆脸、白鼻梁与原左右橘黑面纹。用户随后以“可以，推进部署”接受12张，并选择A原生子包；已由`prepare-catalog-growth.cjs --all-other`完整等比缩放为512×512 JPEG质量0.84，注册在`CATALOG_ASSETS`，路径`catalog/{tuanzi,zhima,buding}-{familiar,trust,attachment,best-friend}.jpg`。原图/提示留在incoming，运行派生图进入独立catalog子包。`tools/preview-cat-art.cjs`提供20阶段本地对照与放大；四张初见仍为原图集区域。完整来源记录不构成部署或发布授权。

## 原生图鉴子包（2026-09-25）

12张新图总计685001字节；`catalog/game.js`为微信子包入口。现有图集、奶糖4张、图标仍在主包；进入图鉴按需`wx.loadSubpackage`，全部解码后显示。加载失败、20秒超时可重试，返回不被迟到回调重新打开。没有新增云存储/云函数/SDK。所有图片为静态，完整构图等比居中，领养与成长仍是develop内存样板。实际包体/平台/上传记录见[`catalog-activation.md`](../release/catalog-activation.md)。
