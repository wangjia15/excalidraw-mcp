---
name: paper-zettel
description: 用卡片盒笔记法精读大语言模型（LLM）与计算机视觉（CV/VLM）论文：按三遍阅读法拆解论文，从 PDF 自动截取论文图表，把每个知识点做成以图形为主的卡片（标注过的论文原图、张量/注意力矩阵/模块堆叠/patch 网格/柱状图、手绘草图），整篇论文的思维导图和全部卡片放在同一个 Excalidraw 文档里（导图分支直接连到卡片，可用 Slideshow 逐卡演示），文档的 Markdown 面写文献笔记和每张卡的背面解读（含 Mermaid），存入用户的 Obsidian vault。生成用本插件的 Excalidraw MCP 工具，验图/精修用 Obsidian Excalidraw 原生 CLI。当用户说"精读这篇论文""把论文做成卡片""卡片盒/zettel/Zettelkasten 拆论文""论文卡片+思维导图""画个草图帮我理解 X（论文里的）"，或给出一篇 LLM/视觉论文（PDF、arXiv 号、链接）并希望在 Obsidian 里做精读笔记时使用。
---

# 论文卡片盒（paper-zettel）

一篇论文 = **一个卡片盒文档** `Papers/<KEY>/<KEY> 卡片盒.excalidraw.md`：

- **Excalidraw 面**：思维导图。根节点是论文，一级分支是问题/方法/结果/批判…，**叶子就是卡片本身**（16:9 带框卡片，分支线直接连到卡片）。Slideshow 先放全图概览帧，再按导图顺序逐张放卡片。
- **卡片正面**以图形为主：标注过的论文原图（红色编号圈和虚线框，对应右侧编号要点）、概念图（张量形状、注意力矩阵、模块堆叠、patch 网格、柱状图、模板图、手绘草图）。文字只有断言标题、≤5 条编号要点和一句结论。
- **Markdown 面**（翻面：命令面板 `Excalidraw: Toggle between Excalidraw and Markdown mode`）：文献笔记，然后 `## 卡片` 下每张卡一节（`### <ID> <标题>`、嵌入该卡帧图、`> [!note] 讲稿`（卡片 `notes`）、背面解读），由工具按 board 自动生成。点卡片背景会跳到它的那一节。
- 跨论文的永久卡放 `Zettel/`，每张一个文件（`obsidian_write_card`）。

## 0. 环境（每次开始先确认）

| 项 | 值 |
|---|---|
| Vault | 用户指定的论文 vault（绝对路径）。没指定时用 MCP 默认 vault（插件配置的 `OBSIDIAN_VAULT`）；两者都没有就问用户。下文 `<VAULT>` 指 vault 根目录，`<VNAME>` 指它在 Obsidian 里的名字（通常就是文件夹名） |
| 生成工具 | 本插件的 MCP 工具（名字以 `obsidian_` 结尾，如 `obsidian_write_paper_board`）。每次调用都传 `vault: "<VAULT>"` |
| 图表截取 | `python -I <本技能目录>/scripts/pdf_figures.py`（PyMuPDF；本技能目录 = 加载技能时显示的 Base directory） |
| 验证/精修 | `obsidian vault=<VNAME> obsidian-excalidraw-plugin:<命令>`（Windows 上不在 PATH 时用 `"$LOCALAPPDATA/Programs/Obsidian/Obsidian.com"`） |
| CLI 规则 | 第一次用 CLI 前跑 `schema` 看各命令的参数，见 [references/tools.md](references/tools.md) |

1. 如果找不到 `obsidian_write_paper_board`，提示用户检查插件是否启用（`/plugin`）并重启 Claude Code。
2. 跑一次 CLI `status`。返回 `ok:true, ready:true, vault:"<VNAME>"` 才能做验证步骤。Obsidian 没开或 vault 没打开时，只做生成，并在报告里写明"未经 Obsidian 渲染验证"。

## 1. 工作流

```
获取 PDF → 截取图表 → 三遍阅读 → 设计卡片(先选图形) → 写卡片盒 → 永久卡 → CLI 导出验图 → 精修 → 汇报
```

