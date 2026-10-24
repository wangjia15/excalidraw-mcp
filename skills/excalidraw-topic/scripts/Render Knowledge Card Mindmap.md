/*
# Render Knowledge Card Mindmap

Input utils.input = {title, growthMode?, cards:[{id,parent,title,category,caption,
  description,analogy,check,detail,visual:'pipeline'|'hub'|'compare'|'decision',steps:string[]}]}
Replaces the active drawing through EA, with 630x880 portrait cards and a Builder-compatible tree.
One structural background per unique group. Decoration and its portrait playback frame share that group.
Tree arrows bind only backgrounds and carry isBranch. This script never edits compressed Markdown.
*/
const spec = utils.input?.specPath ? JSON.parse(await app.vault.adapter.read(utils.input.specPath)) : utils.input;
if (!spec?.cards?.length) throw new Error('cards is required');
const cards = spec.cards;
const keys = new Set(cards.map(c => c.id));
if (keys.size !== cards.length || cards.filter(c => !c.parent).length !== 1) throw new Error('Exactly one root and unique card IDs required');
for (const c of cards) {
  if (c.parent && !keys.has(c.parent)) throw new Error('Missing parent: ' + c.parent);
  if (!c.title || !c.description || !c.steps?.length) throw new Error('Incomplete card: ' + c.id);
  const seen = new Set([c.id]); let p = c.parent;
  while (p) { if (seen.has(p)) throw new Error('Cycle in card tree'); seen.add(p); p = cards.find(v => v.id === p).parent; }
}
const original = ea.getViewElements().filter(e => !e.isDeleted);
ea.clear();
ea.copyViewElementsToEAforEditing(original);
for(const old of original)ea.getElement(old.id).isDeleted=true;
ea.style.fontFamily = 2;
ea.style.roughness = 0;
ea.style.strokeWidth = 2;
ea.style.fillStyle = 'solid';
ea.style.strokeStyle = 'solid';
const W = 630, H = 880;
const colors = {'主题':['#72521b','#fff2ce'], '入口':['#25648c','#e9f4fb'], '上下文':['#765aa5','#f2edfa'], '任务':['#258166','#e9f6ef'], '交付':['#a65b25','#fff0e3']};
const root = cards.find(c => !c.parent);
const branches = cards.filter(c => c.parent === root.id);
const locations = new Map([[root.id, {x:0,y:0}]]);
const half=Math.ceil(branches.length/2);
for(const side of [1,-1]){
  const subset=side===1?branches.slice(0,half):branches.slice(half);
  const spans=subset.map(b=>Math.max(1,cards.filter(c=>c.parent===b.id).length)*1120+500);
  let cursor=-spans.reduce((a,b)=>a+b,0)/2;
  subset.forEach((b,i)=>{const center=cursor+spans[i]/2;cursor+=spans[i];locations.set(b.id,{x:side*1400,y:center});const children=cards.filter(c=>c.parent===b.id);children.forEach((c,j)=>locations.set(c.id,{x:side*2800,y:center+(j-(children.length-1)/2)*1120}));});
}
for (const c of cards) {
  if (!locations.has(c.id)) {
    const p = locations.get(c.parent);
    locations.set(c.id,{x:p.x+1100,y:p.y});
  }
}
const report = [];
const nodeIds = new Map();
const frames = [];
const allCardElements = [];
for (let index=0; index<cards.length; index++) {
  const c = cards[index], pos = locations.get(c.id);
  const x=pos.x,y=pos.y;
  const gid='kg'+String(index).padStart(6,'0');
  const fid='kf'+String(index).padStart(6,'0');
  const [accent,tint] = colors[c.category] || ['#25648c','#e9f4fb'];
  const ink='#253647';
  const remember=id=>{const e=ea.getElement(id);e.groupIds=[gid];e.frameId=fid;e.customData={...e.customData,topicCardId:c.id,topicCardRole:'decoration'};allCardElements.push(id);return id;};
  const rect=(dx,dy,w,h,fill,stroke=accent)=>{
    ea.style.strokeColor=stroke;ea.style.backgroundColor=fill;
    const id=remember(ea.addRect(x+dx,y+dy,w,h));ea.getElement(id).roundness={type:3};return id;
  };
  const wrap=(text,width,fs)=>{
    ea.style.fontSize=fs;
    return text.split('\n').flatMap(line=>{const rows=[];let out='';for(const ch of line){if(out && ea.measureText(out+ch).width>width){if(/[，。！？；：、）】]/.test(ch)){const last=out.slice(-1);rows.push(out.slice(0,-1));out=last+ch;}else{rows.push(out);out=ch;}}else out+=ch;}rows.push(out);return rows;}).join('\n');
  };
  const text=(dx,dy,label,fs=26,color=ink,width=566,center=false)=>{
    ea.style.fontSize=fs;ea.style.strokeColor=color;ea.style.backgroundColor='transparent';
    const value=wrap(label,width,fs);
    const id=remember(ea.addText(x+dx,y+dy,value));
    const e=ea.getElement(id);if(center)e.x=x+dx+(width-e.width)/2;
    return id;
  };
  const line=(pts,stroke=accent,width=2)=>{
    ea.style.strokeColor=stroke;ea.style.backgroundColor='transparent';ea.style.strokeWidth=width;
    const id=remember(ea.addLine(pts.map(([a,b])=>[x+a,y+b])));ea.style.strokeWidth=2;return id;
  };
  const arrow=(a,b)=>{
    line([a,b]);const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len;
    line([[b[0]-ux*10-uy*5,b[1]-uy*10+ux*5],b,[b[0]-ux*10+uy*5,b[1]-uy*10-ux*5]]);
  };
  const smallNode=(dx,dy,w,h,label)=>{rect(dx,dy,w,h,'#ffffff');const tid=text(dx+7,dy+(h-25)/2,label,20,ink,w-14,true);return tid;};
  const bg=rect(0,0,W,H,'#f0dca0','#a88132');
  const node=ea.getElement(bg);
  node.customData={topicCardId:c.id,topicCardRole:'node',mindmapOrder:index,parentTopicId:c.parent,cardWidth:W,cardHeight:H};
  if (!c.parent) Object.assign(node.customData,{growthMode:spec.growthMode || 'Right-Left',autoLayoutDisabled:false});
  nodeIds.set(c.id,bg);
  rect(12,12,606,856,'#fffdf5','#e6ce8c');
  let titleSize=36;while(titleSize>24 && ea.measureText(c.title).width*(titleSize/ea.style.fontSize)>566)titleSize-=2;
  text(30,38,c.title,titleSize,ink,570,true);
  text(30,98,`${c.category}  /  知识卡 ${String(index+1).padStart(2,'0')}`,19,accent,570,true);
  rect(30,145,570,270,tint,'#d8e2e5');
  if(c.visual==='hub') {
    smallNode(210,170,210,58,c.steps[0]);
    const rest=c.steps.slice(1,4),n=rest.length;
    rest.forEach((s,j)=>{const bx=44+j*(542/n);arrow([315,228],[bx+(520/n)/2,310]);smallNode(bx,310,520/n,65,s);});
  } else if(c.visual==='compare') {
    smallNode(52,183,220,110,c.steps[0]);smallNode(358,183,220,110,c.steps[1]);
    arrow([280,238],[348,238]);if(c.comparisonNote)text(48,327,c.comparisonNote,22,accent,535,true);
  } else if(c.visual==='decision') {
    smallNode(48,231,145,70,c.steps[0]);
    ea.style.strokeColor=accent;ea.style.backgroundColor='#ffffff';remember(ea.addDiamond(x+235,y+215,155,105));
    text(243,248,c.steps[1],20,ink,139,true);smallNode(440,231,140,70,c.steps[2]);
    arrow([194,267],[232,267]);arrow([392,267],[437,267]);text(391,231,'是',18,accent,45,true);text(248,345,'否 → 暂停',20,accent,150,true);
  } else {
    const n=c.steps.length;
    if(n===4){
      c.steps.forEach((s,j)=>{const col=j<2?j:3-j;const dx=60+col*295,dy=177+Math.floor(j/2)*125;smallNode(dx,dy,215,65,s);});
      arrow([280,209],[349,209]);arrow([463,247],[463,294]);arrow([350,334],[283,334]);
    }else{
      const bw=150,gap=31,base=(630-(n*bw+(n-1)*gap))/2;
      c.steps.forEach((s,j)=>{smallNode(base+j*(bw+gap),237,bw,78,s);if(j<n-1)arrow([base+j*(bw+gap)+bw+3,276],[base+(j+1)*(bw+gap)-5,276]);});
    }
  }
  text(30,435,c.caption,22,accent,570,true);
  line([[30,480],[600,480]],'#dfd3b4',1.5);
  const fitText=(dx,dy,value,fs,maxH,width=566,color=ink)=>{let tid=text(dx,dy,value,fs,color,width);let e=ea.getElement(tid);while(e.height>maxH && fs>17){delete ea.elementsDict[tid];fs--;tid=text(dx,dy,value,fs,color,width);e=ea.getElement(tid);}if(e.height>maxH)throw new Error('Text block too long: '+c.id);return tid;};
  if(c.scene){
    text(32,491,'命令说明',18,accent);
    fitText(32,520,c.description,24,116);
    rect(30,647,570,108,tint,'transparent');
    text(44,655,'使用场景',18,accent,540);
    fitText(44,682,c.scene,22,67,540);
    text(32,767,'关联命令（虚线）',18,accent);
    fitText(32,795,(c.related||[]).join('  ·  ')||'沿实线查看本类命令',21,50);
    text(32,851,'63 : 88 · 使用前核对当前环境',16,'#7d7560',566,true);
  }else{
    text(32,500,'核心说明',19,accent);
    fitText(32,535,c.description,27,139);
    rect(30,686,570,72,tint,'transparent');text(44,695,'对话类比',18,accent,540);
    fitText(44,721,c.analogy,22,32,540);
    fitText(32,784,'验收：'+c.check,22,52);
    text(32,841,'63 : 88  ·  原生配图  ·  可重排节点',17,'#7d7560',566,true);
  }
  const groupElements=allCardElements.filter(id=>ea.getElement(id)?.customData.topicCardId===c.id);
  const childText=groupElements.map(id=>ea.getElement(id)).filter(e=>e.type==='text');
  const overflow=childText.filter(e=>e.x<x || e.x+e.width>x+W || e.y<y || e.y+e.height>y+H);
  if(overflow.length)throw new Error('Text overflow: '+c.id);
  const frame={type:'frame',id:fid,x:x-40,y:y-40,width:710,height:960,angle:0,strokeColor:'#95a6ac',backgroundColor:'transparent',fillStyle:'solid',strokeWidth:1,strokeStyle:'solid',roughness:0,opacity:100,groupIds:[gid],frameId:null,index:null,roundness:null,seed:100+index,version:1,versionNonce:200+index,isDeleted:false,boundElements:null,updated:Date.now(),link:null,locked:false,name:`${String(index+1).padStart(2,'0')} ${c.title}`,customData:{topicCardId:c.id,topicCardRole:'frame',slideshow:{schemaVersion:2,kind:'frame',order:index+1,notes:c.detail}}};
  frames.push(frame);
  report.push({topicId:c.id,nodeId:bg,frameId:fid,groupId:gid,elements:groupElements.length,x,y});
}
const edges=[];
for(const c of cards.filter(c=>c.parent)){
  const p=ea.getElement(nodeIds.get(c.parent)),n=ea.getElement(nodeIds.get(c.id));
  const right=n.x>p.x;
  const a=[right?p.x+W:p.x,p.y+H/2],b=[right?n.x:n.x+W,n.y+H/2];
  ea.style.strokeColor=(colors[c.category]||colors['主题'])[0];ea.style.backgroundColor='transparent';ea.style.strokeWidth=5;
  const id=ea.addArrow([a,b],{startObjectId:p.id,endObjectId:n.id,endArrowHead:null});
  const e=ea.getElement(id);e.customData={isBranch:true,topicCardRole:'branch'};e.groupIds=[];e.frameId=null;e.roughness=0;
  for(const host of [p,n])host.boundElements=[...(host.boundElements||[]).filter(v=>v.id!==id),{id,type:'arrow'}];
  edges.push(id);
}
for(const f of frames)ea.elementsDict[f.id]=f;
const all=ea.getElements();
const minX=Math.min(...frames.map(f=>f.x))-100,minY=Math.min(...frames.map(f=>f.y))-100;
const maxX=Math.max(...frames.map(f=>f.x+f.width))+100,maxY=Math.max(...frames.map(f=>f.y+f.height))+100;
const overview={...frames[0],id:'kover001',x:minX,y:minY,width:maxX-minX,height:maxY-minY,groupIds:[],name:spec.title,customData:{topicCardRole:'overview',slideshow:{schemaVersion:2,kind:'frame',order:0,notes:'从中心主题进入四条分支。每张卡一个知识点，先看配图，再读说明。选中根卡，用 Mindmap Builder 的 Auto rearrange map 可重新排布。'}}};
ea.elementsDict[overview.id]=overview;
// Old elements were marked deleted before generating new card IDs; reused frame IDs remain active.
await ea.addElementsToView(false,true,true);
await ea.targetView.forceSave(true);
return {summary:`Knowledge cards: ${cards.length}, branches: ${edges.length}`,rootId:nodeIds.get(root.id),overviewId:overview.id,report};
