# 当前任务：横竖特殊触发与通关音替换 · 2026-09-15

- 最新改动：用户“去除吧”仅确认取消成功交换音；main.js单人/PvP的onSwap均仅返回animateSwap，保留无效交换提示音、交换动画与Promise，未修改音频素材或其他声音规则。扩展既有test/audio.js补棋用例覆盖两模式交换静音、动画参数/返回值和invalid提示保留；新增断言修改前失败（solo仍有1个source），修改后21项音频回归全通过，两文件node --check及git diff --check通过。独立复核PASS（既有审核代理01a0a078-7aad-77d3-b7a3-dcb20bd81bf6，只读检查两入口与测试，未重复命令）；回归使用BoardStub验证绑定，不覆盖真实renderer内部，renderer本次未变。微信重新编译后的听感待用户验收。未提交或上传。
- 叠音诊断保留：两处onFill均无drop；移除前swap0.24s与交换动画等待0.22s后的clear重叠0.02s。既有音频桩确认纯普通match仅clear；101/102/103/104单特殊match仍分别为clear+rocket/rocket/bomb/color，双特殊为rocket+bomb无clear。单特殊混普通音本次未获修改授权，待另行确认；不能将用户听到的掉落声唯一归因于swap，也不能排除旧包或clear自身音色/连消尾音。

- 最新补充：用户批准取消普通消除后额外补棋音；`main.js`单人startGame和PvP startBattleBoard的onFill均仅返回animateFill，不再调用AudioFX.drop。保留动画Promise、音效接口/drop历史采样、所有已确认音色与升调/障碍/特殊逻辑；不重打包、不改变音频字节。
- 补棋修复证据：`test/audio.js`新增真实Main回调接线测试（渲染桩、平台音频桩，不构造应用/真实消费体力），修改前clear+drop断言失败，修改后两模式clear唯一、无合成、补棋参数/次数/返回Promise全通过。音频回归21项、main/test语法、针对性diff检查PASS。先前音频解码/许可/PCM/浏览器素材证据因音频及audio.js/map未变而复用；不以桩测试代替真机听感。既有Aristotle独立只读复核PASS，两模式onFill动画返回及无附加发声范围无发现；未独立测真实设备BoardRenderer调度。未提交/推送/上传。

- Owner：体验/美术音频集成；状态：`integrated_verified_pending_device`。用户确认冰裂/连消升调满意；选择Mixkit候选1 Magic wand sparkle用于横/竖特殊棋子被触发消除（rocket），Christmas reveal tones用于win。fourClear是四枚成线生成音，不在本次替换范围；BGM、组合播放逻辑、其他音效不改。
- 本地运行精灵：21cue、61,022bytes，SHA256 `dffb3257a79902f517013afdf09597fc13e36ba4e92e095d74444c542521337e`；15.255510秒/22050Hz/mono/32kbps。官方WAV完整2.5秒/3.026984秒，只有下混、重采样、2ms/8ms边缘淡化；其余19cue从上一无损母版逐样本保留，不重复有损转码原片段。旧完整母版/MP3留存可回退。
- 证据：`assets/_incoming/selected-sfx-20260915/build-rocket-win.mjs`、`rocket-win/provenance.json`维护来源URL/哈希/授权/免费费用/处理/输入输出及编码延迟。实际解码无非有限值/削波，峰值0.694672；clear/ice/rocket/win/fourClear均lag0、corr>0.82，cue边界合法，运行map与构建输出一致。
- 验证：20项音频回归、素材合规、包体、diff检查通过；Chrome152真实OfflineAudioContext 11场景PASS（普通→6连、生成四连+冰裂、组合优先、横向、竖向、通关），无合成回退、无静音/削波，长音按完整duration渲染。当前静态主包3,836,139 / 4,194,304bytes，57文件；新完整尾音增加14,838bytes，因此内部SFX预算48→64KiB，4MiB总预算保持。不是微信上传后的实际包体证明。
- 许可：复用已核验Mixkit Sound Effects Free License，官方3062/2988 WAV已成功下载，未调用生成供应商。所有源/派生音频及运行MP3继续gitignore，不随公开源码分发；随包notice、运行规范、发布台账、客户端README及合规断言已同步。没有Git提交/推送/微信上传。
- 独立复核：既有Aristotle只读代码/证据复核PASS；生成/触发区分、横竖specialTriggered、win、完整duration、组合优先、升调、映射及Git隔离均未发现缺陷。复用当前配置，未要求切换模型或重复通过命令；不等同真机/主观听审。
- 剩余：用户在微信开发者工具/iOS/鸿蒙确认两项新声、横竖触发及组合时2.5秒尾音是否过长。真实浏览器技术检查不代表真机听感。临时本地验证服务已关闭。权威记录已覆盖本次决策，不重复写 transient 记忆候选。
- 新增诊断（用户只要求检查，未改运行代码/音频）：普通消除后有独立drop补棋音。使用既有test/audio.js桩与真实GameCore/AudioFX构造无障碍/无特殊的单次三消，按renderer的200ms消除+260ms重力推进虚拟时钟，观察clear在0秒播放1.497097秒、drop在0.46秒播放0.14秒，实际发声调用共2次且oscillatorCount=0，证明两段会重叠，并非此次路径重复clear或合成回退。单人main.js:273与PvP:794均onFill调用drop；四枚成线仍另用fourClear替换主音。此诊断非真机录音，不能唯一确定用户听到的声音；建议确认后取消补棋drop触发，保留已确认clear/升调及真实障碍反馈。

