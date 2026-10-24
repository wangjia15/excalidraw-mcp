# Slash Commands 全命令知识卡实测

测试日期：2026-10-24。技能 `/excalidraw-topic` 已实际调用，主文档从 19 张入门卡扩展为完整命令知识图谱。

## 产物与覆盖

Vault：本地测试库 `course`，以下路径均相对此库。测试生成的讲义和预览未随插件分发。

主文档：`Excalidraw/Claude Slash Commands/05-Slash Commands 单文件可视化讲义.excalidraw.md`。

- 99 张命令卡：README 91 项（主表 81、捆绑技能 8、已移除项 2）和同目录任务模板 8 项。
- 17 张分类卡、1 张根卡，共 117 张卡；每张背景 630×880、63:88 竖版比例。打印物理尺寸另设。
- 116 条实线父子分支、149 条去重虚线关联。虚线表示配合、别名/同功能或历史替代，不能解释为自动调用。
- 命令卡正面有原生可编辑配图、说明、具体使用场景和关联命令；历史入口与模板身份有标注。
- 背面有分类目录、118 个真实 frame 自嵌入、逐卡中文说明与场景、双向关联跳转、原始说明和 118 段 Mermaid。
- 118 帧：总览加 117 张卡，order 0–117，notes 非空。

来源固定版本：`232591b2a8d916f9f76ff5e0a686edba1822355b`，用户指定的 [claude-howto 目录](https://github.com/luongnv89/claude-howto/tree/main/01-slash-commands)。场景与关联为教学整理，使用前以当前客户端、版本、账户和平台核对入口。

## 原生重排

使用已安装 `Excalidraw/Scripts/Downloaded/Mindmap Builder.md`，UI 版本 v26.10.13，Excalidraw 2.29.0。

每个背景是唯一结构节点，带 mindmapOrder；根带 growthMode。每卡独立 group 包含图文与 frame。父子箭头带 isBranch:true、绑定背景并有反向 boundElements。虚线不带 isBranch、不入卡片 group 或 frame，真实绑定双方背景；置于背景后，避免遮住正文。

添加虚线后实际执行 Right-Left 重排，116 张非根卡移动。对比磁盘快照，卡内图文相对背景位移误差≤0.1，全部几何有限，117 张背景尺寸正确。同步 frame 后，单卡 frame 只比背景大 8 单位，总览更新为完整卡片范围。

完整合并默认和已有 layoutSettings；只传 GAP_X/GAP_Y 会覆盖嵌套设置并可能产生 NaN。仅实测 Right-Left，不能宣称其他增长方向都已验图。

## 结构、图像与播放

保存后结构验证通过：3,311 个有效元素、117 张卡、116 条结构箭头、149 条虚线、118 帧、118 个自嵌入、118 段 Mermaid；覆盖完整，真实绑定及反向引用有效，文字边界合格，无残留 Mermaid 占位。

代表卡预览检查了长标题 `/fewer-permission-prompts`、代码审查、push-all 决策图与历史 pr-comments 卡。修正了换行后中文标点，并把虚线移至背景后。另检查了六张审查相关卡的紧凑关系预览；该预览临时重排以便阅读，不代表全图的原始位置。预览在 `预览/全命令知识卡/`。

当前 CLI area 对负坐标或巨大总览可能裁切偏移，live selection 切换也可能导出旧选择。使用 EA 临时复制明确元素并 createPNG，不改主图；整个大图不适合缩成可读的单张 PNG。

Slideshow 实际手动入口 `obsidian-excalidraw-plugin:Downloaded/Slideshow` 识别 frame 来源、118 张可见幻灯片，并验证下一页由 kf000000 切到 kf000001（索引 1 → 2）。未逐页播放全部卡。CLI script 的 executionSource 不是 manual，单纯脚本回执成功不会启动演示；测试时普通线条被误建成单页来源，已清理其 slideshow metadata。结束演示时退出流程出现停滞，已恢复工具栏、编辑模式与运行时控制器；未修改安装的 Slideshow 脚本。

此前 19 卡版已切 Markdown 阅读模式检查真实嵌入与 Mermaid；扩展版完成全部 118 个引用的结构核验，未逐一视觉检查所有嵌入。

## 复用

```text
/excalidraw-topic 根据资料生成全部命令的63:88图文卡，加入具体使用场景和关联命令，用实线分类、虚线关联，兼容Mindmap Builder重排
```

大规格写到 vault JSON 并传 specPath；渲染树后运行 Connect Related Knowledge Cards，再重排、Sync Knowledge Card Frames 和保存核验。关联脚本用于首次追加，重复运行前须按现有关系去重。

本次未实际执行 Git 提交、推送、创建 PR、外部评论或部署，未安装额外插件。商品筛选与性能讨论为教学案例，没有虚构项目测试或加速结果。