1. **获取论文**：PDF 放到 `Inbox/`（arXiv 用 `https://arxiv.org/pdf/<id>`）。用 Read 读 PDF（每次 ≤20 页）。
2. **定 KEY**：短、全大写、稳定，例如 `VIT`、`LLAMA3`、`DPO`、`SAM2`。目录见 [references/vault-layout.md](references/vault-layout.md)。
3. **截取图表**：`pdf_figures.py auto <pdf> <VAULT>/Papers/<KEY>/assets`，得到 `fig<N>.png`、`tab<N>.png` 和 `figures.json`。**每张要用的图都用 Read 看一遍**。输出里标 `MISSING` 的（例如正文环绕的侧边图）或截错的，用 `pages` 渲染整页，看图估计坐标后用 `crop` 补截。见 [references/tools.md](references/tools.md#截取论文图表)。
4. **三遍阅读 + 拆卡**：按 [references/reading-method.md](references/reading-method.md)。LLM 和 CV 论文各有一份精读清单，清单里的每个问题都要有着落：要么是一张卡，要么在文献笔记里写明"论文未说明"。
5. **设计卡片**：每张卡先想"用什么图讲清楚"，再写要点。论文的关键图表都要进卡片并解读：用 `marks`/`boxes` 圈出要看的位置，编号与要点一一对应。规格见 [references/card-spec.md](references/card-spec.md)。
6. **写卡片盒**：一次 `obsidian_write_paper_board` 写入全部卡片、导图和 Markdown 面。每张卡都写 `notes` 讲稿（[card-spec.md](references/card-spec.md)）。重新生成时用 `overwrite:true`；不传 `back` 时 `## 卡片` 上面的文献笔记保留，卡片各节按新 board 重新生成；不传 `properties` 时保留原值。
7. **永久卡**：跨论文复用的概念（如 KV Cache、Patch Embedding、RoPE、DPO 损失）放 `Zettel/`。先用 `obsidian_list_drawings dir="Zettel"` 查重；已有的就链接过去，并用 `obsidian_read_drawing withBack:true` 读出背面，追加"在 [[KEY]] 中的用法"后写回。没有的用 `obsidian_write_card` 新建。卡片盒里用 `[[Zettel/…|…]]` 链接。
8. **验证**：用 CLI 导出全图和至少 3 张代表卡（含一张论文原图卡）的 PNG，用 Read 看：文字溢出或重叠、标注圈是否落在正确位置、原图是否显示、图形是否太小。见 [references/tools.md](references/tools.md#验图)。
9. **精修**：标注位置不准、图太小这类问题，改 board JSON 后用 `overwrite:true` 重写。用户在 Obsidian 里手改过的，用 CLI `apply` 做局部修改，不要再覆盖整个文件。
10. **汇报**：卡片清单（ID、类型、标题、用了什么图）、文件路径、预览图路径、实际做过的检查、仍未验证的部分。

## 2. 核心原则（卡片盒）

- **一卡一义**：一张卡只讲一个可独立理解的观点。标题写成**断言句**（"÷√d 防止 softmax 饱和"），不要写成话题（"缩放因子"）。
- **图先于字**：每张卡至少一个图形（论文原图或概念图）。正面文字只有标题、≤5 条要点（每条 ≤ 25 字）和一句结论。解释、推导、引文都放到背面。
- **解读原图**：用论文原图时，要点要说"看哪里、看出什么"（例如"① 左侧阴影区：小数据时 BiT 领先"），不要复述图注。数值只用论文里的。
- **用自己的话**：背面的解释必须是转述，原文只放进引用块，并标出处（§、Fig.、Table、Eq.、页码）。
- **区分认知层级**：背面用 `事实`（原文明确写的）/ `推导`（由原文能推出的）/ `理解`（我的解读）/ `疑问`（未解决）标注，不确定的不要写成事实。
- **链接优先于分类**：每张卡在背面至少链接 1 张同论文卡片（`[[#VIT-M01 …]]`）和 1 个永久卡或其他论文，并写清关系（"改进自""对比""依赖""反例"）。
- **少而精**：一篇论文通常 10–20 张卡。先做最小可用的一组（问题、核心方法、关键实验、局限），用户要求时再加深。

## 3. 草图、公式与 Mermaid

- **概念图**优先用内置图形（`tensor`、`matrix`、`stack`、`patches`、`bars`、`template`），没有合适的再用 `sketch`（手绘元素）。用法见 [references/card-spec.md](references/card-spec.md#图形visual) 和 [references/sketching.md](references/sketching.md)。
- **公式**：正面需要渲染公式时，生成后用 CLI `apply` 的 `latex` 操作加上；背面直接写 `$...$`。
- **Mermaid**：只写在背面（每张卡的 `back` 或文献笔记）。规则见 [references/card-spec.md](references/card-spec.md#mermaid)。

## 4. 安全与边界

- 只写选定的 vault。路径一律用 vault 相对路径。
- 新建文件默认不覆盖。`overwrite:true` 只用于本技能自己生成的文件，覆盖前先读出原内容确认。
- 如果用户已经在 Obsidian 里手动改过卡片盒，不要用 MCP 覆盖（会整张重写），改用 CLI `apply` 做局部修改。
- CLI 写操作（`create`、`apply`、`export`）每次都用新的唯一 `requestId`。要检查返回的 `ok`、`mutation`、`persistence`，不要自动重试结果不确定的写操作，按 obsidian-excalidraw-cli 的恢复规则处理。
- 不要直接手工编辑 `.excalidraw.md` 里的压缩数据。
- 截图只在本地 vault 中用于个人阅读笔记。