## 前批：冰裂与普通消除/连消正式接入 · 2026-09-15

- Owner：体验/美术音频集成；状态：`integrated_verified_pending_device`。用户已确认试听可采用，并明确冰裂使用公开压缩预览即可，不再要求原始WAV。四连A、BGM、其余正在使用的特殊/道具/提示声音保留。
- 运行结果：`match3-wechat/res/audio/sfx-acoustic.mp3`共21cue、46,184bytes，SHA256 `f9fb5f45804839d6f1add947844d8c8f167a22d242cf80e531d1d9fa30eae6d6`。消除完整1.497秒，2–6连共用clear以+2/+4/+5/+7/+9半音播放速率升调，不加增益或重复叠层；超过6封顶，下次普通恢复1倍。冰裂取1.1–1.7秒恰好0.6秒。删除旧combo与无调用specialCombo的打包采样，均有旧归档可回退；其他19cue无损PCM保留。
- 资源证据：selected-sfx-20260915/build-runtime.mjs及runtime-provenance.json。旧WASM临时编码器缺失后改用已有FFmpeg7.1/libmp3lame；无付费/新依赖。22050Hz/mono/32kbps，实际解码11.546122秒，峰值0.700269且无削波，全部cue边界合法；1105帧编码延迟与新clear交叉相关验证lag0/corr0.82629。
- 代码与验证：worker沿用gpt-5.6-luna/max，仅修改audio.js和test/audio.js；20项回归及两文件语法通过（含速率、封顶重置、缺失/抛错回退、声部释放、特殊/障碍/静音）。主代理独立审阅该修改，并用当前audio.js/map/MP3在Chrome152真实OfflineAudioContext验证8场景全部PASS，包含消除1..6、四连+冰裂和特殊组合优先，无静音/削波/合成回退；实际生效率1/1.122462/1.259921/1.334840/1.498307/1.681793。测试页browser-audio-check.html；首次测试在渲染前读AudioParam.value导致断言失败，改为渲染后读取后通过，非生产修复。
- 发布/许可证据：素材合规、Git隔离、包体与diff空白检查通过。静态主包3,820,324 / 4,194,304bytes（57文件）；SFX46,184 / 49,152bytes。Mixkit允许商业游戏终端作品但不允许随源码分发；根.gitignore排除运行MP3，局部.gitignore排除原始与所有派生音频；git ls-files确认运行MP3未跟踪。THIRD_PARTY_NOTICES、运行规范、发布台账、客户端README均注明来源与合法本地恢复流程，不能强制提交音频。
- 剩余：用户微信开发者工具/iOS/鸿蒙确认普通→6连的升调与重置、冰裂片段、四连保持、特殊组合优先和密集触发尾音。浏览器技术通过不代表真机听审；未重新制作、不再等待原始WAV，未Git提交/推送/微信上传。权威源码/记录已覆盖学习，不重复写记忆候选。

