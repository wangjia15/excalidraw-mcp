/* Bind dashed crosslinks between related cards; these are not mindmap tree branches. */
const spec=JSON.parse(await app.vault.adapter.read(utils.input.specPath));
const original=ea.getViewElements().filter(e=>!e.isDeleted);
const nodes=original.filter(e=>e.customData?.topicCardRole==='node');
const map=new Map(nodes.map(e=>[e.customData.topicCardId,e]));
ea.clear();ea.copyViewElementsToEAforEditing(nodes);
const report=[];
for(const r of spec.relations||[]){
 const a=map.get(r.from),b=map.get(r.to);if(!a||!b)throw new Error('Missing related card');
 ea.style.strokeColor='#8797a5';ea.style.backgroundColor='transparent';ea.style.strokeWidth=1.5;ea.style.strokeStyle='dashed';ea.style.roughness=0;
 const sameColumn=Math.abs(a.x-b.x)<100;
 const side=a.x>=0?1:-1;
 const p=sameColumn?[a.x+(side>0?a.width:0),a.y+a.height*.72]:[a.x+a.width/2,a.y+a.height/2];
 const q=sameColumn?[b.x+(side>0?b.width:0),b.y+b.height*.72]:[b.x+b.width/2,b.y+b.height/2];
 const pts=sameColumn?[p,[p[0]+side*100,p[1]],[q[0]+side*100,q[1]],q]:[p,q];
 const id=ea.addArrow(pts,{startObjectId:a.id,endObjectId:b.id,startArrowHead:null,endArrowHead:null});
 const e=ea.getElement(id);Object.assign(e,{strokeStyle:'dashed',strokeWidth:1.5,opacity:55,groupIds:[],frameId:null});
 e.customData={topicCardRole:'related',relationType:r.label,relationReason:r.reason,fromTopicId:r.from,toTopicId:r.to};
 for(const n of [a,b]){const host=ea.getElement(n.id);host.boundElements=[...(host.boundElements||[]),{type:'arrow',id}];}
 report.push({id,from:r.from,to:r.to});
}
await ea.addElementsToView(false,true,true);
for(const r of report)ea.moveViewElementToZIndex(r.id,-1);
await ea.targetView.forceSave(true);
return {relations:report.length,report};
