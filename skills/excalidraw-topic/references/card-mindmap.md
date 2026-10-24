# 竖版知识卡 mindmap

## 先拆知识点，再连接

默认先输出知识树：主题根卡 → 3–5 张分支卡 → 每分支 2–5 张叶卡。一张卡只讲一个概念、命令或可验证机制。不要先写一页密集幻灯片再缩成卡片。

卡片为 630×880 画布单位，即 63:88 比例。常用实体尺寸 63×88 mm，打印时须另设物理尺寸，画布单位不是毫米。只借鉴尺寸和信息层级，不需要真实角色、商标或卡牌素材。

每卡包含：标题、类别/编号、约 570×270 的配图区、一句结论、3–4 行说明、对话类比或具体例子、验收点。图形必须解释机制，可以是流程、比较、决策、时序或适当 UML；照片等图片仅在有用时加入。默认原生图形可编辑。复杂 UML 拆成更多知识卡，避免把完整大图硬塞进小框。

## 已安装 Mindmap Builder 的实际契约

以用户目标库中的 `Excalidraw/Scripts/Downloaded/Mindmap Builder.md` 为准。2026-10-24 实测版本 v26.10.13。

- 每卡的 **630×880 背景矩形** 是唯一结构节点，带数值 `customData.mindmapOrder`。
- 中心背景额外带 `customData.growthMode:"Right-Left"` 与 `autoLayoutDisabled:false`。
- 所有卡内文字、配图、装饰及本卡播放 frame 共用一个独立 `groupIds:[cardGroupId]`。它们不带 `mindmapOrder`、`growthMode`、`isBranch` 或 `isBoundary`。
- 每组只能有一个结构节点。多个结构节点共组会被当作分支组，可能被原生重排拆组。
- 父子箭头为独立 arrow，`customData.isBranch:true`，`startBinding.elementId` 指父卡背景，`endBinding.elementId` 指子卡背景。背景的 `boundElements` 反向包含对应箭头。
- 内部配图连线用 line 或不绑定的箭头，不要误标成树分支。不能将装饰当成父子连接端点。
- 普通文本按局部坐标排版并作为 grouped decoration，避免复杂卡片绑定文本被脚本重新居中。此形式支持重排；不要承诺原生 exportMarkdown 能导出全部卡片正文（它通常读取节点绑定标题）。背面自行保留完整知识树。
- group 负责重排时的共同位移，frameId 负责播放/嵌入裁切，二者不可互相替代。

## 生成路线

用户要求知识卡 mindmap 时，使用 `scripts/Render Knowledge Card Mindmap.md`，不要继续用宽版 slides cards。

先读已有绘图和背面；新图可由 MCP `obsidian_write_drawing` 创建空白或种子图。只有更新本技能产物且已有授权时，才允许 renderer 重建该主文档。renderer 会替换正面场景；用户手改内容需先保留或局部迁移。

复制已审阅 renderer 到目标 vault 唯一脚本名，通过原生 CLI `script` 传显式 card tree：

```json
{
  "title":"主题知识卡片图",
  "growthMode":"Right-Left",
  "cards":[
    {"id":"root","parent":null,"title":"主题","category":"主题","caption":"一句核心结论","description":"第一行说明。\n第二行说明。","analogy":"像一个熟悉的具体场景。","check":"可核对的完成条件。","detail":"背面详细解释。","visual":"pipeline","steps":["输入","机制","结果"]},
    {"id":"part","parent":"root","title":"小知识点","category":"入口","caption":"单卡结论","description":"简短说明。","analogy":"具体类比。","check":"检查点。","detail":"背面解释。","visual":"pipeline","steps":["条件","行动","结果"]}
  ]
}
```

visual 支持 pipeline、hub、compare、decision；特殊领域可扩展原生插图。compare 的可选 `comparisonNote` 用于有依据的比较结论，不默认带入某一示例的性能数据。renderer 当前示例布局主要面向根、分支、叶三层；超过三层需明确扩展布局，不应默默堆叠。

## 使用场景与虚线关联

操作或命令卡增加 `scene`（具体触发条件与目标）和 `related`（其他卡片标题数组）；renderer 会显示使用场景面板与关联命令。完整规格可以保存在 vault，通过 `args:{specPath:"库内相对路径.json"}` 传入，避免超长 CLI 参数。