## 前批：四连A已接入 · 2026-09-14

- 独立复核补录：Aristotle只读静态复核PASS；四枚成线/第4次连消区分、特殊优先、生成不提前响火箭、cue边界及相关测试覆盖均无具体缺陷；未做真机/听审，也未重复跑已有证据。

- 最新状态：`accepted_a_integrated_waiting_device_acceptance`。用户选定A“Shimmer glitter magic”作为四连消除音效，已接入单人/PvP共用的四枚成线事件；B未采用。熊猫办公bulingbuling仅作已选音色参考，不下载/改造入包。
- 当前运行资源：`match3-wechat/res/audio/sfx-acoustic.mp3`保留旧22 cue并追加`fourClear`，共23 cue，46,498 bytes，SHA256 `e4e4d593479fe393a30f7574a6ca1539e9ec4d25de627696ef78235d608686bf`。A仅重采样/编码，运行offset补偿约50ms MP3解码延迟，未变调、增益或裁剪。
- 证据与授权：A原FLAC SHA256 `b6802e6ef22189058a4406ae5c7bda9a54c47e908fad3fd6212650c1aa0170af`，Berklee/OGA与归档均核验CC BY 3.0；署名、许可链接和改编说明已写入随包`match3-wechat/THIRD_PARTY_NOTICES.txt`。构建记录与候选保留在同目录README及provenance.json。
- 许可：两者OpenGameArt页面均CC BY 3.0；A原Berklee归档同许可，B官方About明确允许商业内容复用及指定署名。CC官网确认可商业复制/改编/分发，要求署名、许可链接、标注改编且不可加限制许可权利的措施。将来采用需落实致谢/notice与分发条款，非开源整个游戏的要求。
- 技术证据：两FLAC下载/解码成功，44.1kHz/24bit WAV；A单声道、峰值0.708，B双声道、峰值0.312，有限值/非静音/无数字削波。没有直接听觉判断声明；无新生成、费用、上传、提交或游戏变更。不重复运行无影响的客户端测试。
- 下一步：用户在微信开发者工具和真机确认四连听感及触发；冰裂、连消仍待处理。无需继续向熊猫客服询问。未Git提交、推送或微信上传。

## 历史：熊猫音色参考与授权核验

