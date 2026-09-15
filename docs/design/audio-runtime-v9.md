# 原创音频运行规范 V9

状态：2026-09-15追加采用Mixkit Magic wand sparkle用于横/竖特殊棋子触发（rocket），Christmas reveal tones用于win；四枚成线生成音fourClear不变。用户确认Freesound冰裂压缩预览1.1–1.7秒与Mixkit Fairy arcade sparkle普通/升调连消正式采用；四连生成音A保持。当前21cue已接入，两项新声音真机听感尚待验证。含Mixkit精灵只能作为本地发布资产，不得随公开源码分发。

## 运行资源

| 文件 | 内容 | 运行参数 | 字节 | SHA256 |
| --- | --- | --- | ---: | --- |
| `res/audio/calm.mp3` | ElevenLabs `music_v1` 的 `calm-b-kalimba-waltz`，用户确认 | 48.065s、22050 Hz、单声道、24 kbps MP3 | 144,196 | `7665e8961c71f0d079555dcbf4a0ea0deb984cc4f3f11d53c567c29173650236` |
| `res/audio/battle.mp3` | ElevenLabs `music_v1` 的 `battle-d-lantern-waltz`，用户确认 | 48.065s、22050 Hz、单声道、24 kbps MP3 | 144,196 | `902e36eea70fab4d76785ae378c5d2a8b74c5fed24c16a7cebb06344737ebfe1` |
| `res/audio/sfx-acoustic.mp3` | 21 个 cue；新rocket/win，其余19cue保留 | 15.255510s、22050 Hz、单声道、32 kbps MP3 | 61,022 | `dffb3257a79902f517013afdf09597fc13e36ba4e92e095d74444c542521337e` |

双 BGM 加音效精灵共 349,414 bytes。未压缩 PCM 阶段两首 BGM 峰值 0.86，音效精灵峰值 0.72，全部无削波。精确 cue offset/duration 由 `js/sfx-acoustic-map.js` 维护。

## 已批准内容

- 舒缓场景：`calm-b-kalimba-waltz`。
- PvP：`battle-d-lantern-waltz`。
- 新声音方向：`click1`、`clear`、`combo`；其余常规 cue 依照同一温暖、圆润、自然拟音语言生成和裁剪。
- 保留原版：`bomb`（animationIsaac CC0）。`rocket`改为Mixkit Magic wand sparkle，Kinoton旧声仅归档。旧`specialCombo`（qubodup CC0）已无运行调用，本轮从精灵移除并保留归档。
- `click2`、`click3` 从已批准 `click1` 本地轻微速率变化派生，不额外调用供应商。
- 四枚成线采用Berklee的Shimmer glitter magic（CC BY 3.0），用户于2026-09-14选A。来源https://opengameart.org/content/shimmer-glitter-magic ，归档https://archive.org/details/Berklee44v13 。署名、许可链接、改编说明及不限制素材许可权利的声明位于随包THIRD_PARTY_NOTICES.txt；不暗示作者背书，不将整个项目改为CC许可。
- 当前精灵从上一版无损母版重新拼接，只替换rocket/win，其余19cue的PCM内容保留；含已确认clear/ice/fourClear。所有offset补偿1105帧编码延迟，实际解码相关性校验lag0；fourClear offset14.513968、duration0.658367，映射以js/sfx-acoustic-map.js为准。

## 供应商与加工

- ElevenLabs Starter；模型 `music_v1` 与 `eleven_text_to_sound_v2`。
- 只发送原创文字描述，没有上传项目文件或参考素材。
- 2026-09-09 至 2026-09-10 三轮候选与最终补齐公开价格估算累计约 CNY 7.59，低于 CNY 50 授权上限。
- 原始输出、完整提示、参数、请求记录、哈希、费用和选择历史位于 `assets/_incoming/audio-elevenlabs-20260909-match3-v9-pilot/`，不在小游戏包目录。
- 本地处理包含 MP3 解码、单声道下混、去头部静音、裁剪、短淡入淡出、峰值配平、22050 Hz 重采样、BGM 循环交叉淡化、音效精灵拼接和 MP3 编码。
- 临时离线工具 `mpg123-decoder 1.0.3`（MIT）与 `wasm-media-encoders 0.7.0`（MIT）只安装在 `/private/tmp`，不是项目依赖，也不进入仓库或发布包。

