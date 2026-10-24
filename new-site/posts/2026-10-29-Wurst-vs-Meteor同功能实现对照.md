---
title: "Wurst vs Meteor：同功能实现对照"
date: 2026-10-29
tags: ["Minecraft", "技术", "Wurst7", "Meteor"]
summary: "以同一组功能为坐标，对照 Wurst7 与 Meteor 两个开源客户端的实现差异：架构取舍、事件模型、渲染与网络层。"
---

> 定位：本文是两套分析文档的**外挂对照层**，不替代任何一方——
> Wurst 四件套：[源码分析报告](../article.html?post=2026-10-21-Wurst7源码分析报告) · [功能实现详解](../article.html?post=2026-10-22-Wurst7功能实现详解) · [补充卷](../article.html?post=2026-10-23-Wurst7功能详解补充卷) · [补充卷2](../article.html?post=2026-10-24-Wurst7功能详解补充卷2)
> Meteor 四件套：[源码分析报告](../article.html?post=2026-10-25-Meteor源码分析报告) · [功能实现详解](../article.html?post=2026-10-26-Meteor功能实现详解) · [补充卷](../article.html?post=2026-10-27-Meteor功能详解补充卷) · [补充卷2](../article.html?post=2026-10-28-Meteor功能详解补充卷2)
> 锚点格式：`W:` 前缀 = Wurst7（相对 `src/main/java/net/wurstclient/`），`M:` 前缀 = Meteor（相对 `src/main/java/meteordevelopment/meteorclient/`），均带 `文件:行号` 可回溯。
> "设计取舍"列只写工程权衡（性能/兼容/复杂度/行为差异）；涉及反作弊处只转述源码注释与描述原文，主观优劣判断一律标注 `[推断]`。

## 阅读指南

- 想理解**某个机制为什么有两家做法**：直接查对应域的表（§3–§6）。
- 时间有限：先读 §2 基建层（差异最本质）+ §7 十大看点。
- 单侧独有的功能不在对照表里，见 §8 两个清单。

---

## 1. 总体架构对照

| 维度 | Wurst (v7.56.1) | Meteor (MC26.3) | 取舍 |
|---|---|---|---|
| 事件总线 | 自研 `EventManager`：`HashMap<Class,List>`，异常包成 CrashReport 崩溃（`W:event/EventManager.java:71-81`） | Orbit 库：`@EventHandler`+priority，模块**激活才订阅/关闭即摘除**（`M:systems/modules/Module.java:90-110`） | Wurst 常驻监听器+onEnable 显式注册；Meteor 生命周期自动化、支持优先级仲裁 |
| Mixin 风格 | 94 个（全部 client）；`@Inject` 主力，无 @Overwrite（`W:wurst.mixins.json`） | 212 个（199 主包+13 兼容配置）；无 @Overwrite **且无 @Redirect**，MixinExtras 重度（@ModifyExpressionValue 66/@ModifyReturnValue 33） | Meteor 组合式注入对多 mod 共存更友好 `[推断]` |
| 持久化 | JSON ×12（`.minecraft/wurst/`） | NBT ×9 系统+原子保存+损坏备份（`M:systems/System.java:45-105`） | JSON 可手编；NBT 原生支持嵌套设置树 `[推断]` |
| 访问扩展 | Fabric accesswidener 47 条 | 自研 classtweaker 18 条（`meteor-client.classtweaker`，带逐条用途注释） | Meteor 自研格式需自带加载器 |
| 命令 | 自研分发：ChatScreenMixin→CmdProcessor 前缀处理（`W:command/CmdProcessor.java:30-41`） | Brigadier：sendChat 拦截+参数类型 17 种（`M:mixin/ClientPacketListenerMixin.java:161-185`） | Brigadier 带类型化参数/建议；自研更可控 |
| 模块注册 | 反射扫字段（后缀 Hack/Cmd/Otf） | 显式 `add(new …)` + addon 生态（@PreInit/@PostInit 反射拓扑排序） | 显式注册无扫描遗漏风险；addon 生态 Meteor 独有 |
| GUI | 固定外观窗口拖拽系统 | 主题抽象+widget 树+共享 GuiRenderer+TexturePacker 图集 | Meteor 分层更工程化；Wurst 更简单直接 |
| HUD | HackListHUD/TabGui 固定形态 | 16 元素系统+**Starscript 模板脚本**（`M:systems/hud/elements/TextHud.java:41-60`） | Starscript 让用户自定义 HUD 文案 |
| 26.3 快照适配 | ConnectionMixin 自动补 `ServerboundClientTickEndPacket`（`W:mixin/ConnectionMixin.java:43-64`） | **无对应层** | Wurst 的带位置多发包功能（Criticals/MaceDMG/NoClip 等）有协议兜底；Meteor 各模块自行控制包数 |
| 反模块冲突 | onEnable 互斥关闭（25+ 条边） | 无互斥，靠优先级（HIGHEST+999）与 pause 联动 | 两种哲学：禁止共存 vs 协作共存 |