顶层 `relations` 采用 `[{from:"卡片ID",to:"卡片ID",label:"常用配合",reason:"具体关联原因"}]`。同一无向对只绘一次。先生成知识树，再运行 `scripts/Connect Related Knowledge Cards.md`，输入相同 specPath。该辅助脚本用于首次添加虚线；再次运行前需读取已有关系并去重或局部更新，不能盲目重复追加。

虚线 arrow 真实绑定两张背景，双方 boundElements 记录反向引用；带 `topicCardRole:"related"`、关系类型和原因。不带 isBranch，不进入卡片 group 或 frame，置于背景后，避免穿过正文。实线负责分类树，虚线表示配合、别名或替代；不要把相关性描述为自动调用。背面列出双向关联链接与理由，Mermaid 用虚线复述。跨类别连线跨度大时，增加分类目录和局部关系预览；局部重排预览须明确不是全图原始布局。

新增虚线后再实际重排一次，核对树结构、虚线端点、反向引用以及卡内相对位置。播放如误选了连线来源，先结束已有演示，再在 Slideshow 面板选择 Frames 并启动；实际核对总页数和下一页，不能仅凭 metadata 宣称播放成功。

## 实际重排

打开并聚焦精确绘图，运行已安装 Mindmap Builder。不能只调用 open 后就假设 activeLeaf 正确，面板可能抢走焦点。

手动：选根卡 → Auto-Layout 开启 → Growth Strategy → **Auto rearrange map**。快捷键默认 Option/Alt+R（Builder 输入框焦点，用户自定义优先）。

实际脚本已加载时可通过 Obsidian eval 使用已公开 API：

```js
const mm = window.MindMapBuilderAPI;
const selected = mm.selectNode(actualRootId);
if (!selected.ok) throw new Error(JSON.stringify(selected));
const current = mm.getMapConfig(actualRootId).data.config;
// 嵌套 layoutSettings 必须完整合并。仅传 GAP_X/GAP_Y 会替换其余值，可能产生 NaN 坐标。
const defaults = mm.getGlobalConfig().data.config.layoutSettings;
const config = await mm.setMapConfig({
  nodeId: actualRootId,
  patch: {autoLayoutDisabled:false, layoutSettings:{...defaults,...current.layoutSettings,GAP_X:240,GAP_Y:140}},
  relayout:false
});
if (!config.ok) throw new Error(JSON.stringify(config));
const result = await mm.refreshMapLayout(actualRootId);
if (!result.ok) throw new Error(JSON.stringify(result));
```

成功回执不等于实际移动。捕获前后几何，确认至少一个非根卡位置变化、全部 x/y 有限、尺寸保持 630×880，并逐组确认全部装饰与节点同位移。图文相对偏移误差应≤0.1。

支持增长模式：Radial、Right-facing、Left-facing、Right-Left、Up-facing、Down-facing、Up-Down。不同模式的空间分布需实测，不能声称全已验图。

## 播放、背面与验图

每卡一个 portrait frame，单独带 slideshow 连续 order 和非空 notes；额外一帧总览。frame 与卡片共享 group，重排后跟随位移。建议卡 frame 只比背景大 8 单位；总览不归任一卡片组。

重排后运行 `scripts/Sync Knowledge Card Frames.md` 同步卡 frame 与总览范围，并核对 frameId。缩放、手动拖动或并行操作可能改变成员关系，不能仅依赖旧 frameId。

背面写同文件真实 frame 自嵌入与逐卡解释；总体用 Mermaid mindmap 表示知识拆分，机制卡用 flowchart、sequenceDiagram 或 classDiagram 等复述正面关系。使用 vault API 只更新 Markdown back，完整保留 `# Excalidraw Data` 后的内容，禁止修改压缩数据。卡片模式不是 slides 工具自动段；需要自行维护卡片背面。

实际导出中，当前版本 CLI `area` 对负坐标/大总览可能裁切偏移；live selection 切换也可能存在异步延迟。发现空图或截断时，使用显式元素组的 EA `createPNG`（复制到 EA 临时元素，不改绘图），不依赖即时选择。导出后必须 Read 图片。

验收：卡数、分支数、树无环、唯一根、每卡尺寸、每组一个结构节点、真实绑定及反向引用、相对位移、自嵌入、Mermaid、播放与文字边界。frame ID 采用插件有效的 8 字符 ID，实际卡数与帧数按主题变化。
