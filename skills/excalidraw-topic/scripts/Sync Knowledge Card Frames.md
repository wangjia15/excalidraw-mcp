/* Sync portrait card playback frames and overview after a Mindmap Builder relayout. */
const elements=ea.getViewElements().filter(e=>!e.isDeleted);
const nodes=elements.filter(e=>e.customData?.topicCardRole==='node');
if(!nodes.length)throw new Error('No knowledge card nodes');
for(const n of nodes)if(![n.x,n.y,n.width,n.height].every(Number.isFinite))throw new Error('Invalid card geometry');
const frames=elements.filter(e=>e.type==='frame'&&e.customData?.topicCardRole==='frame');
const overview=elements.find(e=>e.customData?.topicCardRole==='overview');
ea.clear();ea.copyViewElementsToEAforEditing([...frames,...(overview?[overview]:[])]);
for(const f of frames){const n=nodes.find(e=>e.customData.topicCardId===f.customData.topicCardId);if(!n)throw new Error('Orphan card frame');Object.assign(ea.getElement(f.id),{x:n.x-4,y:n.y-4,width:n.width+8,height:n.height+8});}
if(overview){const x=Math.min(...nodes.map(n=>n.x))-120,y=Math.min(...nodes.map(n=>n.y))-120;Object.assign(ea.getElement(overview.id),{x,y,width:Math.max(...nodes.map(n=>n.x+n.width))-x+120,height:Math.max(...nodes.map(n=>n.y+n.height))-y+120});}
await ea.addElementsToView(false,true,true);await ea.targetView.forceSave(true);
return {cards:nodes.length,frames:frames.length,overview:overview?.id};
