# Vault 结构（I:\obsidiannote\paper-zettel）

```
Inbox/                              待读 PDF、临时摘录
Papers/<KEY>/
  <KEY> 卡片盒.excalidraw.md         一篇论文一个文档：导图 + 全部卡片（Excalidraw 面），文献笔记 + 每卡背面（Markdown 面）
  assets/                           pdf_figures.py 截取的 fig<N>.png / tab<N>.png / figures.json
  sketches/<名称>.excalidraw.md      复杂的独立草图（可作为 figure 的 path 嵌入卡片）
  _preview/                         CLI 导出的验图 PNG（可删）
Zettel/<主题>.excalidraw.md          永久卡（跨论文概念，obsidian_write_card，单文件正反面）
Index/<领域> 地图.excalidraw.md       领域地图：链接各论文卡片盒和永久卡
_cli/                               CLI 请求 JSON（apply/export 的 input 文件）
theme/                              配色主题 CSS
Excalidraw/Scripts/Downloaded/      Slideshow 与 Mindmap Builder 脚本
```

## 约定

- 文献笔记写在卡片盒的 Markdown 面（`obsidian_write_paper_board` 的 `back` 参数），不再单独建 `<KEY>.md`。
- 其他笔记链接一篇论文：`[[Papers/VIT/VIT 卡片盒.excalidraw|ViT]]`；链接某张卡：`[[Papers/VIT/VIT 卡片盒.excalidraw#VIT-M01 把图像切成 16×16 patch 当作词]]`；嵌入某张卡的图：`![[Papers/VIT/VIT 卡片盒.excalidraw#^frame=<frameId>|900]]`（frameId 可从卡片盒 Markdown 面里抄）。
- `assets/` 里的截图是生成卡片的输入，重新截取前先确认没有被其他卡片引用的手工补截图（`crop` 生成的）会被覆盖。
