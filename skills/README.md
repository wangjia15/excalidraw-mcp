# Claude Code 技能（Skills）

两个基于本 MCP 的 Claude Code 技能，和 MCP 一起打包成 Claude Code 插件 `excalidraw-obsidian`：

| 技能 | 做什么 | 主要工具 |
|---|---|---|
| [paper-zettel](paper-zettel/SKILL.md) | 卡片盒笔记法精读 LLM / 视觉论文：从 PDF 截取图表，每个知识点一张以图形为主的卡片，导图叶子就是卡片，Markdown 面写文献笔记和每卡背面 | `obsidian_write_paper_board`、`obsidian_write_card` |
| [boppps-lesson](boppps-lesson/SKILL.md) | 按 BOPPPS 生成教学 PPT（正面）和教案（背面）；Mermaid 图经插件内置 mermaid-to-excalidraw 转成原生图形并按 PPT 主题上色 | `obsidian_write_slides`（`mermaid`、`back`、`properties`） |

## 安装（Claude Code 插件）

本仓库本身就是一个插件市场，插件 `excalidraw-obsidian` 包含 MCP 服务器和这两个技能：

```
/plugin install excalidraw-obsidian --marketplace wangjia15/excalidraw-mcp
```

旧版 Claude Code 分两步：`/plugin marketplace add wangjia15/excalidraw-mcp`，再 `/plugin install excalidraw-obsidian@wangjia15-excalidraw`。

装好后技能名为 `excalidraw-obsidian:paper-zettel`、`excalidraw-obsidian:boppps-lesson`。插件运行仓库里已构建好的 `dist/index.js`，只需要 Node.js 18+，不用自己构建。

**指定 vault**：每次调用工具都可以传 `vault`（vault 文件夹的绝对路径，里面要有 `.obsidian/`），技能会按你说的 vault 传入，所以同一个服务器可以写多个 vault。想要一个默认 vault，就在启动 Claude Code 前设置环境变量 `OBSIDIAN_VAULT`。

**vault 里的文件**：第一次在某个 vault 里用时，技能会调用 `obsidian_install_vault_files`，把 `Mermaid to Excalidraw` 脚本装到 `Excalidraw/Scripts/`、主题 CSS 装到 `theme/`。它会先列出计划，你同意后才写入，已有文件一律不覆盖。不装主题也能用：vault 里没有 `theme/<名>.css` 时，用技能自带的 [`boppps-lesson/themes/`](boppps-lesson/themes)。

主题 CSS 来自 Marp 主题，只带了配色和版式，没有带字体文件（中文字体共约 180 MB）。MCP 只读配色，不需要字体；在 Marp 里用这些主题时，把字体放到 vault 的 `theme/fonts/` 下，或者靠 CSS 里的系统字体回退（微软雅黑、苹方等）。

### 不用插件

也可以只把技能复制到 `~/.claude/skills/`，再手动注册 MCP：

```bash
cp -r skills/paper-zettel skills/boppps-lesson ~/.claude/skills/
claude mcp add -s user excalidraw-obsidian -e OBSIDIAN_VAULT=/path/to/vault -- node /path/to/excalidraw-mcp/dist/index.js --stdio
```

## 依赖

- Obsidian + [Excalidraw 插件](https://github.com/zsviczian/obsidian-excalidraw-plugin)，vault 里装好 Slideshow（两个技能）和 Mindmap Builder（paper-zettel）脚本。
- 验图和 Mermaid 转换用 Excalidraw 插件的原生 CLI（`obsidian-excalidraw-plugin:<命令>`：`status`、`open`、`script`、`export`、`apply`…）。Obsidian 没开时只能生成，不能转换和验图。
- boppps-lesson：vault 里要有 `Excalidraw/Scripts/Mermaid to Excalidraw.md`（`obsidian_install_vault_files` 安装）。
- paper-zettel：Python 3 + PyMuPDF（`pip install pymupdf`），用于 `scripts/pdf_figures.py` 截取论文图表。

## 示例

- 课件 deck：[docs/examples/boppps-deck.json](../docs/examples/boppps-deck.json)
- 论文卡片盒 board：[docs/examples/paper-board.json](../docs/examples/paper-board.json)
- 完整说明：[docs/使用手册.md](../docs/使用手册.md) 第 11–13 节

对 Claude Code 说：

- "精读这篇论文 https://arxiv.org/abs/2010.11929，做成卡片盒" → paper-zettel
- "给软件工程大二学生做一讲 Spring MVC 请求流程的课件和教案，45 分钟" → boppps-lesson
- "用这份讲义 `inbox/第5章.pdf` 按 BOPPPS 备一节课" → boppps-lesson（以讲义为准）
