# 无 Extras 的原生绘图路线

测试发现 Excalidraw 2.29.0 的 `ea.addMermaid` 需要 Excalidraw Extras。CLI status 中 converter:true 只表示 API 存在，不能证明可转换。已有 Extras 时可用 Mermaid converter；没有时直接绘图，背面仍保留 Mermaid。

## 运行方法

将已读取的 `scripts/Render Native Diagram Slots.md` 放进目标库唯一脚本名。先通过 CLI inspect 找到带 `customData.mermaid` 的占位框真实 ID，然后逐一提供图形计划。

```json
{
  "apiVersion":1,
  "requestId":"topic-native-example-01",
  "path":"主题/讲义.excalidraw.md",
  "script":"Excalidraw/Scripts/Render Topic Native Diagrams.md",
  "trusted":true,
  "args":{
    "diagrams":[{
      "placeholderId":"从 inspect 返回取真实 ID",
      "kind":"graph",
      "nodes":[
        {"id":"a","label":"输入","x":0,"y":60,"w":170,"h":70},
        {"id":"b","label":"结果","x":350,"y":60,"w":170,"h":70}
      ],
      "edges":[{"from":"a","to":"b","label":"处理"}]
    }]
  }
}
```

所有 x/y/w/h 在该图自己的局部坐标系中，脚本按占位框等比缩放。不要把已有 frame 的绝对坐标加进节点坐标。

节点 `kind` 为 box（默认）、decision（菱形）或 class（带隔线的 UML 类框）。class 的 members 为中文职责或属性数组，类图若仅为教学概念模型应明确标示。

边可加 fromSide/toSide（left/right/top/bottom）及 dashed。箭头绑定到真实形状，文字用单独标签。不宜把连线文字放到相邻节点内部。

时序图：

```json
{
  "placeholderId":"实际占位ID",
  "kind":"sequence",
  "participants":[{"id":"u","label":"用户"},{"id":"a","label":"助手"}],
  "messages":[
    {"from":"u","to":"a","label":"任务与资料"},
    {"from":"a","to":"u","label":"结果与证据","reply":true}
  ]
}
```

图形语义必须与背面 Mermaid 对应。脚本不解析任意 Mermaid，不应把它当通用编译器。state/ER 等特殊图可直接原生绘制或在有依赖时转内嵌 SVG，并说明可编辑性。

## 验收

report 每项包含元素数、scale、minFont。minFont <16 时属于需要修复的字号问题；缩短标签或降低局部布局高度，或用 CLI apply 提高小标签字号与尺寸并核对边界。

脚本完成回执可能 persistence:unknown；必须 read source=disk 与 export source=disk 才能确认最终内容。重跑脚本只能处理仍存在的占位框；已转换框不再存在，不能盲目重放。