---

## 2. 基建层对照（差异最本质，先读这节）

| 机制 | Wurst | Meteor | 取舍 |
|---|---|---|---|
| **旋转欺骗** | RotationFaker：单 tick spoof——PreMotion 临时换 yaw/pitch→发包→PostMotion 还原（`W:RotationFaker.java:27-60`），一次只服务一个动作 | Rotations：**优先级队列+双包**——队首随移动包发出，剩余项逐个发独立 Rot 包，各带 callback；队列空时 hold 4 tick（`M:utils/player/Rotations.java:87-155`） | Wurst 简单无残留；Meteor 支持一 tick 内"转向 A 打一击、转向 B 放一块"的复合序列（CrystalAura 同 tick 放爆依赖此）`[推断]` |
| **背包操作** | `IMultiPlayerGameMode.windowClick_*` 直发 + `InventoryUtils.selectItem`（`W:mixinterface/IMultiPlayerGameMode.java`） | InvUtils **move() 链式 DSL**：SlotUtils 屏幕槽→网络槽映射、quickSwap（SWAP 一次点击）、防漏拿递归、swapBack 跨 tick 归还（`M:utils/player/InvUtils.java:167-355`） | Meteor 的 DSL 让 AutoTotem/AutoReplenish 等只声明意图；Wurst 每模块手写点击序列 |
| **伤害计算** | 内联在 aura/模块里（未发现独立工具类 `[推断]`） | **DamageUtils 独立模块，复刻服务端 `ExplosionDamageCalculator`**：seen-percent 网格采样+<600 抗性遮挡捷径+完整减免链（`M:utils/entity/DamageUtils.java:90-404`） | Meteor 的 CrystalAura/AutoLog/AutoTotem 共享同一套服务端同源公式 |
| **渲染坐标** | 顶点存世界坐标+512 格 region 偏移，**跨帧静态 VBO**（EasyVertexBuffer，`W:util/EasyVertexBuffer.java`；`W:hacks/SearchHack.java:201-248`） | 顶点写入时**就地烘焙相机 XZ**，Y 走 modelview，**全部当帧编码**（`M:renderer/MeshBuilder.java:88-99`、`MeshRenderer.java:223-226`） | Wurst 的 Search 缓冲跨帧复用零重建；Meteor 实现简单但大量几何每帧重编码 |
| **TPS 感知** | 无 | TickRate 环形窗口估算（注释：复制自 KAMI Blue，`M:utils/world/TickRate.java:19`），KillAura tpsSync/pause-on-lag 消费 | Meteor 把"服务器卡顿"变成一等公民输入 |
| **多线程区块扫描** | ChunkSearcher 低优先级固定池+ForkJoin 两阶段编译（`W:util/chunk/ChunkSearcher.java:30-54`） | MeteorExecutor cachedThreadPool / BlockESP 专用单线程（`M:utils/network/MeteorExecutor.java:20-30`） | 同构，Wurst 的协作式中断更精细 |
| **配置格式** | JSON 五种形态（数组/两层对象/键值…） | NBT 统一 | — |
| **对外网络** | Plausible 统计（可关、dev 不发）+OpenAI/Google 翻译/披风 | meteorclient.com 心跳（**开游戏即跑、无需进服**）+Capes+微软 OAuth 链+无遥测 | 两家都无传统遥测；Wurst 的 AI/翻译把用户内容发第三方 |