- 最新状态：`reference_selected_rights_unresolved`。用户明确选熊猫办公第一条“开心消消乐bulingbuling音效”为四连参考；未选择叮铃。V8已否决，停止生成。音色参考通过不等于商用采用授权，未修改游戏。
- 当前产物：`assets/_incoming/audio-elevenlabs-20260909-match3-v9-pilot/review-four-bling-v8/`，four-bling.wav为0.600秒，listen-twice.wav为2.20秒重复两次试听。仅用原创文字在ElevenLabs生成1次，没有上传/采样CG；jobs-four-bling-v8.json与generated-four-bling-v8/保留请求和来源侧车。
- 授权/费用：复用ElevenLabs三类音效/文字输入/本轮1元及累计50元/至2026-09-30授权。本次公开价格估算CNY0.0096，V5/V6及此次合计约0.0672元，项目约7.66元，不是实际账单。未购买、充值、订阅或重试生成。
- 验证：MP3成功解码，PCM候选44.1kHz双声道24bit、26460帧/0.600秒；试听2.20秒，测得峰值-13.7dBFS。仅+3dB电平、2ms起音/40ms收尾，无低通/变调/旧cue叠加。技术检查不代表听觉验收；未替换运行资源、提交或上传。复现与限制见rework-four-bling-v8.md。
- 来源核验（本次仅浏览）：爱给专题`https://www.aigei.com/sound/class/kai_xin_xi/`显示238文件/2专辑，登录墙，未查看具体音频或许可；熊猫办公`https://www.tukuppt.com/tupian/kaixinxiaoxiaoleyinxiao.html`列出消除、掉落、叮铃、bulingbuling等条目。具体`https://www.tukuppt.com/muban/lbpkowrx.html`标题“开心消消乐bulingbuling音效”、约1秒、MP3，版权栏明确“人物画像、字体及音频仅供参考”；不能据平台标题确认原游戏来源或商用授权。没有登录、下载、购买、试听能力声明或接入。
- 授权复核：`https://www.tukuppt.com/pro/copyright`官方声明明确，除平台原创外部分用户上传作品版权不属平台，仅供学习交流、请勿用于任何商业用途。所选条目列普通上传作者、标注“人物画像、字体及音频仅供参考”，没有单独商用授权证明或CC0标识。不能仅凭会员/下载认定可用于商业小游戏。
- 官方咨询渠道：帮助页`https://www.tukuppt.com/index/about/question`及作品详情均链接客服`https://q.url.cn/cdUM4o?_type=wpa&qidian=true`。未联系或发送信息，不使用侵权投诉邮箱冒充授权咨询渠道。建议咨询内容：请核实作品lbpkowrx是否有权授权嵌入纯广告变现微信小游戏，是否允许客户端随包分发及必要裁剪/音量调整；请提供原权利人/授权链、书面许可范围（地域/期限/平台）、报价及署名要求，不以会员下载权益替代版权授权。未经用户授权不发送咨询、不购买、签约或接入。
- 下一步：用户向平台客服确认单独授权，或明确授权代询问后再操作；无权授权则需原权利人书面许可或重新选择商用替代。当前声音仍仅参考，冰裂与连消待处理。

## 历史：V7否决与官方声音参考

- 最新状态：`rejected_reference_needed`。用户否决V7整版，特别指出冰裂刺耳、像音响损坏；V5/V6/V7均禁止采用。停止新生成与盲目调参，运行资源保持不变。
- 方法改变：停止付费提示词迭代；下载Joseph SARDIN的CC0真实冰块压裂录音（BigSoundBank #2208），仅裁剪/淡出/电平调整。连消与四连复用此前接受的V9普通消除音色，连消0/+2/+4/+7/+9半音离线升调，四连同时叠加转调层、一次触发；不宣称复刻或听审过开心消消乐原音。
- 当前文件：`assets/_incoming/audio-elevenlabs-20260909-match3-v9-pilot/review-v7/`；生成程序`build-rework-v7.mjs`，来源/方法/限制见`rework-v7.md`。包括三项分项试听、12秒现有BGM上下文及未裁剪的真实冰裂对照。
- 新证据：脚本语法、源MP3解码、输出非静音/有限值/无削波通过；连消0.161–0.270s，四连0.310s，冰裂0.500s。技术证据不能证明主观听感；等待用户试听。没有新供应商费用、上传、运行代码/入包音频替换、提交或发布。
- 否决后定向排查：原MP3成功解码，但浮点峰值1.104，11个样本超出±1，峰均比25.94dB；输出ice.wav头部/长度一致、首尾为0、峰值0.500、无数字削波，峰均比23.31dB。MP3解码超范围可能是编码过冲，不能据此断定源录音损坏；技术检查无法确定用户听到的刺耳成因。此前仅检查处理后无削波不足以证明素材适配。
- 官方参考进展：用户授权尝试提取官网CG，已获取官方播放器公开视频并以afconvert原AAC包复制到`assets/_incoming/kxxxl-official-cg-reference-20260914/cg-full-audio.m4a`。137.300秒/48kHz/双声道，输入输出音频帧数、包数与数据字节一致，无重编码或音量加工。来源/命令/限制见同目录README；音视频由局部.gitignore隔离，不入Git或游戏包。
- 参考范围：用户指定CG第7–9秒作为四连声音方向，已按批准仅截取`assets/_incoming/kxxxl-official-cg-reference-20260914/cg-reference-07-09.wav`（2秒/48kHz/双声道24bit），无调音/声源分离。afinfo格式/时长确认；临时FFmpeg不进入项目依赖，原素材和游戏不变。
- 下一步：用户确认截取范围，之后才制作原创四连候选。参考尚未分离音乐/对白/音效；不上传参考到供应商，不提取第三方声音入包；没有直接听觉判断或已听审的声明。没有重新跑无变更的客户端/包体检查。