## 运行规则

- 单人/PvP成功交换（onSwap）只播放交换动画，不触发swap音效；保留动画Promise和无效交换提示音。保留swap历史采样及兼容接口，不重打包音频。
- 单人/PvP补棋（onFill）只播放补棋动画，不触发drop音效，避免与1.497秒消除尾音重叠；保留drop采样和兼容接口，不为这一小改动重新压缩精灵。
- `InnerAudioContext` 播放本地 BGM；失败时回退原 WebAudio 程序化旋律。
- 音效共用一次文件读取和一次 WebAudio 解码，最多 12 声并发；解码失败时回退程序化短音。
- 普通消除使用完整1.497秒clear；2–6连共用该采样，playbackRate=2^(半音/12)，半音依次2/4/5/7/9，6连以上封顶，回到普通消除恢复原速。取消旧增益/重复叠层；source.start的duration维持源片段长度，不能再除速率。最多12声并发，异常沿用回退。
- 特殊棋子生成时仅保留该次普通消除/连消音，不额外播放火箭、炸弹或彩球触发音；真正触发时才播放对应特殊音效（2026-09-14重复音修复）。
- 四枚成线（本轮generated含横/竖火箭）以一次fourClear替代本轮普通消除/连消主音和叠层，不提前播放火箭爆发音；多条四连同轮只响一次。仅combo计数为4不得触发。资源失败则沿用既有消除回退。
- 同次match触发至少两个特殊棋子时，沿用当前代码的前两个特殊类别同时播放并去重规则，优先于四连；本次不更改该组合逻辑。
- 胜负音效短暂把 BGM 压低 15% 约 0.6 秒；其他音效不 duck。
- 音乐和音效独立控制，后台隐藏及音频中断时暂停。

## 待验收

- 微信开发者工具确认三个 MP3 可加载、首触解锁、场景切换与后台恢复正常。
- iOS 与鸿蒙分别完成单人和 PvP：普通消除、2–6 连、三种单特殊、特殊组合、障碍、道具、胜负和关闭音效。
- 连续播放检查 BGM 循环接缝与疲劳度；如接缝明显，只调整循环窗口，不重新调用供应商。

## 用户验收

- 2026-09-10：用户确认最终 22 cue 试听带并决定“就定这一套”。
- 冻结组合：舒缓 B、PvP D、新点击/消除/连消及补齐的常规事件；火箭、炸弹、特殊组合保留原版。
- 后续仅允许因开发者工具或真机发现的明确播放、响度、循环或性能问题做针对性修复；不再主动更换声音方向。

## 2026-09-15 采用来源与公开仓库隔离

- Ice cracking — timbreknight，https://freesound.org/people/timbreknight/sounds/342546/ ，CC0 1.0。用户明确接受公开压缩预览，不再要求原始WAV；准确截取1.1–1.7秒，0.600秒；仅下混和边缘淡入淡出，不变调/滤波/叠加。
- Fairy arcade sparkle — Mixkit ID866，https://mixkit.co/free-sound-effects/sparkle/ ，https://mixkit.co/license/#sfxFree 。允许商业游戏终端作品，禁止随源码分发；原音/派生试听/母版及含该声的MP3均gitignore。不能因源码缺少音频就把合成回退视为通过，克隆后须由项目持有人恢复合法本地副本。
- 初批构建脚本、源哈希及处理记录：assets/_incoming/selected-sfx-20260915/build-runtime.mjs 与runtime-provenance.json。旧临时WASM编码器不存在，本轮用已安装FFmpeg7.1/libmp3lame，32kbps/22050Hz/mono，无Xing；解码峰值0.700269，cue均未越界，编码延迟对应相关系数0.82629。
- 冰裂与连消升调已获用户听感确认；横竖触发/通关新声见build-rocket-win.mjs和rocket-win/provenance.json。官方下载WAV，保留2.5秒/3.026984秒全文、仅下混/重采样及2ms/8ms边缘淡化；无新费用、变调或叠加。解码峰值0.694672；SFX预算改64KiB，主包4MiB上限不变。新声需真机验收。本轮未发布、上传或Git提交。真机须确认普通→6连音调升高、回合重置、冰裂、四连保持、特殊优先和密集触发尾音，特别是鸿蒙playbackRate兼容性。