---

## 3. 战斗对照

| 功能 | Wurst 实现 | Meteor 实现 | 取舍 |
|---|---|---|---|
| **KillAura** | 单目标 min 比较器（DISTANCE/ANGLE/HEALTH）；冷却=毫秒+高斯随机 `speedRandMS`（`W:hacks/KillauraHack.java:145-193`） | maxTargets 目标列表（默认 1）；冷却=原版蓄力或 hitDelay=11t+**tpsSync 除以 TPS**；旋转 Always/OnHit/None（`M:systems/modules/combat/KillAura.java:396-461`） | Wurst 的随机冷却 vs Meteor 的 TPS 同步——两种"像人"路线；Wurst 无 maxTargets>1 的多打 |
| **CrystalAura** | 放与爆**分 tick**（`W:hacks/CrystalAuraHack.java:165-225`） | 放爆**同 tick**（Rotations 队列支持）；face-place/smartDelay/yaw-steps 限转角（`M:systems/modules/combat/CrystalAura.java`） | 分 tick 更保守；同 tick 伤害爆发更高 |
| **Criticals** | 3 模式：PACKET(0.0625 序列)/MINI_JUMP/FULL_JUMP（`W:hacks/CriticalsHack.java:87-93`） | 6 模式常量：Packet/UpdatedNCP(8e-8)/OldNCP(0.11 序列)/Jump/MiniJump/None+**tag 1337 与 NoFall 互认**（`M:systems/modules/combat/Criticals.java:180,196`） | Meteor 模式更细且有跨模块包协议；Wurst 用"关闭 NoFall"解决冲突 |
| **免击退** | AntiKnockback：改**本地应用结果**——lerpMotion/爆炸回调缩放（`W:hacks/AntiKnockbackHack.java:43-53`，滑条 -100%~200% 可反向） | Velocity：**改写入站包本身**——SetEntityMotionPacket `meteor$setMovement`、爆炸经 IClientboundExplodePacket（`M:systems/modules/combat/Velocity.java:152-161`） | 改包→后续逻辑全部看到改后值；改本地→与其它本地速度修改叠加自由。h=0 默认两家一致（全免） |
| **BowAimbot** | 抛物线 g=0.006+移动预测+**直接 setYRot 真转头**（`W:hacks/BowAimbotHack.java:145-168`） | 同公式+Rotations.rotate 队列（`M:systems/modules/combat/BowAimbot.java:151-153`） | 真转头（必须，发射方向取客户端视角）；仅旋转应用层不同 |
| **离手** | AutoTotem：两 tick 三连击 PICKUP（`W:hacks/AutoTotemHack.java:124-144`） | AutoTotem+**Offhand 双模块分层**（HIGHEST 与 HIGHEST+999）：Smart 锁定用 DamageUtils 预估"血量−可预支伤害"（`M:systems/modules/combat/AutoTotem.java:90-96`） | Meteor 把"常规副手管理"拆成独立模块，优先级仲裁 |
| **AutoArmor** | 护甲分=点数×5+保护×3+韧性；**Collections.shuffle 随机穿戴顺序**（`W:hacks/AutoArmorHack.java:146-197`） | 计分制+绑定诅咒/鞘翅设 MAX_VALUE 跳过+anti-break 耐久 10 脱下（`M:systems/modules/combat/AutoArmor.java:277`） | Wurst 的随机顺序是行为层伪装；Meteor 是装备策略 |
| **目标几何** | 命中盒距离 `distanceToHitboxSq`（`W:util/EntityUtils.java`） | 同为包围盒最近点（`M:systems/modules/combat/KillAura.java:396-441`） | 一致 |
| **Hitboxes** | 无此功能 | expand=0.5 同时扩拾取/攻击/弹射物判定（getPickRadius/AttackRange/ProjectileUtil 三 Mixin，`M:mixin/EntityMixin.java:133-137`） | Meteor 独有的"判定圈放大"族 |
| **弹道规避** | 无 | ArrowDodge：模拟来箭+8 方向 shuffle 择向（`M:systems/modules/combat/ArrowDodge.java:130-132`） | — |