## 历史：V6试听（用户否决）

- 最新状态：`awaiting_listening_acceptance`，V5被用户否决为普遍刺耳，要求参考开心消消乐。V6已改为原创卡通气泡/橡胶木质弹音和闷脆雪块，不提取、下载或上传参考游戏素材。
- V6三项生成各一次；沿用已批准ElevenLabs/三类音效/仅文字/至9月30日/本次最多1元与项目累计50元。公开价格快照估算此次CNY0.028，与V5合计CNY0.0576，项目约CNY7.65；不是实际账单。
- 处理方法变化：更换声音材质，去掉卡林巴/铃音与写实冰裂；连消源先降低5半音再制作0/+2/+4/+7/+9档，之后柔性压缩与四阶低通（1.5–1.8kHz）、10ms起音和35ms收尾。避免仅降低音量或继续原整段乐句方法。
- 最终候选：`assets/_incoming/audio-elevenlabs-20260909-match3-v9-pilot/review-v6-soft/`，4条试听及7个cue。`review-v6/`是此次低音域调整前的中间候选，不用于交付。源文件与提示为generated-v6/、jobs-rework-v6.json；制作说明见rework-v6.md。
- 检查：三源MP3解码无错误、有限值/非静音/无削波、连消主峰单调上升通过；最终连消约402/478/544/658/850Hz（谱峰不是固定音符基频）、单次0.214–0.36秒，冰块0.25秒、四连0.30秒；上下文峰值0.451。主观听感待用户；未更换运行精灵/客户端，没有新增生成重试。
- 下一步：用户听审这4条，接受后再改运行精灵和事件分派。游戏包体未变化；不上传、提交或发布。

## 历史：V5试听（用户否决）

- 状态：`awaiting_listening_acceptance`。用户在当前对话批准 ElevenLabs 三项新音效、本轮最多CNY1、项目累计最多CNY50、至2026-09-30、仅文字提示。三项生成各调用一次成功；未上传项目文件，未购买/充值/修改订阅。
- 生成前后官方只读核验 Starter active，剩余额度32,545→32,526，本时间窗减少19点（未排除其他并发账户使用）。按原公开价格快照估算本轮CNY0.0296、项目累计约CNY7.62，不等于最终账单。凭证仅在调用时从既有钥匙串读取到进程，无明文落盘/日志。
- 原始三MP3位于 `assets/_incoming/audio-elevenlabs-20260909-match3-v9-pilot/generated-v5/`，旁有请求/时间/哈希侧车。`review-v5/` 已输出7个处理后cue和4条试听带：2–6连、冰块（两次）、四连（两次）、13秒既有BGM上下文；参数/处理程序/证据见同目录上层 `rework-v5.md`、`build-rework-v5.mjs`。
- 连消0/+2/+4/+7/+9半音已离线处理，实测主峰348/392/440/522/586Hz；生成单音未精确落在提示词C5，采用实测音色相对升调，无需额外付费生成。单cue0.238–0.4秒；冰块0.30秒、四连0.36秒。四枚成线与第4次连锁需分别识别。
- 证据：三个源MP3均解码无错误；脚本语法、44.1kHz单声道16bit WAV元数据、数值有限/非静音/无削波及升调单调性检查通过，指标在 `review-v5/metrics.json`。峰值连消0.484–0.545、冰块/四连0.68，上下文0.489。未冒称听感或真机通过。
- 下一步：用户试听确认后再改运行精灵/映射及对应事件分派；当前仅incoming候选、未替换游戏音频、未提交或上传，不影响客户端包体。上一轮分享更新策略不属于此次音效制作范围。

