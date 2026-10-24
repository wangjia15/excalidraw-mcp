# 单文件正反面讲义编写约定

默认使用 [card-mindmap.md](card-mindmap.md) 的 630×880 竖版知识卡与可重排 mindmap。本文以下 1920×1080 deck 约定仅用于用户明确请求的宽版演示；知识拆分、图文分工和事实依据同样适用于竖版卡片。

## 卡片与图的职责

卡片回答“这是什么、有什么用、记住什么”，图回答“谁和谁发生什么关系、按什么顺序、由什么条件改变”。至少一半内容 frame 用机制图，避免整张画布只有列表卡片。纯概念型主题也可以画因果链、决策或对照，不必套 UML。

每 frame 1920×1080，正文中文建议 26–34px；图中文字转换后不低于 16px。标题≤22汉字，卡片每条≤32汉字，建议 2–3 条；详细解释放 notes。图超过 8 个节点时先考虑拆分；时序图建议≤4个参与者、≤7条消息，类图建议≤4类。

## 图型选择

| 解释任务 | 首选图 | 画法要点 |
|---|---|---|
| 任务先后、选择分支 | flowchart / 活动图 | 箭头说明动作、条件和交付 |
| 多方如何协作 | sequenceDiagram | 参与者是真实角色，消息有具体内容 |
| 类型与职责依赖 | classDiagram | 明确这是概念模型还是源码实际类 |
| 一个实体如何变化 | stateDiagram-v2 | 只跟踪一个实体，转移有事件或条件 |
| 记录与关联 | erDiagram | 区分实体、字段与基数 |
| 工作移交 | 泳道或带角色的活动图 | 标明责任边界 |
| 非技术概念 | 流程、因果、对比、时间线 | 图表达可验证关系，不为了图而发明数据 |

flowchart、sequence、class 在当前插件通常转换为原生元素；state、ER 等可能为 SVG 图片。优先看实际 report 与 element types，不硬编码判断。

## 最小 deck 示例

```json
{
  "title":"主题名称",
  "titleFont":"sans",
  "bodyFont":"sans",
  "progress":false,
  "slides":[
    {
      "title":"用一个问题进入主题",
      "subtitle":"对象与学习目标",
      "bullets":["概念：说清术语","机制：看清关系","案例：检查理解"],
      "layout":"cards",
      "notes":"说明本主题的范围与阅读路径。案例为教学示例。"
    },
    {
      "title":"输入经过处理形成结果",
      "layout":"cards",
      "bullets":["输入：提供必要资料","输出：按约定检查结果"],
      "mermaid":{
        "code":"flowchart LR\n  A[输入] -->|处理| B[机制]\n  B -->|交付| C[结果]",
        "ratio":2.4,
        "caption":"输入与交付之间的机制"
      },
      "animate":false,
      "notes":"**如何读图**：从左到右看输入如何成为结果。\n\n**案例**：说明一次具体任务的输入与可观察结果。\n\n**验证**：检查结果是否满足初始要求。\n\n```mermaid\nflowchart LR\n  A[输入] -->|处理| B[机制]\n  B -->|交付| C[结果]\n```"
    }
  ]
}
```

第一页默认封面，不能把全部详细图都塞入第一页。内容页 `mermaid + cards` 会给图预留空间。过高图调整 ratio 或减短卡片；不要随意改整个场景坐标。

## 背面结构

```markdown
# 主题可视化讲义

一句概括主题与对象。

## 阅读与播放

正面按 frame 播放；背面直接复用对应 frame 图形。

## 阅读路线

- [[文档#^p02|先看概念]]
- [[文档#^p04|再看机制]]
- [[文档#^p08|练习案例]]

## 案例背景

条件、假设、参与者、约束与来源。

## 来源与限制

事实依据与教学示意的边界。
```

工具自动追加“幻灯片与讲稿”：`### PNN`、同文件 frame 嵌入、`^pNN`、讲稿。讲稿内 Mermaid fenced block 会被放进 Obsidian callout，前缀 `>` 是正常的 Markdown 引用结构。不要因没有裸 ` ```mermaid ` 行就误判 Mermaid 丢失。

## 辅助 CLI

```sh
python3 -I <技能目录>/scripts/ob_cli.py --vault course call status
python3 -I <技能目录>/scripts/ob_cli.py --vault course call open --params '{"path":"主题/讲义.excalidraw.md"}'
python3 -I <技能目录>/scripts/ob_cli.py --vault course call script --input <请求文件的本地路径>
python3 -I <技能目录>/scripts/ob_cli.py --vault course inspect --path '主题/讲义.excalidraw.md' --out /tmp/scene.json
python3 -I <技能目录>/scripts/ob_cli.py --vault course verify --path '主题/讲义.excalidraw.md' --out /tmp/report.json
```

`--input` 由包装器解析成参数后传递给原生 `json=`，适合安全引用、避免 shell 插值；大文件用 vault 内原生 `input=` 请求方式。原生 `export` 的场景像素限制以插件当前版本为准，超过限额时降低 scale，先按 `area` 导出局部。