---

## 4. 移动对照

| 功能 | Wurst | Meteor | 取舍 |
|---|---|---|---|
| **Flight** | 速度直改+antiKick 周期 -dist/+dist/0（`W:hacks/FlightHack.java:90-131`） | Abilities(mayfly)/Velocity 两模式；**antiKick Packet 模式：把 Rot 包升级为含 Y 包且 Y=lastY−0.03130**（源码注释：服务端 −0.03125 以下不踢，`M:systems/modules/movement/Flight.java:178-188`） | Meteor 的包升级法不靠周期坠落，轨迹更平滑 `[推断]` |
| **Speed** | 单一实现：落地 ×1.8+上限 0.66（源码注释：NCP 3.13.0 可过值，`W:hacks/SpeedHackHack.java:62-66`） | Vanilla/Strafe 两模式；Strafe 四阶段 NCP 状态机+**speed-limit 0.43/0.44+1250/2500ms 时间窗**（`M:movement/speed/modes/Strafe.java:27-73`） | Meteor 保留可调模式族；Wurst 曾有模式已删（版本考古点） |
| **NoFall** | 补发 `StatusOnly(onGround=true)`（不动原包，`W:hacks/NoFallHack.java:80-81`） | Packet 模式**改原包 onGround**（下落 −0.5 触发）+Place（真实放水/细雪）+AirPlace 三模式（`M:systems/modules/movement/NoFall.java:115-198`） | 补包永不与原包矛盾；改包+真实方块是 Meteor 的两条替代路线 |
| **Jesus** | 碰撞箱改 `Shapes.block()`+**包重建 ±0.05**（bypass 隔 tick 下沉，`W:hacks/JesusHack.java:138-154`） | 事件版碰撞（CanWalkOnFluidEvent/CollisionShapeEvent）+ncp-bypass 选项+**同步 Baritone assumeWalkOnWater**（`M:systems/modules/movement/Jesus.java:60-71,180-190`） | Wurst 的包重建是主动序列伪造；Meteor 依赖碰撞事件+服务端假设设置 |
| **Step** | LEGIT：发 +0.42/+0.753 两段 Pos 包模拟跳跃（`W:hacks/StepHack.java:87-93`） | **`Attributes.STEP_HEIGHT.setBaseValue(1.25)`** 走原版属性系统（`M:systems/modules/movement/Step.java:77`） | 完全相反的两条路：伪造跳跃序列 vs 修改原版属性 |
| **NoSlow** | 4 处 Mixin 把 isSlowDueToUsingItem 强制 false（`W:mixin/noslowdown/*`） | **十余项独立开关**（items/web/honey/soul-sand/slime/berry/fluidDrag/sneaking/hunger/slowness）+web Timer 模式（踩网开 Timer×10，`M:systems/modules/movement/NoSlow.java:163-172`） | Meteor 精细到每类减速源；Wurst 一刀切 |
| **Sneak** | PACKET 模式**已注释成死代码**（旧 Yarn 命名残留，仅 LEGIT 可用，`W:hacks/SneakHack.java:121-127`） | Vanilla/Packet 双模式**可用**——Packet 只发潜行状态包不真蹲（`M:systems/modules/movement/Sneak.java`） | 同一功能的生死对照：Wurst 废弃的路线 Meteor 保留 `[推断]` 与各自目标服务器生态有关 |
| **Blink** | 扣包/去重/dump+FakePlayerEntity 替身+limit 自动 toggle（`W:hacks/BlinkHack.java:87-107`） | 同构+pulse-delay 周期 dump+cancel-blink 回滚起点（`M:systems/modules/movement/Blink.java:100-143`） | 高度一致（互为验证）；Meteor 多回滚选项 |
| **AntiHunger** | 恒定把 onGround 改 false（`W:hacks/AntiHungerHack.java:42-54`） | onGround=false+**落地瞬间放行一个真包**防免摔判定（`M:systems/modules/player/AntiHunger.java:57-68`） | Meteor 多一层状态机 |
| **Sprint** | setSprinting(true) 条件自动化 | Strict/Rage+**unsprint-on-hit：攻击包前 STOP_SPRINTING 保暴击、包后恢复**（`M:systems/modules/movement/Sprint.java:79-95`） | Meteor 把疾跑与暴击机制联动 |
| **瞬移类** | TpAura 随机 ±2 setPos；.tp ≤22 格；.vclip ≤10 格（`W:commands/TpCmd.java`） | ClickTP ≤210 格每 10 格一 StatusOnly 包（`M:movement/ClickTP.java:83-88`）；.vclip PaperClip 每 10 格一包 ≤20 包（`M:commands/VClipCommand.java:30-47`） | Meteor 把"拆包过位移阈值"做成了通用模式 |
| **Timer** | deltaTicks×=speed（`W:mixin/timer/DeltaTrackerTimerMixin.java:26-34`） | 同机制+**setOverride 供 Burrow/FastClimb/LongJump/NoSlow/Speed 临时接管**（`M:world/Timer.java:33-37`，10 处调用） | Meteor 把 Timer 做成可被其它模块借用的全局资源 |
| **ElytraFly vs ExtraElytra** | instantFly+speedCtrl+heightCtrl（`W:hacks/ExtraElytraHack.java:99-131`） | 四模式：Vanilla/**Packet（伪造成服务端常规飞行）**/Pitch40（40 格振荡+随机化）/Bounce（`M:systems/modules/movement/elytrafly/`） | Meteor 模式族完整度远高 |