## 历史：特殊棋子生成重复音修复 · 2026-09-14

- Owner: 体验/美术（音频集成）；Status: `awaiting_acceptance`。用户明确要求修复特殊棋子出现时额外响一次，不重新制作或更换已接受音色。
- 原因：单人/PvP均在onMatch调用AudioFX.match一次；audio.match先播放clear/combo，再遍历generated调用playSpecial(false)，提前播放尚未触发的火箭/炸弹/彩球音。真正触发另由triggeredSpecials处理。
- 修复：仅移除match内generated音效分支；保留普通/连消、实际特殊触发、特殊组合单声、障碍、设置/回退逻辑。未调用的specialGenerated公共方法保留兼容，无生产调用。文件js/audio.js、test/audio.js、docs/design/audio-runtime-v9.md；既有MP3路径/测试时长dirty修改完整保留。HEAD f7ed98a+当前相关dirty源码，无构建、素材变更、付费调用、上传或发布。
- 复现/验证：新增回归在修复前失败，type101比普通消除多一个rocket的source.start（offset3.099909、duration0.9）；修复后audio.js/test语法和16项音频回归全过、diff空白通过。新增覆盖101/102/103/104生成、普通与3连、同时生成/触发只播实际触发、读取/解码失败不额外合成。单人/PvP共享入口，未改核心事件/动画。测试直接观察WebAudio桩source.start而非只查源码；未进行本轮微信设备录音或真机听感验收。
- 独立复核：原map_result_qa限定只读检查通过，确认单人/PvP共享payload、生成/触发分离、连消/特殊组合/障碍保留以及回归覆盖，无新增遗漏；未重复测试或进行设备听音。复用既有配置，不切换owner、不新建会话。
- 下一步：用户在已打开的微信项目复听生成与实际触发；真机/全套UI验收继续沿用ui-production.md。未清存档、消费资源或触发线上操作；提交/上传/发布仍需单独授权。
- 记忆：本轮按approved项目match3-game及模块ui-production检索音效/特殊生成/重复均空；本修复已明确记录在权威源码、回归和规范中，不重复写记忆状态候选。

## 历史：原创音频重制 V9（已接受）

