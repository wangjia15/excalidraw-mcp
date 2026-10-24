/*
# Render Native Diagram Slots

Render explicitly supplied nodes/edges or sequence participants/messages into existing Mermaid
placeholder slots, using only installed ExcalidrawAutomate shape APIs. No Mermaid parser is implemented.
The caller supplies a diagram plan preserving the same relationships as the retained Mermaid source.
utils.input = {diagrams:[{placeholderId, kind:'graph'|'sequence', nodes?, edges?, participants?, messages?}]}.
Graph nodes: {id,label,x,y,w?,h?,kind?:'box'|'decision'|'class',members?:string[]} in a 1000x260 design space.
Edges: {from,to,label?,fromSide?,toSide?,dashed?}. Sequence: participants[{id,label}], messages[{from,to,label,reply?}].
Existing drawing data is only changed through EA copy/edit/add/save, never by editing compressed Markdown.
*/
const plans = utils.input?.diagrams;
if (!Array.isArray(plans) || !plans.length) throw new Error('diagrams is required');
const report = [];
const original = ea.getViewElements().filter(e => !e.isDeleted);
for (const plan of plans) {
  const ph = original.find(e => e.id === plan.placeholderId);
  if (!ph?.customData?.mermaid) throw new Error('Missing placeholder: ' + plan.placeholderId);
  ea.clear();
  const style = ph.customData.mermaidStyle || {};
  const ink = style.text || '#35495e';
  const edgeInk = style.line || '#52657c';
  const stroke = style.node?.stroke || '#2f6fb5';
  const fill = style.node?.fill || '#e8f1fb';
  ea.style.fontFamily = 2;
  ea.style.fontSize = 22;
  ea.style.roughness = 0;
  ea.style.strokeWidth = 1.5;
  ea.style.strokeStyle = 'solid';
  ea.style.fillStyle = 'solid';
  const remember = id => {
    const e = ea.getElement(id);
    e.frameId = ph.frameId;
    e.customData = {...e.customData, topicDiagram:plan.kind, sourcePlaceholder:ph.id};
    return id;
  };
  const text = (cx,y,label,fs=22) => {
    ea.style.fontSize=fs;ea.style.strokeColor=ink;ea.style.backgroundColor='transparent';
    const id=remember(ea.addText(0,y,label));
    const e=ea.getElement(id);e.x=cx-e.width/2;
    return id;
  };
  const line = (points,dashed=false) => {
    ea.style.strokeColor=edgeInk;ea.style.backgroundColor='transparent';
    const id=remember(ea.addLine(points));
    ea.getElement(id).strokeStyle=dashed?'dashed':'solid';
    return id;
  };
  const node = n => {
    const w=n.w||158,h=n.h||(n.kind==='class'?104:66);
    ea.style.strokeColor=stroke;ea.style.backgroundColor=fill;
    const id=remember(n.kind==='decision'?ea.addDiamond(n.x,n.y,w,h):ea.addRect(n.x,n.y,w,h));
    const box=ea.getElement(id);
    box.roundness=n.kind==='class'?null:{type:3};
    const tid=text(n.x+w/2,n.y+(n.kind==='class'?12:(h-26)/2),n.label,22);
    if(n.kind!=='class'){
      ea.getElement(tid).containerId=id;
      box.boundElements=[...(box.boundElements||[]),{id:tid,type:'text'}];
    } else {
      line([[n.x,n.y+42],[n.x+w,n.y+42]]);
      text(n.x+w/2,n.y+58,(n.members||[]).join('\n'),18);
    }
    return {...n,w,h,actualId:id};
  };
  const side = (n,s) => s==='left'?[n.x,n.y+n.h/2]:s==='top'?[n.x+n.w/2,n.y]:s==='bottom'?[n.x+n.w/2,n.y+n.h]:[n.x+n.w,n.y+n.h/2];
  if(plan.kind==='sequence'){
    const pts=plan.participants||[];
    const spacing=240,offset=110;
    const actors={};
    pts.forEach((p,i)=>{
      const x=offset+i*spacing;
      actors[p.id]={x,y:24};
      node({id:p.id,label:p.label,x:x-75,y:0,w:150,h:52});
      line([[x,58],[x,340]],true);
    });
    (plan.messages||[]).forEach((m,i)=>{
      const a=actors[m.from],b=actors[m.to];
      if(!a||!b)throw new Error('Unknown sequence participant');
      const y=92+i*48;
      ea.style.strokeColor=edgeInk;
      const id=remember(ea.addArrow([[a.x,y],[b.x,y]],{endArrowHead:'arrow'}));
      ea.getElement(id).strokeStyle=m.reply?'dashed':'solid';
      text((a.x+b.x)/2,y-27,m.label,20);
    });
  } else {
    const nodes=Object.fromEntries((plan.nodes||[]).map(n=>[n.id,node(n)]));
    for(const edge of plan.edges||[]){
      const a=nodes[edge.from],b=nodes[edge.to];
      if(!a||!b)throw new Error('Unknown graph node');
      let from=edge.fromSide,to=edge.toSide;
      if(!from||!to){
        if(Math.abs((a.x+a.w/2)-(b.x+b.w/2))<Math.abs((a.y+a.h/2)-(b.y+b.h/2))){
          from=from||(b.y>a.y?'bottom':'top');to=to||(b.y>a.y?'top':'bottom');
        }else{from=from||(b.x>a.x?'right':'left');to=to||(b.x>a.x?'left':'right');}
      }
      const p=side(a,from),q=side(b,to);
      ea.style.strokeColor=edgeInk;
      const id=remember(ea.addArrow([p,q],{startObjectId:a.actualId,endObjectId:b.actualId,endArrowHead:'arrow'}));
      ea.getElement(id).strokeStyle=edge.dashed?'dashed':'solid';
      if(edge.label)text((p[0]+q[0])/2,(p[1]+q[1])/2-27,edge.label,18);
    }
  }
  const created=ea.getElements().filter(e=>!e.isDeleted);
  const xs=created.flatMap(e=>e.points?e.points.map(p=>e.x+p[0]):[e.x,e.x+e.width]);
  const ys=created.flatMap(e=>e.points?e.points.map(p=>e.y+p[1]):[e.y,e.y+e.height]);
  const minX=Math.min(...xs),minY=Math.min(...ys),w=Math.max(...xs)-minX,h=Math.max(...ys)-minY;
  const scale=Math.min((ph.width-32)/w,(ph.height-32)/h,2);
  const ox=ph.x+(ph.width-w*scale)/2,oy=ph.y+(ph.height-h*scale)/2;
  for(const e of created){
    e.x=ox+(e.x-minX)*scale;e.y=oy+(e.y-minY)*scale;
    e.width*=scale;e.height*=scale;
    if(e.points)e.points=e.points.map(p=>[p[0]*scale,p[1]*scale]);
    if(e.type==='text')e.fontSize*=scale;
    e.frameId=ph.frameId;
  }
  const labels=(ph.boundElements||[]).filter(e=>e.type==='text').map(e=>e.id);
  ea.copyViewElementsToEAforEditing(original.filter(e=>e.id===ph.id||labels.includes(e.id)));
  for(const id of [ph.id,...labels]){
    const element=ea.getElement(id);if(element)element.isDeleted=true;
  }
  await ea.addElementsToView(false,true,true);
  report.push({placeholderId:ph.id,ok:true,elements:created.length,minFont:Math.min(...created.filter(e=>e.type==='text').map(e=>e.fontSize)),scale});
}
ea.clear();
await ea.targetView.forceSave(true);
return {summary:`Native diagram slots: ${report.length}/${plans.length} rendered`,report};