---

## 5. 渲染对照

| 功能 | Wurst | Meteor | 取舍 |
|---|---|---|---|
| **X-Ray** | **VisGraph-cancel+面剔除**：`onVisGraph` cancel+双分查表+onlyExposed 对抗假矿（`W:hacks/XRayHack.java:154-209`） | **区块重建+alpha 掩码**：allChanged 重建网格，13 个渲染 Mixin（含 sodium 7 个）查 getAlpha；**Iris 下强制 alpha=0+警告**（`M:systems/modules/render/Xray.java:89-175`） | Wurst 方案零重建延迟但与 Sodium 需独立适配；Meteor 方案 Sodium 一等公民但切换慢 `[推断]` |
| **Search vs BlockESP** | ForkJoin 两阶段+region 静态 VBO+limit=10^n 截断（`W:hacks/SearchHack.java`） | 别名 "search" 并入 BlockESP：单线程+增量更新（连 3³ 邻块刷新）+当帧烘焙（`M:render/blockesp/BlockESP.java:161-263`） | Wurst 有跨帧 VBO；Meteor 全动态 |
| **ChestESP vs StorageESP** | 14 组分类+Box/tracer（`W:hacks/ChestEspHack.java`） | Box/Shader 双模式（后处理描边）+**打开的容器淡化而非消失**（`M:render/StorageESP.java:223-311`） | Meteor 记录交互状态（连双箱另一半） |
| **Fullbright** | GAMMA(forceSet 16)/NIGHT_VISION 效果注入（`W:hacks/FullbrightHack.java:106-116`） | Gamma/**Potion（<420t 强制续）**/Luminance（最低光照级，sodium 光照 mixin）三模式（`M:render/Fullbright.java:69-105`） | Meteor 的 Luminance 是区块网格级方案，Sodium 兼容最好 `[推断]` |
| **NewChunks** | 有（调色板残留/流动液体双算法，`W:hacks/NewChunksHack.java:186-293`） | **无此模块** | Wurst 独有的区块序列化层分析 |
| **Trajectories** | 1000 步自模拟+多物品参数表（`W:hacks/TrajectoriesHack.java:94-176`） | ProjectileEntitySimulator 复用+multishot ±10°+loyalty 回程忽略（`M:render/Trajectories.java:226-249`） | 同构，Meteor 复用模拟器（ArrowDodge 也用） |
| **ESP 实现路线** | 直接 Renderer 画框（tracer/盒） | 五模式：Box/**Wireframe（拦截原版提交通道重绘）**/2D/**Shader（POST_OUTLINE 后处理）**/Glow（`M:render/ESP.java:449`+`utils/OutlineRenderCommandQueue.java`） | Meteor 的 Shader/Glow 借原版提交通道，轮廓与动画姿态完全同步 `[推断]` |
| **Freecam** | camPos 独立+InputFaker 空输入+pick 从相机（`W:hacks/FreecamHack.java`+`W:InputFaker.java`） | 同思路+**baritone-click 点击寻路**+GUIMove 联动+四种包判定自关（`M:render/Freecam.java:350-456`） | 都注册在 RENDER；Meteor 接了寻路生态 |
| **实体信息** | NameTags(scale/see-through)+HealthTags（血量数字） | Nametags（血量/游戏模式/ping/**6 格物品+耐久+附魔**/TNT 倒计时）+EntityOwner+LogoutSpots（下线点） | Meteor 的 2D 名牌信息密度高一个量级 |