- Owner: 体验/美术（音频方向与集成）
- Status: `accepted`
- Deliverable: 两首原创 BGM 与 22 个原创音效，替换现有公开素材，同时保持两 BGM + 单音效精灵 + WebAudio 回退架构
- Approved decisions: ElevenLabs；每任务不超过 CNY 10、累计不超过 CNY 50、授权至 2026-09-30；只发通用文字提示；不上传项目文件；不购买/升级/充值/自动续费
- Current evidence: `docs/design/audio-redesign-v9-draft.md`；首阶段 4 个 BGM 候选与 6 个标志性 SFX 已生成并隔离在 `assets/_incoming/audio-elevenlabs-20260909-match3-v9-pilot/`；10 个 MP3 均为可解析的 44.1 kHz / 128 kbps 文件，BGM 约 60 秒、SFX 约 0.52–0.84 秒
- Cost/rights check: Starter active；官方价格页确认 Starter+ 音乐商用与音效 royalty-free；全部生成公开价格估算 USD 0.9485 / CNY 7.59
- User acceptance 2026-09-10: `calm-b-kalimba-waltz` 通过方向审核；`click1`、`clear`、`combo` 通过音色方向审核，待裁剪与混音。两个 PvP 候选均拒绝；`rocket`、`bomb` 拒绝并要求尽量还原真实声音；`special-combo` 拒绝
- User direction 2026-09-10: 第二轮 PvP 采用“舒缓 B 的同世界快节奏姊妹曲”；组合音效采用约 0.5 秒的空气聚拢、玻璃星屑与柔和冲击，取消旋律
- Revision 2 evidence: 两首新 PvP、真实火箭/炸弹和无旋律组合音效均已生成至 `generated-v2/`；公开价格估算 USD 0.3045 / CNY 2.44，两轮累计约 CNY 7.31；5 个文件均通过 MP3 容器、采样率、码率和时长检查
- User acceptance 2026-09-10: `battle-d-lantern-waltz` 通过方向审核；真实火箭 V2、真实炸弹 V2、无旋律组合音效 V2 均拒绝，评价为“非常烂”并要求重做
- Method decision: `eleven_text_to_sound_v2` 对火箭、炸弹、组合音效已连续两轮未达标；官方 OpenAPI 当前只提供该 SFX 模型，停止继续单次整段生成。改为同供应商“动作组成层分别生成 → 本地裁剪/混合”的制作方法；不增加供应商
- Revision 3 result: 分层拟音方法制作的火箭、炸弹、组合音效仍被用户拒绝；用户要求回听当前游戏原版。已从原批准 WAV 母版按运行 cue 时长提取火箭 0.90s、炸弹 0.86s，并复制原组合 0.872s 至 `assets/_incoming/audio-elevenlabs-20260909-match3-v9-pilot/original-runtime-reference/`。这是入包 AAC 之前的同内容母版，游戏运行时还会应用 SFX master 0.48
- Final direction 2026-09-10: 火箭、炸弹、特殊组合保留原版；舒缓 BGM 采用 `calm-b-kalimba-waltz`，PvP BGM 采用 `battle-d-lantern-waltz`；点击、普通消除、连消采用首批新声音方向。停止继续重做前三项
- Runtime V9: 14 个剩余事件生成成功；已构建 `calm.mp3`、`battle.mp3` 与 22 cue `sfx-acoustic.mp3`，更新音频映射、运行路径、包体忽略、测试、notice 与发布台账。音频回归 15 项、包体预算、素材合规、发布门禁和 `git diff --check` 通过。静态主包 3,773,906 / 4,194,304 bytes
- Final acceptance 2026-09-10: 用户试听最终 22 cue 试听带后确认“就定这一套”。音频方向与运行资源冻结；真机验证并入上线前总体验测试，不再属于声音方向决策门
- Revision 3 evidence: 分别生成 6 个写实/拟音组成层后本地混合为 3 个 WAV；供应商新增估算 CNY 0.05，三轮累计约 CNY 7.36。成品均为 44.1 kHz 单声道 16-bit、峰值 0.82、无削波；火箭 0.76s、炸弹 0.58s、组合 0.56s。临时 MIT 解码工具未加入项目依赖或运行包
- Gate: 音频制作里程碑已通过；剩余为微信开发者工具与 iOS/鸿蒙上线前运行验证
- Known limitation: 系统自带 `afconvert` 无法把本批 MP3 解码为 PCM，Swift 工具链也因 SDK/编译器不匹配不可用；独立执行助手确认 MP3 帧可播放，但其输入通道不支持真实听觉判断。当前只完成容器、时长、码率、大小、哈希核验，峰值/RMS、听感、无缝循环和最终压缩须在用户选择及可用解码链下验证
- Next action: 在下一次上线前总验收中检查本地 MP3 加载、BGM 循环、后台恢复、各 cue 触发与 iOS/鸿蒙响度；只有发现明确运行问题才做针对性修复
- Stop condition: 用户未通过首阶段声音方向，或继续制作将超出已授权供应商/额度/期限
