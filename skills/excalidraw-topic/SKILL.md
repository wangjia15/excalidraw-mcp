---
name: excalidraw-topic
description: 将任意主题制作成一份正反两用的 Obsidian Excalidraw 可视化讲义。正面是带原生图形、卡片和播放 frame 的知识画布，背面嵌入同一画布的对应 frame，附中文解释、案例和 Mermaid。适用于“用一张 Excalidraw 讲清楚”“图文讲义”“卡片讲解”“单文件正反面”“UML 可视化”等请求。
argument-hint: <主题或资料> [面向对象] [vault] [目标路径]
---

# 任意主题的单文件可视化讲义

把一个主题做成 **一个 `.excalidraw.md` 文档**。正面可看、可编辑、可按 frame 播放；背面复用正面真实图形，补充解释、案例、来源与 Mermaid。

本技能借鉴 `excalidraw-obsidian:boppps-lesson` 的单文件、frame 播放、讲稿与自嵌入机制。**默认先将 topic 拆成小知识卡，再连接成可由 Mindmap Builder 重排的 mindmap**。每卡采用 63:88 竖版比例、配图和说明。只有用户明确要求宽版演示时才采用下文 slides 路线；只有用户要求时才采用 BOPPPS 课时结构。

## 默认路线：竖版知识卡 mindmap

先读 [references/card-mindmap.md](references/card-mindmap.md)。根主题 → 3–5 个分支 → 小知识点，每卡只讲一事。卡片背景 630×880 画布单位，对应常用 63×88 mm 卡牌比例，打印需另设物理尺寸。卡内有标题、类别编号、原生示意配图、简短说明、类比/案例和验收点。

使用 `scripts/Render Knowledge Card Mindmap.md` 生成原生卡片。背景是唯一结构节点，带 mindmapOrder；根带 growthMode；图文和单卡 frame 使用每卡独立 group；父子箭头带 isBranch:true 并绑定到背景。先查看用户指定 Mindmap Builder 脚本版本，不能只画外观相似的普通连线。

命令或操作主题的卡片应补充具体 `scene` 使用场景与 `related` 关联命令。用户要求关联图时，通过 `scripts/Connect Related Knowledge Cards.md` 添加真实绑定的虚线 crosslink；虚线不带 isBranch、不进入卡片 group，放到卡片背景后方。实线表示知识树，虚线表示配合、等价或替代，不能暗示自动执行。大量卡片可用 `args:{specPath:"库内相对路径.json"}` 读取完整规格。

必须实际运行已安装 Builder 重排并对比前后坐标，确认图文及单卡 frame 随节点同位移。`layoutSettings` 应完整合并，避免部分字段覆盖导致 NaN。重排后用 `scripts/Sync Knowledge Card Frames.md` 更新总览。背面自行维护逐卡真实 frame 自嵌入、中文讲解与 Mermaid mindmap/机制图；保持一个主绘图。

## 必须满足的交付契约

1. **一个主题只有一个主绘图文件**。多个 frame 属于同一张画布；不要为每张卡片新建绘图。请求 JSON、预览图、辅助脚本不是第二份讲义。
2. **先拆主题，再画知识卡 mindmap**。每卡 630×880、一个知识点、配图和文字，卡片之间用结构分支连接。每卡独立分组，使 Mindmap Builder 重排时背景、图文和播放 frame 一起移动。配图选择合适的流程、UML、对比或代码机制，详细正文放背面。
3. **背面嵌入正面实际 frame**：`![[完整文件路径.excalidraw#^frame=<真实frameId>|900]]`。不能只写链接、只贴截图或虚构 frame ID。MCP `obsidian_write_slides` 会自动生成这些嵌入。
4. **每个 frame 都有讲解**：结论、如何读图、案例或反例、边界或验收方式；每个内容页建议 100–240 字，适合用中文讲清楚。
5. **背面保留 Mermaid**：解释机制的 frame 同时提供 Mermaid 源码。在 `notes` 里用 Markdown fenced block 即可，自动生成的讲稿 callout 仍可渲染 Mermaid；概览背面也可放独立 Mermaid。
6. **播放可用**：frame 带 `customData.slideshow={schemaVersion:2,kind:"frame",order,notes}`。检查顺序连续、每帧备注非空。图形页设 `animate:false`，避免转换后动画仍引用已删除的占位元素。
7. **实际完成转换和验图**：前面不能残留 Mermaid 虚线占位框却报告图形已完成。CLI 不可用时可以先生成，但明确标注未转换、未验证。
8. **内容有依据**：区分来源事实、教学类比、假设、虚构案例和实际执行结果。处理任意主题时按证据选图，不为凑图滥用 UML。