---

## 6. 世界与自动化对照

| 功能 | Wurst | Meteor | 取舍 |
|---|---|---|---|
| **寻路引擎** | **自研 A\***：`ai/PathFinder`（1024 节点/tick 分片、±256 格、失败走最近点），服务 FightBot/Protect/TreeBot/.goto/.path（`W:ai/PathFinder.java:37`） | **可插拔**：Voyager(不在仓库)>Baritone>Nop 三级探测（`M:pathing/PathManagers.java:21-39`）；Baritone 4 线程池算路+InputOverrideHandler 替换 player.input | Wurst 自研轻量但能力有限（大树放弃/无挖矿）；Meteor 借 Baritone 获得挖矿/建造/下界寻路全家桶 |
| **挖矿自动化** | Tunneller：6-Task 管线（DodgeLiquid/FillInFloor/PlaceTorch/…，`W:hacks/TunnellerHack.java:122-124`）；TreeBot（BFS 限 6 根） | InfinityMiner：**全 Baritone**（挖矿/耐久修复/回家/背包满 logOut 状态机，`M:world/InfinityMiner.java:126-176`） | Wurst 的 Tunneller 是"自给自足"典范；InfinityMiner 的无限循环靠 Baritone 进程仲裁 |
| **高速公路** | 无 | HighwayBuilder：**纯自研 10 状态机**（Center→Forward→Mine→Place→ReLevel→Restock→DefuseCrystalTraps…，2924 行，`M:world/HighwayBuilder.java:781-1872`）——故意不用 Baritone | 同一仓库内两种哲学并存：能借则借（InfinityMiner）、太特化则自研（HighwayBuilder）`[推断]` |
| **Nuker** | 创造 packetSpam 一 tick 全破/生存假旋转逐块（`W:hacks/NukerHack.java:124-163`） | 三模式 interact/packetMine(startPrediction 同序号 START+STOP 对)/legit+球/立方/切比雪夫三几何（`M:world/Nuker.java:512-528`） | Wurst 按游戏模式分流；Meteor 按发包风格分流 |
| **放置算法** | BlockPlacer 三级优先（非交互邻居→LOS→**最远**）（`W:util/BlockPlacer.java:136-170`） | BlockUtils.place 单一 relevancy（lookVec 在面法线轴分量最大，即最面向玩家）+**interact 时强制取消潜行再恢复**（`M:utils/world/BlockUtils.java:90-146`） | Wurst 显式处理"潜行死循环"注释；Meteor 用取消-恢复潜行绕开同一问题 |
| **自动农场** | AutoFarm：21 作物策略+三级队列（`W:hacks/AutoFarmHack.java:119-332`） | **无此模块** | — |
| **村民自动化** | AutoLibrarian（讲台重置状态机） | 无 | — |
| **建造防御** | 无 | **Surround/HoleFiller/AutoTrap/SelfTrap/SelfWeb/AntiAnvil/AntiBed/AutoCity 族**（`M:systems/modules/combat/`）——2b2t 战术自动化全家桶 | Meteor 的 pvp 社区导向 |
| **分布式** | 无 | **Swarm**：TCP 主从（默认 6969），Worker 把广播命令当本地命令执行（`M:misc/swarm/SwarmWorker.java:34-62`），集群挖矿走 Baritone | Meteor 独有；无鉴权 `[推断]` |
| **挖矿进度探测** | FastBreak 概率加速 | PacketMine（序列化单块+**ABORT 包掩盖进度**）+SpeedMine（≥0.7 置 1+grim ABORT 序列，`M:systems/modules/player/SpeedMine.java:121-124`） | 两家对"挖掘进度可见性"的攻防不同层 |

---

## 7. 十大最有信息量的差异（导读）

1. **旋转欺骗**：单 tick spoof vs 优先级队列+双包（§2）——决定战斗模块能否做复合动作。
2. **Step**：伪造跳跃包 vs 原版属性（§4）——同一目标的两条极端路线。
3. **X-Ray**：VisGraph-cancel vs 区块重建+alpha（§5）——与 Sodium 的关系决定架构。
4. **寻路**：自研 A\* vs Baritone 生态（§6）——Wurst 的一切自动化建立在自研引擎上。
5. **26.3 适配**：自动 TickEnd 补包 vs 无兜底层（§1）——影响所有多发位置包功能。
6. **免击退**：改本地应用 vs 改入站包（§3）——"在哪一层动手"的经典案例。
7. **Sneak**：废弃的 PACKET 模式 vs 可用（§4）——同一功能的两家存亡。
8. **伤害计算**：内联 vs 服务端同源 DamageUtils（§2）——决定 aura 判断的准确率。
9. **模块共存**：互斥关闭 vs 优先级+pause 联动（§1）——架构哲学差异。
10. **HighwayBuilder 的存在**：同一个 Meteor 里"借 Baritone"与"自研状态机"并存（§6）——特化场景自研更可控的实例。

---

## 8. 单侧独有功能清单

**Wurst 独有**（Meteor 无对应）：AutoFarm（21 作物）、AutoLibrarian、AutoFish 的 mcMMO 钓点轮换、TreeBot、Tunneller、NewChunks、Excavator 的 Wurst 版（.excavate 命令）、Kaboom、CrashChest/KillPotion/TrollPotion（恶意物品）、ForceOp（密码爆破）、Navigator/TabGui（Meteor 用 ClickGUI/HUD 替代形态）、OpenWaterESP/ProphuntESP、TemplateTool（模板录制）、InstantBunker。

**Meteor 独有**（Wurst 无对应）：Baritone 依赖面全部（Excavator/InfinityMiner/AutoWalk Smart/Swarm/Freecam click-to-path）、HighwayBuilder、Surround 族 9 个、ArrowDodge、Quiver、Hitboxes、AttributeSwap、ElytraBoost、EntityControl、TridentBoost、NoGhostBlocks、PacketMine、AntiPacketKick、ServerSpoof 的资源包伪回执部分、BetterChat（含坐标打码）、BetterTooltips、DiscordPresence、InventoryTweaks、Notebot、BookBot、Marker、ItemPhysics、Addon 生态、Starscript、Swarm 集群、Nametags 的高信息密度形态、AutoReplenish/AutoMend/AutoGap（Wurst 用 AutoEat/AutoSoup 等部分覆盖）。

---

## 收尾说明

对照结论的可信度依赖两侧行号（均已实测）；若任一仓库更新，本文对应行失效。涉及"更隐蔽/更安全"的判断全部回避或标 `[推断]`——本文只回答"两家的做法差在哪、各自的工程代价是什么"。