## 输入与默认值

- 用户给定资料时优先读取，以资料为依据；主题延续当前会话时复用已核实内容。
- 只给主题时取 3–5 个适合该领域的可靠来源；涉及日期、产品能力和 API 时核实当前资料。
- 没指定受众：有基础但首次学习该主题的读者；语言跟随用户，中文会话默认中文。
- 默认 12–24 张原子知识卡，按主题增减；一张总览 frame 加每卡一个 portrait frame。宽版演示默认 8–14 帧。
- vault 优先使用用户指定值，其次本会话已确认 vault，再用 MCP 默认；CLI `obsidian vault info=path` 可确认当前库。
- 新文件建议 `<主题目录>/<主题> 可视化讲义.excalidraw.md`。存在同名文件先读，用户未要求更新则取新名称。不要改写插件缓存。

## 工作流

### 1. 确认环境

- 知识卡 mindmap 使用 MCP `obsidian_write_drawing` 创建种子文档，CLI EA renderer 生成精确卡片；宽版演示使用 `obsidian_write_slides`。MCP 每次显式传入 vault 绝对路径。
- CLI 先运行 `status`、`schema action=script`、`schema action=export`。检查 JSON 的 `ok` 与 `data.ready`。
- `scripts/ob_cli.py` 是可复用 CLI 包装器：自动解析原生回执，在 macOS 使用 PTY 避免 stdout 管道丢失 JSON。运行 `python3 -I <技能目录>/scripts/ob_cli.py --help` 看用法。
- Slideshow 已安装时使用现有脚本。Mermaid 转换脚本在技能 `scripts/Mermaid to Excalidraw.md`。仅在需要转换时，将已阅读过的这个辅助脚本复制到目标库的 `Excalidraw/Scripts/` 下的唯一文件名；这是完成用户图形任务的辅助文件，不安装整套主题、不覆盖现有脚本。
- 若选择使用插件 `obsidian_install_vault_files`，遵守该工具的 dry-run 和审批契约；不必为主题讲义安装所有主题。

### 2. 先设计解释顺序

按 [references/authoring.md](references/authoring.md) 规划：

- 总览：主题回答什么问题，涉及哪些部分。
- 概念卡：术语、输入/处理/输出或因果链。
- 机制图：关系、调用、状态、选择或流转。
- 案例：具体条件、行动、结果与限制。
- 验证：如何检查理解或实际结果，常见误解是什么。

每页确定标题结论、图类型、2–3 个短卡片、图上标记与背面解释、来源。不同主题可以用流程图、时序图、类图、状态图、ER 图、活动/泳道图、架构、时间线、对比图等。没有实体关系时无需类图。

### 3. 宽版演示路线（仅在明确请求时）

默认知识卡 mindmap 按上文与 card-mindmap.md 生成。只有宽版演示才用 `obsidian_write_slides`：

- `deck.titleFont="sans"`、`bodyFont="sans"`、`progress:false`；默认 `theme="fresh"`，用户指定主题优先。任意主题默认关闭 BOPPPS 六点进度；只有明确采用 BOPPPS 并给页面分配 stage 时才打开。
- 正文 `layout:"cards"`，每页 2–3 条 `标题：短说明`。不以纯文字卡片充当全部图形解释。
- `mermaid:{code,ratio?,caption}` 生成可转换占位框。代码在同页 `notes` 中也保留一份，确保背面可重现图意。
- `notes` 写详细中文解释、案例与验收点。封面也写说明。
- Mermaid 图页 `animate:false`；其它页面可按需动画。
- `back` 写主题摘要、阅读和播放方法、框架导航、案例背景、来源与适用范围。不手写或修改 `%% slides:start ... slides:end %%` 自动段。
- `properties` 至少包含 tags、topic、audience、source、created、generator:excalidraw-topic。
- `obsidian_write_slides` 自动生成每页嵌入、`^pNN` 锚点及讲稿，back 可用 `[[文档#^p03|第3帧]]` 形成阅读路径。

### 4. CLI 转换与微调

打开精确绘图路径，通过原生 `script` 运行已审阅的 Mermaid 转换脚本；检查每项 `report.ok` 和 `summary`。

- **先检查依赖**：当前 Excalidraw 2.29.0 的 `ea.addMermaid` 可能要求 Excalidraw Extras companion plugin；`status.converter:true` 不保证 Extras 已安装。缺少时不要反复调用、不要自动安装插件；关闭依赖提示，查回执确认失败，再走原生绘图路线。
- **无 Extras 的原生路线**：使用 `scripts/Render Native Diagram Slots.md`，为每个占位框提供明确的 nodes/edges 或 participants/messages 计划，忠实实现同一 Mermaid 的关系。它直接调用 EA addRect / addDiamond / addText / addArrow / addLine，输出原生可编辑图形；不是 Mermaid 解析器。计划写入请求 JSON，复制已阅读的辅助脚本到库内唯一名称，再通过原生 CLI script 执行。接口和例子见 [references/native-diagrams.md](references/native-diagrams.md)。
- flowchart / sequenceDiagram / classDiagram 在转换依赖齐全时通常能转原生形状、文字、箭头；其余类型可能为内嵌 SVG，不要谎称全可编辑。
- 出现转换错误时先检查 Mermaid 语法与图复杂度。
- 转换后最小文字字号以 16 为下限，建议 20+。字号过小优先缩短标签、减少节点、减少旁边卡片或拆帧；不要盲目把图拉满导致越界。
- 验证每个文字/图片/形状保留正确 frameId，文字在 frame 内；连线绑定有效；无残留占位符；动画不引用已删除元素。
- 局部编辑用 `read source=live` → `apply expectedRevision=...`，每次新 requestId。不确定结果先查 `result`，不可盲重试。
- MCP 重写会还原占位框，必须重转；用户已编辑的绘图优先局部微调。
- 禁止手工修改压缩 drawing 数据。

### 5. 验证并交付

运行 `scripts/ob_cli.py verify`，检查 frame 数、连续播放顺序、讲稿、真实自嵌入、Mermaid、残留占位、frame 内文字和悬空动画。脚本检查的是结构，不能代替读图或事实核对。

导出封面/总览、一张关系图或 UML、一张案例页，Read 图片检查中文、连线、字号与重叠。切 Markdown 模式检查自嵌入是否显示为实际图形，Mermaid 源码是否存在并能渲染；首次库信任提示由用户控制。

最终说明：技能路径、主文档路径、frame 数和播放方式、使用的图类型、实际验证结果与限制。新增用户技能后用 `/reload-skills` 重扫可发现新入口；不要假装本会话已经注册一个未出现在技能目录表里的 Skill。

## 调用示例

```text
/excalidraw-obsidian:excalidraw-topic 用一张图解释 HTTP 缓存，面向后端初学者
/excalidraw-obsidian:excalidraw-topic 主题是个人预算管理，加入收入支出案例
/excalidraw-obsidian:excalidraw-topic 根据这份论文讲清注意力机制，类比、机制、案例都要有
/excalidraw-obsidian:excalidraw-topic 用当前 Slash Commands 示例测试，保存到当前 course 库
```

模板与图型选择见 [references/authoring.md](references/authoring.md)；回归测试记录见 [references/tested-example.md](references/tested-example.md)。
